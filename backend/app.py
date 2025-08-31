from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_session import Session
import os
import pandas as pd
import requests
# from deepface import DeepFace
import logging  # Añadir esta importación

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'clave-secreta-por-defecto')
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Configuración CORS
frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:8000')
CORS(app, supports_credentials=True, origins=[frontend_url])

# Configuración de sesión
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_FILE_DIR'] = './flask_session'
os.makedirs(app.config['SESSION_FILE_DIR'], exist_ok=True)

# Inicializar la sesión
session_instance = Session()
session_instance.init_app(app)

# Cargar base de datos de vestidos
base_vestidos = pd.read_excel('base_vestidos.xlsx')
vestidos_formateados = "\n\n".join([
    f"DISEÑO: {row['DISEÑO']}\nDESCRIPCIÓN: {row['DESCRIPCION']}\nCOLORES: {row['COLORES']}\nMATERIAL: {row['MATERIAL']}\nORIGEN: {row['ORIGEN']}\nIMAGEN: {row['IMAGEN']}"
    for _, row in base_vestidos.iterrows()
])


def construir_prompt():
    return f"""
Eres Alzárea, asesora de estilo digital de un exclusivo ATELIER de moda artesanal. Tu tono debe ser cálido, elegante y profesional.

Base de vestidos disponibles:
{vestidos_formateados}

Sigue estrictamente este flujo:
1. Presentación inicial (solo una vez)
2. Preguntar si es invitado o quien celebra
3. Solicitar nombre
4. Pedir imagen y ofrecer alternativa si no la sube
5. Preguntar detalles del evento
6. Consultar preferencias de estilo
7. Preguntar preferencias de color
8. Recomendar vestido con accesorios
9. Ofrecer cita con experto
10. Finalizar con mensaje de colección cápsula

Incluye [MOSTRAR_IMAGEN: NOMBRE_DEL_DISEÑO] al recomendar prendas.
"""

# Middleware para manejar solicitudes OPTIONS


@app.before_request
def handle_options():
    if request.method == 'OPTIONS':
        response = jsonify()
        response.headers.add('Access-Control-Allow-Origin', frontend_url)
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add(
            'Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response


@app.route('/reiniciar', methods=['POST'])
def reiniciar_historial():
    session.clear()
    logger.info("Historial reiniciado")
    return jsonify({"status": "ok"})


@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        mensaje_usuario = data.get('mensaje', '').strip()

        if not mensaje_usuario:
            logger.warning("Mensaje vacío recibido")
            return jsonify({"reply": "Por favor, envía un mensaje válido."}), 400

        # Inicializar historial si no existe
        if 'historial' not in session:
            session['historial'] = [
                {"role": "system", "content": construir_prompt()}]
            logger.info("Nuevo historial de sesión creado")

        # Agregar características físicas si están disponibles
        if 'caracteristicas_usuario' in session and not any("Características físicas" in msg.get('content', '') for msg in session['historial']):
            caracteristicas = session['caracteristicas_usuario']
            descripcion = ", ".join(
                [f"{k}: {v}" for k, v in caracteristicas.items()])
            session['historial'].append({
                "role": "system",
                "content": f"Características físicas del usuario: {descripcion}"
            })
            logger.info(f"Características físicas añadidas: {descripcion}")

        # Agregar mensaje del usuario al historial
        session['historial'].append(
            {"role": "user", "content": mensaje_usuario})
        session.modified = True
        logger.info(
            f"Mensaje de usuario añadido al historial: {mensaje_usuario}")

        # Llamada a Groq API
        GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
        if not GROQ_API_KEY:
            logger.error("GROQ_API_KEY no está configurada")
            return jsonify({"reply": "Error de configuración del servidor."}), 500

        logger.info(
            f"Enviando solicitud a Groq API con {len(session['historial'])} mensajes")

        response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            json={
                "model": "llama3-70b-8192",
                "messages": session['historial'],
                "temperature": 0.7,
                "max_tokens": 1024
            },
            headers={
                'Authorization': f'Bearer {GROQ_API_KEY}',
                'Content-Type': 'application/json'
            },
            timeout=30
        )

        # Verificar si la respuesta de Groq es válida
        response.raise_for_status()
        respuesta_data = response.json()

        if 'choices' not in respuesta_data or len(respuesta_data['choices']) == 0:
            logger.error("Respuesta inesperada de Groq API: %s",
                         respuesta_data)
            return jsonify({"reply": "Lo siento, hubo un error inesperado. Por favor, intenta nuevamente."}), 500

        respuesta_ia = respuesta_data['choices'][0]['message']['content']
        logger.info("Respuesta recibida de Groq API")

        # Guardar respuesta en historial
        session['historial'].append(
            {"role": "assistant", "content": respuesta_ia})
        session.modified = True

        return jsonify({"reply": respuesta_ia})

    except requests.exceptions.RequestException as e:
        logger.error(f"Error de conexión con Groq API: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"Respuesta de error: {e.response.text}")
        return jsonify({"reply": "Lo siento, hubo un error al contactar la IA. Por favor, intenta nuevamente."}), 500
    except Exception as e:
        logger.error(f"Error inesperado: {str(e)}")
        return jsonify({"reply": "Lo siento, hubo un error inesperado. Por favor, intenta nuevamente."}), 500


@app.route('/subir-imagen', methods=['POST'])
def subir_imagen():
    try:
        if 'imagen' not in request.files:
            logger.warning("No se recibió ninguna imagen en la solicitud")
            return jsonify({"reply": "No se recibió ninguna imagen."}), 400

        imagen = request.files['imagen']
        image_bytes = imagen.read()
        logger.info("Imagen recibida correctamente")

        # Detectar características físicas
        # resultados = detect_facial_features(image_bytes)
        resultados = {"Silueta": "Media", "Piel": "Clara",
                      "Género": "Mujer", "Edad": 30, "Cabello": "Castaño"}
        session['caracteristicas_usuario'] = resultados
        logger.info(f"Características físicas establecidas: {resultados}")

        # Continuar con el flujo de conversación
        session['historial'].append(
            {"role": "user", "content": "Ya subí mi imagen"})
        session.modified = True

        # Llamar a Groq para continuar la conversación
        GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
        response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            json={
                "model": "llama3-70b-8192",
                "messages": session['historial'],
                "temperature": 0.7,
                "max_tokens": 1024
            },
            headers={
                'Authorization': f'Bearer {GROQ_API_KEY}',
                'Content-Type': 'application/json'
            },
            timeout=30
        )

        response.raise_for_status()
        respuesta_ia = response.json()['choices'][0]['message']['content']
        logger.info("Respuesta recibida de Groq API después de subir imagen")

        session['historial'].append(
            {"role": "assistant", "content": respuesta_ia})
        session.modified = True

        return jsonify({"reply": respuesta_ia})

    except Exception as e:
        logger.error(f"Error procesando imagen: {str(e)}")
        return jsonify({"reply": "Error al procesar la imagen. Por favor, intenta con otra imagen."}), 500


@app.route('/')
def health_check():
    logger.info("Solicitud de health check recibida")
    return jsonify({"status": "ok", "message": "Alzárea API is running"})


if __name__ == '__main__':
    logger.info("Iniciando servidor Flask")
    app.run(host='0.0.0.0', port=5000)

from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_session import Session
import os
import pandas as pd
import requests
import re
import time
from pathlib import Path

# Crear directorio para sesiones si no existe
session_dir = Path('./flask_session')
session_dir.mkdir(exist_ok=True)

# Configuración del directorio de sesiones
if os.environ.get('RAILWAY_ENVIRONMENT'):
    # En Railway, usa el directorio temporal
    session_dir = Path('/tmp/flask_session')
else:
    # En desarrollo, usa directorio local
    session_dir = Path('./flask_session')

session_dir.mkdir(exist_ok=True, parents=True)

app = Flask(__name__)

# Configuración básica de la aplicación
app.secret_key = os.environ.get('SECRET_KEY', 'clave-secreta-desarrollo')
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_FILE_DIR'] = str(session_dir)
app.config['SESSION_PERMANENT'] = False
app.config['SESSION_USE_SIGNER'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = os.environ.get(
    'FLASK_ENV') == 'production'
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Configuración CORS
frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:8000')
CORS(app, supports_credentials=True, origins=[frontend_url])

# Inicializar Flask-Session
Session(app)

# Carga la base de vestidos
try:
    base_vestidos = pd.read_excel('base_vestidos.xlsx')
    vestidos_formateados = "\n\n".join([
        f"DISEÑO: {row['DISEÑO']}\nDESCRIPCIÓN: {row['DESCRIPCION']}\nCOLORES: {row['COLORES']}\nMATERIAL: {row['MATERIAL']}\nORIGEN: {row['ORIGEN']}"
        for _, row in base_vestidos.iterrows()
    ])
except Exception as e:
    print(f"Error cargando base de vestidos: {e}")
    vestidos_formateados = "Base de vestidos no disponible"


def construir_prompt():
    return f"""
Eres Alzárea, asesora de estilo digital de un exclusivo ATELIER de moda artesanal. Tu tono debe ser:

- Cálido y elegante.
- Profesional pero cercano.
- Detallista sin ser técnico.
- Inspirador sin ser pretencioso.

**INSTRUCCIÓN CRÍTICA: DEBES HACER UNA SOLA PREGUNTA A LA VEZ. NUNCA HAGAS MÚLTIPLES PREGUNTAS EN UN MISMO MENSAJE.**

Palabras clave que debes usar:
- Pieza única - Colección cápsula - Materiales nobles.
- Hecho a mano - A medida - Detalle artesanal.

Palabras que nunca debes usar:
- Querida.
- Muñeca.
- Cariño

IMPORTANTE: Solo debes presentarte 1 vez, al inicio de la conversación.
Limítate a 35 palabras por respuesta excepto cuando des la descripción del vestido.

Nunca des explicaciones de por qué solicitas un dato a menos que el usuario te lo pregunte.
Ofrece las descripciones y materiales de las prendas completas y siempre haz mención de que todos los tejidos utilizados son reciclables y respetuosos con el entorno.

Base de vestidos y colores disponibles:
{vestidos_formateados}

IMPORTANTE: Cuando hagas la recomendación de una prenda, al final de la descripción incluye una línea así:
[MOSTRAR_IMAGEN: NOMBRE_DEL_DISEÑO]
Ejemplo:
[MOSTRAR_IMAGEN: CENEFA]
Cuando recomiendes más de un diseño como parte de un conjunto, incluye todos los nombres dentro de [MOSTRAR_IMAGEN: ...], separados por comas.
Ejemplo:
[MOSTRAR_IMAGEN: SOPHIE, LIRIA]

IMPORTANTE: Los diseños SOPHIE и LIRIA siempre se ofrecen juntos ya que son un conjunto.

Nunca uses frases genéricas como "hecho con amor". Enfócate en:
- Experiencia única - Proceso artesanal - Detalles que marcan la diferencia.

Asegúrate de saber siempre si es un invitado o quien celebra el evento.
Asegúrate de recibir una respuesta coherente a cada pregunta, si no es así vuelve a preguntar. 

**INSTRUCCIÓN CRÍTICA: HAZ SOLO UNA PREGUNTA A LA VEZ. ESPERA LA RESPUESTA DEL USUARIO ANTES DE HACER LA SIGUIENTE PREGUNTA.**

**INSTRUCCIÓN CRÍTICA: NUNCA HAGAS MÚLTIPLES PREGUNTAS EN UN MISMO MENSAJE. SI EL USUARIO NO RESPONDE COMPLETAMENTE, HAZ UNA SOLA PREGUNTA DE SEGUIMIENTO.**
"""


def limpiar_respuesta(respuesta):
    """Limpia la respuesta para eliminar múltiples preguntas"""
    # Buscar todas las preguntas en la respuesta
    preguntas = re.findall(r'[^.!?]*\?', respuesta)

    if len(preguntas) > 1:
        # Conservar solo la primera pregunta y el texto hasta ella
        primera_pregunta = preguntas[0]
        indice = respuesta.find(primera_pregunta) + len(primera_pregunta)
        respuesta = respuesta[:indice].strip()

        # Añadir instrucción para responder una pregunta a la vez
        respuesta += " Por favor, respóndeme esta pregunta primero."

    return respuesta


@app.route('/reiniciar', methods=['POST'])
def reiniciar_historial():
    session.clear()
    return jsonify({"status": "ok", "message": "Conversación reiniciada"})


@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    if not data or 'mensaje' not in data:
        return jsonify({"reply": "Lo siento, no recibí tu mensaje. ¿Podrías intentarlo de nuevo?"}), 200

    mensaje_usuario = data['mensaje'].strip()
    if not mensaje_usuario:
        return jsonify({"reply": "Parece que tu mensaje está vacío. ¿Podrías escribirme de nuevo?"}), 200

    # Inicializar historial si no existe
    if 'historial' not in session:
        session['historial'] = []
        # Agregar prompt del sistema solo al inicio
        session['historial'].append(
            {"role": "system", "content": construir_prompt()})

    # Agregar mensaje del usuario al historial
    session['historial'].append({"role": "user", "content": mensaje_usuario})

    # Limitar el historial para no exceder el límite de tokens
    if len(session['historial']) > 20:
        # Mantener el primer mensaje (system) y los últimos 19 mensajes
        session['historial'] = [session['historial'][0]] + \
            session['historial'][-19:]

    try:
        # Llamada directa a la API de Groq
        GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
        if not GROQ_API_KEY:
            return jsonify({"reply": "Error de configuración del servidor. Por favor, contacta al administrador."}), 500

        response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": session['historial'],
                "temperature": 0.3,
                "max_tokens": 800,
                "top_p": 0.9,
                "stop": None
            },
            headers={
                'Authorization': f'Bearer {GROQ_API_KEY}',
                'Content-Type': 'application/json'
            },
            timeout=30
        )

        response.raise_for_status()
        respuesta_data = response.json()

        if 'choices' not in respuesta_data or len(respuesta_data['choices']) == 0:
            return jsonify({"reply": "Lo siento, hubo un error inesperado. Por favor, intenta nuevamente."}), 200

        respuesta_ia = respuesta_data['choices'][0]['message']['content']

        if not respuesta_ia:
            return jsonify({"reply": "No recibí una respuesta válida. Por favor, intenta de nuevo."}), 200

        # Limpiar la respuesta para eliminar múltiples preguntas
        respuesta_ia = limpiar_respuesta(respuesta_ia)

        # Agregar respuesta al historial
        session['historial'].append(
            {"role": "assistant", "content": respuesta_ia})

        return jsonify({"reply": respuesta_ia})

    except requests.exceptions.Timeout:
        return jsonify({"reply": "La respuesta está tardando más de lo esperado. Por favor, intenta nuevamente."}), 200
    except requests.exceptions.RequestException as e:
        print(f"Error en la solicitud a Groq API: {str(e)}")
        return jsonify({"reply": "Estamos experimentando problemas técnicos. Por favor, intenta más tarde."}), 200
    except Exception as e:
        print(f"Error inesperado: {str(e)}")
        return jsonify({"reply": "Ha ocurrido un error inesperado. Por favor, intenta de nuevo."}), 200


@app.route('/subir-imagen', methods=['POST'])
def subir_imagen():
    if 'imagen' not in request.files:
        return jsonify({"reply": "No se recibió ninguna imagen."}), 400

    try:
        # Simular análisis de imagen (reemplazar con tu lógica real)
        resultados = {
            "Silueta": "Media",
            "Piel": "Clara",
            "Género": "Mujer",
            "Edad_estimada": "25-35",
            "Color_cabello": "Castaño"
        }

        # Guardar características en la sesión
        session['caracteristicas_usuario'] = resultados

        # Agregar características al historial si no están ya
        if 'historial' in session:
            descripcion = ", ".join(
                [f"{k}: {v}" for k, v in resultados.items()])
            # Buscar si ya hay características en el historial
            tiene_caracteristicas = any("Características físicas" in msg.get(
                "content", "") for msg in session['historial'] if msg.get("role") == "system")

            if not tiene_caracteristicas:
                session['historial'].append({
                    "role": "system",
                    "content": f"Características físicas detectadas del usuario: {descripcion}"
                })

        return jsonify({
            "reply": "Imagen recibida y analizada correctamente. Ya tengo tus características para ayudarte mejor.",
            "caracteristicas": resultados
        })

    except Exception as e:
        print(f"Error al procesar imagen: {str(e)}")
        return jsonify({"reply": "Recibí la imagen, pero hubo un problema al procesarla. ¿Podrías intentar con otra imagen?"})


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "message": "Servidor funcionando correctamente"})


@app.route('/')
def home():
    return jsonify({"message": "Backend de Alzárea funcionando correctamente"}), 200


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)

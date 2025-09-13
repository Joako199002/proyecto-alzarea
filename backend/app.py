from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
import os
import pandas as pd
import requests
from groq import Groq
from datetime import timedelta
from werkzeug.utils import secure_filename
from io import BytesIO
from PIL import Image
import base64
import detection
import httpx
import logging

logging.basicConfig(level=logging.INFO)

# Inicializa la aplicación Flask
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "iofaen55!!$scjasncskn")

# ✅ CONFIGURACIÓN PARA COOKIES DE SESIÓN COMPATIBLE CON NETLIFY + HTTPS
app.config.update(
    # Permite cookies en cross-origin (Netlify + Railway)
    SESSION_COOKIE_SAMESITE="None",
    SESSION_COOKIE_SECURE=True,       # Requiere HTTPS
    PERMANENT_SESSION_LIFETIME=timedelta(
        hours=12)  # Opcional: duración de la sesión
)

# Configuración para subir imágenes
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB máximo
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Configura CORS para permitir solicitudes desde distintos orígenes
frontend_urls = [
    'http://localhost:8000',
    'https://proyecto-alzarea.netlify.app',
    'https://proyecto-alzarea-production.up.railway.app'
]
CORS(app, supports_credentials=True, origins=frontend_urls)

# Diccionario global para almacenar el historial de conversación por cada sesión
# NOTA: Ahora usamos un almacenamiento en memoria en lugar de cookies para historiales largos
historial_conversaciones = {}
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
http_client = httpx.Client(proxies=None)  # fuerza que no pase proxies
client = Groq(api_key=GROQ_API_KEY, http_client=http_client)
# client = Groq(api_key=GROQ_API_KEY)

# Variable global para almacenar los vestidos cargados
vestidos_formateados = ""

# Carga la base de vestidos al inicio
try:
    base_vestidos = pd.read_excel('base_vestidos.xlsx')
    vestidos_formateados = "\n\n".join([  # Formatea la base de datos de vestidos
        f"DISEÑO: {row['DISEÑO']}\nDESCRIPCIÓN: {row['DESCRIPCION']}\nCOLORES: {row['COLORES']}\nMATERIAL: {row['MATERIAL']}\nORIGEN: {row['ORIGEN']}"
        for _, row in base_vestidos.iterrows()
    ])
except Exception as e:
    print(f"Error cargando base de vestidos: {e}")
    vestidos_formateados = "Base de vestidos no disponible"

# Definir el prompt base para el asistente
prompt_base = f"""
Eres Alzárea, asesora de estilo digital de un exclusivo ATELIER de moda artesanal. Tu tono debe ser:

- Cálido y elegante.
- Profesional pero cercano.
- Detallista sin ser técnico.
- Inspirador sin ser pretencioso.

Palabras clave que debes usar:
- Pieza única - Colección cápsula - Materiales nobles.
- Hecho a mano - A medida - Detalle artesanal.

Palabras que nunca debes usar:
- Querida.
- Muñeca.
- Cariño

IMPORTANTE:
- Solo debes presentarte 1 vez, al inicio de la conversación.  
- Nunca inventes vestidos: solo puedes recomendar diseños que estén en la base de datos proporcionada.  
- Cuando hagas la recomendación de una prenda (paso 7), al final de la descripción incluye una línea así:  
  [MOSTRAR_IMAGEN: NOMBRE_DEL_DISEÑO]  
  Ejemplo:  
  [MOSTRAR_IMAGEN: ORQUÍDEA BORDADA]  
  Cuando recomiendes más de un diseño como parte de un conjunto, incluye todos los nombres dentro de [MOSTRAR_IMAGEN: ...], separados por comas.  
  Ejemplo:  
  [MOSTRAR_IMAGEN: SOPHIE, LIRIA]  
- Los diseños SOPHIE y LIRIA siempre se ofrecen juntos como conjunto.  

Nunca uses frases genéricas como "hecho con amor". Enfócate en:
- Experiencia única - Proceso artesanal - Detalles que marcan la diferencia.  

Debes preguntar solo por lo que falte, y hacerlo de manera orgánica, como una conversación humana.  
No reinicies la conversación aunque el usuario entregue la información en desorden.  
No repitas datos que ya tengas (nombre, imagen, evento, estilo, colores).  
Si ya recibiste algo, avanza de manera natural al siguiente punto.  

El flujo ideal es este, pero puede darse en cualquier orden:  

1.- Presentación (solo al inicio).  
2.- Nombre del usuario (si no lo sabes aún) y pronombre de preferencia.  
3.- Imagen del usuario o, si no hay imagen, descripción física.  
4.- Detalles del evento (tipo, fecha, lugar).  
5.- Preferencias de estilo y cortes.  
6.- Preferencias de colores.  
7.- Recomendación completa de un vestido de la base de datos, con accesorios (zapatos, joyería, bolsos). Incluye la etiqueta [MOSTRAR_IMAGEN: ...].  
8.- Destacar bondades de la propuesta en relación al evento y características físicas. Ofrecer agenda con un experto.  
9.- Si se agenda, pedir teléfono, email y fecha tentativa.  
10.- Cierre elegante con opciones de personalización o diseño exclusivo.  

⚠️ Reglas clave:  
- Pregunta solo una cosa a la vez, con tono humano.  
- Nunca vuelvas al inicio del flujo aunque la información llegue en otro orden.  
- Usa únicamente los diseños de la base de datos cargada.  

Base de vestidos y colores disponibles:
{vestidos_formateados}
"""

# Ruta para servir imágenes estáticas


@app.route('/imagenes/<path:filename>')
def servir_imagenes(filename):
    # Intenta servir desde la carpeta 'imagenes' en el directorio actual
    imagenes_dir = os.path.join(os.path.dirname(
        os.path.abspath(__file__)), 'imagenes')
    if os.path.exists(imagenes_dir):
        return send_from_directory(imagenes_dir, filename)

    # Si no existe, intenta servir desde 'static/imagenes'
    static_imagenes_dir = os.path.join(os.path.dirname(
        os.path.abspath(__file__)), 'static', 'imagenes')
    if os.path.exists(static_imagenes_dir):
        return send_from_directory(static_imagenes_dir, filename)

    # Si no encuentra la imagen en ningún lugar, devuelve 404
    return "Imagen no encontrada", 404

# Ruta para reiniciar el historial


@app.route('/')
def home():
    return "Bienvenido a la API de Alzárea"


@app.route('/reiniciar', methods=['POST'])
def reiniciar_historial():
    session_id = request.json.get('sessionId')
    if session_id and session_id in historial_conversaciones:
        del historial_conversaciones[session_id]
    session.clear()
    return jsonify({"status": "ok"})

# Ruta para manejar el chat


@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    if not data or 'mensaje' not in data:
        return jsonify({"reply": "Lo siento, estamos teniendo algunos inconvenientes. Por favor, intenta nuevamente más tarde."}), 200

    mensaje_usuario = data['mensaje'].strip()
    session_id = data.get('sessionId', 'default_session')

    if not mensaje_usuario:
        return jsonify({"reply": "Lo siento, estamos teniendo algunos inconvenientes. Por favor, intenta nuevamente más tarde."}), 200

    # Inicializa historial si no existe (en memoria, no en sesión)
    if session_id not in historial_conversaciones:
        historial_conversaciones[session_id] = [
            {"role": "system", "content": prompt_base}
        ]

    historial = historial_conversaciones[session_id]
    caracteristicas = session.get('caracteristicas_usuario')

    # Agregar características físicas si están disponibles y no se han agregado aún
    if caracteristicas and not any("Características físicas detectadas" in h.get("content", "") for h in historial):
        descripcion = ", ".join(
            [f"{k}: {v}" for k, v in caracteristicas.items()])
        historial.append({
            "role": "system",
            "content": f"Características físicas detectadas del usuario: {descripcion}"
        })

    # Agregar el mensaje del usuario al historial
    historial.append({"role": "user", "content": mensaje_usuario})

    try:
        # Llama a la API de Groq para obtener una respuesta
        chat_completion = client.chat.completions.create(
            messages=historial,
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=300,
            top_p=1,
            stream=False
        )
        response = chat_completion.choices[0].message.content

        # Agregar la respuesta de la IA al historial
        historial.append({"role": "assistant", "content": response})

        # Limitar el tamaño del historial para evitar problemas de memoria
        if len(historial) > 20:  # Mantener solo los últimos 20 mensajes
            # Conservar el primer mensaje (system) y los últimos 19
            historial = [historial[0]] + historial[-19:]
            historial_conversaciones[session_id] = historial

        return jsonify({"reply": response})

    except Exception as e:
        print(f"Error al llamar a la API de Groq: {e}")
        return jsonify({"reply": "Lo siento, estamos teniendo algunos inconvenientes. Por favor, intenta nuevamente más tarde."}), 200

# Ruta para subir imagen y detectar características


@app.route('/subir-imagen', methods=['POST'])
def subir_imagen():
    print("📸 Imagen recibida en el backend")
    if 'imagen' not in request.files:
        return jsonify({"reply": "No se recibió ninguna imagen."}), 400

    imagen = request.files['imagen']
    session_id = request.form.get('sessionId', 'default_session')

    # Verificar que se haya seleccionado un archivo
    if imagen.filename == '':
        return jsonify({"reply": "No se seleccionó ningún archivo."}), 400

    try:
        # Leer y procesar la imagen
        image_bytes = imagen.read()

        # Guardar la imagen temporalmente (opcional, para debugging)
        filename = secure_filename(imagen.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        with open(filepath, 'wb') as f:
            f.write(image_bytes)

        # 🔍 Debug: Verifica tamaño de la imagen
        logging.info(f"📏 Imagen recibida: {len(image_bytes)} bytes")

        # Detectar características faciales
        try:
            resultados = detection.detect_facial_features(image_bytes)
            logging.info(f"✅ Resultados brutos detection: {resultados}")

        except Exception as det_err:
            logging.error(
                "❌ Falló detection.detect_facial_features", exc_info=True)
            return jsonify({"reply": "Error interno en la detección facial."}), 500

        # Reemplaza siempre las características previas en la sesión
        session['caracteristicas_usuario'] = resultados
        print("Características detectadas:", resultados)

        # Inicializa historial si no existe
        if session_id not in historial_conversaciones:
            historial_conversaciones[session_id] = [
                {"role": "system", "content": prompt_base}
            ]

        historial = historial_conversaciones[session_id]

        # Reemplaza o agrega la entrada de características físicas en el historial
        descripcion = ", ".join([f"{k}: {v}" for k, v in resultados.items()])
        caracteristicas_entry = {
            "role": "system",
            "content": f"Características físicas detectadas del usuario: {descripcion}"
        }

        # Elimina cualquier entrada anterior de características detectadas
        historial = [
            h for h in historial if "Características físicas detectadas" not in h.get("content", "")]
        historial.append(caracteristicas_entry)
        historial_conversaciones[session_id] = historial

        # Simular un mensaje del usuario para que la IA continúe el flujo
        historial.append({"role": "user", "content": "Ya subí mi imagen"})

        # Llama a la API para obtener una respuesta
        chat_completion = client.chat.completions.create(
            messages=historial,
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=300,
            top_p=1,
            stream=False
        )
        respuesta_ia = chat_completion.choices[0].message.content

        if respuesta_ia:
            historial.append({"role": "assistant", "content": respuesta_ia})
            return jsonify({"reply": respuesta_ia})

        else:
            return jsonify({"reply": "Imagen recibida y analizada. Ya tengo tus características para ayudarte mejor."})

    except Exception as e:
        logging.error("❌ Error inesperado en /subir-imagen", exc_info=True)
        return jsonify({"reply": "Recibí la imagen, pero hubo un problema al procesarla."})


# Ruta para servir imágenes subidas (opcional, para debugging)


@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# Ruta para verificar el estado del servidor


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"})

# Función para detección de características faciales


def detect_facial_features(image_bytes):
    try:
        # Usa tu función de detection.py
        resultados = detection.detect_facial_features(image_bytes)

        # Si no se detectó un rostro, devuelve valores por defecto
        if not resultados.get("Rostro Detectado", False):
            return {
                "tono_piel": "no detectado",
                "color_ojos": "no detectado",
                "color_cabello": "no detectado",
                "forma_rostro": "no detectado",
                "altura_aprox": "no detectado",
                "complexion": "no detectado",
                "ancho_hombros": "no detectado",
                "ancho_cadera": "no detectado"
            }

        # Mapeo completo con estimaciones para campos faltantes
        return {
            "tono_piel": resultados.get("Color de Piel", "no detectado"),
            # Función que podrías añadir
            "color_ojos": estimar_color_ojos(resultados),
            "color_cabello": resultados.get("Color de Cabello", "no detectado"),
            # Función que podrías añadir
            "forma_rostro": estimar_forma_rostro(resultados),
            # Basado en complexión u otros factores
            "altura_aprox": estimar_altura(resultados),
            "complexion": resultados.get("Silueta", "no detectado"),
            "ancho_hombros": resultados.get("ancho_hombros", "no detectado"),
            "ancho_cadera": resultados.get("ancho_cadera", "no detectado")
        }

    except Exception as e:
        print(f"Error en detección facial con detection.py: {e}")
        return {
            "tono_piel": "no detectado",
            "color_ojos": "no detectado",
            "color_cabello": "no detectado",
            "forma_rostro": "no detectado",
            "altura_aprox": "no detectado",
            "complexion": "no detectado",
            "ancho_hombros": "no detectado",
            "ancho_cadera": "no detectado"
        }


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)

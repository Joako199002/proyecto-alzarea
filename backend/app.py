from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
from flask_session import Session
import os
import pandas as pd
import requests
import re
import time
from pathlib import Path

# ==================== CONFIGURACIÓN DE FLASK (DE APP_V3.PY) ====================
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

frontend_urls = [
    'http://localhost:8000',
    'https://proyecto-alzarea.netlify.app',
    'https://proyecto-alzarea-production.up.railway.app'
]
CORS(app, supports_credentials=True, origins=frontend_urls)

# Inicializar Flask-Session
Session(app)

# ==================== COMPORTAMIENTO DEL CHATBOT (DE APP.PY) ====================
# Carga la base de vestidos
base_vestidos = pd.read_excel('base_vestidos.xlsx')
vestidos_formateados = "\n\n".join([
    f"DISEÑO: {row['DISEÑO']}\nDESCRIPCIÓN: {row['DESCRIPCION']}\nCOLORES: {row['COLORES']}\nMATERIAL: {row['MATERIAL']}\nORIGEN: {row['ORIGEN']}\nIMAGEN: {row['IMAGEN']}"
    for _, row in base_vestidos.iterrows()
])


def construir_prompt() -> str:
    prompt = f"""
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

IMPORTANTE: Solo debes presentarte 1 vez, al inicio de la conversacion
Limitate a 35 palabras por respuesta excepto cuando des la descripción del vestido

Nunca debes dar explicaciones de porque solicitas un dato a menos que el usuario te lo pregunte, esto incluye el nombre o cualquier caracteristica que solicites.
Ofrece las descripciones y materiales de las prendas completas y siempre haz mención de que todos los tejidos utilizados son reciclables y respetuosos
con el entorno.

Base de vestidos y colores disponibles:
{vestidos_formateados}

IMPORTANTE: Cuando hagas la recomendación de una prenda (paso 7), al final de la descripción incluye una línea así:
[MOSTRAR_IMAGEN: NOMBRE_DEL_DISEÑO]
Ejemplo:
[MOSTRAR_IMAGEN: ORQUÍDEA BORDADA]
Cuando recomiendes más de un diseño como parte de un conjunto, incluye todos los nombres dentro de [MOSTRAR_IMAGEN: ...], separados por comas.
Ejemplo:
[MOSTRAR_IMAGEN: SOPHIE, LIRIA]

IMPORTANTE: Los diseños SOPHIE y LIRIA siempre se ofrecen juntos ya que son un conjunto

Nunca uses frases genéricas como "hecho con amor". Enfócate en:
- Experiencia única - Proceso artesanal - Detalles que marcan la diferencia.

Asegurate de saber siempre si es un invitado o quien celebra el evento
Asegúrate de recibir una respuesta coherente a cada pregunta, si no es así vuelve a preguntar. 
Haz solo una pregunta a la vez.
El flujo que seguiras será:

1.- Presentación (solo al inicio de la conversacion) usando:

"¡Bienvenida a nuestro atelier digital!\n\n Mi nombre es Alzárea y estoy aquí para acompañarte mientras exploras nuestras colecciones.
Es un placer conocerte, ¿Hay algo que estés buscando en particular o te gustaría que te muestre algunas sugerencias?\n\n¿Buscas algo para
una ocasión especial o deseas explorar nuestra colección cápsula?"

Debes preguntar si es un invitado o es quien festeja el evento pero solo si no está implicito en la respuesta

2.- Después de recibir la respuesta, debes preguntar al usuario el nombre e inferir el sexo a partir de este.

3.- Si el usuario responde con algo que no es un nombre vuelve a preguntarlo, si ya conoces el nombre del usuario
debes pedirle que suba una imagen, usa las siguientes lineas como una base para hacer la solicitud:

"Si querés para que pueda asesorarte de forma más efectiva, puedes subir una imagen tuya reciente, que sea una imagen clara,
de cuerpo completo y con buena iluminación por favor.  Esto me ayudará a sugerirte las prendas que armonicen con tu estilo,
tu silueta y la ocasión."

Si el usuario no sube una imagen dale una alterntviva, algo como:

"Sin imagen también puedo ayudarte: me podrías describir tu color de piel, ojos, cabello, altura, y vamos construyendo desde ahí."

4.- Después de analizar la imagen debes preguntar por la información del evento, tipo de evento, fecha y ubicacion, tipo de lugar o espacio, y cualquier dato
que consideres necesario para ofrecer la mejor recomendación. Haz la pregunta de manera orgánica, no como un bot cualquiera, recuerda que eres
un asistente de un Atelier exclusivo

5.- Después de que el usuario responda al punto 4 pregunta por el estilo que le gusta y si hay algunas partes de su cuerpo que prefiere resaltar
o disimular así como si tiene preferencia por alguna silueta o corte de la prenda.

6.- Después de que el usuario responda al punto 5 debes preguntar si hay algún color que le haga sentir especialmente bien o alguno que
prefiera evitar.

7.- Con la información recopilada y los datos del analisis de la imagen ofrece una pieza de los vestidos disponibles describiendolo por completo
e incluye accesorios como zapatos, joyeria y bolsos que hagan juego con la prenda ofrecida, los accesorios puedes tomarlos de cualquier lado
ya que nuestro catálogo no cuenta con ellos. Muestra la imagen del vestido
No debes solicitar aprobación sobre los accesorios ni condicionar su presentación. Son parte de la experiencia de asesoramiento.
Justo después de hacer tu recomendación conecta la conversación con el siguiente punto.

8.- Enfatíza las bondades de tu recomendación con respecto al evento y sus características físicas pero házle saber que contamos con
una agenda disponible para que uno de nuestros expertos se contacte e juntos puedan ir elaborando un vestido adaptado a lo que está buscando.

9.- Si el cliente solicita una cita pídele numero de teléfono, e-mail, y una fecha tentativa que le sea conveniente para poder contactarlo.

10.- Para finalizar usa una linea como:

"Todo lo que te propuse forma parte de nuestra colección cápsula. Si quieres algo aún más personalizado, también puedo agendarte una
cita y podemos hacer los ajustes que necesites o Podemos diseñarte algo desde cero, exclusivamente para ti."
"""
    return prompt


def limpiar_respuesta(respuesta):
    """Limpia la respuesta para eliminar múltiples preguntas (de app_v3.py)"""
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


@app.route('/')
def home():
    return jsonify({
        "message": "Backend de Alzárea funcionando correctamente",
        "endpoints": {
            "health": "/health",
            "chat": "/chat",
            "reiniciar": "/reiniciar"
        }
    }), 200


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

    # Agregar características físicas si están disponibles y aún no se han incluido
    caracteristicas = session.get('caracteristicas_usuario')
    historial = session['historial']

    if caracteristicas and not any("Características físicas detectadas" in h.get("content", "") for h in historial):
        descripcion = ", ".join(
            [f"{k}: {v}" for k, v in caracteristicas.items()])
        historial.append({
            "role": "system",
            "content": f"Características físicas detectadas del usuario: {descripcion}"
        })

    # Agregar mensaje del usuario al historial
    historial.append({"role": "user", "content": mensaje_usuario})

    # Limitar el historial para no exceder el límite de tokens
    if len(historial) > 20:
        # Mantener el primer mensaje (system) y los últimos 19 mensajes
        historial = [historial[0]] + historial[-19:]

    try:
        # Llamada directa a la API de Groq (de app_v3.py)
        GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
        if not GROQ_API_KEY:
            return jsonify({"reply": "Error de configuración del servidor. Por favor, contacta al administrador."}), 500

        response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": historial,
                "temperature": 0.7,  # Ajustado según app.py
                "max_tokens": 1024,  # Ajustado según app.py
                "top_p": 1,  # Ajustado según app.py
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

        # Limpiar la respuesta para eliminar múltiples preguntas (de app_v3.py)
        respuesta_ia = limpiar_respuesta(respuesta_ia)

        # Agregar respuesta al historial
        historial.append({"role": "assistant", "content": respuesta_ia})
        session['historial'] = historial

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
    print("📸 Imagen recibida en el backend")
    if 'imagen' not in request.files:
        return jsonify({"reply": "No se recibió ninguna imagen."}), 400

    imagen = request.files['imagen']

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

        # Simular un mensaje del usuario para que la IA continúe el flujo
        session['historial'].append(
            {"role": "user", "content": "Ya subí mi imagen"})

        # Llamar a Groq para obtener respuesta después de subir la imagen
        GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
        response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": session['historial'],
                "temperature": 0.7,
                "max_tokens": 1024,
                "top_p": 1
            },
            headers={
                'Authorization': f'Bearer {GROQ_API_KEY}',
                'Content-Type': 'application/json'
            },
            timeout=15
        )

        response.raise_for_status()
        respuesta_data = response.json()
        respuesta_ia = respuesta_data['choices'][0]['message']['content']

        if respuesta_ia:
            session['historial'].append(
                {"role": "assistant", "content": respuesta_ia})
            return jsonify({
                "reply": respuesta_ia,
                "caracteristicas": resultados
            })
        else:
            return jsonify({
                "reply": "Imagen recibida y analizada. Ya tengo tus características para ayudarte mejor.",
                "caracteristicas": resultados
            })

    except Exception as e:
        print(f"Error al procesar imagen: {str(e)}")
        return jsonify({"reply": "Recibí la imagen, pero hubo un problema al procesarla. ¿Podrías intentar con otra imagen?"})

# Servir imágenes de vestidos


@app.route('/imagenes/<path:filename>')
def servir_imagen(filename):
    try:
        return send_from_directory('imagenes', filename)
    except FileNotFoundError:
        return jsonify({"error": "Imagen no encontrada"}), 404


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "message": "Servidor funcionando correctamente"})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)

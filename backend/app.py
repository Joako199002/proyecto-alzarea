from flask import Flask, request, jsonify, session
from flask_cors import CORS
import os
import requests
from groq import Groq

# Inicializa la aplicación Flask
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "iofaen55!!$scjasncskn")

# Configura CORS para permitir solicitudes desde distintos orígenes
frontend_urls = [
    'http://localhost:8000',
    'https://proyecto-alzarea.netlify.app',
    'https://proyecto-alzarea-production.up.railway.app'
]
CORS(app, supports_credentials=True, origins=frontend_urls)

# Diccionario global para almacenar el historial de conversación por cada sesión
historial_conversaciones = {}
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY)

# Definir el prompt base para el asistente
prompt_base = """
Eres un asistente de moda para Alzárea. Ayudas a los usuarios a encontrar vestidos y outfits adecuados. Sé amable y profesional.
"""

# Ruta para reiniciar el historial


@app.route('/reiniciar', methods=['POST'])
def reiniciar_historial():
    session.pop('historial', None)
    session.pop('caracteristicas_usuario', None)
    return jsonify({"status": "ok"})

# Ruta para manejar el chat


@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    if not data or 'mensaje' not in data:
        return jsonify({"reply": "Lo siento, estamos teniendo algunos inconvenientes. Por favor, intenta nuevamente más tarde."}), 200

    mensaje_usuario = data['mensaje'].strip()
    if not mensaje_usuario:
        return jsonify({"reply": "Lo siento, estamos teniendo algunos inconvenientes. Por favor, intenta nuevamente más tarde."}), 200

    # Inicializa historial si no existe
    if 'historial' not in session:
        session['historial'] = [{"role": "system", "content": prompt_base}]

    historial = session['historial']
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
            messages=[{"role": "system", "content": prompt_base}] + historial,
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=1024,
            top_p=1,
            stream=False
        )
        response = chat_completion.choices[0].message.content

        # Agregar la respuesta de la IA al historial
        historial.append({"role": "assistant", "content": response})
        session['historial'] = historial

        return jsonify({"reply": response})

    except Exception as e:
        print(f"Error al llamar a la API de Groq: {e}")
        return jsonify({"reply": "Lo siento, estamos teniendo algunos inconvenientes. Por favor, intenta nuevamente más tarde."}), 200

# Ruta para subir imagen y detectar características


@app.route('/subir-imagen', methods=['POST'])
def subir_imagen():
    if 'imagen' not in request.files:
        return jsonify({"reply": "No se recibió ninguna imagen."}), 400

    imagen = request.files['imagen']
    image_bytes = imagen.read()

    try:
        # Aquí debes incluir la lógica de detección de características
        # Asumiendo que tienes esta función definida
        resultados = detect_facial_features(image_bytes)
        session['caracteristicas_usuario'] = resultados

        # Inicializa historial si no existe
        if 'historial' not in session:
            session['historial'] = [{"role": "system", "content": prompt_base}]

        historial = session['historial']

        # Agregar características físicas si aún no están
        if resultados and not any("Características físicas detectadas" in h.get("content", "") for h in historial):
            descripcion = ", ".join(
                [f"{k}: {v}" for k, v in resultados.items()])
            historial.append({
                "role": "system",
                "content": f"Características físicas detectadas del usuario: {descripcion}"
            })

        # Simular un mensaje del usuario para que la IA continúe el flujo
        historial.append({"role": "user", "content": "Ya subí mi imagen"})

        # Llama a la API para obtener una respuesta
        chat_completion = client.chat.completions.create(
            messages=[{"role": "system", "content": prompt_base}] + historial,
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=1024,
            top_p=1,
            stream=False
        )
        respuesta_ia = chat_completion.choices[0].message.content

        if respuesta_ia:
            historial.append({"role": "assistant", "content": respuesta_ia})
            session['historial'] = historial
            return jsonify({"reply": respuesta_ia})
        else:
            return jsonify({"reply": "Imagen recibida y analizada. Ya tengo tus características para ayudarte mejor."})

    except Exception as e:
        print("Error al analizar imagen:", e)
        return jsonify({"reply": "Recibí la imagen, pero hubo un problema al procesarla."})

# Ruta para verificar el estado del servidor


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)

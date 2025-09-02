# app.py

# Importaciones necesarias
# Flask para la aplicación web, 'session' para manejar la sesión del usuario
from flask import Flask, request, jsonify, session
# Para manejar CORS (acceso entre diferentes orígenes)
from flask_cors import CORS
# Para acceder a variables de entorno (como la clave secreta y la API key)
import os
# Cliente para interactuar con la API de Groq (modelo de lenguaje tipo ChatGPT)
from groq import Groq

# Inicializa la aplicación Flask
app = Flask(__name__)

# Configura la clave secreta para que Flask pueda manejar las sesiones de los usuarios
# Esto es necesario para asegurar que Flask pueda usar cookies para almacenar las sesiones
app.secret_key = os.environ.get("SECRET_KEY", "tu_clave_secreta_aqui")

# Diccionario global para almacenar el historial de conversación por cada sesión (por `sessionId`)
historial_conversaciones = {}

# Obtiene la clave API de Groq desde una variable de entorno (esencial para autenticarte con la API de Groq)
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
# Crea una instancia del cliente de Groq utilizando la clave API
client = Groq(api_key=GROQ_API_KEY)

# Configura CORS para permitir solicitudes desde distintos orígenes (dominios) a la API
frontend_urls = [
    'http://localhost:8000',  # Para pruebas locales
    # Para el frontend desplegado en Netlify
    'https://proyecto-alzarea.netlify.app',
    # Para el frontend desplegado en Railway
    'https://proyecto-alzarea-production.up.railway.app'
]

# Habilita CORS para los dominios especificados
CORS(app, supports_credentials=True, origins=frontend_urls)

# Ruta para manejar el chat, acepta solicitudes POST y OPTIONS


@app.route('/chat', methods=['POST'])
def chat():
    # Obtiene los datos enviados en formato JSON desde el frontend
    data = request.json
    user_message = data.get('mensaje')  # Extrae el mensaje del usuario
    # Obtiene un ID de sesión o asigna uno por defecto
    session_id = data.get('sessionId', 'default_session')

    # Obtén el historial actual del usuario desde el diccionario global, o crea uno nuevo si no existe
    historial = historial_conversaciones.get(session_id, [])

    # Agrega el nuevo mensaje del usuario al historial
    historial.append({"role": "user", "content": user_message})

    try:
        # Llama a la API de Groq para generar una respuesta a partir del mensaje del usuario
        chat_completion = client.chat.completions.create(
            messages=[  # Conversación simulada que incluye mensaje del sistema y mensaje del usuario
                {
                    "role": "system",
                    "content": "Eres un asistente de moda para Alzárea. Ayudas a los usuarios a encontrar vestidos y outfits adecuados. Sé amable y profesional."
                }
                # Incluye todo el historial en el prompt (debe contener toda la conversación hasta el momento)
            ] + historial,
            model="llama-3.3-70b-versatile",  # El modelo de lenguaje que se utilizará
            # Grado de creatividad de las respuestas (0.7 es un valor intermedio)
            temperature=0.7,
            # Máximo número de tokens en la respuesta del modelo (una medida del tamaño de la respuesta)
            max_tokens=1024,
            top_p=1,  # Técnica de muestreo (probabilidad acumulada)
            stream=False,  # La respuesta no se enviará en modo streaming, sino en una sola respuesta
            stop=None,  # No se especifican tokens de parada
        )

        # Extrae la respuesta generada por el modelo
        response = chat_completion.choices[0].message.content

        # Agrega la respuesta de la IA al historial de la sesión
        historial.append({"role": "assistant", "content": response})

        # Guarda el historial actualizado en el diccionario global `historial_conversaciones`
        historial_conversaciones[session_id] = historial

        # Devuelve la respuesta en formato JSON al frontend, incluyendo el `sessionId` para mantener el contexto de la conversación
        return jsonify({
            "reply": response,
            "sessionId": session_id
        })

    except Exception as e:
        # Si ocurre un error al llamar a la API de Groq, se imprime el error en consola y se devuelve un mensaje de error al frontend
        print(f"Error calling Groq API: {e}")
        return jsonify({
            "reply": "Lo siento, estoy teniendo dificultades técnicas. Por favor, intenta de nuevo más tarde.",
            "sessionId": session_id
        }), 500  # Código HTTP 500 indica un error interno del servidor

# Ruta para reiniciar el historial de la conversación de un usuario específico


@app.route('/reiniciar', methods=['POST'])
def reiniciar_historial():
    # Obtiene el `sessionId` de la solicitud JSON (para saber cuál usuario reiniciar)
    # Si no se pasa, se asigna 'default_session'
    session_id = request.json.get('sessionId', 'default_session')

    # Elimina el historial para el `sessionId` especificado, si existe
    if session_id in historial_conversaciones:
        # Borra el historial del usuario
        del historial_conversaciones[session_id]

    # Devuelve una respuesta JSON confirmando que se reinició la conversación
    # Respuesta sencilla para confirmar que el historial fue eliminado
    return jsonify({"status": "ok"})

# Ruta para verificar el estado del servidor


@app.route('/health', methods=['GET'])
def health_check():
    # Devuelve un estado "ok" si el servidor está funcionando correctamente
    # Respuesta estándar para comprobar que la aplicación está funcionando
    return jsonify({"status": "ok"})


# Este bloque permite ejecutar la app directamente con Python (útil para desarrollo)
# También garantiza compatibilidad con servidores como Gunicorn en producción
if __name__ == '__main__':
    # Toma el puerto desde una variable de entorno (útil para plataformas como Heroku o Railway)
    # Si no se especifica, usa el puerto 8080 por defecto
    port = int(os.environ.get('PORT', 8080))

    # Ejecuta la aplicación Flask en el puerto especificado
    # Esto hace que la aplicación esté disponible en todas las interfaces de red disponibles
    app.run(host='0.0.0.0', port=port)

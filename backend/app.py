# app.py

# Importaciones necesarias
# Framework web ligero y funciones para manejar solicitudes y respuestas JSON
from flask import Flask, request, jsonify
# Para permitir solicitudes de distintos orígenes (CORS)
from flask_cors import CORS
# No se usa en el código actual, pero se importa (posiblemente para futuras integraciones)
import requests
import os  # Para acceder a variables de entorno
# Cliente para interactuar con la API de Groq (modelo de lenguaje tipo ChatGPT)
from groq import Groq

# Inicializa la aplicación Flask
app = Flask(__name__)

# Origenes permitidos
frontend_urls = [
    'http://localhost:8000',
    'https://proyecto-alzarea.netlify.app',
    'https://proyecto-alzarea-production.up.railway.app']

# Habilita CORS para que el frontend (aunque esté en otro dominio) pueda comunicarse con esta API
CORS(app, supports_credentials=True, origins=frontend_urls)

# Obtiene la clave API de Groq desde una variable de entorno
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

# Crea una instancia del cliente de Groq utilizando la clave API
client = Groq(api_key=GROQ_API_KEY)

# Ruta principal para el chatbot


# Define la ruta '/chat' que solo acepta solicitudes POST
@app.route('/chat', methods=['POST'])
def chat():
    # Obtiene los datos enviados en formato JSON desde el frontend
    data = request.json
    user_message = data.get('mensaje')  # Extrae el mensaje del usuario
    # Obtiene un ID de sesión o asigna uno por defecto
    session_id = data.get('sessionId', 'default_session')

    # Obtén el historial actual o crea uno nuevo si no existe
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
            ] + historial,  # Incluye todo el historial en el prompt,
            model="llama-3.3-70b-versatile",  # Modelo de lenguaje usado
            temperature=0.7,  # Grado de creatividad en la respuesta
            max_tokens=1024,  # Máximo número de tokens en la respuesta
            top_p=1,  # Técnica de muestreo (probabilidad acumulada)
            stream=False,  # La respuesta no se envía en streaming
            stop=None,  # No se especifican tokens de parada
        )

        # Extrae la respuesta generada por el modelo
        response = chat_completion.choices[0].message.content

        # Agrega la respuesta de la IA al historial
        historial.append({"role": "assistant", "content": response})

        # Guarda el historial actualizado en el diccionario global
        historial_conversaciones[session_id] = historial

        # Devuelve la respuesta en formato JSON al frontend
        return jsonify({
            "reply": response,
            "sessionId": session_id
        })

    except Exception as e:
        # En caso de error, se imprime el error en consola y se devuelve un mensaje de error al usuario
        print(f"Error calling Groq API: {e}")
        return jsonify({
            "reply": "Lo siento, estoy teniendo dificultades técnicas. Por favor, intenta de nuevo más tarde.",
            "sessionId": session_id
        }), 500  # Código HTTP 500 = error interno del servidor


# Ruta simple para verificar que el servidor está corriendo correctamente
# Ruta GET para verificar estado de la app
@app.route('/health', methods=['GET'])
def health_check():
    # Devuelve un estado "ok" si todo funciona
    return jsonify({"status": "ok"})


# Este bloque permite ejecutar la app directamente con Python (útil para desarrollo)
# También garantiza compatibilidad con servidores como Gunicorn en producción
if __name__ == '__main__':
    # Toma el puerto desde variable de entorno o usa 8080 por defecto
    port = int(os.environ.get('PORT', 8080))
    # Ejecuta la app en todas las interfaces de red disponibles
    app.run(host='0.0.0.0', port=port)

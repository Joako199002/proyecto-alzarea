# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from groq import Groq

app = Flask(__name__)
CORS(app)  # Permitir solicitudes desde tu frontend

# Configuración de Groq
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY)


@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_message = data.get('mensaje')
    session_id = data.get('sessionId', 'default_session')

    try:
        # Llamar a la API de Groq
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "Eres un asistente de moda para Alzárea. Ayudas a los usuarios a encontrar vestidos y outfits adecuados. Sé amable y profesional."
                },
                {
                    "role": "user",
                    "content": user_message
                }
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=1024,
            top_p=1,
            stream=False,
            stop=None,
        )

        response = chat_completion.choices[0].message.content

        return jsonify({
            "reply": response,
            "sessionId": session_id
        })

    except Exception as e:
        print(f"Error calling Groq API: {e}")
        return jsonify({
            "reply": "Lo siento, estoy teniendo dificultades técnicas. Por favor, intenta de nuevo más tarde.",
            "sessionId": session_id
        }), 500


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"})


# Este bloque es importante para que funcione con Gunicorn
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)

# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
import pandas as pd
import numpy as np
from groq import Groq
from collections import deque
import time

app = Flask(__name__)
CORS(app)  # Permitir solicitudes desde tu frontend

# Configuración de Groq
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY)

# Diccionario para almacenar historiales de conversación por sesión
conversation_histories = {}

# Tiempo de expiración para las sesiones (24 horas)
SESSION_EXPIRY = 24 * 60 * 60

# Carga la base de vestidos solo una vez al iniciar la app
try:
    base_vestidos = pd.read_excel('base_vestidos.xlsx')
    vestidos_formateados = "\n\n".join([
        f"DISEÑO: {row['DISEÑO']}\nDESCRIPCIÓN: {row['DESCRIPCION']}\nCOLORES: {row['COLORES']}\nMATERIAL: {row['MATERIAL']}\nORIGEN: {row['ORIGEN']}\nIMAGEN: {row['IMAGEN']}"
        for _, row in base_vestidos.iterrows()
    ])
except Exception as e:
    print(f"Error cargando base de vestidos: {e}")
    vestidos_formateados = "Base de vestidos no disponible"

# Prompt personalizado para el asistente
system_prompt = f"""
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
una agenda disponible para que uno de nuestros expertos se contacte y juntos puedan ir elaborando un vestido adaptado a lo que está buscando.

9.- Si el cliente solicita una cita pídele numero de teléfono, e-mail, y una fecha tentativa que le sea conveniente para poder contactarlo.

10.- Para finalizar usa una linea como:

"Todo lo que te propuso forma parte de nuestra colección cápsula. Si quieres algo aún más personalizado, también puedo agendarte una
cita y podemos hacer los ajustes que necesites o podemos diseñarte algo desde cero, exclusivamente para ti."
"""


def cleanup_expired_sessions():
    """Elimina sesiones expiradas para evitar acumulación de memoria"""
    current_time = time.time()
    expired_sessions = [
        session_id for session_id, data in conversation_histories.items()
        if current_time - data['last_activity'] > SESSION_EXPIRY
    ]

    for session_id in expired_sessions:
        del conversation_histories[session_id]


@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_message = data.get('mensaje')
    session_id = data.get('sessionId', 'default_session')

    # Limpiar sesiones expiradas periódicamente
    if len(conversation_histories) > 100:  # Limpiar solo cuando hay muchas sesiones
        cleanup_expired_sessions()

    try:
        # Inicializar o recuperar el historial de conversación para esta sesión
        if session_id not in conversation_histories:
            conversation_histories[session_id] = {
                'messages': [],
                'last_activity': time.time(),
                'has_introduced': False
            }
        else:
            conversation_histories[session_id]['last_activity'] = time.time()

        # Verificar si ya nos hemos presentado en esta conversación
        has_introduced = conversation_histories[session_id]['has_introduced']

        # Preparar los mensajes para la API de Groq
        messages_for_api = []

        # Solo incluir el prompt del sistema si es el primer mensaje
        if not has_introduced:
            messages_for_api.append({
                "role": "system",
                "content": system_prompt
            })
            conversation_histories[session_id]['has_introduced'] = True
        else:
            # Para mensajes subsiguientes, incluir solo el historial de la conversación
            messages_for_api.extend(
                conversation_histories[session_id]['messages'])

        # Agregar el nuevo mensaje del usuario
        messages_for_api.append({
            "role": "user",
            "content": user_message
        })

        # Llamar a la API de Groq
        chat_completion = client.chat.completions.create(
            messages=messages_for_api,
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=1024,
            top_p=1,
            stream=False,
            stop=None,
        )

        response = chat_completion.choices[0].message.content

        # Guardar la conversación en el historial (solo los últimos 10 intercambios)
        conversation_histories[session_id]['messages'].append({
            "role": "user",
            "content": user_message
        })
        conversation_histories[session_id]['messages'].append({
            "role": "assistant",
            "content": response
        })

        # Limitar el historial a los últimos 10 intercambios para no exceder el límite de tokens
        # 10 preguntas + 10 respuestas
        if len(conversation_histories[session_id]['messages']) > 20:
            conversation_histories[session_id]['messages'] = conversation_histories[session_id]['messages'][-20:]

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


@app.route('/reiniciar', methods=['POST'])
def reiniciar():
    """Reinicia la conversación para una sesión específica"""
    data = request.json
    session_id = data.get('sessionId', 'default_session')

    if session_id in conversation_histories:
        del conversation_histories[session_id]

    return jsonify({"status": "ok", "message": "Conversación reiniciada"})


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"})


# Este bloque es importante para que funcione con Gunicorn
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)

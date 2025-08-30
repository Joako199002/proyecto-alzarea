from flask import Flask, request, jsonify, session, Response, stream_with_context, send_from_directory
from flask_cors import CORS
from flask_session import Session
from werkzeug.utils import secure_filename
import os
import pandas as pd
import requests
import time
from deepface imprort DeepDFace
# from detection import detect_facial_features  # COMENTADA PARA TESTING

app = Flask(__name__)
app.secret_key = 'clave-secreta'
app.config['SESSION_TYPE'] = 'filesystem'
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

CORS(app, supports_credentials=True, origins=["http://localhost:8000"])
# CORS(app, resources={
#      r"/chat": {"origins": "http://localhost:8000"}}, supports_credentials=True)
# CORS(app)  # Permite llamadas desde frontend local
Session(app)

# Carga la base de vestidos solo una vez al iniciar la app
# Version de base de dadtos local
# base_vestidos = pd.read_excel(
#     r'C:\Users\Joaquin\Desktop\Asistente_de_Moda\base_vestidos.xlsx')
# version de base de datos en linea
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
una agenda disponible para que uno de nuestros expertos se contacte y juntos puedan ir elaborando un vestido adaptado a lo que está buscando.

9.- Si el cliente solicita una cita pídele numero de teléfono, e-mail, y una fecha tentativa que le sea conveniente para poder contactarlo.

10.- Para finalizar usa una linea como:

"Todo lo que te propuse forma parte de nuestra colección cápsula. Si quieres algo aún más personalizado, también puedo agendarte una
cita y podemos hacer los ajustes que necesites o Podemos diseñarte algo desde cero, exclusivamente para ti."
"""
    return prompt


@app.route('/reiniciar', methods=['POST'])
def reiniciar_historial():
    session.pop('historial', None)
    session.pop('caracteristicas_usuario', None)

    return jsonify({"status": "ok"})

# ***** Comienza respuesta sin escritura animada *****


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
        session['historial'] = [
            {"role": "system", "content": construir_prompt()}
        ]

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

    # Agrega el mensaje del usuario al historial
    historial.append({"role": "user", "content": mensaje_usuario})

    try:
        response = requests.post(
            'http://localhost:3000/chat',
            json={"messages": historial},
            timeout=15
        )
        response.raise_for_status()
        respuesta_ia = response.json().get('reply')

        if not respuesta_ia:
            return jsonify({"reply": "Lo siento, estamos teniendo algunos inconvenientes. Por favor, intenta nuevamente más tarde."}), 200

        # Agrega la respuesta de la IA al historial
        historial.append({"role": "assistant", "content": respuesta_ia})
        session['historial'] = historial

        # # Enviar la respuesta en fragmentos simulando escritura
        # for char in respuesta_ia:
        #     yield char
        #     time.sleep(0.02)  # Simula escritura lenta (ajustable)

        return jsonify({"reply": respuesta_ia})

    except requests.exceptions.Timeout:
        return jsonify({"reply": "Lo siento, estamos teniendo algunos inconvenientes. Por favor, intenta nuevamente más tarde."}), 200

    except requests.exceptions.RequestException:
        return jsonify({"reply": "Lo siento, estamos teniendo algunos inconvenientes. Por favor, intenta nuevamente más tarde."}), 200

# ***** Termina respuesta sin escritura animada ******

# ***** Comienza respuesta con escritura animada *****

# @app.route('/chat', methods=['POST'])
# def chat():
#     data = request.json
#     if not data or 'mensaje' not in data:
#         return jsonify({"reply": "Lo siento, estamos teniendo algunos inconvenientes. Por favor, intenta nuevamente más tarde."}), 200

#     mensaje_usuario = data['mensaje'].strip()
#     if not mensaje_usuario:
#         return jsonify({"reply": "Lo siento, estamos teniendo algunos inconvenientes. Por favor, intenta nuevamente más tarde."}), 200

#     # if 'historial' not in session:
#     #     session['historial'] = [
#     #         {"role": "system", "content": construir_prompt()}
#     #     ]

#     if 'historial' not in session or not any(m['role'] == 'system' for m in session['historial']):
#         session['historial'] = [
#             {"role": "system", "content": construir_prompt()}
#         ]

#     caracteristicas = session.get('caracteristicas_usuario')
#     historial = session['historial']

#     if caracteristicas and not any("Características físicas detectadas" in h.get("content", "") for h in historial):
#         descripcion = ", ".join(
#             [f"{k}: {v}" for k, v in caracteristicas.items()])
#         historial.append({
#             "role": "system",
#             "content": f"Características físicas detectadas del usuario: {descripcion}"
#         })

#     historial.append({"role": "user", "content": mensaje_usuario})

#     def generar_respuesta():
#         try:
#             response = requests.post(
#                 'http://localhost:3000/chat',
#                 json={"messages": historial},
#                 timeout=15
#             )
#             response.raise_for_status()
#             respuesta_ia = response.json().get('reply')

#             if not respuesta_ia:
#                 yield "Lo siento, no pude obtener una respuesta."
#                 return

#             # Guardar en historial
#             historial.append({"role": "assistant", "content": respuesta_ia})
#             session['historial'] = historial
#             session.modified = True  # Para que guarde la sesion
#             # Enviar la respuesta en fragmentos simulando escritura
#             for char in respuesta_ia:
#                 yield char
#                 time.sleep(0.02)  # Simula escritura lenta (ajustable)

#         except requests.exceptions.Timeout:
#             yield "Lo siento, hubo un problema de tiempo de espera."
#         except requests.exceptions.RequestException:
#             yield "Lo siento, ocurrió un error al contactar la IA."

#     return Response(stream_with_context(generar_respuesta()), mimetype='text/plain')

# ******* Termina respuesta con escritura animada *******

# ****COMENTADO PARA TESTING  ******
# @app.route('/subir-imagen', methods=['POST'])
# def subir_imagen():
#     print("📸 Imagen recibida en el backend")
#     if 'imagen' not in request.files:
#         return jsonify({"reply": "No se recibió ninguna imagen."}), 400

#     imagen = request.files['imagen']
#     image_bytes = imagen.read()

#     try:
#         resultados = detect_facial_features(image_bytes)
#         session['caracteristicas_usuario'] = resultados
#         print(resultados)

#         # Inicializa historial si no existe
#         if 'historial' not in session:
#             session['historial'] = [
#                 {"role": "system", "content": construir_prompt()}
#             ]

#         historial = session['historial']

#         # Agregar características físicas si aún no están
#         if resultados and not any("Características físicas detectadas" in h.get("content", "") for h in historial):
#             descripcion = ", ".join(
#                 [f"{k}: {v}" for k, v in resultados.items()])
#             historial.append({
#                 "role": "system",
#                 "content": f"Características físicas detectadas del usuario: {descripcion}"
#             })

#         # Simular un mensaje del usuario para que la IA continúe el flujo
#         historial.append({"role": "user", "content": "Ya subí mi imagen"})

#         response = requests.post(
#             'http://localhost:3000/chat',
#             json={"messages": historial},
#             timeout=15
#         )
#         response.raise_for_status()
#         respuesta_ia = response.json().get('reply')

#         if respuesta_ia:
#             historial.append({"role": "assistant", "content": respuesta_ia})
#             session['historial'] = historial
#             return jsonify({"reply": respuesta_ia})
#         else:
#             return jsonify({"reply": "Imagen recibida y analizada. Ya tengo tus características para ayudarte mejor."})

#     except Exception as e:
#         print("Error al analizar imagen:", e)
#         return jsonify({"reply": "Recibí la imagen, pero hubo un problema al procesarla."})


# agregado para manejo de imagen de vestido en el chatbot
# @app.route('/static/disenos/<path:filename>')
# def serve_diseno(filename):
#     return send_from_directory('static/disenos', filename)
# final del manejo de vestido en chatbot

# Version app local
# if __name__ == '__main__':
#     app.run(port=5000, debug=True)

# *********** SOLO PARA TESTING   **************
@app.route('/subir-imagen', methods=['POST'])
def subir_imagen():
    print("📸 Imagen recibida en el backend (modo prueba)")
    # Devuelve datos de prueba en lugar de procesar
    return jsonify({
        "reply": "Imagen recibida (modo prueba). Características: Silueta-Media, Piel-Clara, Género-Mujer, Edad-30, Cabello-Castaño"
    })


# Version app en linea
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

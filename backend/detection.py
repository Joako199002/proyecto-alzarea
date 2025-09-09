import cv2
import math
import torch
import numpy as np
import pandas as pd
from PIL import Image
# from deepface import DeepFace
from transformers import SegformerImageProcessor, SegformerForSemanticSegmentation
import mediapipe as mp
import os
import logging

try:
    from deepface import DeepFace
except ImportError:
    DeepFace = None

mp_pose = mp.solutions.pose


def detectar_y_clasificar_tono_piel(img_path):
    try:
        face_obj = DeepFace.extract_faces(
            img_path=img_path, enforce_detection=True, detector_backend="retinaface")[0]
        face_img = face_obj['face']

        if face_img.dtype != np.uint8:
            face_img = (face_img * 255).astype(np.uint8)

        face_rgb = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
        avg_color = np.mean(face_rgb.reshape(-1, 3), axis=0).astype(int)
        r, g, b = avg_color
        luminancia = 0.299 * r + 0.587 * g + 0.114 * b

        if luminancia >= 150:
            tono = "Muy claro"
        elif luminancia >= 100:
            tono = "Claro"
        elif luminancia >= 80:
            tono = "Medio"
        elif luminancia >= 40:
            tono = "Oscuro"
        else:
            tono = "Muy oscuro"

        return avg_color, tono
    except Exception as e:
        print(f"Error en detección de tono de piel: {str(e)}")
        return None, "No detectado"


def detectar_color_cabello_con_segmentacion(img_path, mostrar=True):
    try:
        image = Image.open(img_path).convert("RGB").resize((512, 512))
        processor = SegformerImageProcessor.from_pretrained(
            "jonathandinu/face-parsing")
        model = SegformerForSemanticSegmentation.from_pretrained(
            "jonathandinu/face-parsing")
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model.to(device)

        inputs = processor(images=image, return_tensors="pt").to(device)
        with torch.no_grad():
            outputs = model(**inputs)

        logits = outputs.logits
        upsampled_logits = torch.nn.functional.interpolate(
            logits, size=image.size[::-1], mode="bilinear", align_corners=False
        )
        mask = upsampled_logits.argmax(dim=1)[0].cpu().numpy()

        hair_mask = (mask == 13).astype(np.uint8)
        img_array = np.array(image)
        hair_pixels = img_array[hair_mask == 1]

        if hair_pixels.size == 0:
            avg_color = [0, 0, 0]
            color_nombre = "Indefinido"
        else:
            avg_color = np.mean(hair_pixels, axis=0).astype(int).tolist()
            r, g, b = avg_color

            if r < 70 and g < 70 and b < 70:
                color_nombre = "Negro"
            elif r < 110 and g < 100 and b < 90:
                color_nombre = "Castaño oscuro"
            elif 100 <= r <= 150 and 90 <= g <= 140 and 80 <= b <= 160:
                color_nombre = "Castaño claro"
            elif r > 200 and g > 190 and b < 160:
                color_nombre = "Rubio"
            elif r > 130 and g < 110 and b < 100:
                color_nombre = "Pelirrojo"
            elif r > 170 and g > 170 and b > 170:
                color_nombre = "Gris / Blanco"
            else:
                color_nombre = "Indefinido"

        return avg_color, color_nombre
    except Exception as e:
        print(f"Error en detección de color de cabello: {str(e)}")
        return [0, 0, 0], "Indefinido"


def distancia(p1, p2):
    return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)


def estimar_complexion(landmarks):
    try:
        required_indices = [0, 1, 2, 11, 12, 23, 24, 25, 26]
        for i in required_indices:
            if i >= len(landmarks) or landmarks[i] is None:
                return "Silueta no detectada", None

        hombro_izq = landmarks[11]
        hombro_der = landmarks[12]
        cadera_izq = landmarks[23]
        cadera_der = landmarks[24]
        cabeza = landmarks[0]
        rodilla_izq = landmarks[25]
        rodilla_der = landmarks[26]

        cabeza_superior = ((landmarks[1][0] + landmarks[2][0]) / 2,
                           (landmarks[1][1] + landmarks[2][1]) / 2)

        ancho_hombros = distancia(hombro_izq, hombro_der)
        ancho_caderas = distancia(cadera_izq, cadera_der)
        altura = (distancia(cabeza_superior, rodilla_izq) +
                  distancia(cabeza_superior, rodilla_der)) / 2

        proporcion_hombros = ancho_hombros / altura
        proporcion_caderas = ancho_caderas / altura
        score = (proporcion_hombros + proporcion_caderas) / 2

        if score < 0.23:
            return "Delgada", score
        elif score < 0.27:
            return "Media", score
        else:
            return "Robusta", score
    except Exception as e:
        print(f"Error en estimación de complexión: {str(e)}")
        return "No detectada", None


def estimar_complexion_cuerpo(img_path, mostrar=True):
    try:
        img = cv2.imread(img_path)
        if img is None:
            print(f"No se pudo cargar la imagen: {img_path}")
            return None, "Imagen no cargada", None

        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        h, w = img.shape[:2]

        with mp.solutions.pose.Pose(static_image_mode=True, model_complexity=1) as pose:
            res = pose.process(img_rgb)

        if not res.pose_landmarks:
            print("No se detectó cuerpo completo.")
            return None, "Cuerpo no detectado", None

        lm = res.pose_landmarks.landmark
        visibility_threshold = 0.5
        pts = []
        for p in lm:
            if p.visibility < visibility_threshold:
                pts.append(None)
            else:
                pts.append((p.x * w, p.y * h))

        complexion, score = estimar_complexion(pts)

        if complexion == "Cuerpo no detectado":
            return None, complexion, None

        datos_complexion = {
            "complexion": complexion,
            "score": score
        }

        if pts[11] is not None and pts[12] is not None:
            datos_complexion["ancho_hombros"] = float(
                distancia(pts[11], pts[12]))
        else:
            datos_complexion["ancho_hombros"] = None

        if pts[23] is not None and pts[24] is not None:
            datos_complexion["ancho_caderas"] = float(
                distancia(pts[23], pts[24]))
        else:
            datos_complexion["ancho_caderas"] = None

        return datos_complexion, complexion, score
    except Exception as e:
        print(f"Error en análisis de complexión: {str(e)}")
        return None, "Error en cálculo", None


def analizar_rostro(img_path):
    try:
        if DeepFace is None:
            logging.error("DeepFace no está instalado")
            return None

        result = DeepFace.analyze(
            img_path=img_path,
            actions=['age', 'gender', 'race'],
            enforce_detection=True,
            detector_backend="retinaface",   # ✅ fuerza retinaface
            silent=True
        )[0]

        race_mapping = {
            'white': "Caucásico",
            'black': "Negro",
            'east asian': "Asiático Oriental",
            'indian': "Indio",
            'latino hispanic': "Hispano/Latino",
            'middle eastern': "Medio Oriental",
            'southeast asian': "Asiático Suroriental",
            'asian': "Asiático"
        }
        raza = race_mapping.get(
            result['dominant_race'], result['dominant_race'])

        color_rgb, tono_clasificado = detectar_y_clasificar_tono_piel(img_path)
        color_cabello, cabello_nombre = detectar_color_cabello_con_segmentacion(
            img_path)
        body_info, complexion, score = estimar_complexion_cuerpo(img_path)

        return pd.DataFrame([{
            'edad': result['age'],
            'genero': 'Mujer' if result['dominant_gender'] == 'Woman' else 'Hombre',
            'raza': raza,
            'tono_piel': tono_clasificado,
            'color_cabello': cabello_nombre,
            'complexion': complexion
        }])

    except Exception as e:
        if "Face could not be detected" in str(e):
            logging.warning("⚠️ Rostro no detectado en la imagen")
            return None
        logging.error(f"❌ Error en analizar_rostro: {e}", exc_info=True)
        return None


def detect_facial_features(image_data):
    try:
        temp_path = "/tmp/temp_image.jpg"  # ✅ usar /tmp
        with open(temp_path, "wb") as f:
            f.write(image_data)

        logging.info(f"Imagen guardada temporalmente en {temp_path}")

        df = analizar_rostro(temp_path)

        if os.path.exists(temp_path):
            os.remove(temp_path)

        if df is not None:
            return {
                "Silueta": df['complexion'].iloc[0],
                "Color de Piel": df['tono_piel'].iloc[0],
                "Género": df['genero'].iloc[0],
                "Edad": df['edad'].iloc[0],
                "Color de Cabello": df['color_cabello'].iloc[0],
                "Rostro Detectado": True
            }
        else:
            return {"Rostro Detectado": False}

    except Exception as e:
        logging.error(f"❌ Error en detect_facial_features: {e}", exc_info=True)
        if os.path.exists("/tmp/temp_image.jpg"):
            os.remove("/tmp/temp_image.jpg")
        return {"Rostro Detectado": False}


# if __name__ == "__main__":
#     with open(r"C:\Users\Joaquin\Desktop\pruebas\prueba22.jpg", "rb") as f:
#         image_bytes = f.read()

#     resultados = detect_facial_features(image_bytes)
#     print(resultados)

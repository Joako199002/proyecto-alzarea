FROM python:3.10.12-slim

WORKDIR /app

# Instala librerías del sistema necesarias para OpenCV, TensorFlow y otros
RUN apt-get update && apt-get install -y \
    curl \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# Copia requirements y archivo base
COPY requirements.txt .
COPY base_vestidos.xlsx .

# Variables de entorno para evitar problemas con TensorFlow/Keras
ENV TF_ENABLE_ONEDNN_OPTS=0
ENV TF_USE_LEGACY_KERAS=0

# Instala dependencias de Python
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Descarga previa de modelos de DeepFace (solo retinaface, age, gender)
RUN mkdir -p /root/.deepface/weights && \
    curl -L -o /root/.deepface/weights/retinaface.h5 https://github.com/serengil/deepface_models/releases/download/v1.0/retinaface.h5 && \
    curl -L -o /root/.deepface/weights/age_model_weights.h5 https://github.com/serengil/deepface_models/releases/download/v1.0/age_model_weights.h5 && \
    curl -L -o /root/.deepface/weights/gender_model_weights.h5 https://github.com/serengil/deepface_models/releases/download/v1.0/gender_model_weights.h5

# Copia el resto de la app
COPY . .

ENV PORT=8080
EXPOSE $PORT

# ✅ Ajuste Gunicorn: más timeout y 2 workers
CMD ["gunicorn", "-w", "2", "-t", "300", "--bind", "0.0.0.0:8080", "app:app"]


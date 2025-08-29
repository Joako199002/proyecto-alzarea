# Usa una imagen base específica de Python 3.9
FROM python:3.9.18-slim-bullseye

# Establece el directorio de trabajo
WORKDIR /app

# Instala dependencias del sistema mínimas
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copia solo el archivo de requisitos primero (para caching)
COPY requirements.txt .

# Instala dependencias de Python optimizadas para CPU solamente
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --no-deps -r requirements.txt

# Copia el resto de los archivos de la aplicación
COPY . .

# Expone el puerto
EXPOSE 5000

# Comando para ejecutar la aplicación
CMD ["python", "app.py"]
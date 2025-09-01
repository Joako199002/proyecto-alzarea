FROM python:3.9.18-slim-bullseye

WORKDIR /app

# Instalar dependencias del sistema que puedan ser necesarias
RUN apt-get update && apt-get install -y \
    build-essential \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8080
EXPOSE $PORT

CMD ["gunicorn", "--bind", "0.0.0.0:8080", "app:app"]
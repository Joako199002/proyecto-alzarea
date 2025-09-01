FROM python:3.9.18

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Usar el puerto que Railway asigna (por defecto 8080)
ENV PORT=8080
EXPOSE $PORT

# Especificar explícitamente que use app.py y la variable app
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:$PORT main:app"]
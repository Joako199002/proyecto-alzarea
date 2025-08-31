const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({
    origin: ['https://proyecto-alzarea.netlify.app', 'http://localhost:3000'], // Reemplaza con tu dominio de Netlify
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Manejar solicitudes OPTIONS (preflight)
app.options('*', cors());


app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware de logging para diagnóstico
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Ruta de salud para verificar que el servidor funciona
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Servidor funcionando correctamente',
        timestamp: new Date().toISOString(),
        port: process.env.PORT
    });
});

// Ruta simple de prueba
app.get('/test', (req, res) => {
    res.json({
        message: 'Endpoint de prueba funcionando',
        environment: process.env.NODE_ENV || 'development'
    });
});

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Almacenamiento simple de conversaciones (en producción usarías una base de datos)
const conversations = new Map();

app.post('/chat', async (req, res) => {
    try {
        const { mensaje, sessionId = 'default' } = req.body;

        if (!mensaje) {
            return res.status(400).json({ error: 'Mensaje es requerido' });
        }

        // Obtener o inicializar la conversación
        if (!conversations.has(sessionId)) {
            conversations.set(sessionId, [
                {
                    role: "system",
                    content: "Eres un asistente de moda útil y entusiasta para Alzárea, una marca de vestidos. Responde de manera amable y profesional. Cuando sea apropiado, sugiere diseños específicos de la marca usando la etiqueta [MOSTRAR_IMAGEN: NOMBRE_DEL_DISEÑO]. Los diseños disponibles son: CENEFA, FRISO, SOPHIE, LIRIA, ALMENA, SKIRT, WEIRD."
                }
            ]);
        }

        const conversation = conversations.get(sessionId);

        // Agregar mensaje del usuario a la conversación
        conversation.push({ role: "user", content: mensaje });

        const response = await axios.post(
            GROQ_API_URL,
            {
                model: "llama3-70b-8192",
                messages: conversation,
                temperature: 0.7,
                max_tokens: 1000,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                },
                timeout: 50 // 30 segundos de timeout
            }
        );

        const reply = response.data.choices[0].message.content;

        // Agregar respuesta del asistente a la conversación
        conversation.push({ role: "assistant", content: reply });

        res.json({ reply });

    } catch (error) {
        console.error('Error al conectar con Groq API:', error.response?.data || error.message);

        if (error.code === 'ECONNABORTED') {
            return res.status(408).json({ error: 'Tiempo de espera agotado. Por favor, intenta de nuevo.' });
        }

        res.status(500).json({
            error: 'Lo siento, hubo un error al procesar tu solicitud.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.post('/reiniciar', (req, res) => {
    const { sessionId = 'default' } = req.body;
    conversations.delete(sessionId);
    res.json({ message: 'Conversación reiniciada' });
});

// Ruta para subir imágenes (si decides implementarlo después)
app.post('/subir-imagen', (req, res) => {
    res.status(501).json({ error: 'Funcionalidad de imágenes no implementada aún' });
});

// Usar el puerto proporcionado por Railway o 3000 por defecto
const PORT = process.env.PORT || 3000;

// Asegurarse de escuchar en todas las interfaces de red
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(`Servidor ejecutándose en puerto ${PORT}`);
    console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`GROQ_API_KEY configurada: ${!!process.env.GROQ_API_KEY}`);
    console.log(`=================================`);
});

// Manejar cierre graceful
process.on('SIGTERM', () => {
    console.log('Recibió SIGTERM. Cerrando servidor gracefully.');
    server.close(() => {
        console.log('Servidor cerrado.');
        process.exit(0);
    });
});

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
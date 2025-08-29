const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;

app.post('/chat', async (req, res) => {
    try {
        const { messages } = req.body;

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama3-70b-8192',
                messages: messages,
                temperature: 0.7,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                }
            }
        );

        const reply = response.data.choices[0].message.content;
        res.json({ reply });

    } catch (error) {
        console.error('Error al conectar con la API de Groq:', error.message);
        res.status(500).json({ reply: 'Lo siento, hubo un error al procesar tu solicitud.' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor proxy corriendo en http://localhost:${PORT}`);
});


const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path')
require('dotenv').config();

const app = express();

// Configuración de CORS
app.use(cors({
    origin: ['https://proyecto-alzarea.netlify.app', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Manejar solicitudes OPTIONS (preflight)
app.options('*', cors());

// Middleware para parsing de JSON
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (IMAGENES)
app.use('/imagenes', express.static(path.join(__dirname, 'imagenes')));

// Middleware de logging para diagnóstico
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ========= CONFIGURACIÓN MULTER Y ANÁLISIS DE IMAGEN =========
// Configuración de multer para subida de imágenes
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'image-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB límite
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos de imagen'), false);
        }
    }
});

// Función para ejecutar el script de Python
function analyzeImageWithPython(imagePath) {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', ['detection.py', imagePath]);

        let resultData = '';
        let errorData = '';

        pythonProcess.stdout.on('data', (data) => {
            resultData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Python script exited with code ${code}: ${errorData}`));
                return;
            }

            try {
                const result = JSON.parse(resultData);
                resolve(result);
            } catch (e) {
                reject(new Error(`Failed to parse Python output: ${e.message}`));
            }
        });
    });
}

// ========= FIN CONFIGURACIÓN MULTER =========


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

// Almacenamiento de conversaciones y estados
const conversations = new Map();
const userStates = new Map();

// Mapeo de nombres de diseño a nombres de archivo
const mapeoImagenes = {
    'CENEFA': 'CENEFA',
    'FRISO': 'FRISO_FLOWER',
    'SOPHIE': 'SOPHIE',
    'LIRIA': 'LIRIA_WHITE',
    'ALMENA': 'ALMENA',
    'SKIRT': 'SKIRT_BLACK',
    'WEIRD': 'WEIRD'
};

// Información de vestidos formateada
const vestidosFormateados = `
CENEFA: Vestido elegante con detalles únicos en acabados premium. Materiales nobles y hecho a mano.
FRISO: Diseño moderno con cortes innovadores. Pieza única con detalles artesanales.
SOPHIE: Vestido sofisticado con inspiración en tendencias contemporáneas. Colección cápsula.
LIRIA: Modelo clásico reinventado con un toque de modernidad. A medida con materiales reciclables.
ALMENA: Diseño exclusivo que representa la esencia de la marca. Hecho a mano con atención al detalle.
SKIRT: Variación del modelo CENEFA con detalles mejorados. Materiales nobles y respetuosos con el entorno.
WEIRD: Diseño vanguardista y único. Pieza única de colección cápsula.
`;

// Prompt del sistema actualizado
const systemPrompt = `Eres Alzárea, asesora de estilo digital de un exclusivo ATELIER de moda artesanal. Tu tono debe ser:

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
${vestidosFormateados}

IMPORTANTE ABSOLUTO: Cuando menciones cualquier vestido de nuestra colección, DEBES incluir al final de la descripción la etiqueta [MOSTRAR_IMAGEN: NOMBRE_DEL_DISEÑO].
Ejemplo:
"Te recomiendo nuestro vestido CENEFA, es elegante con detalles únicos [MOSTRAR_IMAGEN: CENEFA]"

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

IMPORTANTE: Si el usuario te pide ver la imagen de un vestido, DEBES incluir inmediatamente la etiqueta [MOSTRAR_IMAGEN: NOMBRE_DEL_DISEÑO] en tu respuesta.

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
que consideres necesario para ofrecer la mejor recomendación. Haz la pregunta de manera orgánica, no como a bot cualquiera, recuerda que eres
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
una agenda disponible para que uno de nuestros expertos se contacte e y juntos puedan ir elaborando un vestido adaptado a lo que está buscando.

9.- Si el cliente solicita una cita pídele numero de teléfono, e-mail, y una fecha tentativa que le sea conveniente para poder contactarlo.

10.- Para finalizar usa una linea como:

"Todo lo que te propuse forma parte de nuestra colección cápsula. Si quieres algo aún más personalizado, también puedo agendarte una
cita y podemos hacer los ajustes que necesites o Podemos diseñarte algo desde cero, exclusivamente para ti."`;

app.post('/chat', async (req, res) => {
    try {
        const { mensaje, sessionId = 'default' } = req.body;

        if (!mensaje) {
            return res.status(400).json({ error: 'Mensaje es requerido' });
        }

        // Inicializar o obtener el estado del usuario
        if (!userStates.has(sessionId)) {
            userStates.set(sessionId, {
                step: 1, // Paso inicial
                presented: false, // Si se ha presentado
                userData: {} // Datos del usuario
            });
        }

        const userState = userStates.get(sessionId);

        // Obtener o inicializar la conversación
        if (!conversations.has(sessionId)) {
            conversations.set(sessionId, [
                {
                    role: "system",
                    content: systemPrompt
                }
            ]);

            // SOLO inicializar el estado, NO agregar presentación manual
            userState.presented = true;
            userState.step = 1; // Empezar en el paso 1
        }


        const conversation = conversations.get(sessionId);

        // Agregar mensaje del usuario a la conversación
        conversation.push({ role: "user", content: mensaje });

        const response = await axios.post(
            GROQ_API_URL,
            {
                model: "llama-3.3-70b-versatile",
                messages: conversation,
                temperature: 0.7,
                max_tokens: 1000,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                },
                timeout: 30000 // 30 segundos de timeout
            }
        );

        // Obtener la respuesta de la IA
        let reply = response.data.choices[0].message.content;

        // Verificación mejorada para incluir etiquetas de imagen
        const nombresVestidos = ['CENEFA', 'FRISO', 'SOPHIE', 'LIRIA', 'ALMENA', 'SKIRT', 'WEIRD'];
        const replyUpper = reply.toUpperCase();

        // Buscar vestidos mencionados (case-insensitive)
        const vestidosMencionados = nombresVestidos.filter(vestido =>
            replyUpper.includes(vestido.toUpperCase())
        );

        // Si se mencionaron vestidos pero no hay etiqueta, agregarla
        if (vestidosMencionados.length > 0 && !reply.includes('[MOSTRAR_IMAGEN:')) {
            // SOPHIE y LIRIA siempre juntos
            const tieneSophie = vestidosMencionados.includes('SOPHIE');
            const tieneLiria = vestidosMencionados.includes('LIRIA');

            if (tieneSophie && tieneLiria) {
                reply += ` [MOSTRAR_IMAGEN: SOPHIE, LIRIA]`;
            } else {
                // Agregar todos los vestidos mencionados
                reply += ` [MOSTRAR_IMAGEN: ${vestidosMencionados.join(', ')}]`;
            }

            console.log('Etiqueta de imagen agregada automáticamente');
        }

        // Agregar respuesta del asistente a la conversación
        conversation.push({ role: "assistant", content: reply });
        // Actualizar el estado según la respuesta
        if (reply.includes("¿Cómo te llamas?") || reply.includes("nombre")) {
            userState.step = 2; // Esperando nombre
        } else if (reply.includes("imagen") || reply.includes("foto")) {
            userState.step = 3; // Esperando imagen
        } else if (reply.includes("evento") || reply.includes("ocasión")) {
            userState.step = 4; // Esperando detalles del evento
        } else if (reply.includes("estilo") || reply.includes("prefier")) {
            userState.step = 5; // Esperando preferencias de estilo
        } else if (reply.includes("color") || reply.includes("tono")) {
            userState.step = 6; // Esperando preferencias de color
        } else if (reply.includes("[MOSTRAR_IMAGEN:")) {
            userState.step = 7; // Ha hecho una recomendación
        } else if (reply.includes("contacto") || reply.includes("teléfono") || reply.includes("email")) {
            userState.step = 9; // Solicitando información de contacto
        }

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
    userStates.delete(sessionId);
    res.json({ message: 'Conversación reiniciada' });
});

// Ruta para obtener la URL de una imagen de diseño
app.get('/imagen-diseno/:nombre', (req, res) => {
    const { nombre } = req.params;
    const nombreArchivo = mapeoImagenes[nombre.toUpperCase()];

    if (!nombreArchivo) {
        return res.status(404).json({ error: 'Diseño no encontrado' });
    }

    res.json({
        url: `${req.protocol}://${req.get('host')}/imagenes/${nombreArchivo}.jpg`,
        nombre: nombre
    });
});

// // Agregar multer para manejar la subida de archivos
// const multer = require('multer');
// const fs = require('fs');

// // Configurar almacenamiento para multer
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         const uploadDir = 'uploads/';
//         if (!fs.existsSync(uploadDir)) {
//             fs.mkdirSync(uploadDir);
//         }
//         cb(null, uploadDir);
//     },
//     filename: function (req, file, cb) {
//         // Generar nombre único para el archivo
//         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//         cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
//     }
// });

// const upload = multer({
//     storage: storage,
//     limits: {
//         fileSize: 5 * 1024 * 1024 // Límite de 5MB
//     },
//     fileFilter: function (req, file, cb) {
//         // Solo permitir imágenes
//         if (file.mimetype.startsWith('image/')) {
//             cb(null, true);
//         } else {
//             cb(new Error('Solo se permiten archivos de imagen'), false);
//         }
//     }
// });

// Ruta para subir imágenes ()
app.post('/subir-imagen', upload.single('imagen'), async (req, res) => {
    try {
        const { sessionId = 'default' } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
        }

        // Obtener o inicializar la conversación
        if (!conversations.has(sessionId)) {
            conversations.set(sessionId, [
                {
                    role: "system",
                    content: systemPrompt
                }
            ]);
        }

        const conversation = conversations.get(sessionId);

        // Agregar mensaje del usuario sobre la imagen subida
        conversation.push({
            role: "user",
            content: `He subido una imagen: ${req.file.filename}`
        });

        // Simular análisis de imagen (en una implementación real, aquí integrarías un servicio de visión por computadora)
        const analisisImagen = `
He analizado tu imagen. Veo que tienes una complexión [tipo de complexión], 
color de piel [tonalidad], cabello [color y tipo de cabello], y altura aproximada de [altura]. 
Esto me ayudará a recomendarte prendas que se adapten perfectamente a tu silueta.
`;

        // Agregar el análisis a la conversación como si fuera del usuario
        conversation.push({
            role: "user",
            content: analisisImagen
        });

        // Obtener respuesta de la IA
        const response = await axios.post(
            GROQ_API_URL,
            {
                model: "llama-3.3-70b-versatile",
                messages: conversation,
                temperature: 0.7,
                max_tokens: 1000,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                },
                timeout: 30000
            }
        );

        let reply = response.data.choices[0].message.content;

        // Agregar respuesta del asistente a la conversación
        conversation.push({ role: "assistant", content: reply });

        res.json({
            reply,
            imagenUrl: `/uploads/${req.file.filename}`
        });

    } catch (error) {
        console.error('Error al procesar imagen:', error);
        res.status(500).json({
            error: 'Error al procesar la imagen',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});


// Servir archivos subidos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Usar el puerto proporcionado por Railway o 3000 por defecto
const PORT = process.env.PORT || 3000;

// Crear servidor HTTP en lugar de usar app.listen directamente
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================`);
    console.log(`Servidor ejecutándose en puerto ${PORT}`);
    console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`GROQ_API_KEY configurada: ${!!process.env.GROQ_API_KEY}`);
    console.log(`=================================`);
});

// Manejar cierre graceful
const shutdown = (signal) => {
    console.log(`Recibió ${signal}. Cerrando servidor gracefully.`);
    server.close(() => {
        console.log('Servidor cerrado.');
        process.exit(0);
    });

    // Forzar cierre después de 10 segundos
    setTimeout(() => {
        console.error('Forzando cierre después de timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
});

app.get('/test-groq', async (req, res) => {
    try {
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: "llama3-70b-8192",
                messages: [{ role: "user", content: "Responde con 'OK' si funciona" }],
                temperature: 0.7,
                max_tokens: 10,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                },
                timeout: 10000
            }
        );

        res.json({
            status: 'GROQ_CONNECTION_OK',
            response: response.data,
            response_time: `${response.headers['x-ratelimit-remaining']} requests remaining`
        });
    } catch (error) {
        res.status(500).json({
            status: 'GROQ_CONNECTION_ERROR',
            error: error.message,
            details: error.response?.data || 'No response data'
        });
    }
});
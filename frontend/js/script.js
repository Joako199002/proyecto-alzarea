// ==================== CONFIGURACIÓN DE URLS ====================
// Determina automáticamente la URL del backend según el entorno
const backendUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://proyecto-alzarea-production.up.railway.app';

// Mapeo de nombres de diseño a nombres de archivo (actualizado)
const mapeoImagenes = {
    'CENEFA': 'CENEFA',
    'FRISO': 'FRISO_FLOWER',
    'SOPHIE': 'SOPHIE',
    'LIRIA': 'LIRIA_WHITE',
    'ALMENA': 'ALMENA',
    'SKIRT': 'SKIRT_BLACK',
    'WEIRD': 'WEIRD'
};

// Función para verificar el estado del backend
async function checkBackendHealth() {
    try {
        const response = await fetch(`${backendUrl}/health`);
        const data = await response.json();
        console.log('Backend health:', data);
        return response.ok;
    } catch (error) {
        console.error('Backend health check failed:', error);
        return false;
    }
}

// let sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
let sessionId = localStorage.getItem('chatbot_session_id');
if (!sessionId) {
    sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('chatbot_session_id', sessionId);
}

// ==================== CÓDIGO DEL MENÚ HAMBURGUESA ====================

// Obtener referencias a los elementos del menú
const menuHamburguesa = document.getElementById('menuHamburguesa');
const opcionesMenu = document.getElementById('opcionesMenu');
const body = document.body;

// Función para alternar el menú
function toggleMenu() {
    body.classList.toggle('menu-abierto');
}

// Agregar evento de clic al menú hamburguesa
if (menuHamburguesa) {
    menuHamburguesa.addEventListener('click', toggleMenu);
}

// Cerrar el menú al hacer clic en una opción (opcional)
const enlacesMenu = document.querySelectorAll('.opciones-menu a');
enlacesMenu.forEach(enlace => {
    enlace.addEventListener('click', () => {
        body.classList.remove('menu-abierto');
    });
});

// ==================== CÓDIGO DEL CHATBOT ====================

// Obtener elementos del DOM para el chatbot
const toggleButton = document.querySelector('.chatbot-toggle');
const chatbotBox = document.querySelector('.chatbot-box');
const closeButton = document.querySelector('.chatbot-close');
const sendButton = document.getElementById('chatbot-send');
const inputField = document.getElementById('chatbot-input');
const messagesContainer = document.getElementById('chatbot-messages');
const uploadButton = document.getElementById('upload-button');
const imageInput = document.getElementById('chatbot-image');

// Variable para almacenar la referencia al mensaje "pensando"
let thinkingMessage = null;

// Función para ajustar automáticamente la altura del textarea
function autoResizeTextarea() {
    // Reset height to auto to get the correct scrollHeight
    inputField.style.height = 'auto';

    // Calculate the scrollHeight (content height)
    const scrollHeight = inputField.scrollHeight;

    // Set a maximum height equivalent to 3 lines
    const maxHeight = 90;

    // Set the height based on content, but not exceeding maxHeight
    if (scrollHeight <= maxHeight) {
        inputField.style.height = scrollHeight + 'px';
    } else {
        inputField.style.height = maxHeight + 'px';
    }
}

// Ajustar el textarea cuando se escribe o se pega texto
if (inputField) {
    inputField.addEventListener('input', autoResizeTextarea);
    // Ajustar el textarea al cargar la página (por si hay contenido inicial)
    autoResizeTextarea();
}

// Enviar mensaje al hacer clic en el botón de enviar
if (sendButton) {
    sendButton.addEventListener('click', () => {
        const userInput = inputField.value.trim();
        if (userInput) {
            addMessage(userInput, 'user');
            respond(userInput);
            inputField.value = '';
            // Resetear la altura del textarea después de enviar
            inputField.style.height = '45px';
        }
    });
}

// Enviar mensaje al presionar Enter en el campo de texto (pero no crear nueva línea con Shift+Enter)
if (inputField) {
    inputField.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault(); // Evita salto de línea
            if (sendButton) {
                sendButton.click(); // Simula el click del botón
            }
        }
    });
}

// Función para agregar mensajes al chat - MANTENIDA PARA OTROS USOS
function addMessage(text, sender) {
    if (!messagesContainer) return;

    const message = document.createElement('div');
    message.className = sender + '-message';

    // Verificar si contiene la etiqueta [MOSTRAR_IMAGEN: NOMBRE]
    const regex = /\[MOSTRAR_IMAGEN:\s*([^\]]+)\]/i;
    const match = text.match(regex);

    if (match) {
        const nombreDiseno = match[1].trim();
        // Reemplazar solo la etiqueta, manteniendo el nombre en el texto si ya está presente
        const textoSinEtiqueta = text.replace(regex, '').trim();

        // Agregar texto sin la etiqueta
        const textoElem = document.createElement('span');
        textoElem.textContent = textoSinEtiqueta;
        message.appendChild(textoElem);

        // Agregar imágenes de los diseños
        const disenos = nombreDiseno.split(',').map(d => d.trim());
        disenos.forEach(nombreDiseno => {
            const nombreArchivo = mapeoImagenes[nombreDiseno.toUpperCase()] || nombreDiseno;

            const img = document.createElement('img');
            img.src = `${backendUrl}/imagenes/${nombreArchivo}.jpg`;
            img.alt = nombreDiseno;
            img.style.maxWidth = '100%';
            img.style.borderRadius = '8px';
            img.style.marginTop = '5px';

            // Mejor manejo de errores para imágenes
            img.onerror = function () {
                console.error(`Error al cargar la imagen: ${img.src}`);

                // Intentar cargar con diferentes extensiones y nombres
                const extensions = ['.jpg', '.jpeg', '.png', '.webp'];
                const alternativeNames = {
                    'FRISO': ['FRISO_FLOWER', 'FRISO'],
                    'LIRIA': ['LIRIA_WHITE', 'LIRIA'],
                    'SKIRT': ['SKIRT_BLACK', 'SKIRT']
                };

                let currentAttempt = 0;
                const tryNextImage = () => {
                    if (currentAttempt < extensions.length * 2) {
                        const attemptType = currentAttempt % 2;
                        const extIndex = Math.floor(currentAttempt / 2);

                        let newSrc;
                        if (attemptType === 0 && alternativeNames[nombreDiseno]) {
                            // Intentar con nombres alternativos
                            newSrc = `${backendUrl}/imagenes/${alternativeNames[nombreDiseno][0]}${extensions[extIndex]}`;
                        } else {
                            // Intentar con el nombre original
                            newSrc = `${backendUrl}/imagenes/${nombreDiseno}${extensions[extIndex]}`;
                        }

                        currentAttempt++;
                        console.log(`Intentando cargar: ${newSrc}`);
                        img.src = newSrc;
                    } else {
                        this.style.display = 'none';
                        // Mostrar mensaje al usuario
                        const errorMsg = document.createElement('div');
                        errorMsg.textContent = `No se pudo cargar la imagen de ${nombreDiseno}`;
                        errorMsg.style.color = '#d32f2f';
                        errorMsg.style.marginTop = '5px';
                        errorMsg.style.fontSize = '0.9em';
                        message.appendChild(errorMsg);
                    }
                };

                tryNextImage();
            };

            // Agregar logging para diagnóstico
            console.log(`Intentando cargar imagen: ${img.src}`);
            img.onload = function () {
                console.log(`Imagen cargada correctamente: ${img.src}`);
            };

            message.appendChild(img);
        });
    } else {
        const textoElem = document.createElement('span');
        textoElem.textContent = text;
        message.appendChild(textoElem);
    }

    messagesContainer.appendChild(message);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Función para eliminar el mensaje "pensando" si existe
function removeThinkingMessage() {
    if (thinkingMessage && thinkingMessage.parentNode === messagesContainer) {
        messagesContainer.removeChild(thinkingMessage);
        thinkingMessage = null;
    }
}

// Función para mostrar mensajes con animación de escritura y luego imágenes - ACTUALIZADA
function showMessageWithAnimation(messageText, isError = false, disenos = []) {
    if (!messagesContainer) return;

    // Crear contenedor del mensaje
    const message = document.createElement('div');
    message.className = 'bot-message';
    if (isError) {
        message.style.color = '#d32f2f'; // Color rojo para errores
    }

    const textoElem = document.createElement('span');
    textoElem.textContent = '';
    message.appendChild(textoElem);
    messagesContainer.appendChild(message);

    // Animación de escritura
    let index = 0;
    const intervalo = setInterval(() => {
        if (index < messageText.length) {
            textoElem.textContent += messageText.charAt(index);
            index++;
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else {
            clearInterval(intervalo);

            // Después de terminar la animación, agregar imágenes si hay diseños
            if (disenos.length > 0) {
                disenos.forEach(nombreDiseno => {
                    const nombreArchivo = mapeoImagenes[nombreDiseno.toUpperCase()] || nombreDiseno;

                    const img = document.createElement('img');
                    img.src = `${backendUrl}/imagenes/${nombreArchivo}.jpg`;
                    img.alt = nombreDiseno;
                    img.style.maxWidth = '100%';
                    img.style.borderRadius = '8px';
                    img.style.marginTop = '5px';

                    // Mejor manejo de errores para imágenes
                    img.onerror = function () {
                        console.error(`No se pudo cargar: ${nombreArchivo}.jpg`);

                        // Intentar cargar con diferentes extensiones y nombres
                        const extensions = ['.jpg', '.jpeg', '.png', '.webp'];
                        const alternativeNames = {
                            'FRISO': ['FRISO_FLOWER', 'FRISO'],
                            'LIRIA': ['LIRIA_WHITE', 'LIRIA'],
                            'SKIRT': ['SKIRT_BLACK', 'SKIRT']
                        };

                        let currentAttempt = 0;
                        const tryNextImage = () => {
                            if (currentAttempt < extensions.length * 2) {
                                const attemptType = currentAttempt % 2;
                                const extIndex = Math.floor(currentAttempt / 2);

                                let newSrc;
                                if (attemptType === 0 && alternativeNames[nombreDiseno]) {
                                    // Intentar con nombres alternativos
                                    newSrc = `${backendUrl}/imagenes/${alternativeNames[nombreDiseno][0]}${extensions[extIndex]}`;
                                } else {
                                    // Intentar con el nombre original
                                    newSrc = `${backendUrl}/imagenes/${nombreDiseno}${extensions[extIndex]}`;
                                }

                                currentAttempt++;
                                console.log(`Intentando cargar: ${newSrc}`);
                                img.src = newSrc;
                            } else {
                                this.style.display = 'none';
                                // Mostrar mensaje al usuario
                                const errorMsg = document.createElement('div');
                                errorMsg.textContent = `No se pudo cargar la imagen de ${nombreDiseno}`;
                                errorMsg.style.color = '#d32f2f';
                                errorMsg.style.marginTop = '5px';
                                errorMsg.style.fontSize = '0.9em';
                                message.appendChild(errorMsg);
                            }
                        };

                        tryNextImage();
                    };

                    // Agregar logging para diagnóstico
                    console.log(`Intentando cargar imagen: ${img.src}`);
                    img.onload = function () {
                        console.log(`Imagen cargada correctamente: ${img.src}`);
                        if (messagesContainer) {
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        }
                    };

                    message.appendChild(img);
                });
            }
        }
    }, 50); // velocidad animación
}

// Función principal para procesar respuestas del chatbot - MODIFICADA PARA GROQ
async function respond(text, isDirectReply = false) {
    try {
        let mensajeTexto = text;
        let disenos = [];

        if (!isDirectReply) {
            // Mostrar "escribiendo..."
            thinkingMessage = document.createElement('div');
            thinkingMessage.className = 'bot-message';
            thinkingMessage.textContent = '...';
            if (messagesContainer) {
                messagesContainer.appendChild(thinkingMessage);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }

            // Enviar mensaje al backend Python (que se conecta con Groq)
            const response = await fetch(`${backendUrl}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: "include", // Permite creedenciales del backend
                body: JSON.stringify({
                    mensaje: text,
                    sessionId: sessionId // cambiado
                })
            });

            // Quitar "..." después de obtener respuesta
            removeThinkingMessage();

            // Verificar si la respuesta es exitosa
            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }

            const data = await response.json();
            if (!data.reply) {
                showMessageWithAnimation("Lo siento, no pude obtener una respuesta en este momento.", true);
                return;
            }
            mensajeTexto = data.reply;
        }

        // Detectar todas las etiquetas [MOSTRAR_IMAGEN: ...]
        const regex = /\[MOSTRAR_IMAGEN:\s*([^\]]+)\]/gi;
        let match;

        // Extraer los diseños del mensaje
        while ((match = regex.exec(mensajeTexto)) !== null) {
            const disenosEncontrados = match[1].split(',').map(d => d.trim());
            disenos.push(...disenosEncontrados);
        }

        // Eliminar las etiquetas del texto para la animación
        const textoSinEtiquetas = mensajeTexto.replace(regex, '').trim();

        // Mostrar el mensaje con animación de escritura
        showMessageWithAnimation(textoSinEtiquetas, false, disenos);

    } catch (error) {
        // Asegurarse de eliminar el mensaje "pensando" en caso de error
        removeThinkingMessage();

        // Mostrar mensaje de error más específico
        if (error.message.includes('Failed to fetch')) {
            showMessageWithAnimation("Error de conexión con el servidor. Por favor, intenta nuevamente.", true);
        } else {
            showMessageWithAnimation("Ocurrió un error al procesar tu solicitud.", true);
        }

        console.error('Error en respond:', error);
    }
}

// Agrega una función para reiniciar la conversación si es necesario
function reiniciarConversacion() {
    fetch(`${backendUrl}/reiniciar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId })
    })
        .then(response => response.json())
        .then(data => {
            console.log('Conversación reiniciada:', data);
            // Limpiar el chat visualmente
            if (messagesContainer) {
                messagesContainer.innerHTML = '';
                // Agregar mensaje inicial
                const initialMessage = document.createElement('div');
                initialMessage.className = 'bot-message';
                initialMessage.textContent = 'Hola, soy Alzárea ¿Lista para una experiencia de moda?';
                messagesContainer.appendChild(initialMessage);
            }
        })
        .catch(error => {
            console.error('Error al reiniciar la conversación:', error);
        });
}


// ==================== CREAR BOTÓN DE REINICIO ====================

// Crear botón de reinicio
const resetButton = document.createElement('button');
resetButton.id = 'reset-button';
resetButton.textContent = '🔄 Reiniciar';

// Insertar el botón de reinicio en el DOM
const chatbotInput = document.querySelector('.chatbot-input');
if (chatbotInput && uploadButton) {
    // Crear contenedor para los botones
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'chatbot-buttons-container';

    // Mover el botón de subir imagen al contenedor
    uploadButton.parentNode.removeChild(uploadButton);
    buttonsContainer.appendChild(uploadButton);

    // Agregar el botón de reinicio al contenedor
    buttonsContainer.appendChild(resetButton);

    // Insertar el contenedor antes del textarea
    inputField.parentNode.insertBefore(buttonsContainer, inputField);
}

// Agregar evento al botón de reinicio
if (resetButton) {
    resetButton.addEventListener('click', reiniciarConversacion);
}

// ==================== FUNCIONALIDAD PARA SUBIR IMÁGENES ====================

// Función para manejar la subida de imágenes (preparada para el futuro)
if (uploadButton) {
    uploadButton.addEventListener('click', () => {
        // Mostrar mensaje de que la función está en desarrollo
        showMessageWithAnimation("La función de subir imágenes estará disponible pronto. Mientras tanto, puedes describir tu apariencia con texto.", false);

        // Para cuando implementes la subida de imágenes:
        // imageInput.click();
    });
}

// Evento change para cuando se seleccione una imagen (preparado para el futuro)
if (imageInput) {
    imageInput.addEventListener('change', async () => {
        if (imageInput.files && imageInput.files[0]) {
            const file = imageInput.files[0];

            // Mostrar mensaje de que se está procesando la imagen
            addMessage("Procesando imagen...", 'user');

            try {
                // Crear FormData para enviar la imagen
                const formData = new FormData();
                formData.append('image', file);
                formData.append('sessionId', sessionId);

                // Enviar imagen al backend para análisis
                const response = await fetch(`${backendUrl}/analyze-image`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error('Error al procesar la imagen');
                }

                const data = await response.json();

                // Usar el resultado del análisis para generar una respuesta
                respond(`He subido una imagen. ${data.analysis}`, true);

            } catch (error) {
                console.error('Error al subir imagen:', error);
                showMessageWithAnimation("Error al procesar la imagen. Por favor, intenta de nuevo o describe tu apariencia con texto.", true);
            }
        }
    });
}

// ==================== FUNCIONALIDAD PARA MOVILES ====================

// Función para ajustar el chatbot en dispositivos móviles
function adjustChatbotForMobile() {
    const chatbotBox = document.querySelector('.chatbot-box');
    const chatbotContainer = document.querySelector('.chatbot-container');

    if (!chatbotBox || !chatbotContainer) return;

    // Detectar si es un dispositivo móvil
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // Asegurarse de que el chatbot esté visiblemente dentro de la pantalla
        const viewportWidth = window.innerWidth;
        const chatbotWidth = chatbotBox.offsetWidth;

        // Si el chatbot se sale por la derecha
        if (chatbotContainer.getBoundingClientRect().right > viewportWidth) {
            chatbotBox.style.right = '0';
            chatbotBox.style.left = 'auto';
        }

        // Si el chatbot se sale por la izquierda
        if (chatbotContainer.getBoundingClientRect().left < 0) {
            chatbotBox.style.left = '0';
            chatbotBox.style.right = 'auto';
        }
    }
}

// Mostrar el chatbot al hacer clic en el botón de toggle
if (toggleButton) {
    toggleButton.addEventListener('click', () => {
        chatbotBox.style.display = 'flex';
        // Enfocar el campo de entrada cuando se abre el chatbot
        setTimeout(() => inputField.focus(), 100);
        // Ajustar para móviles después de abrir
        setTimeout(adjustChatbotForMobile, 100);
    });
}

// Ocultar el chatbot al hacer clic en el botón de cerrar
if (closeButton) {
    closeButton.addEventListener('click', () => {
        chatbotBox.style.display = 'none';
    });
}

// Ejecutar al cargar y al redimensionar la ventana
window.addEventListener('load', adjustChatbotForMobile);
window.addEventListener('resize', adjustChatbotForMobile);

// ==================== INICIALIZACIÓN ====================

// Verificar el estado del backend al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    const isBackendHealthy = await checkBackendHealth();

    if (!isBackendHealthy) {
        console.warn('El backend no está respondiendo. Algunas funciones pueden no estar disponibles.');
        // Opcional: mostrar un mensaje al usuario
        setTimeout(() => {
            showMessageWithAnimation("Nota: Algunas funciones avanzadas pueden no estar disponibles temporalmente debido a problemas de conexión.", true);
        }, 3000);
    }
});
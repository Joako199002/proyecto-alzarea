// ==================== CONFIGURACIÓN DE URLS ====================
// Determina automáticamente la URL del backend según el entorno
const backendUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://proyecto-alzarea-production.up.railway.app'; // Reemplaza con tu URL real de Railway

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

// Reiniciar la sesión del chatbot al cargar la página
fetch(`${backendUrl}/reiniciar`, {
    method: 'POST',
    credentials: 'include'
}).catch(error => {
    console.error('Error al reiniciar sesión:', error);
});

// Mostrar el chatbot al hacer clic en el botón de toggle
if (toggleButton) {
    toggleButton.addEventListener('click', () => {
        chatbotBox.style.display = 'flex';
        // Enfocar el campo de entrada cuando se abre el chatbot
        setTimeout(() => inputField.focus(), 100);
    });
}

// Ocultar el chatbot al hacer clic en el botón de cerrar
if (closeButton) {
    closeButton.addEventListener('click', () => {
        chatbotBox.style.display = 'none';
    });
}

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

// Función para agregar mensajes al chat
function addMessage(text, sender) {
    if (!messagesContainer) return;

    const message = document.createElement('div');
    message.className = sender + '-message';

    // Verificar si contiene la etiqueta [MOSTRAR_IMAGEN: NOMBRE]
    const regex = /\[MOSTRAR_IMAGEN:\s*([^\]]+)\]/i;
    const match = text.match(regex);

    if (match) {
        const nombreDiseno = match[1].trim();
        const textoSinEtiqueta = text.replace(regex, '').trim();

        // Agregar texto sin la etiqueta
        const textoElem = document.createElement('span');
        textoElem.textContent = textoSinEtiqueta;
        message.appendChild(textoElem);

        // Agregar imagen del diseño
        const img = document.createElement('img');
        img.src = `${backendUrl}/static/disenos/${nombreDiseno}.jpg`;
        img.alt = nombreDiseno;
        img.style.maxWidth = '100%';
        img.style.borderRadius = '8px';
        img.style.marginTop = '5px';
        img.onerror = function () {
            console.error(`Error al cargar la imagen: ${img.src}`);
            this.style.display = 'none';
        };
        message.appendChild(img);
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

// Función para mostrar mensajes con animación de escritura
function showMessageWithAnimation(messageText, isError = false) {
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
        }
    }, 50); // velocidad animación
}

// Función principal para procesar respuestas del chatbot
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

            // Enviar mensaje al backend
            const response = await fetch(`${backendUrl}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mensaje: text }),
                credentials: 'include'
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
        while ((match = regex.exec(mensajeTexto)) !== null) {
            disenos.push(match[1].trim());
            mensajeTexto = mensajeTexto.replace(match[0], '').trim();
        }

        // Crear contenedor del mensaje
        const message = document.createElement('div');
        message.className = 'bot-message';
        const textoElem = document.createElement('span');
        textoElem.textContent = '';
        message.appendChild(textoElem);
        if (messagesContainer) {
            messagesContainer.appendChild(message);
        }

        // Animación de escritura
        let index = 0;
        const intervalo = setInterval(() => {
            if (index < mensajeTexto.length) {
                textoElem.textContent += mensajeTexto.charAt(index);
                index++;
                if (messagesContainer) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            } else {
                clearInterval(intervalo);

                // Agregar imágenes si hay
                if (disenos.length > 0 && messagesContainer) {
                    disenos.forEach(grupo => {
                        grupo.split(',').forEach(d => {
                            const cleanName = d.trim();
                            const normalizedName = cleanName.replace(/ /g, '_');

                            const img = document.createElement('img');
                            img.src = `${backendUrl}/static/disenos/${normalizedName}.jpg`;
                            img.alt = cleanName;
                            img.style.maxWidth = '100%';
                            img.style.borderRadius = '8px';
                            img.style.marginTop = '5px';
                            img.onerror = function () {
                                console.error(`No se pudo cargar: ${normalizedName}.jpg`);
                                this.style.display = 'none';
                            };
                            img.onload = () => {
                                if (messagesContainer) {
                                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                                }
                            };
                            message.appendChild(img);
                        });
                    });
                }
            }
        }, 50); // velocidad animación

    } catch (error) {
        // Asegurarse de eliminar el mensaje "pensando" en caso de error
        removeThinkingMessage();

        // Mostrar mensaje de error con animación
        showMessageWithAnimation("Ocurrió un error al contactar la IA.", true);
        console.error('Error en respond:', error);
    }
}

// ==================== FUNCIONALIDAD PARA SUBIR IMÁGENES ====================

// Al hacer clic en el botón, abrir el selector de imágenes
if (uploadButton) {
    uploadButton.addEventListener('click', () => {
        if (imageInput) {
            imageInput.click();
        }
    });
}

// Al seleccionar una imagen
if (imageInput) {
    imageInput.addEventListener('change', () => {
        const file = imageInput.files[0];
        if (file) {
            const reader = new FileReader();

            reader.onload = function (e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.alt = 'Imagen subida';
                img.style.maxWidth = '100px';
                img.style.borderRadius = '8px';
                img.style.margin = '5px 0';

                const messageDiv = document.createElement('div');
                messageDiv.classList.add('user-message', 'solo-imagen');
                messageDiv.appendChild(img);

                img.onload = function () {
                    if (messagesContainer) {
                        messagesContainer.appendChild(messageDiv);
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                };

                // Enviar imagen al backend
                const formData = new FormData();
                formData.append('imagen', file);

                // Mostrar mensaje "pensando" para la subida de imagen
                thinkingMessage = document.createElement('div');
                thinkingMessage.className = 'bot-message';
                thinkingMessage.textContent = '...';
                if (messagesContainer) {
                    messagesContainer.appendChild(thinkingMessage);
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }

                fetch(`${backendUrl}/subir-imagen`, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                })
                    .then(response => {
                        // Eliminar mensaje "pensando" después de obtener respuesta
                        removeThinkingMessage();

                        if (!response.ok) {
                            throw new Error(`Error del servidor: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (data.reply) {
                            respond(data.reply, true);
                        } else {
                            showMessageWithAnimation("La imagen fue enviada, pero no recibimos respuesta del servidor.", true);
                        }
                    })
                    .catch(error => {
                        // Asegurarse de eliminar el mensaje "pensando" en caso de error
                        removeThinkingMessage();

                        console.error("Error al subir la imagen:", error);
                        showMessageWithAnimation("Ocurrió un error al subir la imagen.", true);
                    });
            };

            reader.readAsDataURL(file);
        }
    });
}
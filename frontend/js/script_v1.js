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

// Variable global para sessionId
let sessionId = localStorage.getItem('chatbot_session_id');
if (!sessionId) {
    sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('chatbot_session_id', sessionId);
}

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', function () {
    // Inicializar componentes
    initMenuHamburguesa();
    initChatbot();
    initCarruseles();
    initBarraSuperior();
    initSubmenus();

    // Verificar estado del backend
    checkBackendHealth().then(isHealthy => {
        if (!isHealthy) {
            console.warn('El backend no está respondiendo. Algunas funciones pueden no estar disponibles.');
            setTimeout(() => {
                showMessageWithAnimation("Nota: Algunas funciones avanzadas pueden no estar disponibles temporalmente debido a problemas de conexión.", true);
            }, 3000);
        }
    });
});

// ==================== FUNCIONES GENERALES ====================
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

// ==================== MENÚ HAMBURGUESA ====================
function initMenuHamburguesa() {
    const menuHamburguesa = document.getElementById('menuHamburguesa');
    const body = document.body;

    if (menuHamburguesa) {
        menuHamburguesa.addEventListener('click', () => {
            body.classList.toggle('menu-abierto');
        });
    }

    // Cerrar el menú al hacer clic en una opción
    const enlacesMenu = document.querySelectorAll('.opciones-menu a');
    enlacesMenu.forEach(enlace => {
        enlace.addEventListener('click', () => {
            body.classList.remove('menu-abierto');
        });
    });
}

// ==================== CHATBOT ====================
function initChatbot() {
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

    // Configurar eventos del chatbot
    if (inputField) {
        inputField.addEventListener('input', autoResizeTextarea);
        inputField.addEventListener("keydown", function (event) {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (sendButton) sendButton.click();
            }
        });
        autoResizeTextarea();
    }

    if (sendButton) {
        sendButton.addEventListener('click', handleSendMessage);
    }

    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            chatbotBox.style.display = 'flex';
            setTimeout(() => inputField.focus(), 100);
            setTimeout(adjustChatbotForMobile, 100);
        });
    }

    if (closeButton) {
        closeButton.addEventListener('click', () => {
            chatbotBox.style.display = 'none';
        });
    }

    // Configurar carga de imágenes
    if (uploadButton) {
        uploadButton.addEventListener('click', () => {
            imageInput.click();
        });
    }

    if (imageInput) {
        imageInput.addEventListener('change', handleImageUpload);
    }

    // Crear botón de reinicio
    createResetButton();

    // Ajustes para móviles
    window.addEventListener('resize', adjustChatbotForMobile);
}

// Función para ajustar automáticamente la altura del textarea
function autoResizeTextarea() {
    const inputField = document.getElementById('chatbot-input');
    if (!inputField) return;

    inputField.style.height = 'auto';
    const scrollHeight = inputField.scrollHeight;
    const maxHeight = 90;

    if (scrollHeight <= maxHeight) {
        inputField.style.height = scrollHeight + 'px';
    } else {
        inputField.style.height = maxHeight + 'px';
    }
}

// Manejar envío de mensajes
function handleSendMessage() {
    const inputField = document.getElementById('chatbot-input');
    if (!inputField) return;

    const userInput = inputField.value.trim();
    if (userInput) {
        addMessage(userInput, 'user');
        respond(userInput);
        inputField.value = '';
        inputField.style.height = '45px';
    }
}

// Función para agregar mensajes al chat
function addMessage(text, sender) {
    const messagesContainer = document.getElementById('chatbot-messages');
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

        // Agregar imágenes de los diseños
        const disenos = nombreDiseno.split(',').map(d => d.trim());
        disenos.forEach(nombreDiseno => {
            const nombreArchivo = mapeoImagenes[nombreDiseno.toUpperCase()] || nombreDiseno;
            const img = createDesignImage(nombreArchivo, nombreDiseno);
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

// Crear imagen de diseño con manejo de errores
function createDesignImage(nombreArchivo, nombreDiseno) {
    const img = document.createElement('img');
    img.src = `${backendUrl}/imagenes/${nombreArchivo}.jpg`;
    img.alt = nombreDiseno;
    img.style.maxWidth = '100%';
    img.style.borderRadius = '8px';
    img.style.marginTop = '5px';

    img.onerror = function () {
        console.error(`Error al cargar la imagen: ${img.src}`);
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
                    newSrc = `${backendUrl}/imagenes/${alternativeNames[nombreDiseno][0]}${extensions[extIndex]}`;
                } else {
                    newSrc = `${backendUrl}/imagenes/${nombreDiseno}${extensions[extIndex]}`;
                }

                currentAttempt++;
                console.log(`Intentando cargar: ${newSrc}`);
                img.src = newSrc;
            } else {
                this.style.display = 'none';
                const errorMsg = document.createElement('div');
                errorMsg.textContent = `No se pudo cargar la imagen de ${nombreDiseno}`;
                errorMsg.style.color = '#d32f2f';
                errorMsg.style.marginTop = '5px';
                errorMsg.style.fontSize = '0.9em';
                this.parentNode.appendChild(errorMsg);
            }
        };

        tryNextImage();
    };

    console.log(`Intentando cargar imagen: ${img.src}`);
    img.onload = function () {
        console.log(`Imagen cargada correctamente: ${img.src}`);
    };

    return img;
}

// Función para eliminar el mensaje "pensando" si existe
function removeThinkingMessage() {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!messagesContainer) return;

    const thinkingMessage = messagesContainer.querySelector('.thinking-message');
    if (thinkingMessage) {
        messagesContainer.removeChild(thinkingMessage);
    }
}

// Función para mostrar mensajes con animación de escritura
function showMessageWithAnimation(messageText, isError = false, disenos = []) {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!messagesContainer) return;

    const message = document.createElement('div');
    message.className = 'bot-message';
    if (isError) {
        message.style.color = '#d32f2f';
    }

    const textoElem = document.createElement('span');
    textoElem.textContent = '';
    message.appendChild(textoElem);
    messagesContainer.appendChild(message);

    let index = 0;
    const intervalo = setInterval(() => {
        if (index < messageText.length) {
            textoElem.textContent += messageText.charAt(index);
            index++;
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else {
            clearInterval(intervalo);

            if (disenos.length > 0) {
                disenos.forEach(nombreDiseno => {
                    const nombreArchivo = mapeoImagenes[nombreDiseno.toUpperCase()] || nombreDiseno;
                    const img = createDesignImage(nombreArchivo, nombreDiseno);
                    message.appendChild(img);
                });
            }
        }
    }, 50);
}

// Función principal para procesar respuestas del chatbot
async function respond(text, isDirectReply = false) {
    try {
        let mensajeTexto = text;
        let disenos = [];

        if (!isDirectReply) {
            // Mostrar "pensando..."
            const messagesContainer = document.getElementById('chatbot-messages');
            if (messagesContainer) {
                const thinkingMsg = document.createElement('div');
                thinkingMsg.className = 'bot-message thinking-message';
                thinkingMsg.textContent = '...';
                messagesContainer.appendChild(thinkingMsg);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }

            // Enviar mensaje al backend
            const response = await fetch(`${backendUrl}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: "include",
                body: JSON.stringify({
                    mensaje: text,
                    sessionId: sessionId
                })
            });

            removeThinkingMessage();

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

        // Detectar etiquetas [MOSTRAR_IMAGEN: ...]
        const regex = /\[MOSTRAR_IMAGEN:\s*([^\]]+)\]/gi;
        let match;

        while ((match = regex.exec(mensajeTexto)) !== null) {
            const disenosEncontrados = match[1].split(',').map(d => d.trim());
            disenos.push(...disenosEncontrados);
        }

        const textoSinEtiquetas = mensajeTexto.replace(regex, '').trim();
        showMessageWithAnimation(textoSinEtiquetas, false, disenos);

    } catch (error) {
        removeThinkingMessage();

        if (error.message.includes('Failed to fetch')) {
            showMessageWithAnimation("Error de conexión con el servidor. Por favor, intenta nuevamente.", true);
        } else {
            showMessageWithAnimation("Ocurrió un error al procesar tu solicitud.", true);
        }

        console.error('Error en respond:', error);
    }
}

// Función para reiniciar la conversación
function reiniciarConversacion() {
    fetch(`${backendUrl}/reiniciar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId })
    })
        .then(response => response.json())
        .then(data => {
            console.log('Conversación reiniciada:', data);
            const messagesContainer = document.getElementById('chatbot-messages');
            if (messagesContainer) {
                messagesContainer.innerHTML = '';
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

// Crear botón de reinicio
function createResetButton() {
    const resetButton = document.createElement('button');
    resetButton.id = 'reset-button';
    resetButton.textContent = '🔄 Reiniciar';

    const chatbotInput = document.querySelector('.chatbot-input');
    const uploadButton = document.getElementById('upload-button');

    if (chatbotInput && uploadButton) {
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'chatbot-buttons-container';

        uploadButton.parentNode.removeChild(uploadButton);
        buttonsContainer.appendChild(uploadButton);
        buttonsContainer.appendChild(resetButton);

        const inputField = document.getElementById('chatbot-input');
        inputField.parentNode.insertBefore(buttonsContainer, inputField);

        resetButton.addEventListener('click', reiniciarConversacion);
    }
}

// Manejar carga de imágenes
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

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

        const messagesContainer = document.getElementById('chatbot-messages');
        if (messagesContainer) {
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            showMessageWithAnimation("Analizando imagen...", false, []);
            setTimeout(() => uploadImageToBackend(file), 1000);
        }
    };
    reader.readAsDataURL(file);
}

// Subir imagen al backend
async function uploadImageToBackend(file) {
    try {
        const formData = new FormData();
        formData.append('imagen', file);
        formData.append('sessionId', sessionId);

        const response = await fetch(`${backendUrl}/subir-imagen`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Error del servidor: ${response.status}`);
        }

        const data = await response.json();
        if (data.reply) {
            respond(data.reply, true);
        } else {
            showMessageWithAnimation("La imagen fue enviada, pero no recibimos respuesta del servidor.", true);
        }
    } catch (error) {
        console.error("Error al subir la imagen:", error);
        showMessageWithAnimation("Ocurrió un error al subir la imagen. Por favor, intenta de nuevo.", true);
    }
}

// Ajustar el chatbot para dispositivos móviles
function adjustChatbotForMobile() {
    const chatbotBox = document.querySelector('.chatbot-box');
    const chatbotContainer = document.querySelector('.chatbot-container');

    if (!chatbotBox || !chatbotContainer) return;

    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        const viewportWidth = window.innerWidth;
        if (chatbotContainer.getBoundingClientRect().right > viewportWidth) {
            chatbotBox.style.right = '0';
            chatbotBox.style.left = 'auto';
        }
        if (chatbotContainer.getBoundingClientRect().left < 0) {
            chatbotBox.style.left = '0';
            chatbotBox.style.right = 'auto';
        }
    }
}

// ==================== CARRUSELES ====================
function initCarruseles() {
    initCarrusel('carruselIzquierda');
    initCarrusel('carruselDerecha');
}

function initCarrusel(carruselId) {
    const carrusel = document.getElementById(carruselId);
    if (!carrusel) return;

    const inner = carrusel.querySelector('.carrusel-inner');
    const items = carrusel.querySelectorAll('.carrusel-item');
    const prevBtn = carrusel.querySelector('.carrusel-prev');
    const nextBtn = carrusel.querySelector('.carrusel-next');
    const indicadoresContainer = carrusel.querySelector('.carrusel-indicadores');

    let currentIndex = 0;
    const totalItems = items.length;

    // Crear indicadores
    for (let i = 0; i < totalItems; i++) {
        const indicador = document.createElement('button');
        indicador.classList.add('carrusel-indicador');
        if (i === 0) indicador.classList.add('active');
        indicador.addEventListener('click', () => goToSlide(i));
        indicadoresContainer.appendChild(indicador);
    }

    // Función para ir a una slide específica
    function goToSlide(index) {
        if (index < 0) index = totalItems - 1;
        if (index >= totalItems) index = 0;

        inner.style.transform = `translateX(-${index * 100}%)`;
        currentIndex = index;

        carrusel.querySelectorAll('.carrusel-indicador').forEach((ind, i) => {
            ind.classList.toggle('active', i === currentIndex);
        });
    }

    // Event listeners para botones
    if (prevBtn) prevBtn.addEventListener('click', () => goToSlide(currentIndex - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => goToSlide(currentIndex + 1));

    // Auto avanzar slides
    setInterval(() => goToSlide(currentIndex + 1), 4000);

    // Soporte para deslizar en dispositivos táctiles
    let startX = 0;
    let currentX = 0;

    carrusel.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
    });

    carrusel.addEventListener('touchmove', (e) => {
        currentX = e.touches[0].clientX;
    });

    carrusel.addEventListener('touchend', () => {
        const diff = startX - currentX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) {
                goToSlide(currentIndex + 1);
            } else {
                goToSlide(currentIndex - 1);
            }
        }
    });
}

// ==================== BARRA SUPERIOR ====================
function initBarraSuperior() {
    const menuHamburguesaSuperior = document.getElementById('menuHamburguesaSuperior');
    const opcionesMenu = document.getElementById('opcionesMenu');
    const body = document.body;
    const iconoBusqueda = document.getElementById('icono-busqueda');
    const iconoBusquedaMovil = document.getElementById('icono-busqueda-movil');
    const barraBusqueda = document.getElementById('barraBusqueda');
    const cerrarBusqueda = document.getElementById('cerrarBusqueda');
    const inputBusqueda = barraBusqueda ? barraBusqueda.querySelector('input') : null;

    // Alternar menú superior
    if (menuHamburguesaSuperior) {
        menuHamburguesaSuperior.addEventListener('click', function (e) {
            e.stopPropagation();
            body.classList.toggle('menu-abierto');
        });
    }

    // Cerrar menú al hacer clic fuera
    document.addEventListener('click', function (e) {
        if (opcionesMenu && !opcionesMenu.contains(e.target) && menuHamburguesaSuperior && !menuHamburguesaSuperior.contains(e.target)) {
            body.classList.remove('menu-abierto');
        }
    });

    // Funcionalidad barra de búsqueda
    function activarBarraBusqueda(e) {
        e.preventDefault();
        barraBusqueda.classList.add('activa');
        setTimeout(() => inputBusqueda.focus(), 100);
    }

    function cerrarBarraBusqueda(e) {
        e.stopPropagation();
        barraBusqueda.classList.remove('activa');
        inputBusqueda.value = '';
    }

    if (iconoBusqueda && barraBusqueda && cerrarBusqueda) {
        iconoBusqueda.addEventListener('click', activarBarraBusqueda);
    }

    // Agregar evento para el icono de búsqueda móvil
    if (iconoBusquedaMovil && barraBusqueda && cerrarBusqueda) {
        iconoBusquedaMovil.addEventListener('click', activarBarraBusqueda);
    }

    if (cerrarBusqueda) {
        cerrarBusqueda.addEventListener('click', cerrarBarraBusqueda);
    }

    // Cerrar barra de búsqueda al hacer clic fuera
    document.addEventListener('click', function (e) {
        if (barraBusqueda && barraBusqueda.classList.contains('activa') &&
            !barraBusqueda.contains(e.target) &&
            e.target !== iconoBusqueda &&
            e.target !== iconoBusquedaMovil) {
            barraBusqueda.classList.remove('activa');
        }
    });

    // Prevenir que el clic en la barra de búsqueda la cierre
    if (barraBusqueda) {
        barraBusqueda.addEventListener('click', function (e) {
            e.stopPropagation();
        });
    }
}

// ==================== SUBMENÚS (CORREGIDO) ====================
function initSubmenus() {
    const menuItemsConSubmenu = document.querySelectorAll('.menu-con-submenu > a');

    menuItemsConSubmenu.forEach(item => {
        item.addEventListener('click', function (e) {
            if (window.innerWidth <= 768) {
                e.preventDefault();
                e.stopPropagation(); // Evita que el evento se propague al document

                const submenu = this.nextElementSibling;
                const estaAbierto = submenu.classList.contains('mostrar');

                // Cerrar otros submenús abiertos
                document.querySelectorAll('.submenu').forEach(sm => {
                    if (sm !== submenu) {
                        sm.classList.remove('mostrar');
                        // Remover clase de submenú abierto de otros elementos
                        sm.previousElementSibling.classList.remove('submenu-abierto');
                    }
                });

                // Alternar estado del submenu actual
                if (!estaAbierto) {
                    submenu.classList.add('mostrar');
                    this.classList.add('submenu-abierto');
                } else {
                    submenu.classList.remove('mostrar');
                    this.classList.remove('submenu-abierto');
                }
            }
        });
    });

    // Cerrar submenús al hacer clic fuera de ellos (solo en móviles)
    document.addEventListener('click', function (e) {
        if (window.innerWidth <= 768) {
            const submenuAbierto = document.querySelector('.submenu.mostrar');
            const enlaceSubmenu = document.querySelector('.menu-con-submenu > a.submenu-abierto');

            if (submenuAbierto && !submenuAbierto.contains(e.target) &&
                enlaceSubmenu && !enlaceSubmenu.contains(e.target)) {
                submenuAbierto.classList.remove('mostrar');
                enlaceSubmenu.classList.remove('submenu-abierto');
            }
        }
    });

    // Prevenir que los clics dentro del submenu cierren el submenu
    document.querySelectorAll('.submenu').forEach(submenu => {
        submenu.addEventListener('click', function (e) {
            e.stopPropagation();
        });
    });
}
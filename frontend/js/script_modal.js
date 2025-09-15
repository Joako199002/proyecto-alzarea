// Datos de los productos (precios y descripciones detalladas)
const productosData = {
    "cenefa": {
        nombre: "CENEFA",
        precio: "$1,139.00",
        descripcion: "Vestido midi de silueta estilizada con godets.",
        imagen: "imagenes/CENEFA.jpg"
    },
    "friso": {
        nombre: "FRISO",
        precio: "$1,194.00",
        descripcion: "Vestido largo hasta los tobillos con escote halter y espalda abierta.",
        imagen: "imagenes/FRISO_FLOWER.jpg"
    },
    "sophie": {
        nombre: "SOPHIE",
        precio: "$1,528.00",
        descripcion: "Chaqueta estructurada de líneas limpias, diseñada para llevarse como prenda única.",
        imagen: "imagenes/SOPHIE.jpg"
    },
    "liria": {
        nombre: "LIRIA",
        precio: "$673.00",
        descripcion: "Pantalón de talle alto con cinturilla estructurada y pierna recta para un acabado clásico y versátil.",
        imagen: "imagenes/LIRIA_WHITE.jpg"
    },
    "almena": {
        nombre: "ALMENA",
        precio: "$1,184.00",
        descripcion: "Vestido sin mangas con escote barco.",
        imagen: "imagenes/ROJO.jpg"
    },
    "afra": {
        nombre: "AFRA",
        precio: "$507.00",
        descripcion: "Falda de talle alto con silueta limpia y fluida.",
        imagen: "imagenes/SKIRT_BLACK.jpg"
    },
    "bruma": {
        nombre: "BRUMA",
        precio: "$1,150.00",
        descripcion: "Top con volumen en el pecho y ajuste ceñido.",
        imagen: "imagenes/WEIRD.jpg"
    },
    "raiz": {
        nombre: "RAIZ",
        precio: "$1,525.00",
        descripcion: "Vestido asimétrico largo hasta los tobillos con diseño estructurado.",
        imagen: "imagenes/ALMENA.jpg"
    },
    "dalia": {
        nombre: "DALIA",
        precio: "$1,296.00",
        descripcion: "Chaleco estructurado de silueta limpia y elegante, diseñado como prenda única.",
        imagen: "imagenes/VEST.jpg"
    }

};

// Obtener elementos del DOM
const modal = document.getElementById('modalProducto'); // Modal de producto
const modalImagen = document.getElementById('modalImagen'); // Imagen en el modal
const modalNombre = document.getElementById('modalNombre'); // Nombre en el modal
const modalPrecio = document.getElementById('modalPrecio'); // Precio en el modal
const modalDescripcion = document.getElementById('modalDescripcion'); // Descripción en el modal
const modalCerrar = document.getElementById('modalCerrar'); // Botón cerrar modal
const productos = document.querySelectorAll('.producto:not(.vacio)'); // Todos los productos (excepto vacíos)

// Función para abrir el modal con la información del producto
function abrirModal(productoId) {
    const producto = productosData[productoId]; // Obtener datos del producto

    if (producto) {
        modalImagen.src = producto.imagen; // Establecer imagen del producto
        modalImagen.alt = producto.nombre; // Establecer texto alternativo
        modalNombre.textContent = producto.nombre; // Establecer nombre
        modalPrecio.textContent = producto.precio; // Establecer precio
        modalDescripcion.textContent = producto.descripcion; // Establecer descripción
        modal.style.display = 'block'; // Mostrar el modal
        document.body.style.overflow = 'hidden'; // Deshabilitar scroll del body
    }
}

// Función para cerrar el modal
function cerrarModal() {
    modal.style.display = 'none'; // Ocultar el modal
    document.body.style.overflow = 'auto'; // Habilitar scroll del body
}

// Agregar event listener a cada producto
productos.forEach(producto => {
    producto.addEventListener('click', () => {
        const productoId = producto.getAttribute('data-producto'); // Obtener ID del producto
        abrirModal(productoId); // Abrir modal con el producto
    });
});

// Cerrar modal al hacer clic en la X
modalCerrar.addEventListener('click', cerrarModal);

// Cerrar modal al hacer clic fuera del contenido
modal.addEventListener('click', (event) => {
    if (event.target === modal) { // Si se hizo clic en el fondo del modal
        cerrarModal(); // Cerrar modal
    }
});

// Cerrar modal con la tecla Escape
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.style.display === 'block') { // Si se presionó Escape y el modal está abierto
        cerrarModal(); // Cerrar modal
    }
});

// ****** mEJORAR INTERACCION DEL PRODUCTO  ********

// Función para prevenir el scroll del fondo cuando el modal está abierto
function toggleBodyScroll(enable) {
    if (enable) {
        document.body.style.overflow = 'auto';
    } else {
        document.body.style.overflow = 'hidden';
    }
}

// Modifica la función abrirModal
function abrirModal(productoId) {
    const producto = productosData[productoId];

    if (producto) {
        modalImagen.src = producto.imagen;
        modalImagen.alt = producto.nombre;
        modalNombre.textContent = producto.nombre;
        modalPrecio.textContent = producto.precio;
        modalDescripcion.textContent = producto.descripcion;
        modal.style.display = 'block';
        toggleBodyScroll(false); // Deshabilita scroll del body
    }
}

// Modifica la función cerrarModal
function cerrarModal() {
    modal.style.display = 'none';
    toggleBodyScroll(true); // Habilita scroll del body
}

// Agrega este evento para manejar el cierre con gestos táctiles
modal.addEventListener('touchstart', function (e) {
    if (e.target === modal) {
        cerrarModal();
    }
});
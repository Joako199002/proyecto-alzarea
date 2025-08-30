// Datos de los productos (precios y descripciones detalladas)
const productosData = {
    cenefa: {
        nombre: "CENEFA",
        precio: "$299.000",
        descripcion: "Elegante vestido de noche con detalles únicos en acabados premium. Confeccionado con los mejores materiales para brindar comodidad y estilo. Ideal para eventos formales y ocasiones especiales.",
        imagen: "imagenes/CENEFA.jpg"
    },
    friso: {
        nombre: "FRISO",
        precio: "$275.000",
        descripcion: "Diseño moderno con cortes innovadores que garantizan máxima comodidad y elegancia. Perfecto para quienes buscan un equilibrio entre tendencia y comodidad.",
        imagen: "imagenes/FRISO_FLOWER.jpg"
    },
    sophie: {
        nombre: "SOPHIE",
        precio: "$325.000",
        descripcion: "Vestido sofisticado con inspiración en las tendencias contemporáneas más exclusivas. Destaca por su corte perfecto y materiales de primera calidad.",
        imagen: "imagenes/SOPHIE.jpg"
    },
    liria: {
        nombre: "LIRIA",
        precio: "$285.000",
        descripcion: "Modelo clásico reinventado con un toque de modernidad que no pasa desapercibido. La combinación perfecta entre tradición y vanguardia en diseño de moda.",
        imagen: "imagenes/LIRIA_WHITE.jpg"
    },
    almena: {
        nombre: "ALMENA",
        precio: "$310.000",
        descripcion: "Diseño exclusivo que representa la esencia y valores de nuestra marca. Un vestido que comunica elegancia y distinción en cada detalle.",
        imagen: "imagenes/ALMENA.jpg"
    },
    skirt: {
        nombre: "SKIRT",
        precio: "$315.000",
        descripcion: "Variación mejorada del modelo CENEFA con detalles refinados y materiales de mayor calidad. La evolución de un clásico hacia la perfección.",
        imagen: "imagenes/SKIRT_BLACK.jpg"
    },
    weird: {
        nombre: "WEIRD",
        precio: "$315.000",
        descripcion: "Variación mejorada del modelo CENEFA con detalles refinados y materiales de mayor calidad. La evolución de un clásico hacia la perfección.",
        imagen: "imagenes/WEIRD.jpg"
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
// Datos de los accesorios (precios y descripciones detalladas)
const productosData = {
    "zapatillas1": {
        nombre: "ZAR",
        precio: "$299.000",
        descripcion: "Zapatos destalonados en tejido de fibra natural con rejilla semitransparente. Diseño cómodo y elegante perfecto para ocasiones informales y looks casuales chic.",
        imagen: "imagenes/zapatillas1.jpg"
    },
    "zapatillas2": {
        nombre: "ZAN",
        precio: "$275.000",
        descripcion: "Zapatos en tejido natural bordado y detalles en raso negro. Combinación perfecta entre artesanía tradicional y diseño contemporáneo.",
        imagen: "imagenes/zapatillas2.jpg"
    },
    "zapatillas3": {
        nombre: "ZAB",
        precio: "$325.000",
        descripcion: "Sandalia de tacón ancho con tejido entramado y espiga dorada. Ideal para eventos especiales, combina comodidad y elegancia en su máxima expresión.",
        imagen: "imagenes/zapatillas3.jpg"
    },
    "clutch": {
        nombre: "CLUB",
        precio: "$285.000",
        descripcion: "Clutch beige entretejido con hilos dorados en patrón de espiga. Diseño exclusivo con capacidad suficiente para tus essentials, perfecto para noches especiales.",
        imagen: "imagenes/clutch1.jpg"
    },
    "pendiente-cala": {
        nombre: "Pendientes CALA",
        precio: "$185.000",
        descripcion: "Pendientes CALA en plata de ley 925 y chapado en oro 18k. Diseño floral delicado que aporta elegancia y sofisticación a cualquier look.",
        imagen: "imagenes/pendientes_cala.jpg"
    },
    "pulsera-cala": {
        nombre: "Pulsera CALA",
        precio: "$210.000",
        descripcion: "Pulsera CALA en plata de ley 925 y chapado en oro 18k. Diseño refinado con detalles florales, ajustable para mayor comodidad.",
        imagen: "imagenes/pulsera_cala.jpg"
    },
    "anillo-alheli": {
        nombre: "Anillo ALHELI",
        precio: "$150.000",
        descripcion: "Anillo ALHELÍ en plata de ley 925 y chapado en oro 18k. Diseño floral contemporáneo que realza la belleza natural con elegancia.",
        imagen: "imagenes/ANILLI_ALHELI.jpg"
    },
    "colgante-alheli": {
        nombre: "Colgante ALHELI",
        precio: "$220.000",
        descripcion: "Colgante ALHELÍ en plata de ley 925 y chapado en oro 18k con cadena de 45cm. Pieza versátil que complementa cualquier estilo con distinción.",
        imagen: "imagenes/COLGANTE_ALHELI.jpg"
    },
    "anillo-jacinta": {
        nombre: "Anillo JACINTA",
        precio: "$175.000",
        descripcion: "Anillo JACINTA en plata de ley 925 y chapado en oro 18k (4x2cm). Diseño arquitectónico inspirado en la naturaleza, para quienes buscan piezas únicas.",
        imagen: "imagenes/ANILLO_JACINTA.jpg"
    }
};

// Obtener elementos del DOM
const modal = document.getElementById('modalProducto');
const modalImagen = document.getElementById('modalImagen');
const modalNombre = document.getElementById('modalNombre');
const modalPrecio = document.getElementById('modalPrecio');
const modalDescripcion = document.getElementById('modalDescripcion');
const modalCerrar = document.getElementById('modalCerrar');
const productos = document.querySelectorAll('.producto:not(.vacio)');

// Función para prevenir el scroll del fondo cuando el modal está abierto
function toggleBodyScroll(enable) {
    if (enable) {
        document.body.style.overflow = 'auto';
    } else {
        document.body.style.overflow = 'hidden';
    }
}

// Función para abrir el modal con la información del producto
function abrirModal(productoId) {
    const producto = productosData[productoId];

    if (producto) {
        modalImagen.src = producto.imagen;
        modalImagen.alt = producto.nombre;
        modalNombre.textContent = producto.nombre;
        modalPrecio.textContent = producto.precio;
        modalDescripcion.textContent = producto.descripcion;
        modal.style.display = 'block';
        toggleBodyScroll(false);
    }
}

// Función para cerrar el modal
function cerrarModal() {
    modal.style.display = 'none';
    toggleBodyScroll(true);
}

// Agregar event listener a cada producto
productos.forEach(producto => {
    producto.addEventListener('click', () => {
        const productoId = producto.getAttribute('data-producto');
        abrirModal(productoId);
    });
});

// Cerrar modal al hacer clic en la X
modalCerrar.addEventListener('click', cerrarModal);

// Cerrar modal al hacer clic fuera del contenido
modal.addEventListener('click', (event) => {
    if (event.target === modal) {
        cerrarModal();
    }
});

// Cerrar modal con la tecla Escape
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.style.display === 'block') {
        cerrarModal();
    }
});

// Agregar evento para manejar el cierre con gestos táctiles
modal.addEventListener('touchstart', function (e) {
    if (e.target === modal) {
        cerrarModal();
    }
});
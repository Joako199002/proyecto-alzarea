// Mejora la experiencia táctil para el slider en móviles
document.addEventListener('DOMContentLoaded', function () {
    const contenedor = document.querySelector('.contenedor');
    let startX;
    let scrollLeft;
    let isDown = false;

    // Solo aplicar en dispositivos táctiles
    if ('ontouchstart' in window) {
        contenedor.addEventListener('touchstart', function (e) {
            isDown = true;
            startX = e.touches[0].pageX - contenedor.offsetLeft;
            scrollLeft = contenedor.scrollLeft;
        });

        contenedor.addEventListener('touchmove', function (e) {
            if (!isDown) return;
            e.preventDefault();
            const x = e.touches[0].pageX - contenedor.offsetLeft;
            const walk = (x - startX) * 2;
            contenedor.scrollLeft = scrollLeft - walk;
        });

        contenedor.addEventListener('touchend', function () {
            isDown = false;
        });
    }
});
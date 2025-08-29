// ==================== CÓDIGO PARA LOS POP-UPS DE NEWSLETTER ====================

// Obtener elementos del DOM para los pop-ups
const newsletterPopup = document.getElementById('newsletterPopup');
const thankyouPopup = document.getElementById('thankyouPopup');
const overlay = document.getElementById('overlay');
const closePopupBtn = document.getElementById('closePopup');
const closeThankyouPopupBtn = document.getElementById('closeThankyouPopup');
const acceptThankyouBtn = document.getElementById('acceptThankyou');
const newsletterForm = document.getElementById('newsletterForm');

// Mostrar el pop-up de newsletter después de un retraso
function showNewsletterPopup() {
    setTimeout(() => {
        newsletterPopup.classList.add('popup-visible');
        overlay.classList.add('overlay-visible');
        document.body.style.overflow = 'hidden'; // Prevenir scroll
    }, 2000); // Mostrar después de 2 segundos
}

// Cerrar el pop-up de newsletter
function closeNewsletterPopup() {
    newsletterPopup.classList.remove('popup-visible');
    overlay.classList.remove('overlay-visible');
    document.body.style.overflow = 'auto'; // Permitir scroll nuevamente
}

// Mostrar el pop-up de agradecimiento
function showThankyouPopup() {
    thankyouPopup.classList.add('popup-visible');
    overlay.classList.add('overlay-visible');
}

// Cerrar el pop-up de agradecimiento
function closeThankyouPopup() {
    thankyouPopup.classList.remove('popup-visible');
    overlay.classList.remove('overlay-visible');
    document.body.style.overflow = 'auto'; // Permitir scroll nuevamente
}

// Manejar el envío del formulario
function handleNewsletterSubmit(e) {
    e.preventDefault();

    const email = document.getElementById('newsletterEmail').value;

    // Validar el email
    if (!validateEmail(email)) {
        alert('Por favor, ingresa un correo electrónico válido.');
        return;
    }

    // Aquí iría el código para enviar el email a tu base de datos o servicio

    // Cerrar el pop-up de newsletter y mostrar el de agradecimiento
    closeNewsletterPopup();
    showThankyouPopup();
}

// Validar formato de email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Event listeners para los pop-ups
document.addEventListener('DOMContentLoaded', function () {
    // Asegurarse de que el DOM está completamente cargado antes de mostrar el popup
    showNewsletterPopup();
});

closePopupBtn.addEventListener('click', closeNewsletterPopup);
closeThankyouPopupBtn.addEventListener('click', closeThankyouPopup);
acceptThankyouBtn.addEventListener('click', closeThankyouPopup);
newsletterForm.addEventListener('submit', handleNewsletterSubmit);

// Cerrar pop-ups al hacer clic fuera del contenido
overlay.addEventListener('click', function (e) {
    if (e.target === overlay) {
        closeNewsletterPopup();
        closeThankyouPopup();
    }
});

// Cerrar pop-ups con la tecla Escape
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeNewsletterPopup();
        closeThankyouPopup();
    }
});
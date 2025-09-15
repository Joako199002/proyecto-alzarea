document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("red-container");
    const canvas = document.getElementById("network-canvas");
    const ctx = canvas.getContext("2d");

    // Ajustar tamaño del canvas al contenedor
    function resizeCanvas() {
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // Datos de testimonios
    const testimonios = [
        {
            nombre: "Elena Martínez",
            texto:
                "Gracias a ALZÁREA, he podido colaborar con diseñadoras emergentes y llevar mis creaciones a un público más amplio.",
        },
        {
            nombre: "Carmen Rodríguez",
            texto:
                "Ser parte de esta red me ha permitido crecer profesionalmente y encontrar nuevas oportunidades en el sector de la moda.",
        },
        {
            nombre: "Lucía Fernández",
            texto:
                "Aquí encontré un espacio seguro para compartir ideas y desarrollar proyectos colaborativos en moda sostenible.",
        },
        {
            nombre: "María Gómez",
            texto:
                "Lo que más valoro es la solidaridad y el apoyo entre todas las mujeres que formamos parte de ALZÁREA.",
        },
        {
            nombre: "Sofía López",
            texto:
                "He podido conectar con clientas que buscan diseños únicos y con valores de responsabilidad social.",
        },
        {
            nombre: "Ana Torres",
            texto:
                "Esta red me inspira cada día a seguir trabajando con pasión y a transmitir tradición e innovación en cada prenda.",
        },
    ];

    // Crear tarjetas
    testimonios.forEach((t, i) => {
        const card = document.createElement("div");
        card.classList.add("tarjeta-red");
        card.innerHTML = `
      <p class="texto-testimonio">"${t.texto}"</p>
      <h4 class="nombre-testimonio">- ${t.nombre}</h4>
    `;
        // Posición inicial (random)
        card.style.top = `${20 + (i % 3) * 30 + Math.random() * 5}%`;
        card.style.left = `${15 + (i % 2) * 35 + Math.random() * 10}%`;
        container.appendChild(card);
    });

    // Obtener posiciones de tarjetas
    function getCardCenters() {
        const cards = document.querySelectorAll(".tarjeta-red");
        return Array.from(cards).map((card) => {
            const rect = card.getBoundingClientRect();
            const contRect = container.getBoundingClientRect();
            return {
                x: rect.left + rect.width / 2 - contRect.left,
                y: rect.top + rect.height / 2 - contRect.top,
            };
        });
    }

    // Dibujar red
    function drawNetwork() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const centers = getCardCenters();

        centers.forEach((c, i) => {
            // Conectar con 1 o 2 tarjetas al azar
            const conexiones = Math.floor(Math.random() * 2) + 1;
            for (let j = 0; j < conexiones; j++) {
                const randIndex = Math.floor(Math.random() * centers.length);
                if (randIndex !== i) {
                    const c2 = centers[randIndex];

                    // Línea curva (Bezier)
                    ctx.beginPath();
                    ctx.moveTo(c.x, c.y);
                    const cpX = (c.x + c2.x) / 2 + (Math.random() * 40 - 20);
                    const cpY = (c.y + c2.y) / 2 + (Math.random() * 40 - 20);
                    ctx.quadraticCurveTo(cpX, cpY, c2.x, c2.y);
                    ctx.strokeStyle = "rgba(0,0,0,0.15)";
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    // Nodo en el punto medio
                    const midX = (c.x + c2.x) / 2;
                    const midY = (c.y + c2.y) / 2;
                    ctx.beginPath();
                    ctx.arc(midX, midY, 4, 0, Math.PI * 2);
                    ctx.fillStyle = "#d4a373";
                    ctx.fill();
                }
            }
        });
    }

    // Redibujar en intervalos (para refrescar aleatoriedad)
    drawNetwork();
    setInterval(drawNetwork, 5000);
});

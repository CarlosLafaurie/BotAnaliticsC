const socket = io();
const logs = document.getElementById('logs');
const tableBody = document.querySelector('#results tbody');

const runPending = document.getElementById('runPending');
const runAll = document.getElementById('runAll');

// --- VARIABLES PARA PAGINACIÓN ---
let allResults = [];
let currentPage = 1;
const itemsPerPage = 25;

// -------------------------------
// 🔥 LOGS EN TIEMPO REAL
// -------------------------------
socket.on('connect_error', (err) => {
  console.error("❌ ERROR: No se pudo conectar a socket.io", err);
});

socket.on('analyzer_log', msg => {
  const line = document.createElement('div');
  line.textContent = msg;
  logs.appendChild(line);
  logs.scrollTop = logs.scrollHeight;
});

socket.on('analyzer_done', code => {
  const doneMsg = document.createElement('div');
  doneMsg.textContent = `✅ Análisis finalizado (código ${code})`;
  logs.appendChild(doneMsg);

  loadResults();
});

// -------------------------------
// ▶ BOTONES SUPERIORES
// -------------------------------
runPending.addEventListener('click', async () => {
  const res = await fetch('/run/pending', { method: 'POST' });
  if (!res.ok) console.error("❌ ERROR en /run/pending:", res.status);

  logs.innerHTML += "▶ Analizando solo pendientes...\n";
});

runAll.addEventListener('click', async () => {
  const res = await fetch('/run/all', { method: 'POST' });
  if (!res.ok) console.error("❌ ERROR en /run/all:", res.status);

  logs.innerHTML += "🔄 Re-analizando TODOS los sitios...\n";
});

// -------------------------------
// 📌 Cargar resultados desde la BD
// -------------------------------
async function loadResults() {
  const res = await fetch('/resultados');
  if (!res.ok) {
    console.error("❌ ERROR al obtener /resultados:", res.status);
    return;
  }

  const data = await res.json();

  if (!Array.isArray(data)) {
    console.error("❌ ERROR: /resultados NO devolvió un array");
    return;
  }

  // Guardamos todos los registros en memoria
  allResults = data;

  // Renderizamos la primera página
  currentPage = 1;
  renderPage();
}

// -------------------------------
// 📄 Renderizar página
// -------------------------------
function renderPage() {
  tableBody.innerHTML = "";

  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = allResults.slice(start, end);

  pageItems.forEach(row => {
    let detalles = row.detalles;

    if (typeof detalles === "string") {
      try {
        detalles = JSON.parse(detalles);
      } catch {
        detalles = {};
      }
    }

    const detallesHTML = Object.entries(detalles || {})
      .map(([key, value]) => `
        <div class="detalle-item ${value ? 'ok' : 'fail'}">
          ${value ? '✅' : '❌'} <strong>${key}</strong>
        </div>
      `)
      .join('');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="${row.url}" target="_blank">${row.sitio}</a></td>
      <td>${row.puntuacion_total}</td>
      <td>${row.tecnologias_detectadas || '-'}</td>
      <td><div class="detalles">${detallesHTML}</div></td>
      <td>
        <button class="analyze-btn" data-id="${row.id}" data-url="${row.url}">
          🔍 Analizar
        </button>
      </td>
    `;

    tableBody.appendChild(tr);
  });

  addAnalyzeListeners();
  renderPagination();
}

// -------------------------------
// 🔘 Listeners de botones individuales
// -------------------------------
function addAnalyzeListeners() {
  document.querySelectorAll('.analyze-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;

      const res = await fetch(`/run/${id}`, { method: "POST" });
      if (!res.ok) console.error("❌ ERROR en /run/:id:", res.status);

      logs.innerHTML += `🔍 Re-analizando ${btn.dataset.url}...\n`;
    });
  });
}

// -------------------------------
// 📌 Controles de paginación
// -------------------------------
function renderPagination() {
  const totalPages = Math.ceil(allResults.length / itemsPerPage);

  const pagination = document.getElementById("pagination");
  if (!pagination) return;

  pagination.innerHTML = "";

  const prev = document.createElement("button");
  prev.textContent = "⬅ Anterior";
  prev.disabled = currentPage === 1;
  prev.onclick = () => { currentPage--; renderPage(); };
  pagination.appendChild(prev);

  const info = document.createElement("span");
  info.textContent = ` Página ${currentPage} de ${totalPages} `;
  info.style.margin = "0 10px";
  pagination.appendChild(info);

  const next = document.createElement("button");
  next.textContent = "Siguiente ➡";
  next.disabled = currentPage === totalPages;
  next.onclick = () => { currentPage++; renderPage(); };
  pagination.appendChild(next);
}

const exportExcel = document.getElementById("exportExcel");

exportExcel.addEventListener('click', () => {
  window.location.href = "/export/excel";
});

loadResults();

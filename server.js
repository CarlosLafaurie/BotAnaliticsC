import express from 'express';
import { spawn } from 'child_process';
import { pool } from './db.js';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { analizarSitio } from './analyzer.js';
import ExcelJS from 'exceljs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🔄 Ejecutar analyzer.js automáticamente al iniciar
function runAnalyzer() {
  const process = spawn('node', ['analyzer.js']);

  process.stdout.on('data', data => {
    io.emit('analyzer_log', data.toString());
  });

  process.stderr.on('data', data => {
    io.emit('analyzer_log', `[ERROR] ${data}`);
  });

  process.on('close', code => {
    io.emit('analyzer_done', code);
  });
}

app.post('/run/pending', async (req, res) => {
  console.log("▶ Ejecutando análisis SOLO de pendientes...");
  runAnalyzer();
  res.json({ status: 'pending_analysis_started' });
});

app.post('/run/all', async (req, res) => {
  try {
    console.log("🔁 Reiniciando análisis global...");

    await pool.query('DELETE FROM analisis_resultados');
    await pool.query('UPDATE sitios SET analizado = 0');

    runAnalyzer();

    res.json({ status: 'global_analysis_started' });
  } catch (err) {
    console.error("❌ Error en /run/all:", err);
    res.status(500).json({ error: 'Error al reiniciar' });
  }
});


app.post('/run/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [[sitio]] = await pool.query("SELECT * FROM sitios WHERE id = ?", [id]);

    if (!sitio) {
      return res.status(404).json({ error: "Sitio no encontrado" });
    }

    console.log(`▶ Análisis manual del sitio ID ${id}: ${sitio.dominio || sitio.url}`);

    const resultado = await analizarSitio(sitio.url || sitio.dominio);

    // Guardar en BD
    await pool.query(`
      INSERT INTO analisis_resultados (sitio_id, puntuacion_total, tecnologias_detectadas, detalles)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        puntuacion_total = VALUES(puntuacion_total),
        tecnologias_detectadas = VALUES(tecnologias_detectadas),
        detalles = VALUES(detalles),
        fecha_analisis = CURRENT_TIMESTAMP
    `, [
      id,
      resultado.puntuacion_total,
      resultado.tecnologias.join(', '),
      JSON.stringify(resultado.checks)
    ]);

    await pool.query("UPDATE sitios SET analizado = 1, fecha_analisis = NOW() WHERE id = ?", [id]);

    res.json({ status: "single_analysis_completed", resultado });

  } catch (err) {
    console.error("❌ Error analizando sitio individual:", err);
    res.status(500).json({ error: 'Error analizando sitio' });
  }
});


// 🧾 API para leer resultados desde la BD (mostrando nombre y URL del sitio)
app.get('/resultados', async (req, res) => {
  try {
    const [rows] = await pool.query(`
     SELECT
      s.id,
      s.dominio AS sitio,
      CONCAT('https://', s.dominio) AS url,
      a.puntuacion_total,
      a.tecnologias_detectadas,
      a.detalles
    FROM sitios s
    LEFT JOIN analisis_resultados a ON s.id = a.sitio_id
    ORDER BY s.id ASC;
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener resultados:', err);
    res.status(500).send('Error al obtener resultados');
  }
});


io.on('connection', socket => {
  console.log('🟢 Cliente conectado al panel');
});

server.listen(3000, () => {
  console.log('🌐 Panel de análisis disponible en http://localhost:3000');
  runAnalyzer(); // se ejecuta automáticamente al iniciar
});

app.get('/export/excel', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        s.dominio AS sitio,
        CONCAT('https://', s.dominio) AS url,
        a.puntuacion_total,
        a.tecnologias_detectadas,
        a.detalles,
        a.fecha_analisis
      FROM sitios s
      INNER JOIN analisis_resultados a ON s.id = a.sitio_id
      ORDER BY s.id ASC
    `);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Resultados");

    sheet.columns = [
      { header: "Sitio", key: "sitio", width: 30 },
      { header: "URL", key: "url", width: 40 },
      { header: "Puntuación", key: "puntuacion_total", width: 15 },
      { header: "Tecnologías", key: "tecnologias_detectadas", width: 30 },
      { header: "Detalles", key: "detalles", width: 50 },
      { header: "Fecha Análisis", key: "fecha_analisis", width: 25 }
    ];

    rows.forEach(r => {
      sheet.addRow({
        sitio: r.sitio,
        url: r.url,
        puntuacion_total: r.puntuacion_total,
        tecnologias_detectadas: r.tecnologias_detectadas,
        detalles: r.detalles,
        fecha_analisis: r.fecha_analisis
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="resultados_analizados.xlsx"'
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("❌ Error exportando Excel:", err);
    res.status(500).json({ error: "Error exportando Excel" });
  }
});
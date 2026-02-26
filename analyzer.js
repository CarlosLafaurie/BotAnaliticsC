import { pool } from './db.js';
import { chromium } from 'playwright';
import { calcularPuntuacion } from './utils/scoring.js';
import dns from 'dns/promises';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
const execp = promisify(exec);

// ⚠️ Normaliza URLs sin protocolo
function normalizarURL(url) {
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    return "https://" + url.trim();
  }
  return url.trim();
}

export async function analizarSitio(url) {
  url = normalizarURL(url);

  const checks = {};
  const tecnologias = [];

  console.log(`\n🔍 Analizando ${url}`);

  // 1️⃣ Detección de tecnologías
  try {
    const res = await axios.get(url, {
      timeout: 100000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36',
        'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8'
      }
    });

    const html = res.data;
    const headers = res.headers;

    if (/wp-content|wordpress/i.test(html)) tecnologias.push('WordPress');
    if (/joomla/i.test(html)) tecnologias.push('Joomla');
    if (/drupal/i.test(html)) tecnologias.push('Drupal');
    if (/react/i.test(html)) tecnologias.push('React');
    if (/vue/i.test(html)) tecnologias.push('Vue.js');
    if (/angular/i.test(html)) tecnologias.push('Angular');
    if (/shopify/i.test(html)) tecnologias.push('Shopify');
    if (/magento/i.test(html)) tecnologias.push('Magento');

    if (/php/i.test(headers['x-powered-by'] || '') || /php/i.test(html)) tecnologias.push('PHP');

    if (/joomla|drupal 7|php 5|wordpress\/4/i.test(tecnologias.join(' '))) {
      checks.techObsolete = true;
    }

  } catch (err) {
    console.log('⚠️ Error detectando tecnologías:', err.message);
    checks.techError = true;
  }

  // 2️⃣ SSL
  try {
    const { hostname } = new URL(url);
    const { stdout } = await execp(
      `echo | openssl s_client -servername ${hostname} -connect ${hostname}:443 2>/dev/null | openssl x509 -noout -dates`
    );
    const exp = stdout.match(/notAfter=(.*)/);
    if (!exp || new Date(exp[1]) < new Date()) checks.sslIssue = true;
  } catch {
    checks.sslIssue = true;
  }

  // 3️⃣ Headers
  try {
    const res = await axios.get(url, { timeout: 10000 });
    const headers = res.headers;

    checks.headersMissing = !(headers['strict-transport-security'] && headers['content-security-policy']);
    checks.mixedContent = /http:\/\//i.test(res.data);

  } catch {
    checks.headersMissing = true;
  }

  // 4️⃣ DNS SPF / DMARC
  try {
    const { hostname } = new URL(url);
    const domain = hostname.replace(/^www\./, '');
    const txts = await dns.resolveTxt(domain);
    const txtStr = txts.flat().join(' ');

    checks.mxMissingSPF = !/v=spf1/i.test(txtStr);
    checks.mxMissingDMARC = !/v=DMARC1/i.test(txtStr);

  } catch {
    checks.mxError = true;
  }

  // 5️⃣ Playwright (checks visuales)
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36'
  });

  try {
    await page.goto(url, { timeout: 60000, waitUntil: 'load' });

    checks.favicon = await page.$('link[rel*="icon"]') !== null;
    checks.metaSEO = await page.$('meta[name="description"]') !== null;

    checks.responsive = !!(await page.$('meta[name="viewport"]'));

    const ctaText = await page.$$eval('a,button', els =>
      els.map(e => e.innerText.toLowerCase()).join(' ')
    );

    checks.cta = /(contact|cotiz|compra|contrata)/i.test(ctaText);

    const content = await page.content();
    checks.policyPage = /pol[ií]tica|privacidad|cookies/i.test(content);

    const forms = await page.$$eval('form', forms =>
      forms.map(f => ({
        valid: Array.from(f.querySelectorAll('input,textarea')).some(i => i.required)
      }))
    );
    checks.formsBroken = forms.some(f => !f.valid);

  } catch (err) {
    console.log('⚠️ Playwright error:', err.message);
  } finally {
    await browser.close();
  }

  // 6️⃣ Puntuación final
  const puntuacion_total = calcularPuntuacion(checks);

  return { url, tecnologias, checks, puntuacion_total };
}
if (process.argv[1].includes("analyzer.js")) {
  (async function main() {
    console.log("▶ Iniciando análisis en modo continuo...");

    while (true) {
      const [sitios] = await pool.query("SELECT * FROM sitios WHERE analizado = 0 LIMIT 50");

      if (sitios.length === 0) {
        console.log("🎉 No quedan sitios pendientes. Análisis completado.");
        break; // Detiene el bucle
      }

      console.log(`⚙️ Procesando lote de ${sitios.length} sitios...`);

      for (const sitio of sitios) {
        if (!sitio.dominio || sitio.dominio.trim() === "") {
          console.log(`❌ Dominio inválido (ID ${sitio.id})`);
          continue;
        }

        const url = sitio.dominio.startsWith("http")
          ? sitio.dominio
          : "https://" + sitio.dominio;

        console.log("▶ Analizando:", url);

        const resultado = await analizarSitio(url);

        await pool.query(
          `INSERT INTO analisis_resultados (sitio_id, puntuacion_total, tecnologias_detectadas, detalles)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            puntuacion_total = VALUES(puntuacion_total),
            tecnologias_detectadas = VALUES(tecnologias_detectadas),
            detalles = VALUES(detalles),
            fecha_analisis = CURRENT_TIMESTAMP`,
          [
            sitio.id,
            resultado.puntuacion_total,
            resultado.tecnologias.join(', '),
            JSON.stringify(resultado.checks)
          ]
        );

        await pool.query("UPDATE sitios SET analizado = 1, fecha_analisis = NOW() WHERE id = ?", [sitio.id]);

        console.log(`✅ ${sitio.dominio} → Score: ${resultado.puntuacion_total}`);
      }
    }

    process.exit();
  })();
}


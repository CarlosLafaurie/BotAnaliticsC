# 🧠 Panel de Análisis Web Automático

Proyecto personal de automatización de análisis de sitios web, desarrollado con **Node.js**, **Express**, **Playwright** y **MySQL**. Permite analizar sitios web, detectar tecnologías, validar SSL, headers de seguridad, formularios, CTAs y generar reportes en Excel de manera automática.

---

## 🚀 Funcionalidades principales

- Análisis de sitios web en tiempo real con logs en panel web
- Detección de tecnologías: WordPress, Joomla, Drupal, React, Vue.js, Angular, Shopify, Magento, PHP, entre otras
- Verificación de SSL, headers de seguridad y contenido mixto
- Comprobación de SPF y DMARC en DNS
- Inspección visual de elementos con **Playwright** (CTAs, formularios, SEO, responsive)
- Gestión de resultados en **MySQL**
- Paginación de resultados y búsqueda en panel web
- Exportación a Excel usando **ExcelJS**
- Botones de análisis automático, análisis solo pendientes y re-análisis global
- Web en tiempo real mediante **Socket.IO**
- Normalización de URLs y manejo de errores robusto

---

## 🏗 Arquitectura

- **Backend:** Node.js + Express + MySQL
- **Frontend:** Panel web estático (HTML + CSS + JS)
- **Automatización:** Playwright para navegación y análisis visual
- **Base de datos:** MySQL para almacenar sitios y resultados
- **Tiempo real:** Socket.IO para logs y actualizaciones instantáneas
- **Exportación:** ExcelJS para reportes descargables

---

## 💻 Instalación y ejecución

1. Clonar el repositorio:

```bash
git clone https://github.com/tuusuario/panel-analisis-web.git
cd panel-analisis-web
```

Instalar dependencias:

```bash
npm install
```

Configurar variables de entorno (.env):


```bash
DB_HOST=localhost
DB_USER=root
DB_PASS=password
DB_NAME=analisis_web
DB_PORT=3306

```

Inicializar la base de datos y probar conexión:

```bash
node db.js

```

Ejecutar servidor:

```bash
node server.js

```

Acceder al panel web en:

```bash
http://localhost:3000

```

---

## 📂 Uso

- Analizar sitios pendientes: ▶ Analizar Pendientes
- Re-analizar todos los sitios: 🔄 Re-Analizar TODO
- Exportar resultados a Excel: 📤 Exportar Analizados a Excel
- Logs en tiempo real: visualización en panel de logs del navegador
- Analizar sitio individual: botón 🔍 junto al sitio en la tabla

---

## 🛠 Tecnologías utilizadas

- Node.js
- Express.js
- Playwright
- MySQL
- ExcelJS
- Socket.IO
- HTML / CSS / Vanilla JS
- Axios
- dotenv
  
---

## ⚡ Características destacadas

- Automatización completa de análisis web
- Panel web interactivo con logs en tiempo real
- Exportación estructurada de datos a Excel
- Detección de tecnologías y buenas prácticas web
- Código modular y escalable, fácil de extender para nuevos checks

---

📌 Autor
Carlos Lafaurie – Desarrollador Full Stack

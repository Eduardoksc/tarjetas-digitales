// generar.mjs
// Lee la hoja de Google Sheets (publicada como CSV) y crea UNA página lista por cada negocio.
// No necesita instalar nada: solo Node 20 o superior.
//
// Uso local:   SHEET_CSV_FILE=ejemplo-negocios.csv node generar.mjs
// En GitHub:   lo ejecuta solo el robot (ver .github/workflows/publicar.yml)

import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// ---------- Ajustes que puedes cambiar ----------
const SALIDA = 'dist';
const COLOR_DEFECTO = '#1f6f5c';
const MENSAJE_DEFECTO = 'Hola, vi su tarjeta y quisiera más información.';
const PIE_TEXTO = process.env.PIE_TEXTO ?? ''; // ej: "Tarjeta digital por E.S.C"
const PIE_URL = process.env.PIE_URL ?? ''; // ej: "https://tudominio.co"
// ------------------------------------------------

const advertencias = [];
const avisar = (msg) => {
  advertencias.push(msg);
  console.warn('  ⚠ ' + msg);
};
const fallar = (msg) => {
  console.error('\n✖ ' + msg + '\n');
  process.exit(1);
};

// ---------- Utilidades ----------
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizar = (s) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

function parsearCSV(texto) {
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);
  const filas = [];
  let fila = [];
  let campo = '';
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else entreComillas = false;
      } else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo);
      campo = '';
      filas.push(fila);
      fila = [];
    } else campo += c;
  }
  if (campo !== '' || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((x) => x.trim() !== ''));
}

function urlSegura(valor) {
  const v = (valor ?? '').trim();
  if (!v) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    u.protocol = 'https:';
    return u.href;
  } catch {
    return null;
  }
}

function colorHex(valor) {
  const v = (valor ?? '').trim();
  if (!v) return COLOR_DEFECTO;
  const m = v.match(/^#?([0-9a-f]{6})$/i);
  return m ? '#' + m[1].toLowerCase() : null;
}

// Elige texto blanco u oscuro según qué tan claro es el color del negocio
function textoSobre(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.179 ? '#111111' : '#ffffff';
}

function telefono(valor) {
  let d = (valor ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 10 && d.startsWith('3')) d = '57' + d; // celular colombiano sin indicativo
  if (d.length < 11 || d.length > 15) return null;
  return d;
}

function rutaLogo(valor) {
  const v = (valor ?? '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return urlSegura(v);
  if (/^[\w.-]+$/.test(v) && existsSync(`logos/${v}`)) return `../logos/${encodeURIComponent(v)}`;
  return null;
}

const slugValido = (s) => /^[a-z0-9][a-z0-9-]*$/.test(s);

// ---------- Íconos (trazo simple, sin descargar nada) ----------
const ICONOS = {
  resenas:
    '<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3"/>',
  catalogo:
    '<line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  whatsapp:
    '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-5.2A8.5 8.5 0 1 1 21 11.5z"/>',
  enlace:
    '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
};

// ---------- Lectura de la hoja ----------
async function leerCSV() {
  if (process.env.SHEET_CSV_FILE) {
    return readFile(process.env.SHEET_CSV_FILE, 'utf8');
  }
  const base = process.env.SHEET_CSV_URL;
  if (!base) {
    fallar(
      'Falta la dirección de la hoja. Crea la variable SHEET_CSV_URL en GitHub (Settings → Secrets and variables → Actions → Variables).'
    );
  }
  let ultimoError = '';
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const url = base + (base.includes('?') ? '&' : '?') + 'nocache=' + Date.now();
      const res = await fetch(url, { redirect: 'follow' });
      const texto = await res.text();
      if (!res.ok) throw new Error('Google respondió ' + res.status);
      if (/^\s*</.test(texto)) {
        throw new Error(
          'Google devolvió una página web en vez de datos. Revisa que la hoja esté "Publicada en la web" en formato CSV.'
        );
      }
      return texto;
    } catch (e) {
      ultimoError = e.message;
      console.warn(`  Intento ${intento} falló: ${ultimoError}`);
      await new Promise((r) => setTimeout(r, 2000 * intento));
    }
  }
  fallar('No se pudo leer la hoja. ' + ultimoError);
}

// ---------- Construcción de cada negocio ----------
function prepararNegocio(fila, num) {
  const g = (k) => (fila[k] ?? '').trim();
  const etiqueta = `Fila ${num} (${g('id') || 'sin id'})`;

  const id = g('id').toLowerCase();
  if (!slugValido(id)) {
    avisar(`${etiqueta}: el "id" debe usar solo letras minúsculas, números o guiones (ej: 001). Se omite.`);
    return null;
  }
  if (id === 'logos') {
    avisar(`${etiqueta}: "logos" es un nombre reservado. Se omite.`);
    return null;
  }
  const estado = normalizar(g('estado'));
  if (!['activo', 'si', 'activa'].includes(estado)) return { id, pausado: true };

  const nombre = g('nombre');
  if (!nombre) {
    avisar(`${etiqueta}: falta el nombre. Se omite.`);
    return null;
  }
  const color = colorHex(g('color'));
  if (!color) {
    avisar(`${etiqueta}: color inválido "${g('color')}". Usa 6 letras/números como #1F6F5C.`);
  }
  const colorFinal = color ?? COLOR_DEFECTO;

  const alias = g('alias').toLowerCase();
  if (alias && !slugValido(alias)) {
    avisar(`${etiqueta}: el alias "${alias}" no es válido; se ignora.`);
  }

  // Logo
  let logo = rutaLogo(g('logo'));
  if (logo === null) {
    avisar(`${etiqueta}: no encontré el logo "${g('logo')}" en la carpeta logos/. Se usará la inicial del negocio.`);
    logo = '';
  }

  // Botones, en orden de importancia
  const botones = [];
  const resenas = urlSegura(g('google_resenas'));
  if (resenas === null) avisar(`${etiqueta}: el enlace de reseñas no es válido. Se omite ese botón.`);
  else if (resenas) botones.push({ icono: 'resenas', texto: 'Califícanos en Google', url: resenas });

  const catalogo = urlSegura(g('catalogo'));
  if (catalogo === null) avisar(`${etiqueta}: el enlace del catálogo no es válido. Se omite ese botón.`);
  else if (catalogo) botones.push({ icono: 'catalogo', texto: 'Ver catálogo', url: catalogo });

  const tel = telefono(g('whatsapp'));
  if (tel === null) avisar(`${etiqueta}: el número de WhatsApp no parece válido. Se omite ese botón.`);
  else if (tel) {
    const msg = g('mensaje_whatsapp') || MENSAJE_DEFECTO;
    botones.push({
      icono: 'whatsapp',
      texto: 'Escríbenos por WhatsApp',
      url: `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`,
    });
  }

  const extraUrl = urlSegura(g('boton4_url'));
  if (extraUrl === null) avisar(`${etiqueta}: el enlace del botón extra no es válido. Se omite.`);
  else if (extraUrl) {
    botones.push({ icono: 'enlace', texto: g('boton4_texto') || 'Más información', url: extraUrl });
  }

  if (botones.length === 0) {
    avisar(`${etiqueta}: no tiene ningún botón con datos válidos. Se omite.`);
    return null;
  }

  return {
    id,
    alias: alias && slugValido(alias) ? alias : '',
    nombre,
    slogan: g('slogan'),
    color: colorFinal,
    logo,
    botones,
  };
}

function htmlBotones(botones) {
  return botones
    .map(
      (b, i) =>
        `<a class="boton${i === 0 ? ' principal' : ''}" href="${esc(b.url)}" rel="noopener">` +
        `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS[b.icono]}</svg>` +
        `<span>${esc(b.texto)}</span></a>`
    )
    .join('\n      ');
}

function htmlPagina(plantilla, n) {
  const logoHtml = n.logo
    ? `<div class="logo"><img src="${esc(n.logo)}" alt="Logo de ${esc(n.nombre)}" width="112" height="112"></div>`
    : `<div class="logo inicial" aria-hidden="true">${esc([...n.nombre][0].toUpperCase())}</div>`;
  const sloganHtml = n.slogan ? `<p class="slogan">${esc(n.slogan)}</p>` : '';
  let pie = '';
  if (PIE_TEXTO) {
    const url = urlSegura(PIE_URL);
    pie = `<footer class="pie">${url ? `<a href="${esc(url)}" rel="noopener">${esc(PIE_TEXTO)}</a>` : esc(PIE_TEXTO)}</footer>`;
  }
  return plantilla
    .replaceAll('{{TITULO}}', esc(n.nombre))
    .replaceAll('{{COLOR}}', n.color)
    .replaceAll('{{COLOR_TEXTO}}', textoSobre(n.color))
    .replaceAll('{{NOMBRE}}', esc(n.nombre))
    .replaceAll('{{LOGO_HTML}}', logoHtml)
    .replaceAll('{{SLOGAN_HTML}}', sloganHtml)
    .replaceAll('{{BOTONES}}', htmlBotones(n.botones))
    .replaceAll('{{PIE_HTML}}', pie);
}

const paginaSimple = (titulo, texto) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(titulo)}</title>
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;text-align:center;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f6f6f4;color:#16181a}
h1{font-size:1.4rem;margin:0 0 8px}p{margin:0;color:#5d6368;line-height:1.5}</style></head>
<body><main><h1>${esc(titulo)}</h1><p>${esc(texto)}</p></main></body></html>`;

// ---------- Programa principal ----------
console.log('Leyendo la hoja…');
const filas = parsearCSV(await leerCSV());
if (filas.length < 2) fallar('La hoja está vacía o solo tiene los encabezados.');

const encabezados = filas[0].map(normalizar);
for (const obligatoria of ['id', 'estado', 'nombre']) {
  if (!encabezados.includes(obligatoria)) {
    fallar(`Falta la columna "${obligatoria}" en la hoja. Revisa los encabezados de la fila 1.`);
  }
}

const plantilla = await readFile('plantilla.html', 'utf8');
const negocios = [];
const vistos = new Set();
let pausados = 0;

filas.slice(1).forEach((celdas, i) => {
  const fila = Object.fromEntries(encabezados.map((h, j) => [h, celdas[j] ?? '']));
  const n = prepararNegocio(fila, i + 2);
  if (!n) return;
  if (vistos.has(n.id)) {
    avisar(`Fila ${i + 2}: el id "${n.id}" está repetido. Se usa solo la primera fila.`);
    return;
  }
  vistos.add(n.id);
  if (n.pausado) {
    pausados++;
    return;
  }
  negocios.push(n);
});

if (negocios.length === 0) {
  fallar('No hay ningún negocio activo con datos válidos. No se publica nada para no borrar el sitio actual.');
}

// Revisar que los alias no choquen con ids ni entre sí
const nombresUsados = new Set(vistos);
for (const n of negocios) {
  if (n.alias) {
    if (nombresUsados.has(n.alias)) {
      avisar(`El alias "${n.alias}" del negocio ${n.id} ya está en uso. Se ignora.`);
      n.alias = '';
    } else nombresUsados.add(n.alias);
  }
}

await rm(SALIDA, { recursive: true, force: true });
await mkdir(SALIDA, { recursive: true });
if (existsSync('logos')) await cp('logos', `${SALIDA}/logos`, { recursive: true });

for (const n of negocios) {
  const html = htmlPagina(plantilla, n);
  for (const carpeta of [n.id, n.alias].filter(Boolean)) {
    await mkdir(`${SALIDA}/${carpeta}`, { recursive: true });
    await writeFile(`${SALIDA}/${carpeta}/index.html`, html);
  }
  console.log(`  ✔ ${n.id}${n.alias ? ' / ' + n.alias : ''} — ${n.nombre} (${n.botones.length} botones)`);
}

await writeFile(`${SALIDA}/index.html`, paginaSimple('Tarjeta digital', 'Escanea la tarjeta de un negocio para ver su página.'));
await writeFile(`${SALIDA}/404.html`, paginaSimple('Esta tarjeta no está disponible', 'Pídele al negocio que la revise o intenta de nuevo más tarde.'));
await writeFile(`${SALIDA}/robots.txt`, 'User-agent: *\nDisallow: /\n');

console.log(`\nListo: ${negocios.length} páginas creadas, ${pausados} pausadas, ${advertencias.length} advertencias.`);

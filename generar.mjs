// generar.mjs
// Lee la hoja de Google Sheets (publicada como CSV) y crea UNA página lista por cada negocio.
//
// Uso local:   SHEET_CSV_FILE=ejemplo-negocios.csv node generar.mjs
// En GitHub:   lo ejecuta solo el robot (ver .github/workflows/publicar.yml)

import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { extname } from 'node:path';
import { createHash } from 'node:crypto';
import { MARCAS } from './iconos.mjs';

// ---------- Ajustes que puedes cambiar ----------
const SALIDA = 'dist';
const LOGOS_DIR = process.env.LOGOS_DIR ?? 'logos';
const COLOR_DEFECTO = '#1f6f5c';
const MENSAJE_DEFECTO = 'Hola, vi su tarjeta y quisiera más información.';
const PIE_TEXTO = process.env.PIE_TEXTO ?? ''; // ej: "Tarjeta digital por E.S.C"
const PIE_URL = process.env.PIE_URL ?? ''; // ej: "https://tudominio.co"
const CAJA_LOGO = { w: 300, h: 120 }; // tamaño máximo en pantalla (px) donde se ajusta cada logo
const LOGO_MAX_PX = 800; // tamaño máximo del archivo de logo que se publica
const LOGO_MIN_PX = 300; // por debajo de esto se avisa que se verá borroso
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

// sharp recorta y ajusta los logos. Si no está instalado, el sistema sigue funcionando sin él.
let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('  ⚠ No se encontró "sharp": los logos se publicarán sin recorte automático (npm install lo instala).');
}

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
    .replace(/[̀-ͯ]/g, '')
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

// ---------- Colores ----------
function colorHex(valor) {
  const v = (valor ?? '').trim();
  if (!v) return COLOR_DEFECTO;
  const m = v.match(/^#?([0-9a-f]{6})$/i);
  return m ? '#' + m[1].toLowerCase() : null;
}

const hexARgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const rgbAHex = (rgb) => '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
// Mezcla un color con blanco: cantidad 0 = color puro, 1 = blanco
const aclarar = (hex, cantidad) => rgbAHex(hexARgb(hex).map((c) => c + (255 - c) * cantidad));

// Mezcla un color con negro: cantidad 0 = color puro, 1 = negro
const oscurecer = (hex, cantidad) => rgbAHex(hexARgb(hex).map((c) => c * (1 - cantidad)));

// Tono del primer botón: un poco más profundo que el fondo (menos en colores claros, para que no se vean apagados)
const tonoFuerte = (hex) => oscurecer(hex, textoSobre(hex) === '#111111' ? 0.1 : 0.22);

// Elige texto blanco u oscuro según qué tan claro es el color del negocio
function textoSobre(hex) {
  const [r, g, b] = hexARgb(hex)
    .map((c) => c / 255)
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

const slugValido = (s) => /^[a-z0-9][a-z0-9-]*$/.test(s);

// ---------- Íconos (trazo simple, sin descargar nada) ----------
const ICONOS = {
  resenas:
    '<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3"/>',
  catalogo:
    '<line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  enlace:
    '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  camara:
    '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
};

// Los botones extra eligen su ícono según el enlace (o según la columna botonN_icono)
const ICONOS_EXTRA = ['instagram', 'facebook', 'tiktok', 'youtube', 'x', 'telegram', 'maps', 'waze', 'web', 'enlace'];
const ALIAS_ICONO = { twitter: 'x', mapa: 'maps', ubicacion: 'maps', google_maps: 'maps', pagina: 'web', sitio: 'web', link: 'enlace' };
const TEXTO_ICONO = {
  instagram: 'Síguenos en Instagram',
  facebook: 'Síguenos en Facebook',
  tiktok: 'Síguenos en TikTok',
  youtube: 'Mira nuestro YouTube',
  x: 'Síguenos en X',
  telegram: 'Escríbenos por Telegram',
  maps: 'Cómo llegar',
  waze: 'Llegar con Waze',
  web: 'Visita nuestra página',
  enlace: 'Más información',
};

function iconoExtra(url) {
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, '');
  if (/(^|\.)instagram\.com$/.test(host)) return 'instagram';
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me)$/.test(host)) return 'facebook';
  if (/(^|\.)tiktok\.com$/.test(host)) return 'tiktok';
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return 'youtube';
  if (/^(x\.com|twitter\.com)$/.test(host)) return 'x';
  if (/^(t\.me|telegram\.me)$/.test(host)) return 'telegram';
  if (/(^|\.)waze\.com$/.test(host)) return 'waze';
  if (host === 'maps.app.goo.gl' || host === 'maps.google.com') return 'maps';
  if ((host === 'goo.gl' || /(^|\.)google\.[a-z.]+$/.test(host)) && u.pathname.startsWith('/maps')) return 'maps';
  return 'web';
}

function svgIcono(clave) {
  if (MARCAS[clave]) {
    return `<svg class="relleno" viewBox="0 0 24 24" aria-hidden="true"><path d="${MARCAS[clave]}"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS[clave] ?? ICONOS.enlace}</svg>`;
}

// ---------- Logos ----------
// Huella corta del contenido: si cambias el logo, cambia el nombre y nadie ve el viejo guardado en su celular
const huella = (contenido) => createHash('md5').update(contenido).digest('hex').slice(0, 8);

function dimensionesSvg(txt) {
  const vb = txt.match(/viewBox\s*=\s*["']\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)/i);
  if (vb) return { w: +vb[1], h: +vb[2] };
  const w = txt.match(/<svg[^>]*\swidth\s*=\s*["']([\d.]+)/i);
  const h = txt.match(/<svg[^>]*\sheight\s*=\s*["']([\d.]+)/i);
  return w && h ? { w: +w[1], h: +h[1] } : null;
}

// Calcula el tamaño final en pantalla: lo más grande posible dentro de la caja, sin deformar
function ajustarACaja(w, h, esVector) {
  const tope = esVector ? 4 : 2; // un logo pequeño se agranda como mucho al doble
  const k = Math.min(CAJA_LOGO.w / w, CAJA_LOGO.h / h, tope);
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

// ¿El logo es claro y transparente (por ejemplo, blanco)? Entonces se perdería sobre una tarjeta blanca.
async function esLogoClaro(buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .resize(48, 48, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let suma = 0;
  let opacos = 0;
  let transparentes = 0;
  const total = info.width * info.height;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 250) transparentes++;
    if (a > 128) {
      suma += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      opacos++;
    }
  }
  return opacos > 0 && suma / opacos > 0.8 && transparentes / total > 0.1;
}

function sugerirArchivos() {
  try {
    const lista = readdirSync(LOGOS_DIR).filter((f) => !f.startsWith('.'));
    return lista.length ? ` Archivos que sí hay en logos/: ${lista.slice(0, 6).join(', ')}.` : ' La carpeta logos/ está vacía.';
  } catch {
    return '';
  }
}

// Devuelve { src, w, h, claro } o null (sin logo) o 'error'
async function prepararLogo(id, valor, etiqueta) {
  const v = (valor ?? '').trim();
  if (!v) return null;

  if (/^https?:\/\//i.test(v)) {
    const u = urlSegura(v);
    if (!u) {
      avisar(`${etiqueta}: el enlace del logo no es válido. Se usará la inicial del negocio.`);
      return 'error';
    }
    return { src: u, w: 0, h: 0, claro: false };
  }

  if (!/^[\w. -]+$/.test(v) || !existsSync(`${LOGOS_DIR}/${v}`)) {
    avisar(`${etiqueta}: no encontré el logo "${v}" en la carpeta logos/. Revisa mayúsculas y la extensión.${sugerirArchivos()} Se usará la inicial del negocio.`);
    return 'error';
  }

  const ruta = `${LOGOS_DIR}/${v}`;
  const ext = extname(v).toLowerCase();
  await mkdir(`${SALIDA}/logos`, { recursive: true });

  // Logo vectorial: se publica tal cual (nítido a cualquier tamaño)
  if (ext === '.svg') {
    const txt = await readFile(ruta, 'utf8');
    const dim = dimensionesSvg(txt);
    if (!dim) avisar(`${etiqueta}: el SVG del logo no indica su tamaño (viewBox); puede verse mal ajustado.`);
    const nombreSvg = `${id}-${huella(txt)}.svg`;
    await copyFile(ruta, `${SALIDA}/logos/${nombreSvg}`);
    const caja = ajustarACaja(dim?.w || 200, dim?.h || 100, true);
    return { src: `../logos/${nombreSvg}`, w: caja.w, h: caja.h, claro: false };
  }

  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    avisar(`${etiqueta}: el logo "${v}" debe ser PNG, JPG, WEBP o SVG. Se usará la inicial del negocio.`);
    return 'error';
  }

  // Sin sharp: se publica tal cual
  if (!sharp) {
    const nombreCopia = `${id}-${huella(await readFile(ruta))}${ext}`;
    await copyFile(ruta, `${SALIDA}/logos/${nombreCopia}`);
    return { src: `../logos/${nombreCopia}`, w: 0, h: 0, claro: false };
  }

  try {
    const original = await readFile(ruta);
    const base = sharp(original).rotate(); // respeta la orientación de la foto
    const meta = await sharp(await base.clone().toBuffer()).metadata();

    // 1) Quitar márgenes vacíos (blancos o transparentes) alrededor del logo
    let recortado;
    try {
      recortado = await sharp(await base.clone().toBuffer()).trim({ threshold: 14 }).toBuffer();
    } catch {
      recortado = await base.clone().toBuffer(); // imagen de un solo color o sin márgenes
    }

    // 2) Ajustar a un tamaño estándar, sin agrandar
    // PNG si el logo tiene transparencia, JPG si no: formatos que abren en cualquier celular (WebP falla en algunos viejos)
    const conTransparencia = (await sharp(recortado).metadata()).hasAlpha === true;
    const ajustado = sharp(recortado).resize({ width: LOGO_MAX_PX, height: LOGO_MAX_PX, fit: 'inside', withoutEnlargement: true });
    const final = conTransparencia
      ? await ajustado.png({ palette: true, quality: 92, compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
      : await ajustado.flatten({ background: '#ffffff' }).jpeg({ quality: 90, mozjpeg: true }).toBuffer({ resolveWithObject: true });

    const { width: w, height: h } = final.info;
    const nombreFinal = `${id}-${huella(final.data)}.${conTransparencia ? 'png' : 'jpg'}`;
    await writeFile(`${SALIDA}/logos/${nombreFinal}`, final.data);

    // 3) Avisos de calidad
    const mayor = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (Math.max(w, h) < LOGO_MIN_PX) {
      avisar(`${etiqueta}: el logo mide solo ${w}×${h} px después de recortar; se verá borroso. Pide uno de al menos ${LOGO_MIN_PX} px de ancho (mejor PNG transparente o SVG).`);
    }
    const proporcion = Math.max(w / h, h / w);
    if (proporcion > 5) {
      avisar(`${etiqueta}: el logo es muy ${w > h ? 'alargado' : 'alto'} (${w}×${h}); se verá pequeño. Si tiene una versión más compacta, úsala.`);
    }
    const recorte = meta.width && meta.height ? 1 - (w * h) / (meta.width * meta.height) : 0;
    if (recorte > 0.05) {
      console.log(`  · ${id}: logo recortado (${meta.width}×${meta.height} → ${w}×${h}), sin márgenes vacíos.`);
    }

    const caja = ajustarACaja(w, h, false);
    return { src: `../logos/${nombreFinal}`, w: caja.w, h: caja.h, claro: await esLogoClaro(final.data), mayor };
  } catch (e) {
    avisar(`${etiqueta}: no se pudo procesar el logo "${v}" (${e.message}). Se usará la inicial del negocio.`);
    return 'error';
  }
}

// ---------- Lectura de la hoja ----------
const SHEETS_BASE = process.env.SHEETS_BASE ?? 'https://docs.google.com'; // solo se cambia para pruebas

async function descargarCSV(base) {
  const url = base + (base.includes('?') ? '&' : '?') + 'nocache=' + Date.now();
  const res = await fetch(url, { redirect: 'follow' });
  const texto = await res.text();
  if (!res.ok) throw new Error('Google respondió ' + res.status + '.');
  if (/^\s*</.test(texto)) throw new Error('Google devolvió una página web en vez de datos.');
  return texto;
}

async function leerCSV() {
  if (process.env.SHEET_CSV_FILE) {
    return readFile(process.env.SHEET_CSV_FILE, 'utf8');
  }
  const id = (process.env.SHEET_ID ?? '').trim();
  const gid = (process.env.SHEET_GID ?? '').trim() || '0';
  const publicada = (process.env.SHEET_CSV_URL ?? '').trim();
  if (!id && !publicada) {
    fallar(
      'Falta la dirección de la hoja. Crea la variable SHEET_ID (o SHEET_CSV_URL) en GitHub: Settings → Secrets and variables → Actions → Variables.'
    );
  }

  const fuentes = [];
  if (id) {
    fuentes.push({
      nombre: 'lectura directa de la hoja',
      url: `${SHEETS_BASE}/spreadsheets/d/${encodeURIComponent(id)}/export?format=csv&gid=${encodeURIComponent(gid)}`,
      ayuda: 'Revisa que la hoja esté compartida como "Cualquier persona con el enlace" (Lector) y que SHEET_GID sea el de la pestaña Negocios.',
    });
  }
  if (publicada) {
    fuentes.push({
      nombre: 'enlace publicado en la web',
      url: publicada,
      ayuda: 'Revisa que la hoja esté "Publicada en la web" en formato CSV.',
    });
  }

  let ultimoError = '';
  for (const [i, fuente] of fuentes.entries()) {
    for (let intento = 1; intento <= 3; intento++) {
      try {
        const texto = await descargarCSV(fuente.url);
        console.log(`  Fuente de datos: ${fuente.nombre}.`);
        if (i > 0) avisar(`Se usó el ${fuente.nombre} porque la lectura directa falló. Los cambios pueden tardar unos minutos más en verse.`);
        return texto;
      } catch (e) {
        ultimoError = `${fuente.nombre}: ${e.message} ${fuente.ayuda}`;
        console.warn(`  Intento ${intento} falló (${fuente.nombre}): ${e.message}`);
        await new Promise((r) => setTimeout(r, 1500 * intento));
      }
    }
  }
  fallar('No se pudo leer la hoja. ' + ultimoError);
}

// ---------- Construcción de cada negocio ----------
const ORDEN_DEFECTO = ['resenas', 'catalogo', 'whatsapp', 'boton4', 'boton5'];
const NOMBRES_CLAVE = {
  resenas: 'resenas',
  resena: 'resenas',
  google: 'resenas',
  catalogo: 'catalogo',
  menu: 'catalogo',
  whatsapp: 'whatsapp',
  wa: 'whatsapp',
  boton4: 'boton4',
  extra: 'boton4',
  extra1: 'boton4',
  boton5: 'boton5',
  extra2: 'boton5',
};

function ordenarBotones(texto, etiqueta) {
  const pedidos = [];
  for (const parte of (texto ?? '').split(/[,;\s]+/).filter(Boolean)) {
    const clave = NOMBRES_CLAVE[normalizar(parte)];
    if (!clave) {
      avisar(`${etiqueta}: "${parte}" no es un botón válido en orden_botones. Usa: resenas, catalogo, whatsapp, boton4, boton5.`);
    } else if (!pedidos.includes(clave)) pedidos.push(clave);
  }
  return [...pedidos, ...ORDEN_DEFECTO.filter((c) => !pedidos.includes(c))];
}

async function prepararNegocio(fila, num) {
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

  // Color y estilo de fondo
  const color = colorHex(g('color'));
  if (!color) avisar(`${etiqueta}: color inválido "${g('color')}". Usa 6 letras/números como #1F6F5C.`);
  const colorFinal = color ?? COLOR_DEFECTO;

  let estilo = normalizar(g('estilo')) || 'completo';
  if (!['completo', 'suave'].includes(estilo)) {
    avisar(`${etiqueta}: estilo "${g('estilo')}" no existe. Usa "completo" (fondo del color del negocio) o "suave". Se usa "completo".`);
    estilo = 'completo';
  }

  const alias = g('alias').toLowerCase();
  if (alias && !slugValido(alias)) avisar(`${etiqueta}: el alias "${alias}" no es válido; se ignora.`);

  // Logo
  const logoRes = await prepararLogo(id, g('logo'), etiqueta);
  const logo = logoRes && logoRes !== 'error' ? logoRes : null;

  let fondoLogo = normalizar(g('logo_fondo'));
  if (fondoLogo && !['blanco', 'oscuro', 'sin'].includes(fondoLogo)) {
    avisar(`${etiqueta}: logo_fondo "${g('logo_fondo')}" no existe. Usa blanco, oscuro o sin. Se elige automático.`);
    fondoLogo = '';
  }
  if (!fondoLogo) {
    fondoLogo = logo?.claro ? 'oscuro' : 'blanco';
    if (logo?.claro) console.log(`  · ${id}: el logo es claro; se pone sobre una tarjeta oscura para que se vea.`);
  }

  // Botones disponibles (solo los que tienen datos válidos)
  const disponibles = {};
  const texto = (campo, defecto) => {
    const t = g(campo) || defecto;
    if (t.length > 40) avisar(`${etiqueta}: el texto del botón "${t.slice(0, 20)}…" es largo (${t.length} letras); intenta que sea más corto.`);
    return t;
  };

  const resenas = urlSegura(g('google_resenas'));
  if (resenas === null) avisar(`${etiqueta}: el enlace de reseñas no es válido. Se omite ese botón.`);
  else if (resenas) disponibles.resenas = { icono: 'resenas', texto: texto('texto_resenas', 'Califícanos en Google'), url: resenas };

  const catalogo = urlSegura(g('catalogo'));
  if (catalogo === null) avisar(`${etiqueta}: el enlace del catálogo no es válido. Se omite ese botón.`);
  else if (catalogo) disponibles.catalogo = { icono: 'catalogo', texto: texto('texto_catalogo', 'Ver catálogo'), url: catalogo };

  const tel = telefono(g('whatsapp'));
  if (tel === null) avisar(`${etiqueta}: el número de WhatsApp no parece válido. Se omite ese botón.`);
  else if (tel) {
    const msg = g('mensaje_whatsapp') || MENSAJE_DEFECTO;
    disponibles.whatsapp = {
      icono: 'whatsapp',
      texto: texto('texto_whatsapp', 'Escríbenos por WhatsApp'),
      url: `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`,
    };
  }

  for (const n of ['4', '5']) {
    const url = urlSegura(g(`boton${n}_url`));
    if (url === null) avisar(`${etiqueta}: el enlace del botón ${n} no es válido. Se omite.`);
    else if (url) {
      let icono = iconoExtra(url);
      const forzado = normalizar(g(`boton${n}_icono`));
      if (forzado) {
        const clave = ALIAS_ICONO[forzado] ?? forzado;
        if (ICONOS_EXTRA.includes(clave)) icono = clave;
        else avisar(`${etiqueta}: el ícono "${g(`boton${n}_icono`)}" no existe. Usa: ${ICONOS_EXTRA.join(', ')}. Se elige automático.`);
      }
      disponibles['boton' + n] = { icono, texto: texto(`boton${n}_texto`, TEXTO_ICONO[icono]), url };
    }
  }

  const botones = ordenarBotones(g('orden_botones'), etiqueta)
    .map((clave) => disponibles[clave])
    .filter(Boolean);

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
    estilo,
    logo,
    fondoLogo,
    botones,
  };
}

function htmlBotones(botones) {
  return botones
    .map(
      (b, i) =>
        `<a class="boton${i === 0 ? ' principal' : ''}" href="${esc(b.url)}" rel="noopener">` +
        `<span class="chip">${svgIcono(b.icono)}</span>` +
        `<span class="texto">${esc(b.texto)}</span></a>`
    )
    .join('\n      ');
}

function htmlLogo(n) {
  if (!n.logo) {
    return `<div class="logo inicial" aria-hidden="true">${esc([...n.nombre][0].toUpperCase())}</div>`;
  }
  const medidas = n.logo.w ? ` width="${n.logo.w}" height="${n.logo.h}" style="width:${n.logo.w}px"` : '';
  return (
    `<div class="logo fondo-${n.fondoLogo}">` +
    `<img src="${esc(n.logo.src)}" alt="Logo de ${esc(n.nombre)}"${medidas} decoding="async" fetchpriority="high">` +
    `</div>`
  );
}

function htmlPagina(plantilla, n) {
  const sloganHtml = n.slogan ? `<p class="slogan">${esc(n.slogan)}</p>` : '';
  let pie = '';
  if (PIE_TEXTO) {
    const url = urlSegura(PIE_URL);
    pie = `<footer class="pie">${url ? `<a href="${esc(url)}" rel="noopener">${esc(PIE_TEXTO)}</a>` : esc(PIE_TEXTO)}</footer>`;
  }
  return plantilla
    .replaceAll('{{TITULO}}', esc(n.nombre))
    .replaceAll('{{ESTILO}}', n.estilo)
    .replaceAll('{{COLOR}}', n.color)
    .replaceAll('{{COLOR_TEXTO}}', textoSobre(n.color))
    .replaceAll('{{COLOR_FUERTE}}', tonoFuerte(n.color))
    .replaceAll('{{COLOR_FUERTE_TEXTO}}', textoSobre(tonoFuerte(n.color)))
    .replaceAll('{{FONDO_SUAVE}}', aclarar(n.color, 0.9))
    .replaceAll('{{BORDE_SUAVE}}', aclarar(n.color, 0.55))
    .replaceAll('{{NOMBRE}}', esc(n.nombre))
    .replaceAll('{{LOGO_HTML}}', htmlLogo(n))
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
await rm(SALIDA, { recursive: true, force: true });
await mkdir(SALIDA, { recursive: true });

const negocios = [];
const vistos = new Set();
let pausados = 0;

for (const [i, celdas] of filas.slice(1).entries()) {
  const fila = Object.fromEntries(encabezados.map((h, j) => [h, celdas[j] ?? '']));
  const n = await prepararNegocio(fila, i + 2);
  if (!n) continue;
  if (vistos.has(n.id)) {
    avisar(`Fila ${i + 2}: el id "${n.id}" está repetido. Se usa solo la primera fila.`);
    continue;
  }
  vistos.add(n.id);
  if (n.pausado) {
    pausados++;
    continue;
  }
  negocios.push(n);
}

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

for (const n of negocios) {
  const html = htmlPagina(plantilla, n);
  for (const carpeta of [n.id, n.alias].filter(Boolean)) {
    await mkdir(`${SALIDA}/${carpeta}`, { recursive: true });
    await writeFile(`${SALIDA}/${carpeta}/index.html`, html);
  }
  console.log(`  ✔ ${n.id}${n.alias ? ' / ' + n.alias : ''} — ${n.nombre} (${n.botones.length} botones, fondo ${n.estilo})`);
}

await writeFile(`${SALIDA}/index.html`, paginaSimple('Tarjeta digital', 'Escanea la tarjeta de un negocio para ver su página.'));
await writeFile(`${SALIDA}/404.html`, paginaSimple('Esta tarjeta no está disponible', 'Pídele al negocio que la revise o intenta de nuevo más tarde.'));
await writeFile(`${SALIDA}/robots.txt`, 'User-agent: *\nDisallow: /\n');

console.log(`\nListo: ${negocios.length} páginas creadas, ${pausados} pausadas, ${advertencias.length} advertencias.`);

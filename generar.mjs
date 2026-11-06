// generar.mjs
// Lee la hoja de Google Sheets (publicada como CSV) y crea UNA página lista por cada negocio.
//
// Uso local:   SHEET_CSV_FILE=ejemplo-negocios.csv node generar.mjs
// En GitHub:   lo ejecuta solo el robot (ver .github/workflows/publicar.yml)

import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { extname } from 'node:path';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { MARCAS } from './iconos.mjs';

// ---------- Ajustes que puedes cambiar ----------
const SALIDA = 'dist';
const LOGOS_DIR = process.env.LOGOS_DIR ?? 'logos';
const COLOR_DEFECTO = '#1f6f5c';
const TITULAR_DEFECTO = 'Nos encantó verte.';
const TEXTO_RESENAS_DEFECTO = 'Toca las estrellas y cuéntale a Google';
const NOTA_RESENAS_DEFECTO = '20 segundos. Ayudas a que más gente nos encuentre.';
const MAX_TEXTO_BOTON = 16; // los botones cuadrados tienen poco espacio
const MENSAJE_DEFECTO = 'Hola, vi su tarjeta y quisiera más información.';
const PIE_TEXTO = process.env.PIE_TEXTO ?? ''; // ej: "Tarjeta digital por E.S.C"
const PIE_URL = process.env.PIE_URL ?? ''; // ej: "https://tudominio.co"
const CAJA_LOGO = { w: 200, h: 80 }; // tamaño máximo en pantalla (px) donde se ajusta cada logo
const LOGO_MAX_PX = 800; // tamaño máximo del archivo de logo que se publica
const LOGO_MIN_PX = 300; // por debajo de esto se avisa que se verá borroso
const PLANTILLAS = { mostrador: 'plantilla.html', premium: 'plantilla-premium.html' }; // columna "estilo" de la hoja
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
  return filas; // incluye filas vacías para conservar el número de fila de la hoja (se quitan después)
}

const filaVacia = (f) => !f.some((x) => (x ?? '').trim() !== '');

function urlSegura(valor) {
  const v = (valor ?? '').trim();
  if (!v) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!/^[^.]+(\.[^.]+)+$/.test(u.hostname)) return null; // sin dominio real (ej. una palabra como "Sedes" escrita en vez del enlace)
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
const tonoFuerte = (hex) => oscurecer(hex, textoSobre(hex) === TEXTO_OSCURO ? 0.1 : 0.22);

// Elige texto blanco u oscuro según qué tan claro es el color del negocio.
// El texto oscuro es negro puro: con el corte en 0.179, blanco o negro siempre dan al menos 4.58:1 (AA).
// Con #111111 había colores (luminancia entre 0.179 y 0.19) donde ninguno de los dos llegaba a 4.5:1.
const TEXTO_OSCURO = '#000000';
function textoSobre(hex) {
  const [r, g, b] = hexARgb(hex)
    .map((c) => c / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.179 ? TEXTO_OSCURO : '#ffffff';
}

const luminancia = (hex) => {
  const [r, g, b] = hexARgb(hex).map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
// Oscurece el color poco a poco hasta que se lea sobre el fondo (3:1 para íconos y líneas, 4.5:1 para texto)
function legibleSobre(hex, fondo, minimo) {
  let c = hex;
  for (let i = 1; contraste(c, fondo) < minimo && i <= 20; i++) c = oscurecer(hex, i * 0.05);
  return c;
}
const distanciaColor = (a, b) => Math.hypot(...hexARgb(a).map((c, i) => c - hexARgb(b)[i]));

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
    '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  enlace:
    '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  camara:
    '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
  menu: '<path d="M6 3v5a2 2 0 0 0 4 0V3M8 10v11"/><path d="M17.5 21V3c-2.3 1.3-3.5 3.8-3.5 7.5V13h3.5"/>',
  domicilio: '<path d="M5 8.5h14l-1.2 11a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
  tienda: '<path d="M4.5 10.5V20h15v-9.5"/><path d="M3 4h18l1 4a2.5 2.5 0 0 1-5 .5 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0A2.5 2.5 0 0 1 2 8z"/><path d="M10 20v-5h4v5"/>',
  reservas: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M9 15.2l2 2 4-4"/>',
  llamar: '<path d="M5.2 4h3.3l1.6 4.4-2.1 1.4a11 11 0 0 0 6.2 6.2l1.4-2.1 4.4 1.6v3.3a1.6 1.6 0 0 1-1.7 1.6A16 16 0 0 1 3.6 5.7 1.6 1.6 0 0 1 5.2 4z"/>',
  horario: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  promos: '<path d="M3.5 12.4V4.5a1 1 0 0 1 1-1h7.9l8.1 8.1a1.5 1.5 0 0 1 0 2.1l-6.8 6.8a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8.3" cy="8.3" r="1.5"/>',
  pago: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3.5"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.6 12.4a9.5 9.5 0 0 1 12.8 0M8.7 15.8a5 5 0 0 1 6.6 0"/><circle cx="12" cy="19.3" r=".8"/>',
};

// Ícono de cada botón: 1) el que se escribe en botonN_icono, 2) el de la red o el mapa según el enlace,
// 3) según el texto del botón ("Pedidos" → bolsa, "Sedes" → tienda), 4) según el servicio (Rappi, Doctoralia…), 5) globo.
const ICONOS_EXTRA = ['instagram', 'facebook', 'tiktok', 'youtube', 'x', 'telegram', 'maps', 'waze', 'menu', 'catalogo', 'domicilio', 'tienda', 'reservas', 'llamar', 'horario', 'promos', 'pago', 'web', 'enlace'];
const ALIAS_ICONO = {
  twitter: 'x', mapa: 'maps', ubicacion: 'maps', google_maps: 'maps', pagina: 'web', sitio: 'web', link: 'enlace',
  carta: 'menu', productos: 'catalogo', pedidos: 'domicilio', domicilios: 'domicilio', rappi: 'domicilio', sedes: 'tienda', local: 'tienda',
  citas: 'reservas', cita: 'reservas', agenda: 'reservas', reserva: 'reservas', telefono: 'llamar', promociones: 'promos', pagos: 'pago',
};
const TEXTO_ICONO = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X',
  telegram: 'Telegram',
  maps: 'Cómo llegar',
  waze: 'Waze',
  menu: 'Ver menú',
  catalogo: 'Ver catálogo',
  domicilio: 'Pide a domicilio',
  tienda: 'Nuestras sedes',
  reservas: 'Agenda tu cita',
  llamar: 'Llámanos',
  horario: 'Horario',
  promos: 'Promociones',
  pago: 'Medios de pago',
  web: 'Nuestra web',
  enlace: 'Más info',
};
// Palabras del texto del botón (ya normalizado: sin tildes y en minúsculas)
const ICONO_POR_TEXTO = [
  ['domicilio', /domicilio|pedido|pide|delivery|rappi|didi|ifood/],
  ['menu', /(^|_)(menu|carta)(_|$)/],
  ['tienda', /sede|tienda|local|sucursal|punto_de_venta/],
  ['reservas', /reserva|cita|agend|turno|consulta/],
  ['maps', /llegar|ubicacion|direccion|mapa/],
  ['llamar', /llama|telefono/],
  ['horario', /horario/],
  ['promos', /promo|oferta|descuento/],
  ['pago', /pago|paga|nequi|daviplata/],
  ['catalogo', /catalogo|producto|servicio/],
];
// Servicios conocidos por su dominio
const ICONO_POR_DOMINIO = [
  ['domicilio', /(^|\.)(rappi\.com(\.co)?|didi-food\.com|didifood\.com|ifood\.com(\.co)?)$/],
  ['reservas', /(^|\.)(calendly\.com|doctoralia\.(co|com)|booksy\.com|agendapro\.com|fresha\.com|setmore\.com|simplybook\.me|cal\.com)$/],
];
const TEXTO_DOMINIO = { 'rappi.com.co': 'Pide en Rappi', 'rappi.com': 'Pide en Rappi' };

function elegirIcono({ forzado, texto, url, defecto, etiqueta, columna }) {
  if (forzado) {
    const clave = ALIAS_ICONO[forzado] ?? forzado;
    if (ICONOS_EXTRA.includes(clave)) return clave;
    avisar(`${etiqueta}: el ícono "${forzado}" de ${columna} no existe. Usa: ${ICONOS_EXTRA.join(', ')}. Se elige automático.`);
  }
  const porEnlace = iconoExtra(url);
  if (porEnlace !== 'web') return porEnlace;
  const t = normalizar(texto ?? '');
  for (const [clave, patron] of ICONO_POR_TEXTO) if (t && patron.test(t)) return clave;
  const host = new URL(url).hostname.replace(/^www\./, '');
  for (const [clave, patron] of ICONO_POR_DOMINIO) if (patron.test(host)) return clave;
  return defecto;
}

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

// Redes sociales: una columna por red. Acepta el enlace completo o solo el usuario (@usuario).
const REDES = [
  { clave: 'instagram', nombre: 'Instagram', perfil: (u) => `https://instagram.com/${u}` },
  { clave: 'facebook', nombre: 'Facebook', perfil: (u) => `https://facebook.com/${u}` },
  { clave: 'tiktok', nombre: 'TikTok', perfil: (u) => `https://www.tiktok.com/@${u}` },
  { clave: 'youtube', nombre: 'YouTube', perfil: (u) => `https://www.youtube.com/@${u}` },
  { clave: 'x', nombre: 'X', perfil: (u) => `https://x.com/${u}` },
  { clave: 'telegram', nombre: 'Telegram', perfil: (u) => `https://t.me/${u}` },
];

// Devuelve el enlace del perfil, '' si está vacío, o null si no es válido o no es de esa red
function enlaceRed(red, valor) {
  const v = (valor ?? '').trim();
  if (!v) return '';
  if (/^@?[\w.-]{1,60}$/.test(v) && !/^(www\.)?[a-z]+\.(com|me|be)$/i.test(v)) return red.perfil(v.replace(/^@/, '')); // solo el usuario
  const url = urlSegura(v);
  return url && iconoExtra(url) === red.clave ? url : null;
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

// Qué parte del logo es transparente (0 a 1)
async function fraccionTransparente(buffer) {
  const { data } = await sharp(buffer).ensureAlpha().resize(64, 64, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  let t = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) t++;
  return t / (data.length / 4);
}

// Si el logo trae su propio fondo liso (como un JPG con fondo crema), devuelve ese color para usarlo en la placa.
// Se mira el borde de la imagen ya recortada: si la mayoría de sus píxeles son de un mismo color, ese es el fondo.
// Si el borde tiene degradado o foto, devuelve null y el logo se muestra tal cual.
async function colorFondoLiso(buffer) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const borde = [];
  const tomar = (x, y) => {
    const i = (y * w + x) * 3;
    borde.push([data[i], data[i + 1], data[i + 2]]);
  };
  for (let x = 0; x < w; x++) { tomar(x, 0); tomar(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { tomar(0, y); tomar(w - 1, y); }
  // color más repetido (agrupando tonos parecidos)
  const grupos = new Map();
  for (const p of borde) {
    const k = p.map((c) => c >> 4).join(',');
    const g = grupos.get(k) ?? { n: 0, suma: [0, 0, 0] };
    g.n++;
    p.forEach((c, i) => (g.suma[i] += c));
    grupos.set(k, g);
  }
  const mejor = [...grupos.values()].sort((a, b) => b.n - a.n)[0];
  const medio = mejor.suma.map((c) => c / mejor.n);
  const cercanos = borde.filter((p) => p.every((c, i) => Math.abs(c - medio[i]) <= 24)).length;
  return cercanos / borde.length >= 0.7 ? rgbAHex(medio) : null;
}

// Color con carácter más repetido del logo (sin contar su fondo, blancos ni grises). Sirve de color secundario.
async function colorDelLogo(buffer, fondo) {
  const { data } = await sharp(buffer).ensureAlpha().resize(64, 64, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const grupos = new Map();
  let opacos = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const p = [data[i], data[i + 1], data[i + 2]];
    opacos++;
    if (Math.max(...p) - Math.min(...p) < 40) continue; // gris, blanco o negro
    if (fondo && distanciaColor(rgbAHex(p), fondo) < 48) continue;
    const k = p.map((c) => c >> 5).join(',');
    const g = grupos.get(k) ?? { n: 0, suma: [0, 0, 0] };
    g.n++;
    p.forEach((c, j) => (g.suma[j] += c));
    grupos.set(k, g);
  }
  const mejor = [...grupos.values()].sort((a, b) => b.n - a.n)[0];
  return mejor && mejor.n >= opacos * 0.03 ? rgbAHex(mejor.suma.map((c) => c / mejor.n)) : null;
}

function sugerirArchivos() {
  try {
    const lista = readdirSync(LOGOS_DIR).filter((f) => !f.startsWith('.'));
    return lista.length ? ` Archivos que sí hay en logos/: ${lista.slice(0, 6).join(', ')}.` : ' La carpeta logos/ está vacía.';
  } catch {
    return '';
  }
}

// Busca el archivo del logo sin importar mayúsculas ni si falta la extensión.
// En Windows "logo005.png" y "logo005.PNG" son el mismo archivo, pero en GitHub (Linux) no: sin esto, funciona en el
// computador y falla al publicar.
function buscarLogo(nombre) {
  let lista;
  try {
    lista = readdirSync(LOGOS_DIR).filter((f) => !f.startsWith('.'));
  } catch {
    return null;
  }
  const n = nombre.toLowerCase();
  return lista.find((f) => f === nombre) ?? lista.find((f) => f.toLowerCase() === n) ?? lista.find((f) => f.toLowerCase().replace(/\.[^.]+$/, '') === n) ?? null;
}

// Foto de portada (opcional): se recorta a 900×500 y se comprime para que la página siga siendo liviana
const PORTADA = { w: 900, h: 500, maxBytes: 70 * 1024 };
async function prepararPortada(id, valor, etiqueta) {
  const v = (valor ?? '').trim();
  if (!v) return null;
  const archivo = /^[\w. -]+$/.test(v) ? buscarLogo(v) : null;
  if (!archivo || !['.jpg', '.jpeg', '.png', '.webp'].includes(extname(archivo).toLowerCase())) {
    avisar(`${etiqueta}: no encontré la foto de portada "${v}" (JPG, PNG o WEBP) en la carpeta logos/. Se omite.${sugerirArchivos()}`);
    return null;
  }
  if (!sharp) {
    avisar(`${etiqueta}: la portada necesita "sharp" para reducir su peso. Se omite.`);
    return null;
  }
  try {
    const base = sharp(await readFile(`${LOGOS_DIR}/${archivo}`)).rotate().resize(PORTADA.w, PORTADA.h, { fit: 'cover', position: 'attention' });
    let datos;
    for (const calidad of [72, 62, 52]) {
      datos = await base.clone().jpeg({ quality: calidad, mozjpeg: true }).toBuffer();
      if (datos.length <= PORTADA.maxBytes) break;
    }
    await mkdir(`${SALIDA}/logos`, { recursive: true });
    const nombre = `${id}-portada-${huella(datos)}.jpg`;
    await writeFile(`${SALIDA}/logos/${nombre}`, datos);
    return { src: `../logos/${nombre}`, kb: Math.round(datos.length / 1024) };
  } catch (e) {
    avisar(`${etiqueta}: no se pudo procesar la portada "${v}" (${e.message}). Se omite.`);
    return null;
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
    return { src: u, w: 0, h: 0, claro: false, opaco: false, fondoEsquina: null };
  }

  const archivo = /^[\w. -]+$/.test(v) ? buscarLogo(v) : null;
  if (!archivo) {
    avisar(`${etiqueta}: no encontré el logo "${v}" en la carpeta logos/. Revisa el nombre y la extensión.${sugerirArchivos()} Se usará la inicial del negocio.`);
    return 'error';
  }

  const ruta = `${LOGOS_DIR}/${archivo}`;
  const ext = extname(archivo).toLowerCase();
  await mkdir(`${SALIDA}/logos`, { recursive: true });

  // Logo vectorial: se publica tal cual (nítido a cualquier tamaño)
  if (ext === '.svg') {
    const txt = await readFile(ruta, 'utf8');
    const dim = dimensionesSvg(txt);
    if (!dim) avisar(`${etiqueta}: el SVG del logo no indica su tamaño (viewBox); puede verse mal ajustado.`);
    const nombreSvg = `${id}-${huella(txt)}.svg`;
    await copyFile(ruta, `${SALIDA}/logos/${nombreSvg}`);
    const caja = ajustarACaja(dim?.w || 200, dim?.h || 100, true);
    const secundario = sharp ? await colorDelLogo(Buffer.from(txt), null).catch(() => null) : null;
    return { src: `../logos/${nombreSvg}`, w: caja.w, h: caja.h, claro: false, opaco: false, fondoEsquina: null, secundario };
  }

  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    avisar(`${etiqueta}: el logo "${v}" debe ser PNG, JPG, WEBP o SVG. Se usará la inicial del negocio.`);
    return 'error';
  }

  // Sin sharp: se publica tal cual
  if (!sharp) {
    const nombreCopia = `${id}-${huella(await readFile(ruta))}${ext}`;
    await copyFile(ruta, `${SALIDA}/logos/${nombreCopia}`);
    return { src: `../logos/${nombreCopia}`, w: 0, h: 0, claro: false, opaco: false, fondoEsquina: null };
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
    // Un PNG puede traer canal de transparencia sin tener nada transparente: en ese caso se trata como logo con fondo propio
    let conTransparencia = (await sharp(recortado).metadata()).hasAlpha === true;
    if (conTransparencia && (await fraccionTransparente(recortado)) < 0.01) conTransparencia = false;
    // Fondo propio del logo: si el borde es de un solo color, la placa usará ese color
    const fondoEsquina = conTransparencia ? null : await colorFondoLiso(await sharp(recortado).flatten({ background: '#ffffff' }).toBuffer());
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
    const secundario = await colorDelLogo(final.data, fondoEsquina);
    return { src: `../logos/${nombreFinal}`, w: caja.w, h: caja.h, claro: await esLogoClaro(final.data), mayor, opaco: !conTransparencia, fondoEsquina, secundario };
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

// Devuelve { texto, xlsx }: el CSV y de dónde sacar la versión .xlsx (para los vínculos con nombre)
async function leerCSV() {
  if (process.env.SHEET_CSV_FILE) {
    const archivo = process.env.SHEET_XLSX_FILE; // solo para pruebas locales
    return { texto: await readFile(process.env.SHEET_CSV_FILE, 'utf8'), xlsx: archivo ? { archivo } : null };
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
      xlsx: { url: `${SHEETS_BASE}/spreadsheets/d/${encodeURIComponent(id)}/export?format=xlsx` },
      ayuda: 'Revisa que la hoja esté compartida como "Cualquier persona con el enlace" (Lector) y que SHEET_GID sea el de la pestaña Negocios.',
    });
  }
  if (publicada) {
    fuentes.push({
      nombre: 'enlace publicado en la web',
      url: publicada,
      xlsx: /output=csv/i.test(publicada) ? { url: publicada.replace(/output=csv/i, 'output=xlsx') } : null,
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
        return { texto, xlsx: fuente.xlsx };
      } catch (e) {
        ultimoError = `${fuente.nombre}: ${e.message} ${fuente.ayuda}`;
        console.warn(`  Intento ${intento} falló (${fuente.nombre}): ${e.message}`);
        await new Promise((r) => setTimeout(r, 1500 * intento));
      }
    }
  }
  fallar('No se pudo leer la hoja. ' + ultimoError);
}

// ---------- Vínculos con nombre ----------
// Si en la hoja se usa "Insertar vínculo" y se le pone un nombre (ej. "Sedes"), el CSV solo trae ese nombre.
// El enlace real sí viene en la versión .xlsx de la hoja: de ahí se toma, solo para las columnas de enlaces.
const COLUMNAS_ENLACE = new Set(['google_resenas', 'catalogo', 'boton4_url', 'boton5_url', ...REDES.map((r) => r.clave)]);

// Lee los archivos de un .xlsx (que es un .zip) sin instalar nada más
function leerZip(buf) {
  let fin = buf.length - 22;
  while (fin >= 0 && buf.readUInt32LE(fin) !== 0x06054b50) fin--;
  if (fin < 0) throw new Error('el archivo .xlsx no es válido');
  const archivos = {};
  let p = buf.readUInt32LE(fin + 16);
  for (let i = buf.readUInt16LE(fin + 10); i > 0 && buf.readUInt32LE(p) === 0x02014b50; i--) {
    const metodo = buf.readUInt16LE(p + 10);
    const tamano = buf.readUInt32LE(p + 20);
    const largoNombre = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const nombre = buf.toString('utf8', p + 46, p + 46 + largoNombre);
    const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const datos = buf.subarray(inicio, inicio + tamano);
    archivos[nombre] = () => (metodo === 8 ? inflateRawSync(datos) : datos).toString('utf8');
    p += 46 + largoNombre + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return archivos;
}

const desescaparXml = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
const atributo = (texto, nombre) => texto.match(new RegExp(`(?:^|\\s)${nombre}="([^"]*)"`))?.[1];

// "J5" → [fila, columna] contando desde 0
function celda(ref) {
  const [, letras, num] = ref.match(/^([A-Z]+)(\d+)$/);
  let col = 0;
  for (const l of letras) col = col * 26 + l.charCodeAt(0) - 64;
  return [+num - 1, col - 1];
}

// Devuelve [[fila, columna, enlace], …] de la pestaña cuyos encabezados coinciden con los del CSV, o null
function vinculosXlsx(buf, encabezados, filaEncabezados) {
  const zip = leerZip(buf);
  const compartidos = zip['xl/sharedStrings.xml']
    ? [...zip['xl/sharedStrings.xml']().matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
        desescaparXml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''))
      )
    : [];
  for (const nombre of Object.keys(zip).filter((n) => /^xl\/worksheets\/[^/]+\.xml$/.test(n))) {
    const xml = zip[nombre]();
    const celdas = [...xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map((m) => ({ attrs: m[1], dentro: m[2] ?? '' }));

    // ¿Es la pestaña de los negocios? Sus encabezados deben ser los mismos del CSV
    const titulos = [];
    for (const c of celdas) {
      const [f, col] = celda(atributo(c.attrs, 'r') ?? 'A0');
      if (f !== filaEncabezados) continue;
      const v = c.dentro.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? c.dentro.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '';
      titulos[col] = normalizar(atributo(c.attrs, 't') === 's' ? compartidos[+v] ?? '' : desescaparXml(v));
    }
    if (!encabezados.every((h, j) => !h || titulos[j] === h)) continue;

    const vinculos = [];
    // 1) Vínculos insertados con "Insertar vínculo": <hyperlink ref="J5" r:id="rId1"/> + archivo de relaciones
    const rels = zip[nombre.replace('worksheets/', 'worksheets/_rels/') + '.rels'];
    const destinos = {};
    if (rels) for (const m of rels().matchAll(/<Relationship\b([^>]*)>/g)) destinos[atributo(m[1], 'Id')] = desescaparXml(atributo(m[1], 'Target') ?? '');
    for (const m of xml.matchAll(/<hyperlink\b([^>]*)>/g)) {
      const url = destinos[atributo(m[1], 'r:id')];
      const [desde, hasta = desde] = (atributo(m[1], 'ref') ?? '').split(':');
      if (!url || !desde) continue;
      const [f1, c1] = celda(desde);
      const [f2, c2] = celda(hasta);
      for (let f = f1; f <= f2; f++) for (let c = c1; c <= c2; c++) vinculos.push([f, c, url]);
    }
    // 2) Fórmulas =HYPERLINK("enlace"; "nombre")
    for (const c of celdas) {
      const formula = desescaparXml(c.dentro.match(/<f>([\s\S]*?)<\/f>/)?.[1] ?? '');
      const url = formula.match(/^HYPERLINK\(\s*"([^"]+)"/i)?.[1];
      const ref = atributo(c.attrs, 'r');
      if (url && ref) vinculos.push([...celda(ref), url]);
    }
    return vinculos;
  }
  return null;
}

async function aplicarVinculos(todas, iEncabezados, fuente) {
  try {
    let buf;
    if (fuente.archivo) buf = await readFile(fuente.archivo);
    else {
      const res = await fetch(fuente.url + (fuente.url.includes('?') ? '&' : '?') + 'nocache=' + Date.now(), { redirect: 'follow' });
      if (!res.ok) throw new Error('Google respondió ' + res.status);
      buf = Buffer.from(await res.arrayBuffer());
    }
    const encabezados = todas[iEncabezados].map(normalizar);
    const vinculos = vinculosXlsx(buf, encabezados, iEncabezados);
    if (!vinculos) throw new Error('no encontré la pestaña de los negocios en el .xlsx');
    let cambiados = 0;
    for (const [f, c, url] of vinculos) {
      if (f <= iEncabezados || !todas[f] || !COLUMNAS_ENLACE.has(encabezados[c])) continue;
      if ((todas[f][c] ?? '').trim() !== url) {
        todas[f][c] = url;
        cambiados++;
      }
    }
    if (cambiados) console.log(`  · ${cambiados} vínculo(s) con nombre: se usa el enlace real, no el texto que se ve en la celda.`);
  } catch (e) {
    avisar(`No se pudieron leer los vínculos con nombre (${e.message}). Si en una celda usaste "Insertar vínculo" con otro texto, ese botón puede fallar: pega el enlace completo.`);
  }
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

  // Tema: vacío = Mostrador (por defecto); "premium" = negro y oro
  let estilo = normalizar(g('estilo'));
  if (estilo && !PLANTILLAS[estilo]) {
    avisar(`${etiqueta}: el estilo "${g('estilo')}" no existe. Escribe premium o déjalo vacío. Se usa el diseño normal.`);
    estilo = '';
  }

  const alias = g('alias').toLowerCase();
  if (alias && !slugValido(alias)) avisar(`${etiqueta}: el alias "${alias}" no es válido; se ignora.`);

  // Logo
  const logoRes = await prepararLogo(id, g('logo'), etiqueta);
  const logo = logoRes && logoRes !== 'error' ? logoRes : null;

  let fondoLogo = normalizar(g('logo_fondo'));
  let colorPlaca = '';
  if (fondoLogo && !['blanco', 'oscuro', 'sin'].includes(fondoLogo)) {
    avisar(`${etiqueta}: logo_fondo "${g('logo_fondo')}" no existe. Usa blanco, oscuro o sin. Se elige automático.`);
    fondoLogo = '';
  }
  if (!fondoLogo) {
    if (!logo) fondoLogo = 'blanco';
    else if (logo.opaco && logo.fondoEsquina) {
      // El logo trae un fondo liso: la placa toma ese color y no se nota ningún borde
      fondoLogo = 'color';
      colorPlaca = logo.fondoEsquina;
      console.log(`  · ${id}: el logo trae fondo propio (${colorPlaca}); la placa usa ese color.`);
    } else if (logo.opaco) {
      fondoLogo = 'tal'; // fondo degradado o foto: se muestra tal cual, con esquinas redondeadas
      console.log(`  · ${id}: el logo trae un fondo no liso; se muestra tal cual.`);
    } else {
      fondoLogo = logo.claro ? 'oscuro' : 'blanco';
      if (logo.claro) console.log(`  · ${id}: el logo es claro; se pone sobre una placa oscura para que se vea.`);
    }
  }

  // Botones disponibles (solo los que tienen datos válidos)
  const disponibles = {};
  const texto = (campo, defecto, maximo = MAX_TEXTO_BOTON) => {
    const t = g(campo) || defecto;
    if (t.length > maximo) avisar(`${etiqueta}: el texto "${t.slice(0, 24)}…" de ${campo} tiene ${t.length} letras; en el botón cuadrado caben unas ${maximo}. Acórtalo.`);
    return t;
  };

  const resenas = urlSegura(g('google_resenas'));
  if (resenas === null) avisar(`${etiqueta}: el enlace de reseñas no es válido. Se omite ese botón.`);
  else if (resenas) disponibles.resenas = { icono: 'resenas', texto: texto('texto_resenas', TEXTO_RESENAS_DEFECTO, 45), url: resenas };

  const catalogo = urlSegura(g('catalogo'));
  if (catalogo === null) avisar(`${etiqueta}: el enlace del catálogo no es válido. Se omite ese botón.`);
  else if (catalogo) {
    const icono = elegirIcono({ texto: g('texto_catalogo'), url: catalogo, defecto: 'catalogo', etiqueta, columna: 'catalogo' });
    disponibles.catalogo = { icono, texto: texto('texto_catalogo', TEXTO_ICONO[icono] ?? 'Ver catálogo'), url: catalogo };
  }

  const tel = telefono(g('whatsapp'));
  if (tel === null) avisar(`${etiqueta}: el número de WhatsApp no parece válido. Se omite ese botón.`);
  else if (tel) {
    const msg = g('mensaje_whatsapp') || MENSAJE_DEFECTO;
    disponibles.whatsapp = {
      icono: 'whatsapp',
      texto: texto('texto_whatsapp', 'Escríbenos'),
      url: `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`,
    };
  }

  for (const n of ['4', '5']) {
    const url = urlSegura(g(`boton${n}_url`));
    if (url === null) avisar(`${etiqueta}: el enlace del botón ${n} no es válido. Se omite.`);
    else if (url) {
      const icono = elegirIcono({
        forzado: normalizar(g(`boton${n}_icono`)),
        texto: g(`boton${n}_texto`),
        url,
        defecto: 'web',
        etiqueta,
        columna: `boton${n}_icono`,
      });
      const porDominio = TEXTO_DOMINIO[new URL(url).hostname.replace(/^www\./, '')];
      disponibles['boton' + n] = { icono, texto: texto(`boton${n}_texto`, porDominio ?? TEXTO_ICONO[icono]), url };
    }
  }

  const botones = ordenarBotones(g('orden_botones'), etiqueta)
    .map((clave) => disponibles[clave])
    .filter(Boolean);

  if (botones.length === 0) {
    avisar(`${etiqueta}: no tiene ningún botón con datos válidos. Se omite.`);
    return null;
  }

  const titular = g('titular') || TITULAR_DEFECTO;
  if (titular.length > 32) avisar(`${etiqueta}: el titular tiene ${titular.length} letras; en letra grande se verá muy largo. Acórtalo.`);

  // Redes sociales: círculos con el ícono de cada red, al final de la página
  const redes = [];
  for (const red of REDES) {
    const url = enlaceRed(red, g(red.clave));
    if (url === null) avisar(`${etiqueta}: "${g(red.clave)}" no es un enlace ni un usuario de ${red.nombre}. Se omite.`);
    else if (url) redes.push({ clave: red.clave, nombre: red.nombre, url });
  }

  // Si el logo ya trae el nombre escrito, el nombre no se repite en pantalla (sigue ahí para lectores de pantalla y Google)
  let nombreEnLogo = ['si', 'yes'].includes(normalizar(g('nombre_en_logo')));
  if (nombreEnLogo && !logo) {
    avisar(`${etiqueta}: nombre_en_logo dice "si" pero no hay logo. Se muestra el nombre.`);
    nombreEnLogo = false;
  }

  // Color secundario automático: el color con carácter del logo, si se distingue del principal.
  // Si no hay, el mismo color principal. En los dos casos se oscurece solo si hace falta para leerse sobre el papel.
  const secundario = logo?.secundario && distanciaColor(logo.secundario, colorFinal) > 60 ? logo.secundario : colorFinal;
  const acento = legibleSobre(secundario, '#fffdf8', 3);

  const portada = await prepararPortada(id, g('portada'), etiqueta);

  // Wi-Fi para clientes: se muestra al tocar el botón, sin JavaScript
  let wifi = null;
  if (g('wifi_red') || g('wifi_clave')) {
    if (!g('wifi_red')) avisar(`${etiqueta}: hay clave de Wi-Fi pero falta el nombre de la red (wifi_red). Se omite el Wi-Fi.`);
    else wifi = { red: g('wifi_red'), clave: g('wifi_clave') };
  }

  return {
    id,
    alias: alias && slugValido(alias) ? alias : '',
    acento,
    portada,
    wifi,
    nombre,
    slogan: g('slogan'),
    titular,
    notaResenas: g('nota_resenas') || NOTA_RESENAS_DEFECTO,
    color: colorFinal,
    logo,
    fondoLogo,
    colorPlaca,
    resena: botones.find((b) => b.icono === 'resenas') ?? null,
    botones: botones.filter((b) => b.icono !== 'resenas'),
    redes,
    nombreEnLogo,
    estilo: estilo || 'mostrador',
  };
}

const ESTRELLA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l3 6.9 7.4.7-5.6 4.9 1.7 7.3L12 17.6 5.5 21.6l1.7-7.3L1.6 9.4l7.4-.7z"/></svg>';
// "G" de Google, sin modificar (Google permite usarla para pedir reseñas)
const G_GOOGLE =
  '<svg class="g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

function htmlBotones(botones) {
  return botones
    .map(
      (b) =>
        `<a class="tl" href="${esc(b.url)}" rel="noopener">` +
        `<span class="ic">${svgIcono(b.icono)}</span>` +
        `<span class="tx">${esc(b.texto)}</span></a>`
    )
    .join('\n      ');
}

function htmlResena(n) {
  if (!n.resena) return '';
  return (
    // Sin "cinco estrellas": la calificación la elige el cliente en Google, aquí no se sugiere ninguna
    `<a class="res" href="${esc(n.resena.url)}" rel="noopener" aria-label="${esc(n.resena.texto)}. Abre Google para calificar">` +
    `<span class="arr">${G_GOOGLE}<span>${esc(n.resena.texto)}</span></span>` +
    `<span class="est" aria-hidden="true">${ESTRELLA.repeat(5)}</span>` +
    `<span class="nota">${esc(n.notaResenas)}</span></a>`
  );
}

// <details> abre y cierra sin JavaScript. La clave se selecciona completa con un toque para copiarla.
function htmlWifi(wifi) {
  if (!wifi) return '';
  const clave = wifi.clave
    ? `<span class="wf-dato"><span class="wf-et">Clave</span><span class="wf-clave">${esc(wifi.clave)}</span></span>`
    : `<span class="wf-dato"><span class="wf-et">Clave</span><span>Red abierta, sin clave</span></span>`;
  return (
    `<details class="wifi"><summary><span class="ic">${svgIcono('wifi')}</span><span class="tx">Wi-Fi gratis</span></summary>` +
    `<div class="wf-panel"><span class="wf-dato"><span class="wf-et">Red</span><span class="wf-red">${esc(wifi.red)}</span></span>${clave}</div></details>`
  );
}

function htmlRedes(redes) {
  if (!redes.length) return '';
  const enlaces = redes
    .map((r) => `<a href="${esc(r.url)}" rel="noopener" aria-label="${r.nombre}">${svgIcono(r.clave)}</a>`)
    .join('\n      ');
  return `<nav class="redes" aria-label="Redes sociales">\n      ${enlaces}\n    </nav>`;
}

function htmlLogo(n) {
  if (!n.logo) {
    return `<div class="logo inicial" aria-hidden="true">${esc([...n.nombre][0].toUpperCase())}</div>`;
  }
  const medidas = n.logo.w ? ` width="${n.logo.w}" height="${n.logo.h}" style="width:${n.logo.w}px"` : '';
  const clases = { blanco: 'placa fondo-blanco', oscuro: 'placa fondo-oscuro', color: 'placa', sin: 'sin', tal: 'tal' }[n.fondoLogo];
  const estilo = n.fondoLogo === 'color' ? ` style="background:${n.colorPlaca}"` : '';
  return (
    `<div class="logo ${clases}"${estilo}>` +
    `<img src="${esc(n.logo.src)}" alt="Logo de ${esc(n.nombre)}"${medidas} decoding="async" fetchpriority="high">` +
    `</div>`
  );
}

// Los colores claros llevan íconos más oscuros para que se lean sobre el papel
const colorIcono = (hex) => (textoSobre(hex) === TEXTO_OSCURO ? oscurecer(hex, 0.5) : hex);

function htmlPagina(plantilla, n) {
  const sloganHtml = n.slogan ? `<span class="slogan">${esc(n.slogan)}</span>` : '';
  const apilada = n.logo && n.logo.w && n.logo.w / n.logo.h > 2.2 ? ' apilada' : '';
  let pie = '';
  if (PIE_TEXTO) {
    const url = urlSegura(PIE_URL);
    pie = `<footer class="pie">${url ? `<a href="${esc(url)}" rel="noopener">${esc(PIE_TEXTO)}</a>` : esc(PIE_TEXTO)}</footer>`;
  }
  return plantilla
    .replaceAll('{{TITULO}}', esc(n.nombre))
    .replaceAll('{{COLOR}}', n.color)
    .replaceAll('{{COLOR_TEXTO}}', textoSobre(n.color))
    .replaceAll('{{COLOR_ICONO}}', colorIcono(n.color))
    .replaceAll('{{COLOR_ACENTO}}', n.acento)
    .replaceAll('{{TOLDO_CLASE}}', n.portada ? ' con-portada' : '')
    .replaceAll('{{PORTADA_HTML}}', n.portada ? `<img class="portada" src="${esc(n.portada.src)}" alt="" width="900" height="500" decoding="async">` : '')
    .replaceAll('{{WIFI_HTML}}', htmlWifi(n.wifi))
    .replaceAll('{{CAB_CLASE}}', apilada + (n.nombreEnLogo ? ' nombre-en-logo' : ''))
    .replaceAll('{{NOMBRE}}', `<span class="nom-txt">${esc(n.nombre)}</span>`)
    .replaceAll('{{LOGO_HTML}}', htmlLogo(n))
    .replaceAll('{{SLOGAN_HTML}}', sloganHtml)
    .replaceAll('{{TITULAR}}', esc(n.titular))
    .replaceAll('{{RESENA_HTML}}', htmlResena(n))
    .replaceAll('{{N_BOTONES}}', String(Math.min(n.botones.length, 5)))
    .replaceAll('{{BOTONES}}', htmlBotones(n.botones))
    .replaceAll('{{REDES_HTML}}', htmlRedes(n.redes))
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
const hoja = await leerCSV();
const todas = parsearCSV(hoja.texto);
const iEncabezados = todas.findIndex((f) => !filaVacia(f));
if (iEncabezados >= 0 && hoja.xlsx) await aplicarVinculos(todas, iEncabezados, hoja.xlsx);
const filas = todas.filter((f) => !filaVacia(f));
if (filas.length < 2) fallar('La hoja está vacía o solo tiene los encabezados.');

const encabezados = filas[0].map(normalizar);
for (const obligatoria of ['id', 'estado', 'nombre']) {
  if (!encabezados.includes(obligatoria)) {
    fallar(`Falta la columna "${obligatoria}" en la hoja. Revisa los encabezados de la fila 1.`);
  }
}

const plantillas = {};
for (const [estilo, archivo] of Object.entries(PLANTILLAS)) plantillas[estilo] = await readFile(archivo, 'utf8');
await rm(SALIDA, { recursive: true, force: true });
await mkdir(SALIDA, { recursive: true });

// Tipografías: se publican junto al sitio (sin pedirlas a Google en cada visita)
const FUENTES = {
  'unbounded-800.woff2': '@fontsource/unbounded/files/unbounded-latin-800-normal.woff2',
  'inter-400.woff2': '@fontsource/inter/files/inter-latin-400-normal.woff2',
  'inter-500.woff2': '@fontsource/inter/files/inter-latin-500-normal.woff2',
  'inter-600.woff2': '@fontsource/inter/files/inter-latin-600-normal.woff2',
};
await mkdir(`${SALIDA}/fonts`, { recursive: true });
for (const [destino, origen] of Object.entries(FUENTES)) {
  if (existsSync(`node_modules/${origen}`)) await copyFile(`node_modules/${origen}`, `${SALIDA}/fonts/${destino}`);
  else avisar(`No encontré la tipografía ${destino}. Se usará la letra del sistema. Ejecuta "npm install".`);
}

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
  const html = htmlPagina(plantillas[n.estilo], n);
  for (const carpeta of [n.id, n.alias].filter(Boolean)) {
    await mkdir(`${SALIDA}/${carpeta}`, { recursive: true });
    await writeFile(`${SALIDA}/${carpeta}/index.html`, html);
  }
  console.log(`  ✔ ${n.id}${n.alias ? ' / ' + n.alias : ''} — ${n.nombre} (${n.botones.length + (n.resena ? 1 : 0)} botones${n.estilo === 'premium' ? ', premium' : ''})`);
}

await writeFile(`${SALIDA}/index.html`, paginaSimple('Tarjeta digital', 'Escanea la tarjeta de un negocio para ver su página.'));
await writeFile(`${SALIDA}/404.html`, paginaSimple('Esta tarjeta no está disponible', 'Pídele al negocio que la revise o intenta de nuevo más tarde.'));
await writeFile(`${SALIDA}/robots.txt`, 'User-agent: *\nDisallow: /\n');

console.log(`\nListo: ${negocios.length} páginas creadas, ${pausados} pausadas, ${advertencias.length} advertencias.`);

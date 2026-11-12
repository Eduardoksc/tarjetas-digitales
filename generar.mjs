// generar.mjs
// Lee la hoja de Google Sheets (publicada como CSV) y crea UNA página lista por cada negocio.
//
// Uso local:   SHEET_CSV_FILE=ejemplo-negocios.csv node generar.mjs
// En GitHub:   lo ejecuta solo el robot (ver .github/workflows/publicar.yml)

import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { extname } from 'node:path';
import { createHash, pbkdf2Sync } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { MARCAS } from './iconos.mjs';

// ---------- Ajustes que puedes cambiar ----------
const SALIDA = 'dist';
const LOGOS_DIR = process.env.LOGOS_DIR ?? 'logos';
const COLOR_DEFECTO = '#1f6f5c';
const TITULAR_DEFECTO = 'Nos encantó verte.';
const TEXTO_RESENAS_DEFECTO = '¿Cómo te fue? Cuéntanos tu experiencia'; // el botón ya dice "Calificar en Google"
const NOTA_RESENAS_DEFECTO = '20 segundos. Ayudas a que más gente nos encuentre.';
const MAX_TEXTO_BOTON = 16; // los botones cuadrados tienen poco espacio
const MAX_DETALLE = 30; // subtítulo bajo el texto del botón ("Únete y acumula puntos")
const MAX_ETIQUETA = 10; // etiqueta pequeña en la esquina ("Nuevo")
// Fondo que se queda quieto mientras se baja por la página (columna lienzo)
const LIENZOS = ['formas', 'puntos', 'arcos'];
const ULTIMO_BOTON_EXTRA = 9; // botones adicionales: boton4 a boton9. Con catálogo y WhatsApp son 8 acciones como máximo
const BOTONES_EXTRA = Array.from({ length: ULTIMO_BOTON_EXTRA - 3 }, (_, i) => String(i + 4)); // ['4', '5', … '9']
const MENSAJE_DEFECTO = 'Hola, vi su tarjeta y quisiera más información.';
const PIE_TEXTO = process.env.PIE_TEXTO ?? ''; // ej: "Tarjeta digital por E.S.C"
const PIE_URL = process.env.PIE_URL ?? ''; // ej: "https://tudominio.co"
// Contador propio (opcional): dirección donde corre en Cloudflare, ej. https://t.fides-link.com.
// Con ella, cada botón web pasa por <CONTADOR_URL>/ir/<id>/<botón>, que suma el toque y lleva al enlace real.
const CONTADOR_URL = (process.env.CONTADOR_URL ?? '').trim().replace(/\/+$/, '');
// Dirección pública del sitio, para la imagen de la vista previa al compartir (WhatsApp, Facebook…).
// Sin la variable SITIO_URL, en GitHub se deduce del repositorio. Al pasar a un dominio propio, basta con crear SITIO_URL.
const [DUENO_REPO, NOMBRE_REPO] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
const SITIO_URL = process.env.SITIO_URL || (NOMBRE_REPO ? `https://${DUENO_REPO.toLowerCase()}.github.io/${NOMBRE_REPO}` : '');
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

// Solo acepta páginas web. Teléfono y correo solo se aceptan en los botones adicionales: ver enlaceBoton().
function urlSegura(valor) {
  const v = (valor ?? '').trim();
  if (!v) return '';
  // Otro esquema (mailto:, tel:, javascript:…). "ejemplo.com:8080" no es un esquema, es un puerto.
  if (!/^https?:\/\//i.test(v) && /^[a-z][a-z0-9+.-]*:(?!\d{1,5}(?:[/?#]|$))/i.test(v)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.username || u.password) return null; // "usuario@ejemplo.com" abriría ejemplo.com, no un correo
    if (/^[\d.]+$/.test(u.hostname)) return null; // un número suelto se convierte en una dirección IP que no lleva a ninguna parte
    if (!/^[^.]+(\.[^.]+)+$/.test(u.hostname)) return null; // sin dominio real (ej. una palabra como "Sedes" escrita en vez del enlace)
    u.protocol = 'https:';
    return u.href;
  } catch {
    return null;
  }
}

// Teléfono para llamar: "tel:+573001234567" o null. Sin +, solo números de Colombia:
// celular (3…) o fijo (60…) de 10 dígitos, con o sin 57, y líneas 018000. Con +, cualquier país (8 a 15 dígitos).
function enlaceLlamada(valor) {
  const v = valor.trim();
  if (!/^\+?[\d\s().-]+$/.test(v)) return null;
  const d = v.replace(/\D/g, '');
  const conMas = v.startsWith('+');
  if (!conMas && /^018000\d{6}$/.test(d)) return 'tel:' + d;
  if (!conMas && /^(3\d{9}|60\d{8})$/.test(d)) return 'tel:+57' + d;
  if (/^57(3\d{9}|60\d{8})$/.test(d)) return 'tel:+' + d;
  if (conMas && !d.startsWith('57') && /^[1-9]\d{7,14}$/.test(d)) return 'tel:+' + d;
  return null;
}

// Correo: "mailto:hola@ejemplo.com" o null. Sin asunto ni copias ocultas (?bcc=…), para que nadie los cuele.
function enlaceCorreo(valor) {
  const v = valor.trim();
  if (v.length > 254) return null;
  return /^[a-z0-9_+-]+(\.[a-z0-9_+-]+)*@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i.test(v) ? 'mailto:' + v : null;
}

// Formulario a WhatsApp: "formulario: Opción 1 | Opción 2 | Opción 3" en botonN_url.
// Devuelve la lista de opciones (puede ir vacía: entonces el motivo se escribe), o null si no es un formulario.
const MAX_OPCIONES = 6;
function opcionesFormulario(valor) {
  const m = (valor ?? '').trim().match(/^formulario\s*(?::(.*))?$/is);
  if (!m) return null;
  return (m[1] ?? '').split(/[|\n]/).map((x) => x.trim()).filter(Boolean);
}

// Campos propios del formulario (columna botonN_campos): un campo por renglón o separados por ";".
//   "Tipo de misa (desplegable): Comunitaria | Particular" → lista desplegable
//   "Intención: Eterno descanso | Acción de gracias"      → opciones en botones grandes
//   "(opcional)" quita la obligación. El tipo sale del nombre ("Fecha y hora" → calendario con reloj)
//   o de una palabra entre paréntesis o corchetes: (fecha), (hora), (fecha y hora), (número), (teléfono), (correo), (texto largo), (texto).
const MAX_CAMPOS = 8;
const MAX_OPCIONES_LISTA = 12;
const MARCAS_CAMPO = {
  opcional: 'opcional', desplegable: 'desplegable', lista: 'desplegable', botones: 'botones',
  fecha: 'date', hora: 'time', fecha_y_hora: 'datetime-local', numero: 'numero', telefono: 'tel', celular: 'tel',
  correo: 'email', texto_largo: 'largo', texto: 'text',
};
function tipoPorNombre(nombre) {
  const n = normalizar(nombre);
  if (/fecha/.test(n) && /hora/.test(n)) return 'datetime-local';
  if (/(^|_)(fecha|dia)(_|$)/.test(n)) return 'date';
  if (/(^|_)hora(_|$)/.test(n)) return 'time';
  if (/telefono|celular|whatsapp/.test(n)) return 'tel';
  if (/correo|e_?mail/.test(n)) return 'email';
  if (/intencion|detalle|mensaje|observacion|comentario|descripcion/.test(n)) return 'largo';
  return 'text';
}
function camposFormulario(texto, donde) {
  const lineas = texto.split(/[\n;]/).map((x) => x.trim()).filter(Boolean);
  if (lineas.length > MAX_CAMPOS) avisar(`${donde} tiene ${lineas.length} campos; se usan los primeros ${MAX_CAMPOS}. Un formulario largo cansa al cliente.`);
  return lineas.slice(0, MAX_CAMPOS).map((linea) => {
    let opciones = [];
    const dp = linea.indexOf(':');
    // Solo hay opciones si van separadas por | o si el campo dice (desplegable) o (botones): "Hora: 7 a. m." es solo un nombre
    if (dp > 0 && linea.slice(dp + 1).trim() && (linea.includes('|', dp) || /[([]\s*(desplegable|lista|botones)\s*[)\]]/i.test(linea.slice(0, dp)))) {
      opciones = [...new Set(linea.slice(dp + 1).split('|').map((x) => x.trim()).filter(Boolean))];
      linea = linea.slice(0, dp);
    }
    let opcional = false, forma = '', tipo = '';
    linea = linea.replace(/[([]([^)\]]+)[)\]]/g, (todo, palabra) => {
      const m = MARCAS_CAMPO[normalizar(palabra).replace(/^_+|_+$/g, '')];
      if (!m) return todo; // un paréntesis normal, como "Nombre (completo)", se queda
      if (m === 'opcional') opcional = true;
      else if (m === 'desplegable' || m === 'botones') forma = m;
      else tipo = m;
      return '';
    }).replace(/\s+/g, ' ').trim();
    if (opciones.length) {
      tipo = forma || 'botones';
      const max = tipo === 'botones' ? MAX_OPCIONES : MAX_OPCIONES_LISTA;
      if (opciones.length > max) avisar(`${donde}: "${linea}" tiene ${opciones.length} opciones; se usan las primeras ${max}.${tipo === 'botones' ? ' Con muchas, escribe (desplegable) después del nombre.' : ''}`);
      opciones = opciones.slice(0, max);
      if (tipo === 'botones') for (const o of opciones) if (o.length > 24) avisar(`${donde}: la opción "${o.slice(0, 24)}…" es larga (${o.length} letras); en el botón caben unas 24.`);
    } else {
      if (forma === 'desplegable') avisar(`${donde}: "${linea}" dice (desplegable) pero no tiene opciones. Escríbelas después de dos puntos, separadas por |.`);
      tipo = tipo || tipoPorNombre(linea);
    }
    return { etiqueta: linea || 'Dato', enMensaje: linea || 'Dato', tipo, opciones, opcional };
  });
}
// Sin botonN_campos: motivo (en botones, o para escribir si no hay opciones), nombre y detalle.
// En el mensaje van en el orden de siempre: nombre, motivo, detalle.
function camposPorDefecto(opciones, donde) {
  if (opciones.length > MAX_OPCIONES) avisar(`${donde} tiene ${opciones.length} opciones; se muestran las primeras ${MAX_OPCIONES}.`);
  const lista = [...new Set(opciones)].slice(0, MAX_OPCIONES);
  for (const o of lista) if (o.length > 24) avisar(`${donde}: la opción "${o.slice(0, 24)}…" es larga (${o.length} letras); en el botón caben unas 24.`);
  return [
    { etiqueta: lista.length ? '¿Qué necesitas?' : 'Motivo', enMensaje: 'Motivo', tipo: lista.length ? 'botones' : 'text', opciones: lista, opcional: false, pos: 1 },
    { etiqueta: 'Nombre', enMensaje: 'Nombre', tipo: 'text', opciones: [], opcional: false, pos: 0 },
    { etiqueta: 'Detalle o fecha', enMensaje: 'Detalle', tipo: 'largo', opciones: [], opcional: true, pos: 2 },
  ];
}

// Enlace de un botón adicional: página web, teléfono o correo. Acepta también el número o el correo sin "tel:" ni "mailto:".
function enlaceBoton(valor) {
  const v = (valor ?? '').normalize('NFKC').trim(); // NFKC convierte el "＠" ancho de algunos teclados en "@"
  if (!v) return '';
  if (/^tel:/i.test(v)) return enlaceLlamada(v.slice(4));
  if (/^mailto:/i.test(v)) return enlaceCorreo(v.slice(7));
  if (/^\+?[\d\s().-]+$/.test(v)) return enlaceLlamada(v);
  if (/^[^/?#:\s]+@[^/?#:\s]+$/.test(v)) return enlaceCorreo(v);
  return urlSegura(v);
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
// Mezcla dos colores: t = 0 da el primero, t = 1 el segundo
const mezclar = (a, b, t) => rgbAHex(hexARgb(a).map((c, i) => c + (hexARgb(b)[i] - c) * t));

// Paleta de la tarjeta: el color de la marca va arriba y el resto, sobre un fondo claro neutro y tarjetas blancas.
function paletaMarca(marca, secundario) {
  const acento = legibleSobre(secundario, '#ffffff', 3); // estrellas y botón de la reseña, sobre el tiquete blanco
  const tinte = mezclar('#ffffff', marca, 0.1); // círculo de los íconos del mosaico
  return {
    tinta: mezclar('#17150f', marca, 0.12),
    gris: legibleSobre(mezclar('#6b655a', marca, 0.25), '#ffffff', 4.6),
    acento,
    acentoTexto: textoSobre(acento),
    tinte,
    iconoMosaico: legibleSobre(marca, tinte, 3),
    sombra: oscurecer(marca, 0.5),
    // Lienzo de fondo: suave para no competir con las piezas blancas ni bajar el contraste del pie
    lienzoSuave: mezclar('#f5f5f4', marca, 0.12),
    lienzoTrazo: mezclar('#f5f5f4', marca, 0.26),
  };
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
  correo: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6.5L20.5 7"/>',
  formulario: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.8h6V4M8.5 10h7M8.5 13.5h7M8.5 17h4"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.6 12.4a9.5 9.5 0 0 1 12.8 0M8.7 15.8a5 5 0 0 1 6.6 0"/><circle cx="12" cy="19.3" r=".8"/>',
  iglesia: '<path d="M12 2.5v5M10 4.5h4"/><path d="M5 21v-9.5l7-4 7 4V21"/><path d="M3 21h18"/><path d="M10 21v-3.5a2 2 0 0 1 4 0V21"/>',
  personas: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.6"/><path d="M16.2 14.2A4.6 4.6 0 0 1 21 19"/>',
  boda: '<circle cx="9" cy="14.5" r="5"/><circle cx="15" cy="14.5" r="5"/><path d="M12 3.2l1.8 1.8L12 6.8 10.2 5z"/>',
  salud: '<path d="M9.2 3.5h5.6v5.7h5.7v5.6h-5.7v5.7H9.2v-5.7H3.5V9.2h5.7z"/>',
  casa: '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>',
  documento: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 15.5h6"/>',
  tijeras: '<circle cx="6.5" cy="17.5" r="2.8"/><circle cx="17.5" cy="17.5" r="2.8"/><path d="M8.6 15.6L19 4M15.4 15.6L5 4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r=".6"/>',
};

// Ícono de cada botón: 1) el que se escribe en botonN_icono, 2) el de la red o el mapa según el enlace,
// 3) según el texto del botón ("Pedidos" → bolsa, "Sedes" → tienda), 4) según el servicio (Rappi, Doctoralia…), 5) globo.
const ICONOS_EXTRA = ['instagram', 'facebook', 'tiktok', 'youtube', 'x', 'telegram', 'maps', 'waze', 'menu', 'catalogo', 'domicilio', 'tienda', 'reservas', 'llamar', 'correo', 'horario', 'promos', 'pago', 'formulario', 'web', 'enlace', 'iglesia', 'personas', 'boda', 'salud', 'casa', 'documento', 'tijeras', 'info'];
const ALIAS_ICONO = {
  twitter: 'x', mapa: 'maps', ubicacion: 'maps', google_maps: 'maps', pagina: 'web', sitio: 'web', link: 'enlace',
  carta: 'menu', productos: 'catalogo', pedidos: 'domicilio', domicilios: 'domicilio', rappi: 'domicilio', sedes: 'tienda', local: 'tienda',
  citas: 'reservas', cita: 'reservas', agenda: 'reservas', reserva: 'reservas', telefono: 'llamar', email: 'correo', mail: 'correo', promociones: 'promos', pagos: 'pago', solicitud: 'formulario', pedido: 'formulario',
  // Palabras comunes en español (sin tildes; el plural se entiende solo)
  direccion: 'maps', localizacion: 'maps', llegar: 'maps', como_llegar: 'maps', mapas: 'maps',
  comida: 'menu', restaurante: 'menu', platos: 'menu', bebidas: 'menu',
  catalogo_de_productos: 'catalogo', servicio: 'catalogo', portafolio: 'catalogo', galeria: 'catalogo',
  delivery: 'domicilio', bolsa: 'domicilio', compras: 'domicilio', comprar: 'domicilio', carrito: 'domicilio',
  sede: 'tienda', sucursal: 'tienda', negocio: 'tienda', almacen: 'tienda',
  calendario: 'reservas', turno: 'reservas', agendar: 'reservas', consulta: 'reservas',
  llamada: 'llamar', celular: 'llamar', contacto: 'llamar', contactanos: 'llamar',
  correo_electronico: 'correo', mensaje: 'correo',
  hora: 'horario', reloj: 'horario', abierto: 'horario',
  promo: 'promos', oferta: 'promos', descuento: 'promos', etiqueta: 'promos',
  nequi: 'pago', daviplata: 'pago', tarjeta: 'pago', pagar: 'pago', dinero: 'pago',
  formulario_de_contacto: 'formulario', inscripcion: 'formulario', registro: 'formulario', encuesta: 'formulario',
  internet: 'web', sitio_web: 'web', globo: 'web', mundo: 'web',
  vinculo: 'enlace', mas: 'enlace',
  parroquia: 'iglesia', templo: 'iglesia', capilla: 'iglesia', misa: 'iglesia', eucaristia: 'iglesia', cruz: 'iglesia', religion: 'iglesia',
  persona: 'personas', gente: 'personas', grupo: 'personas', comunidad: 'personas', equipo: 'personas', nosotros: 'personas', usuarios: 'personas', pastoral: 'personas',
  matrimonio: 'boda', anillo: 'boda', anillos: 'boda', novios: 'boda', bautismo: 'boda',
  medico: 'salud', doctor: 'salud', consultorio: 'salud', clinica: 'salud', hospital: 'salud', odontologia: 'salud', especialidad: 'salud', cruz_medica: 'salud',
  hogar: 'casa', inicio: 'casa', conjunto: 'casa', apartamento: 'casa', edificio: 'casa', administracion: 'casa', residentes: 'casa', inmobiliaria: 'casa',
  requisito: 'documento', documentos: 'documento', tramite: 'documento', certificado: 'documento', archivo: 'documento', pdf: 'documento', papeles: 'documento', reglamento: 'documento',
  tijera: 'tijeras', barberia: 'tijeras', peluqueria: 'tijeras', corte: 'tijeras', salon: 'tijeras', belleza: 'tijeras',
  informacion: 'info', ayuda: 'info', preguntas: 'info', dudas: 'info', faq: 'info',
};
// Busca el ícono de una palabra de la hoja: exacta, por alias o sin plural ("Horarios" → horario)
function claveIcono(palabra) {
  const n = normalizar(palabra ?? '').replace(/^_+|_+$/g, '');
  if (!n) return '';
  for (const k of [n, n.replace(/es$/, ''), n.replace(/s$/, '')]) {
    const clave = ALIAS_ICONO[k] ?? k;
    if (ICONOS_EXTRA.includes(clave)) return clave;
  }
  return null;
}
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
  correo: 'Enviar correo',
  horario: 'Horario',
  promos: 'Promociones',
  pago: 'Medios de pago',
  formulario: 'Haz tu solicitud',
  web: 'Nuestra web',
  enlace: 'Más info',
  iglesia: 'Nuestra parroquia',
  personas: 'Nosotros',
  boda: 'Matrimonios',
  salud: 'Servicios',
  casa: 'Administración',
  documento: 'Requisitos',
  tijeras: 'Servicios',
  info: 'Más información',
};
// Palabras del texto del botón (ya normalizado: sin tildes y en minúsculas)
const ICONO_POR_TEXTO = [
  ['domicilio', /domicilio|pedido|pide|delivery|rappi|didi|ifood/],
  ['menu', /(^|_)(menu|carta)(_|$)/],
  ['tienda', /sede|tienda|local|sucursal|punto_de_venta/],
  ['reservas', /reserva|cita|agend|turno|consulta/],
  ['maps', /llegar|ubicacion|direccion|mapa/],
  ['llamar', /llama|telefono/],
  ['correo', /correo|e_?mail/],
  ['horario', /horario/],
  ['promos', /promo|oferta|descuento/],
  ['pago', /pago|paga|nequi|daviplata/],
  ['catalogo', /catalogo|producto|servicio/],
  ['iglesia', /misa|eucarist|parroquia|capilla|templo|iglesia/],
  ['boda', /boda|matrimonio|bautizo|bautismo/],
  ['personas', /grupo|comunidad|equipo|nosotros|pastoral/],
  ['documento', /requisito|documento|tramite|certificado|reglamento/],
  ['salud', /salud|medic|doctor|odontolog|especialidad/],
  ['tijeras', /corte|barber|peluquer/],
  ['casa', /conjunto|administracion|residente|apartamento/],
];
// Servicios conocidos por su dominio
const ICONO_POR_DOMINIO = [
  ['domicilio', /(^|\.)(rappi\.(com|co|com\.co)|didi-food\.(com|co|com\.co)|didifood\.(com|co|com\.co)|ifood\.(com|co|com\.co))$/],
  ['reservas', /(^|\.)(calendly\.com|doctoralia\.(co|com|com\.co)|booksy\.(com|co|com\.co)|agendapro\.(com|co|com\.co)|fresha\.(com|co|com\.co)|setmore\.com|simplybook\.me|cal\.com)$/],
];
const TEXTO_DOMINIO = { 'rappi.com.co': 'Pide en Rappi', 'rappi.com': 'Pide en Rappi', 'rappi.co': 'Pide en Rappi' };

function elegirIcono({ forzado, texto, url, defecto, etiqueta, columna }) {
  if (forzado) {
    const clave = claveIcono(forzado);
    if (clave) return clave;
    avisar(`${etiqueta}: el ícono "${forzado}" de ${columna} no existe. Elige uno de la lista de la hoja: ${ICONOS_EXTRA.join(', ')}. Se elige automático.`);
  }
  if (url.startsWith('tel:')) return 'llamar'; // aunque el texto diga otra cosa ("Consulta"): lo que hace es llamar
  if (url.startsWith('mailto:')) return 'correo';
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
const COLUMNAS_ENLACE = new Set(['google_resenas', 'catalogo', ...BOTONES_EXTRA.map((n) => `boton${n}_url`), ...REDES.map((r) => r.clave)]);

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
const ORDEN_DEFECTO = ['resenas', 'catalogo', 'whatsapp', ...BOTONES_EXTRA.map((n) => 'boton' + n)];
const NOMBRES_CLAVE = {
  resenas: 'resenas',
  resena: 'resenas',
  google: 'resenas',
  catalogo: 'catalogo',
  menu: 'catalogo',
  whatsapp: 'whatsapp',
  wa: 'whatsapp',
  extra: 'boton4',
  extra1: 'boton4',
  extra2: 'boton5',
  ...Object.fromEntries(BOTONES_EXTRA.map((n) => ['boton' + n, 'boton' + n])),
};

function ordenarBotones(texto, etiqueta) {
  const pedidos = [];
  for (const parte of (texto ?? '').split(/[,;\s]+/).filter(Boolean)) {
    const clave = NOMBRES_CLAVE[normalizar(parte)];
    if (!clave) {
      avisar(`${etiqueta}: "${parte}" no es un botón válido en orden_botones. Usa: catalogo, whatsapp o boton4 a boton${ULTIMO_BOTON_EXTRA}.`);
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
  if (['logos', 'fonts', 'ir', 'panel'].includes(id)) {
    avisar(`${etiqueta}: "${id}" es un nombre reservado. Se omite.`);
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

  // Una columna fuera del rango se ignoraría sin que nadie lo note
  for (const columna of Object.keys(fila)) {
    const m = columna.match(/^boton(\d+)_url$/);
    if (m && g(columna) && !BOTONES_EXTRA.includes(m[1])) avisar(`${etiqueta}: la columna ${columna} no se usa. Los botones adicionales van de boton4 a boton${ULTIMO_BOTON_EXTRA}. Se omite.`);
  }

  for (const n of BOTONES_EXTRA) {
    const opciones = opcionesFormulario(g(`boton${n}_url`));
    if (opciones) {
      if (!tel) {
        avisar(`${etiqueta}: boton${n}_url es un formulario, pero falta un número de WhatsApp válido en la columna whatsapp, que es a donde llegan las solicitudes. Se omite.`);
        continue;
      }
      const campos = g(`boton${n}_campos`)
        ? camposFormulario(g(`boton${n}_campos`), `${etiqueta}: boton${n}_campos`)
        : camposPorDefecto(opciones, `${etiqueta}: el formulario de boton${n}`);
      let icono = 'formulario';
      const forzado = normalizar(g(`boton${n}_icono`));
      const t = normalizar(g(`boton${n}_texto`));
      if (forzado) {
        const clave = claveIcono(forzado);
        if (clave) icono = clave;
        else avisar(`${etiqueta}: el ícono "${g(`boton${n}_icono`)}" de boton${n}_icono no existe. Se usa el de formulario.`);
      } else if (/reserva|cita|agend|turno|consulta/.test(t)) icono = 'reservas';
      else if (/domicilio|pedido|pide|encarg/.test(t)) icono = 'domicilio';
      disponibles['boton' + n] = {
        icono,
        texto: texto(`boton${n}_texto`, TEXTO_ICONO.formulario),
        url: `#solicitud-${n}`,
        formulario: { id: `solicitud-${n}`, campos, tel },
      };
      continue;
    }
    const url = enlaceBoton(g(`boton${n}_url`));
    if (url === null) avisar(`${etiqueta}: "${g(`boton${n}_url`).slice(0, 40)}" en boton${n}_url no sirve. Usa una página (https://…), un teléfono (3001234567 o tel:+573001234567) o un correo (hola@negocio.com). Se omite.`);
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

  // Subtítulo y etiqueta opcionales: botonN_detalle / botonN_etiqueta, detalle_catalogo / etiqueta_catalogo…
  for (const [clave, b] of Object.entries(disponibles)) {
    if (clave === 'resenas') continue;
    const [colDetalle, colEtiqueta] = clave.startsWith('boton') ? [`${clave}_detalle`, `${clave}_etiqueta`] : [`detalle_${clave}`, `etiqueta_${clave}`];
    b.detalle = g(colDetalle);
    b.etiqueta = g(colEtiqueta);
    if (b.detalle.length > MAX_DETALLE) avisar(`${etiqueta}: el subtítulo "${b.detalle.slice(0, 24)}…" de ${colDetalle} tiene ${b.detalle.length} letras; caben unas ${MAX_DETALLE}. Acórtalo.`);
    if (b.etiqueta.length > MAX_ETIQUETA) avisar(`${etiqueta}: la etiqueta "${b.etiqueta}" de ${colEtiqueta} tiene ${b.etiqueta.length} letras; caben unas ${MAX_ETIQUETA} (ej: Nuevo). Acórtala.`);
  }

  // Clave del panel de resultados: la inventa el operador y se la da al cliente. Nunca se escribe en la consola.
  let clavePanel = g('clave_panel');
  if (clavePanel && (clavePanel.length < 12 || /\s/.test(clavePanel))) {
    avisar(`${etiqueta}: la clave_panel debe tener al menos 12 letras o números, sin espacios. No se crea el panel.`);
    clavePanel = '';
  }

  let lienzo = normalizar(g('lienzo'));
  if (lienzo && !LIENZOS.includes(lienzo)) {
    avisar(`${etiqueta}: el lienzo "${g('lienzo')}" no existe. Escribe ${LIENZOS.join(', ')} o déjalo vacío. Se usa sin lienzo.`);
    lienzo = '';
  }

  const botones = ordenarBotones(g('orden_botones'), etiqueta)
    .map((clave) => disponibles[clave] && { ...disponibles[clave], clave })
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

  // Un color de marca casi blanco borra el toldo, la placa del logo y los círculos de redes.
  // Si el logo tiene un color con carácter, ese pasa a ser el principal.
  let marca = colorFinal;
  if (luminancia(colorFinal) > 0.7) {
    if (logo?.secundario && luminancia(logo.secundario) < 0.45) {
      marca = logo.secundario;
      avisar(`${etiqueta}: el color ${colorFinal} es casi blanco y la tarjeta se perdería. Se usa el color del logo (${marca}). Escribe ese color en la columna color para que quede fijo.`);
    } else {
      avisar(`${etiqueta}: el color ${colorFinal} es casi blanco y el toldo casi no se verá. Usa el color fuerte de la marca.`);
    }
  }

  // Color secundario automático: el color con carácter del logo, si se distingue del principal.
  // Si no hay, el mismo color principal. En los dos casos se oscurece solo si hace falta para leerse sobre el tiquete.
  const secundario = logo?.secundario && distanciaColor(logo.secundario, marca) > 60 ? logo.secundario : marca;
  const paleta = paletaMarca(marca, secundario);

  // Botones que se confunden entre sí: misma red dos veces, o textos que empiezan igual ("Pedir" y "Pedidos")
  const dominio = (u) => (u.startsWith('#') ? '' : new URL(u).hostname.replace(/^www\./, '')); // un formulario no tiene dominio
  const acciones = botones.filter((b) => b.icono !== 'resenas');
  for (const b of acciones) {
    const red = dominio(b.url) && redes.find((r) => dominio(r.url) === dominio(b.url));
    if (red) avisar(`${etiqueta}: el botón "${b.texto}" lleva a ${red.nombre}, que ya sale en los círculos de redes. Quita uno de los dos.`);
  }
  const inicios = acciones.map((b) => normalizar(b.texto).replace(/^_+/, '').replace(/^(ver|el|la|los|las|tu|su)_/, '').slice(0, 4));
  inicios.forEach((x, i) => {
    const j = inicios.indexOf(x);
    if (x.length === 4 && j < i) avisar(`${etiqueta}: los botones "${acciones[j].texto}" y "${acciones[i].texto}" se parecen y el cliente puede confundirlos. Cambia uno.`);
  });
  if (/[.,;:]\s*[!?¡¿]/.test(titular)) avisar(`${etiqueta}: el titular "${titular}" tiene un signo de más (por ejemplo ". !"). Revísalo.`);

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
    ...paleta,
    portada,
    wifi,
    nombre,
    slogan: g('slogan'),
    titular,
    notaResenas: g('nota_resenas') || NOTA_RESENAS_DEFECTO,
    color: marca,
    logo,
    fondoLogo,
    colorPlaca,
    resena: botones.find((b) => b.icono === 'resenas') ?? null,
    botones: botones.filter((b) => b.icono !== 'resenas'),
    redes,
    nombreEnLogo,
    lienzo,
    clavePanel,
    estilo: estilo || 'mostrador',
  };
}

const ESTRELLA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l3 6.9 7.4.7-5.6 4.9 1.7 7.3L12 17.6 5.5 21.6l1.7-7.3L1.6 9.4l7.4-.7z"/></svg>';
const FLECHA = '<svg class="fl" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';
// "G" de Google, sin modificar (Google permite usarla para pedir reseñas)
const G_GOOGLE =
  '<svg class="g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

// Con contador, los enlaces web pasan por /ir/ para sumar el toque. Teléfono, correo y formularios van directo.
const contadorListo = () => Boolean(CONTADOR_URL) && urlSegura(CONTADOR_URL + '/') === CONTADOR_URL + '/';
function enlace(id, clave, url) {
  return contadorListo() && /^https:\/\//.test(url) ? `${CONTADOR_URL}/ir/${id}/${clave}` : url;
}

function htmlBotones(botones, id) {
  return botones
    .map(
      // La primera acción va a todo el ancho, llena del color de la marca; las demás, en mosaico
      (b, i) =>
        `<a class="tl${i === 0 ? ' pri' : ''}" href="${esc(enlace(id, b.clave, b.url))}"${b.formulario ? ' aria-haspopup="dialog"' : ' rel="noopener"'}>` +
        `<span class="ic">${svgIcono(b.icono)}</span>` +
        (b.detalle
          ? `<span class="txs"><span class="tx">${esc(b.texto)}</span><span class="det">${esc(b.detalle)}</span></span>`
          : `<span class="tx">${esc(b.texto)}</span>`) +
        (b.etiqueta ? `<span class="eti">${esc(b.etiqueta)}</span>` : '') +
        `</a>`
    )
    .join('\n      ');
}

function htmlResena(n) {
  if (!n.resena) return '';
  return (
    // Sin "cinco estrellas": la calificación la elige el cliente en Google, aquí no se sugiere ninguna
    `<a class="res" href="${esc(enlace(n.id, 'resenas', n.resena.url))}" rel="noopener" aria-label="${esc(n.resena.texto)}. Abre Google para calificar">` +
    `<span class="arr">${G_GOOGLE}<span>${esc(n.resena.texto)}</span></span>` +
    `<span class="est" aria-hidden="true">${ESTRELLA.repeat(5)}</span>` +
    // Un botón claro: las estrellas son adorno, la calificación se elige en Google
    `<span class="cta">Calificar en Google${FLECHA}</span>` +
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

// ---------- Formulario a WhatsApp ----------
// Sin JavaScript: el botón abre la hoja con :target y el cliente llena una sola caja con la plantilla ya escrita,
// que se envía tal cual a WhatsApp (formulario GET a api.whatsapp.com/send, que lee "phone" y "text").
// Con JavaScript (casi siempre): la caja se cambia por botones de motivo, nombre y detalle, y el mensaje sale ordenado.
const X_CERRAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ENCABEZADO_SOLICITUD = '*NUEVA SOLICITUD WEB*';

function htmlCampo(c, i, id) {
  const cid = `${id}-c${i}`;
  const op = c.opcional ? ' <span class="fm-op">(opcional)</span>' : '';
  const datos = ` data-et="${esc(c.enMensaje)}" data-tipo="${c.tipo}" data-pos="${c.pos ?? i}"${c.opcional ? '' : ' data-req="1"'}`;
  const error = `<p class="fm-error" id="${cid}-e">${c.tipo === 'botones' || c.tipo === 'desplegable' ? 'Elige una opción.' : 'Completa este dato.'}</p>`;
  if (c.tipo === 'botones') {
    return (
      `<fieldset class="fm-campo"${datos}><legend class="fm-et">${esc(c.etiqueta)}${op}</legend><div class="fm-chips">` +
      c.opciones.map((o) => `<label><input type="radio" name="${cid}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('') +
      `</div>${error}</fieldset>`
    );
  }
  let control;
  const req = c.opcional ? '' : ' aria-required="true"';
  const desc = ` aria-describedby="${cid}-e"`;
  if (c.tipo === 'desplegable') {
    control = `<select id="${cid}"${req}${desc}><option value="">Elige una opción</option>${c.opciones.map((o) => `<option>${esc(o)}</option>`).join('')}</select>`;
  } else if (c.tipo === 'largo') {
    control = `<textarea id="${cid}" rows="2" maxlength="300"${req}${desc}></textarea>`;
  } else {
    const tipo = { numero: 'text', text: 'text' }[c.tipo] ?? c.tipo;
    const extra =
      c.tipo === 'numero' ? ' inputmode="numeric"'
      : c.tipo === 'tel' ? ' autocomplete="tel"'
      : c.tipo === 'email' ? ' autocomplete="email"'
      : c.tipo === 'text' && /quien|nombre/.test(normalizar(c.etiqueta)) ? ' autocomplete="name"' : '';
    control = `<input id="${cid}" type="${tipo}" maxlength="120"${extra}${req}${desc}>`;
  }
  return `<div class="fm-campo"${datos}><label class="fm-et" for="${cid}">${esc(c.etiqueta)}${op}</label>${control}${error}</div>`;
}

// "¿Por quién…?" no lleva dos puntos; "Intención" sí
const conDosPuntos = (e) => (/[?:]$/.test(e) ? e : e + ':');

function htmlFormulario(b) {
  const { id, campos, tel } = b.formulario;
  const plantilla =
    `${ENCABEZADO_SOLICITUD}\n*${b.texto}*\n\n` +
    campos.map((c) => conDosPuntos(c.etiqueta) + (c.opciones.length ? ` (${c.opciones.join(' / ')})` : '') + ' ').join('\n');
  return (
    `<div class="hoja" id="${id}" role="dialog" aria-modal="true" aria-labelledby="${id}-t">` +
    `<a class="hoja-velo" href="#" tabindex="-1" aria-hidden="true"></a>` +
    `<form class="hoja-caja" action="https://api.whatsapp.com/send" method="get" target="_blank" data-wa="${tel}" tabindex="-1" novalidate>` +
    `<input type="hidden" name="phone" value="${tel}">` +
    `<a class="hoja-x" href="#" aria-label="Cerrar">${X_CERRAR}</a>` +
    `<h2 class="hoja-tit" id="${id}-t">${esc(b.texto)}</h2>` +
    `<div class="fm-sin-js"><label class="fm-et" for="${id}-txt">Completa después de cada pregunta</label>` +
    `<textarea id="${id}-txt" name="text" rows="${Math.min(4 + campos.length, 11)}">${esc(plantilla)}</textarea></div>` +
    `<div class="fm-con-js" hidden>${campos.map((c, i) => htmlCampo(c, i, id)).join('')}</div>` +
    `<button class="fm-enviar" type="submit">${svgIcono('whatsapp')}Enviar por WhatsApp</button>` +
    `<p class="fm-priv">Se abre WhatsApp con tu mensaje. No guardamos tus datos.</p>` +
    `</form></div>`
  );
}

// Script mínimo (ES5, sin librerías), solo en las tarjetas que tienen formulario.
// Si no corre, la hoja sigue funcionando con la caja única.
const SCRIPT_FORMULARIO = `<script>
(function () {
  var d = document, raiz = d.documentElement, abierta = null, origen = null;
  if (!d.querySelector || !window.encodeURIComponent || !raiz.classList) return;
  raiz.classList.add('js');
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function hora12(t) {
    var p = t.split(':'), h = +p[0], m = p[1];
    if (isNaN(h) || !m) return t;
    return (h % 12 || 12) + ':' + m.slice(0, 2) + (h < 12 ? ' a. m.' : ' p. m.');
  }
  // "2026-11-15T07:00" → "domingo 15 de noviembre de 2026, 7:00 a. m." (los celulares viejos sin calendario dejan el texto tal cual)
  function legible(tipo, v) {
    if (tipo === 'time') return hora12(v);
    if (tipo !== 'date' && tipo !== 'datetime-local') return v;
    var p = v.split('T'), f = p[0].split('-');
    if (f.length !== 3) return v;
    var a = +f[0], me = +f[1], di = +f[2], fecha = new Date(a, me - 1, di);
    if (isNaN(fecha.getTime()) || !MESES[me - 1]) return v;
    return DIAS[fecha.getDay()] + ' ' + di + ' de ' + MESES[me - 1] + ' de ' + a + (p[1] ? ', ' + hora12(p[1]) : '');
  }
  function cerrar() {
    if (!abierta) return;
    abierta.classList.remove('abierta');
    raiz.classList.remove('con-hoja');
    if (location.hash === '#' + abierta.id && history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    abierta = null;
    if (origen) origen.focus();
  }
  function abrir(h, o) {
    cerrar();
    abierta = h; origen = o;
    // No se puede pedir una fecha que ya pasó
    var hoy = new Date(), dia = hoy.getFullYear() + '-' + dos(hoy.getMonth() + 1) + '-' + dos(hoy.getDate());
    var fechas = h.querySelectorAll('input[type=date], input[type=datetime-local]');
    for (var i = 0; i < fechas.length; i++) fechas[i].min = fechas[i].type === 'date' ? dia : dia + 'T00:00';
    h.classList.add('abierta');
    raiz.classList.add('con-hoja');
    h.querySelector('.hoja-caja').focus();
  }
  function valor(campo) {
    if (campo.getAttribute('data-tipo') === 'botones') {
      var r = campo.querySelector('input:checked');
      return r ? r.value : '';
    }
    return campo.querySelector('input, select, textarea').value.replace(/^\\s+|\\s+$/g, '');
  }
  function marcar(campo, mal) {
    campo.className = campo.className.replace(/ mal\\b/g, '') + (mal ? ' mal' : '');
    var c = campo.querySelector('input:not([type=radio]), select, textarea');
    if (c) c.setAttribute('aria-invalid', mal ? 'true' : 'false');
  }
  var hojas = d.querySelectorAll('.hoja');
  for (var i = 0; i < hojas.length; i++) (function (h) {
    var f = h.querySelector('form'), sin = f.querySelector('.fm-sin-js'), con = f.querySelector('.fm-con-js');
    sin.parentNode.removeChild(sin);
    con.hidden = false;
    var cierres = h.querySelectorAll('.hoja-velo, .hoja-x');
    for (var j = 0; j < cierres.length; j++) cierres[j].addEventListener('click', function (e) { e.preventDefault(); cerrar(); });
    var botones = d.querySelectorAll('a[href="#' + h.id + '"]');
    for (var k = 0; k < botones.length; k++) botones[k].addEventListener('click', function (e) { e.preventDefault(); abrir(h, this); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var campos = f.querySelectorAll('.fm-campo'), lineas = [], primero = null;
      for (var m = 0; m < campos.length; m++) {
        var c = campos[m], v = valor(c), mal = !v && c.getAttribute('data-req') === '1';
        marcar(c, mal);
        if (mal && !primero) primero = c.querySelector('input, select, textarea');
        if (v) {
          var et = c.getAttribute('data-et');
          lineas.push({ pos: +c.getAttribute('data-pos'), txt: '\\u2022 *' + (/[?:]$/.test(et) ? et : et + ':') + '* ' + legible(c.getAttribute('data-tipo'), v) });
        }
      }
      if (primero) { primero.focus(); return; }
      lineas.sort(function (a, b) { return a.pos - b.pos; });
      var msg = '${ENCABEZADO_SOLICITUD}\\n*' + h.querySelector('.hoja-tit').textContent + '*\\n';
      for (var n = 0; n < lineas.length; n++) msg += '\\n' + lineas[n].txt;
      var a = d.createElement('a');
      a.href = 'https://wa.me/' + f.getAttribute('data-wa') + '?text=' + encodeURIComponent(msg);
      a.target = '_blank'; a.rel = 'noopener';
      d.body.appendChild(a); a.click(); d.body.removeChild(a);
      f.reset();
      for (var q = 0; q < campos.length; q++) marcar(campos[q], false);
      cerrar();
    });
  })(hojas[i]);
  d.addEventListener('keydown', function (e) {
    if (!abierta) return;
    if (e.key === 'Escape' || e.keyCode === 27) return cerrar();
    if (e.key !== 'Tab') return;
    // El foco no se sale de la hoja mientras está abierta
    var foco = abierta.querySelectorAll('.hoja-x, input:not([type=hidden]), select, textarea, button');
    var ini = foco[0], fin = foco[foco.length - 1];
    if (e.shiftKey && (d.activeElement === ini || d.activeElement === abierta.querySelector('.hoja-caja'))) { e.preventDefault(); fin.focus(); }
    else if (!e.shiftKey && d.activeElement === fin) { e.preventDefault(); ini.focus(); }
  });
  // Si alguien llega con el enlace directo (#solicitud-5), se abre la versión completa
  var inicial = location.hash && d.getElementById(location.hash.slice(1));
  if (inicial && inicial.classList.contains('hoja')) abrir(inicial, null);
})();
</script>`;

function htmlFormularios(botones) {
  const con = botones.filter((b) => b.formulario);
  if (!con.length) return '';
  return con.map(htmlFormulario).join('\n') + '\n' + SCRIPT_FORMULARIO;
}

function htmlRedes(redes, id) {
  if (!redes.length) return '';
  const enlaces = redes
    .map((r) => `<a href="${esc(enlace(id, r.clave, r.url))}" rel="noopener" aria-label="${r.nombre}">${svgIcono(r.clave)}</a>`)
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

// Etiquetas de la vista previa que necesitan la dirección completa del sitio. Sin SITIO_URL se omiten (pruebas locales).
// Se prefiere la portada: tiene la proporción que usan WhatsApp y Facebook. Los SVG no sirven: esas apps no los muestran.
function metaEnlaces(n) {
  const base = urlSegura(SITIO_URL)?.replace(/\/+$/, '');
  if (!base) return '';
  const absoluta = (src) => (src.startsWith('../') ? `${base}/${src.slice(3)}` : src);
  const imagen = n.portada?.src ?? (n.logo && !/\.svg(\?|$)/i.test(n.logo.src) ? n.logo.src : '');
  const etiquetas = [`<meta property="og:url" content="${esc(`${base}/${n.id}/`)}">`];
  if (imagen) etiquetas.push(`<meta property="og:image" content="${esc(absoluta(imagen))}">`);
  if (n.portada) etiquetas.push('<meta property="og:image:width" content="900">', '<meta property="og:image:height" content="500">');
  etiquetas.push(`<meta name="twitter:card" content="${n.portada ? 'summary_large_image' : 'summary'}">`);
  return etiquetas.join('\n');
}

function htmlPagina(plantilla, n) {
  // El slogan va fuera del h1: así el encabezado se lee solo con el nombre del negocio
  const sloganHtml = n.slogan ? `<p class="slogan">${esc(n.slogan)}</p>` : '';
  const apilada = n.logo && n.logo.w && n.logo.w / n.logo.h > 2.2 ? ' apilada' : '';
  let pie = '';
  if (PIE_TEXTO) {
    const url = urlSegura(PIE_URL);
    pie = `<p class="pie">${url ? `<a href="${esc(url)}" rel="noopener">${esc(PIE_TEXTO)}</a>` : esc(PIE_TEXTO)}</p>`;
  }
  return plantilla
    .replaceAll('{{TITULO}}', esc(n.nombre))
    .replaceAll('{{DESCRIPCION}}', esc(n.slogan || `Contacto y enlaces de ${n.nombre}.`))
    .replaceAll('{{META_ENLACES}}', metaEnlaces(n))
    .replaceAll('{{COLOR}}', n.color)
    .replaceAll('{{COLOR_TEXTO}}', textoSobre(n.color))
    .replaceAll('{{COLOR_ICONO}}', colorIcono(n.color))
    .replaceAll('{{COLOR_ACENTO}}', n.acento)
    .replaceAll('{{COLOR_ACENTO_TEXTO}}', n.acentoTexto)
    .replaceAll('{{COLOR_TINTA}}', n.tinta)
    .replaceAll('{{COLOR_GRIS}}', n.gris)
    .replaceAll('{{COLOR_TINTE}}', n.tinte)
    .replaceAll('{{COLOR_ICONO_MOSAICO}}', n.iconoMosaico)
    .replaceAll('{{COLOR_SOMBRA}}', n.sombra)
    .replaceAll('{{COLOR_LIENZO}}', n.lienzoSuave)
    .replaceAll('{{COLOR_LIENZO_TRAZO}}', n.lienzoTrazo)
    .replaceAll('{{TOLDO_CLASE}}', (n.portada ? ' con-portada' : '') + (n.resena ? '' : ' sin-resena'))
    .replaceAll('{{PORTADA_HTML}}', n.portada ? `<img class="portada" src="${esc(n.portada.src)}" alt="" width="900" height="500" decoding="async">` : '')
    .replaceAll('{{WIFI_HTML}}', htmlWifi(n.wifi))
    .replaceAll('{{CAB_CLASE}}', apilada + (n.nombreEnLogo ? ' nombre-en-logo' : ''))
    .replaceAll('{{NOMBRE}}', `<span class="nom-txt">${esc(n.nombre)}</span>`)
    .replaceAll('{{LOGO_HTML}}', htmlLogo(n))
    .replaceAll('{{SLOGAN_HTML}}', sloganHtml)
    .replaceAll('{{TITULAR}}', esc(n.titular))
    .replaceAll('{{RESENA_HTML}}', htmlResena(n))
    .replaceAll('{{N_BOTONES}}', String(n.botones.length))
    .replaceAll('{{BOTONES}}', htmlBotones(n.botones, n.id))
    .replaceAll('{{REDES_HTML}}', htmlRedes(n.redes, n.id))
    .replaceAll('{{PIE_HTML}}', pie)
    .replaceAll('{{LIENZO_CLASE}}', n.lienzo ? `lz lz-${n.lienzo}` : '')
    .replaceAll('{{FORMULARIOS_HTML}}', htmlFormularios(n.botones));
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
if (!SITIO_URL) console.log('  · Sin SITIO_URL: la vista previa al compartir no lleva imagen en esta construcción (en GitHub se deduce sola).');
else if (!urlSegura(SITIO_URL)) avisar(`La variable SITIO_URL ("${SITIO_URL}") no es una dirección válida. La vista previa al compartir no llevará imagen.`);
await rm(SALIDA, { recursive: true, force: true });
await mkdir(SALIDA, { recursive: true });

// Tipografías: se publican junto al sitio (sin pedirlas a Google en cada visita)
const FUENTES = {
  'unbounded-800.woff2': '@fontsource/unbounded/files/unbounded-latin-800-normal.woff2',
  'inter-400.woff2': '@fontsource/inter/files/inter-latin-400-normal.woff2',
  'figtree-500.woff2': '@fontsource/figtree/files/figtree-latin-500-normal.woff2',
  'figtree-700.woff2': '@fontsource/figtree/files/figtree-latin-700-normal.woff2',
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

const ITERACIONES_PANEL = 10000; // pocas, porque Cloudflare gratis da 10 ms por visita al panel
let paneles = 0;
for (const n of negocios) {
  const html = htmlPagina(plantillas[n.estilo], n);
  for (const carpeta of [n.id, n.alias].filter(Boolean)) {
    await mkdir(`${SALIDA}/${carpeta}`, { recursive: true });
    await writeFile(`${SALIDA}/${carpeta}/index.html`, html);
  }
  // Mapa de enlaces que usa el contador (/ir/<id>/<botón>): solo los https que el robot ya validó
  if (contadorListo()) {
    const mapa = {};
    for (const b of [n.resena, ...n.botones].filter(Boolean)) if (/^https:\/\//.test(b.url)) mapa[b.clave] = b.url;
    for (const r of n.redes) mapa[r.clave] = r.url;
    await writeFile(`${SALIDA}/${n.id}/enlaces.json`, JSON.stringify(mapa));
  }
  // Panel de resultados (/panel/<id>?k=<clave>): solo se guarda la huella de la clave, nunca la clave
  if (n.clavePanel) {
    const nombres = { resenas: 'Calificar en Google' };
    for (const b of n.botones) nombres[b.clave] = b.clave === 'whatsapp' && !/whatsapp/i.test(b.texto) ? `${b.texto} (WhatsApp)` : b.texto;
    for (const r of n.redes) nombres[r.clave] = r.nombre;
    const sal = `fides-panel:${n.id}`;
    const huellaClave = pbkdf2Sync(n.clavePanel, sal, ITERACIONES_PANEL, 32, 'sha256').toString('hex');
    await writeFile(
      `${SALIDA}/${n.id}/panel.json`,
      JSON.stringify({ nombre: n.nombre, alias: n.alias, marca: n.color, tinta: n.tinta, gris: n.gris, tinte: n.tinte, sal, iteraciones: ITERACIONES_PANEL, huella: huellaClave, botones: nombres })
    );
    paneles++;
  }
  console.log(`  ✔ ${n.id}${n.alias ? ' / ' + n.alias : ''} — ${n.nombre} (${n.botones.length + (n.resena ? 1 : 0)} botones${n.estilo === 'premium' ? ', premium' : ''})`);
}

await writeFile(`${SALIDA}/index.html`, paginaSimple('Tarjeta digital', 'Escanea la tarjeta de un negocio para ver su página.'));
await writeFile(`${SALIDA}/404.html`, paginaSimple('Esta tarjeta no está disponible', 'Pídele al negocio que la revise o intenta de nuevo más tarde.'));
await writeFile(`${SALIDA}/robots.txt`, 'User-agent: *\nDisallow: /\n');
if (CONTADOR_URL && !contadorListo()) console.log(`⚠ CONTADOR_URL "${CONTADOR_URL}" no es una dirección https válida. Los botones van directo y no se cuentan.`);
// En Cloudflare, el contador solo corre en las páginas: fuentes, logos y mapas de enlaces se sirven sin gastar cupo.
// Va siempre, porque las visitas se cuentan aunque no haya CONTADOR_URL.
await writeFile(`${SALIDA}/_routes.json`, JSON.stringify({ version: 1, include: ['/*'], exclude: ['/fonts/*', '/logos/*', '/*/enlaces.json', '/robots.txt', '/404.html'] }));
if (contadorListo()) console.log(`  · Contador activo: los botones pasan por ${CONTADOR_URL}/ir/…`);
if (paneles) console.log(`  · Panel de resultados para ${paneles} negocio(s): /panel/<id>?k=<clave_panel>`);

console.log(`\nListo: ${negocios.length} páginas creadas, ${pausados} pausadas, ${advertencias.length} advertencias.`);

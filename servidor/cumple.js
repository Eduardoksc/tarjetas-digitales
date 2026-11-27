// Cumpleaños (B31): el cliente se inscribe desde la tarjeta con nombre, celular y mes (nunca la fecha completa),
// marcando la casilla de autorización. Se guarda en la base CONTADOR con la fecha y el texto que aceptó.
// La lista solo la ve el dueño en su panel (/panel/<id>?k=…&ver=cumple), donde saluda por WhatsApp, marca el regalo
// como canjeado y borra a pedido. El celular no se usa para nada más.
import { ahoraColombia, celularValido, quien } from './caja.js';

const MAX_ENVIOS = 10; // inscripciones por hora desde una misma conexión y para un mismo negocio
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const TABLAS = [
  // "canjeado" es el año en que se entregó el regalo ("2026"): cada año vuelve a quedar pendiente
  'CREATE TABLE IF NOT EXISTS cumple (id TEXT NOT NULL, telefono TEXT NOT NULL, nombre TEXT NOT NULL, mes INTEGER NOT NULL, autorizado TEXT NOT NULL, texto TEXT NOT NULL, canjeado TEXT NOT NULL DEFAULT \'\', PRIMARY KEY (id, telefono))',
  'CREATE TABLE IF NOT EXISTS cumple_envios (hora TEXT NOT NULL, id TEXT NOT NULL, quien TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (hora, id, quien))',
];
let listas = false;
async function prepararTablas(db) {
  if (listas) return;
  for (const sql of TABLAS) await db.exec(sql);
  listas = true;
}

// Igual que textoAutorizacion() de generar.mjs: es lo que el cliente leyó junto a la casilla
export const textoAutorizacion = (nombre) =>
  `Autorizo a ${nombre} a guardar mi nombre, celular y mes de cumpleaños para darme este beneficio y saludarme en mi mes, según la política de privacidad.`;

// Datos del negocio (panel.json, escrito por el robot). null si no tiene el cumpleaños activo.
export async function datosCumple(env, request, id) {
  try {
    const r = await env.ASSETS.fetch(new URL(`/${id}/panel.json`, request.url));
    if (!r.ok) return null;
    const datos = await r.json();
    return datos?.cumple?.premio ? datos : null;
  } catch {
    return null;
  }
}

// Nombre: sin caracteres de control ni espacios repetidos, de 2 a 40 letras
export function nombreValido(valor) {
  const limpio = String(valor ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
  return limpio.length >= 2 && limpio.length <= 40 ? limpio : null;
}

export function mesValido(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
}

// Devuelve { ok: true, nombre, mes } o { error: 'texto para el cliente', estado }
export async function inscribir(db, request, id, datos, form) {
  const nombre = nombreValido(form.get('nombre'));
  const telefono = celularValido(form.get('celular'));
  const mes = mesValido(form.get('mes'));
  if (!nombre) return { error: 'Escribe tu nombre.', estado: 400 };
  if (!telefono) return { error: 'Revisa tu celular: escríbelo con sus 10 dígitos (ej: 300 123 4567).', estado: 400 };
  if (!mes) return { error: 'Elige el mes de tu cumpleaños.', estado: 400 };
  if (form.get('autorizo') !== 'si') return { error: 'Para inscribirte hay que marcar la casilla de autorización.', estado: 400 };

  await prepararTablas(db);
  const { dia, hora } = ahoraColombia();
  const yo = await quien(request, 'cumple:' + id, hora);
  const fila = await db.prepare('SELECT n FROM cumple_envios WHERE hora = ?1 AND id = ?2 AND quien = ?3').bind(hora, id, yo).first();
  if ((fila?.n ?? 0) >= MAX_ENVIOS) return { error: 'Hubo demasiadas inscripciones desde esta conexión. Intenta en una hora.', estado: 429 };

  const momento = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
  await db.batch([
    // Un celular ya inscrito no se cambia desde la tarjeta: cualquiera podría escribir el número de otra persona
    // y cambiarle el nombre o el mes. Para corregir, el negocio lo borra en el panel y la persona se inscribe otra vez.
    db
      .prepare('INSERT INTO cumple (id, telefono, nombre, mes, autorizado, texto) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT (id, telefono) DO NOTHING')
      .bind(id, telefono, nombre, mes, momento, textoAutorizacion(datos.nombre || id)),
    db.prepare('INSERT INTO cumple_envios (hora, id, quien, n) VALUES (?1, ?2, ?3, 1) ON CONFLICT (hora, id, quien) DO UPDATE SET n = n + 1').bind(hora, id, yo),
    db.prepare('DELETE FROM cumple_envios WHERE hora < ?1').bind(dia), // se borran los de días anteriores
  ]);
  // La respuesta es la misma si el celular ya estaba: así nadie puede averiguar quién está inscrito
  return { ok: true, nombre, mes };
}

// ---------- Panel ----------
const vacio = (e) => /no such table/i.test(e?.message ?? '');

export async function resumenCumple(db, id, mes, anio) {
  const r = { inscritos: 0, delMes: 0, canjeados: 0 };
  if (!db) return r;
  try {
    const fila = await db
      .prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN mes = ?2 THEN 1 ELSE 0 END) AS mes, SUM(CASE WHEN mes = ?2 AND canjeado = ?3 THEN 1 ELSE 0 END) AS canjeados FROM cumple WHERE id = ?1')
      .bind(id, mes, String(anio))
      .first();
    r.inscritos = Number(fila?.total) || 0;
    r.delMes = Number(fila?.mes) || 0;
    r.canjeados = Number(fila?.canjeados) || 0;
  } catch (e) {
    if (!vacio(e)) console.log('cumple: ' + e.message);
  }
  return r;
}

export async function listaCumple(db, id, mes) {
  if (!db) return [];
  try {
    const { results } = await db.prepare('SELECT telefono, nombre, canjeado, autorizado FROM cumple WHERE id = ?1 AND mes = ?2 ORDER BY nombre COLLATE NOCASE').bind(id, mes).all();
    return results ?? [];
  } catch (e) {
    if (!vacio(e)) console.log('cumple: ' + e.message);
    return [];
  }
}

// Acciones del dueño desde el panel. Devuelven { tipo: 'ok' | 'aviso', texto }
export async function accionCumple(db, id, accion, valorTelefono, anio) {
  const telefono = celularValido(valorTelefono);
  if (!telefono) return { tipo: 'aviso', texto: 'No encontramos a esa persona. Recarga la lista.' };
  await prepararTablas(db);
  if (accion === 'borrar') {
    const r = await db.prepare('DELETE FROM cumple WHERE id = ?1 AND telefono = ?2').bind(id, telefono).run();
    return r.meta?.changes ? { tipo: 'ok', texto: 'Datos borrados. Esa persona ya no está en la lista.' } : { tipo: 'aviso', texto: 'Esa persona ya no estaba en la lista.' };
  }
  const valor = accion === 'canjear' ? String(anio) : '';
  const r = await db.prepare('UPDATE cumple SET canjeado = ?3 WHERE id = ?1 AND telefono = ?2').bind(id, telefono, valor).run();
  if (!r.meta?.changes) return { tipo: 'aviso', texto: 'Esa persona ya no está en la lista.' };
  return { tipo: 'ok', texto: accion === 'canjear' ? 'Regalo marcado como entregado.' : 'Listo, el regalo vuelve a estar pendiente.' };
}

// ---------- Páginas para el cliente (claras, con el color del negocio) ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const hex = (c) => (/^#[0-9a-f]{6}$/i.test(String(c)) ? c : '#1f6f5c');
// Blanco o negro sobre el color de la marca, con la misma regla que textoSobre() de generar.mjs
function sobre(c) {
  const v = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] > 0.179 ? '#000000' : '#ffffff';
}

export const cabecerasCumple = () => ({
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'",
});

export function paginaCliente({ id, datos, titulo, texto, extra = '', estado = 200 }) {
  const marca = hex(datos?.marca);
  const volver = id ? `/${encodeURIComponent(id)}/${estado === 200 ? '' : '#cumple'}` : '/';
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer"><meta name="color-scheme" content="light only">
<title>${esc(titulo)} · ${esc(datos?.nombre ?? '')}</title>
<style>
@font-face{font-family:Figtree;font-weight:500;font-display:swap;src:url(/fonts/figtree-500.woff2) format("woff2")}
@font-face{font-family:Figtree;font-weight:700;font-display:swap;src:url(/fonts/figtree-700.woff2) format("woff2")}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px max(18px,env(safe-area-inset-left));background:#f5f5f4;color:#17201c;font:500 16px/1.5 Figtree,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{width:100%;max-width:400px;padding:28px 22px;border-radius:24px;background:#fff;text-align:center;box-shadow:0 18px 40px -24px rgba(0,0,0,.35)}
.neg{margin:0 0 14px;font-size:.9rem;font-weight:700;color:#57534e}
h1{margin:0 0 8px;font-size:1.5rem;line-height:1.2}
p{margin:0}
.txt{color:#3f3b37}
.regalo{margin:18px 0 0;padding:14px;border-radius:16px;background:${marca};color:${sobre(marca)};font-weight:700;font-size:1.1rem;line-height:1.3}
.fino{margin-top:12px;font-size:.85rem;color:#57534e}
a.b{display:flex;align-items:center;justify-content:center;min-height:52px;margin-top:20px;border-radius:99px;background:#17201c;color:#fff;font-weight:700;text-decoration:none}
a.b:focus-visible{outline:2px solid ${marca};outline-offset:3px}
</style></head>
<body><main><p class="neg">${esc(datos?.nombre ?? '')}</p><h1>${esc(titulo)}</h1><p class="txt">${esc(texto)}</p>${extra}
<a class="b" href="${volver}">${estado === 200 ? 'Volver a la tarjeta' : 'Volver y corregir'}</a></main></body></html>`;
  return new Response(html, { status: estado, headers: cabecerasCumple() });
}

export function paginaListo({ id, datos, nombre, mes }) {
  const c = datos.cumple;
  const extra =
    `<p class="regalo">${esc(c.premio)}</p>` +
    (c.condiciones ? `<p class="fino">${esc(c.condiciones)}</p>` : '') +
    `<p class="fino">Toma una captura de esta pantalla o di tu nombre en caja. Si ya estabas inscrito, tus datos siguen como estaban: para cambiarlos o borrarlos, pídelo en el negocio.</p>`;
  return paginaCliente({ id, datos, titulo: `¡Listo, ${nombre}!`, texto: `Ya estás en la lista. En ${MESES[mes - 1]} muestra esto en caja y recibe tu regalo.`, extra });
}

export const anioColombia = () => Number(ahoraColombia().dia.slice(0, 4));
export const mesColombia = () => Number(ahoraColombia().dia.slice(5, 7));

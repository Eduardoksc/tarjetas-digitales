// Panel de resultados del cliente (diseño "Resumen"): visitas del mes, lo que más tocaron,
// cómo llegaron (QR o NFC) y su mejor momento. Se arma en el servidor: la página no lleva JavaScript.
// Entrada: /panel/<id>?k=<clave_panel>. La clave solo se compara con su huella (panel.json, escrito por el robot).

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_PLURAL = ['Domingos', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábados'];
const HEX = /^#[0-9a-f]{6}$/i;
const MIN_VISITAS_MOMENTO = 20; // con menos, el "mejor momento" sería casualidad

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const miles = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const mayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const color = (c, defecto) => (HEX.test(c ?? '') ? c : defecto);
// Mezcla con blanco: t = 0 deja el color, t = 1 da blanco
const aclarar = (hex, t) =>
  '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) + (255 - parseInt(hex.slice(i, i + 2), 16)) * t).toString(16).padStart(2, '0')).join('');

// Hora de Colombia (UTC-5, sin horario de verano)
export function hoyColombia() {
  const d = new Date(Date.now() - 5 * 3600 * 1000);
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate(), hora: d.getUTCHours(), min: d.getUTCMinutes() };
}

const diasDelMes = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();
const fecha = (anio, mes, dia) => `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
const mesAnterior = ({ anio, mes }) => (mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 });
const mesSiguiente = ({ anio, mes }) => (mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 });
const claveMes = ({ anio, mes }) => `${anio}-${String(mes).padStart(2, '0')}`;

// "10 a. m.", "12 m.", "3 p. m."
function hora12(h) {
  h = ((h % 24) + 24) % 24;
  if (h === 0) return '12 a. m.';
  if (h === 12) return '12 m.';
  return h < 12 ? `${h} a. m.` : `${h - 12} p. m.`;
}

async function huella(clave, sal, iteraciones) {
  const enc = new TextEncoder();
  const llave = await crypto.subtle.importKey('raw', enc.encode(clave), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(sal), iterations: iteraciones }, llave, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Compara sin cortar en la primera diferencia
function iguales(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function claveValida(datos, clave) {
  if (!datos?.huella || !datos?.sal || !clave || clave.length > 200) return false;
  const it = Number(datos.iteraciones);
  if (!Number.isInteger(it) || it < 1000 || it > 100000) return false;
  return iguales(await huella(clave, datos.sal, it), String(datos.huella));
}

// Lee la base y arma las cifras del mes elegido y del anterior
export async function cifras(db, ids, elegido, hoy) {
  const ant = mesAnterior(elegido);
  const esActual = elegido.anio === hoy.anio && elegido.mes === hoy.mes;
  const finMes = esActual ? hoy.dia : diasDelMes(elegido.anio, elegido.mes);
  // Mes en curso: se compara con los mismos días del mes anterior, para que sea justo
  const finAnt = esActual ? Math.min(hoy.dia, diasDelMes(ant.anio, ant.mes)) : diasDelMes(ant.anio, ant.mes);
  const marcas = ids.map((_, i) => `?${i + 3}`).join(', ');
  const { results } = await db
    .prepare(`SELECT dia, hora, tipo, boton, origen, SUM(n) AS n FROM eventos WHERE dia >= ?1 AND dia <= ?2 AND id IN (${marcas}) GROUP BY dia, hora, tipo, boton, origen`)
    .bind(fecha(ant.anio, ant.mes, 1), fecha(elegido.anio, elegido.mes, finMes), ...ids)
    .all();

  const prefijo = claveMes(elegido) + '-';
  const limiteAnt = fecha(ant.anio, ant.mes, finAnt);
  const c = { visitas: 0, visitasAnt: 0, toques: 0, porBoton: {}, porOrigen: { qr: 0, nfc: 0, '': 0 }, porMomento: {}, esActual, finAnt, ant };
  for (const r of results ?? []) {
    const n = Number(r.n) || 0;
    if (!r.dia.startsWith(prefijo)) {
      if (r.tipo === 'visita' && r.dia <= limiteAnt) c.visitasAnt += n;
      continue;
    }
    if (r.tipo === 'visita') {
      c.visitas += n;
      c.porOrigen[r.origen in c.porOrigen ? r.origen : ''] += n;
      const dSem = new Date(r.dia + 'T12:00:00Z').getUTCDay();
      const franja = Math.floor(r.hora / 2) * 2;
      const k = dSem * 100 + franja;
      c.porMomento[k] = (c.porMomento[k] ?? 0) + n;
    } else if (r.tipo === 'toque') {
      c.toques += n;
      c.porBoton[r.boton] = (c.porBoton[r.boton] ?? 0) + n;
    }
  }
  return c;
}

function bloqueComparacion(c, elegido) {
  const nomAnt = MESES[c.ant.mes - 1];
  const cuando = c.esActual ? `los primeros ${c.finAnt} días de ${nomAnt}` : nomAnt;
  if (!c.visitasAnt) return c.visitas ? `<p class="delta muted">Es el primer mes con datos.</p>` : '';
  const cambio = Math.round(((c.visitas - c.visitasAnt) / c.visitasAnt) * 100);
  const flecha = cambio > 0 ? `↑ ${cambio} %` : cambio < 0 ? `↓ ${Math.abs(cambio)} %` : 'Igual';
  return `<p class="delta"><b>${flecha}</b> <span class="muted">frente a ${esc(cuando)} (${miles(c.visitasAnt)})</span></p>`;
}

function bloqueToques(c, nombres) {
  const lista = Object.entries(c.porBoton).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!lista.length) return `<div class="bloque"><h2>Lo que más tocaron</h2><p class="muted">Todavía nadie ha tocado un botón este mes.</p></div>`;
  const max = lista[0][1];
  const barras = lista
    .map(([clave, n]) => {
      const nombre = nombres?.[clave] ?? clave;
      const ancho = Math.max(2, Math.round((n / max) * 100));
      return `<div class="barra"><span>${esc(nombre)}</span><b class="num">${miles(n)}</b><div class="pista" aria-hidden="true"><i style="width:${ancho}%"></i></div></div>`;
    })
    .join('');
  return `<div class="bloque"><h2>Lo que más tocaron</h2>${barras}</div>`;
}

function bloqueOrigen(c) {
  const { qr, nfc } = c.porOrigen;
  const otro = c.porOrigen[''];
  if (!qr && !nfc) return ''; // sin QR ni NFC marcados no hay nada útil que mostrar
  const total = qr + nfc + otro;
  const pct = (n) => Math.round((n / total) * 100);
  const partes = [
    ['qr', 'Código QR', qr],
    ['nfc', 'NFC', nfc],
    ['otro', 'Enlace u otro', otro],
  ].filter((p) => p[2] > 0);
  const tira = partes.map(([k, , n]) => `<i class="o-${k}" style="flex:${n}"></i>`).join('');
  const ley = partes.map(([k, nombre, n]) => `<span class="o-${k}">${nombre} <b class="num">${pct(n)} %</b></span>`).join('');
  return `<div class="bloque"><h2>Cómo llegaron</h2><div class="split" aria-hidden="true">${tira}</div><div class="ley">${ley}</div></div>`;
}

function bloqueMomento(c) {
  let texto;
  if (c.visitas < MIN_VISITAS_MOMENTO) {
    texto = `<p class="muted">Aún hay pocas visitas para saberlo. Aparece cuando lleguen ${MIN_VISITAS_MOMENTO}.</p>`;
  } else {
    const [k] = Object.entries(c.porMomento).sort((a, b) => b[1] - a[1])[0];
    const dSem = Math.floor(k / 100);
    const franja = k % 100;
    texto = `<p class="momento">${DIAS_PLURAL[dSem]}, de ${hora12(franja)} a ${hora12(franja + 2)}</p><p class="muted consejo">Es cuando más gente abre tu página. Ten a alguien pendiente a esa hora.</p>`;
  }
  return `<div class="bloque"><h2>Tu mejor momento</h2>${texto}</div>`;
}

function navegacion(id, clave, elegido, hoy) {
  const ant = mesAnterior(elegido);
  const sig = mesSiguiente(elegido);
  const url = (m) => `/panel/${esc(id)}?k=${esc(encodeURIComponent(clave))}&amp;mes=${claveMes(m)}`;
  const hayAnt = ant.anio * 12 + ant.mes >= hoy.anio * 12 + hoy.mes - 24;
  const haySig = sig.anio * 12 + sig.mes <= hoy.anio * 12 + hoy.mes;
  return `<nav class="nav" aria-label="Otros meses">${hayAnt ? `<a href="${url(ant)}">‹ ${mayuscula(MESES[ant.mes - 1])}</a>` : '<span></span>'}${
    haySig ? `<a href="${url(sig)}">${mayuscula(MESES[sig.mes - 1])} ›</a>` : '<span></span>'
  }</nav>`;
}

export function paginaPanel({ id, clave, datos, c, elegido, hoy }) {
  const marca = color(datos.marca, '#1f6f5c');
  const nombre = datos.nombre || id;
  const titulo = `${mayuscula(MESES[elegido.mes - 1])} de ${elegido.anio}`;
  const subHero = c.visitas
    ? `<p class="sub muted">${c.visitas === 1 ? 'persona abrió' : 'personas abrieron'} tu página${c.toques ? ` y tocaron ${miles(c.toques)} ${c.toques === 1 ? 'vez' : 'veces'} tus botones` : ''}.</p>`
    : `<p class="sub muted">Todavía no hay visitas ${c.esActual ? 'este mes' : 'en ese mes'}.</p>`;
  const cuerpo = c.visitas || c.toques ? bloqueToques(c, datos.botones) + bloqueOrigen(c) + bloqueMomento(c) : '';
  const actualizado = c.esActual ? `Datos hasta hoy, ${hora12(hoy.hora).replace(/^(\d+)/, `$1:${String(hoy.min).padStart(2, '0')}`)} (hora de Colombia).` : '';

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="light only">
<title>Tus resultados · ${esc(nombre)}</title>
<style>
@font-face{font-family:Figtree;font-weight:500;font-display:swap;src:url(/fonts/figtree-500.woff2) format("woff2")}
@font-face{font-family:Figtree;font-weight:700;font-display:swap;src:url(/fonts/figtree-700.woff2) format("woff2")}
@font-face{font-family:Unbounded;font-weight:800;font-display:swap;src:url(/fonts/unbounded-800.woff2) format("woff2")}
:root{--marca:${marca};--tinta:${color(datos.tinta, '#17201c')};--gris:${color(datos.gris, '#5d6964')};--tinte:${color(datos.tinte, '#e9f1ee')};--linea:#e6e8e6;--fondo:#f5f5f4;color-scheme:light only}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--fondo);color:var(--tinta);font:500 15px/1.45 Figtree,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:440px;margin:0 auto;padding:max(28px,env(safe-area-inset-top)) max(22px,env(safe-area-inset-right)) max(32px,env(safe-area-inset-bottom)) max(22px,env(safe-area-inset-left))}
h1,h2,p{margin:0}
.num{font-variant-numeric:tabular-nums}
.muted{color:var(--gris)}
.neg{display:flex;align-items:center;gap:12px}
.neg i{flex:none;width:40px;height:40px;border-radius:50%;background:var(--marca);color:#fff;display:grid;place-items:center;font-style:normal;font-weight:700;font-size:17px}
.neg h1{font-size:17px;font-weight:700;line-height:1.25}
.neg p{font-size:13px}
.nav{display:flex;justify-content:space-between;margin:22px -12px 0}
.nav a{display:inline-flex;align-items:center;min-height:48px;padding:0 12px;border-radius:12px;color:var(--gris);font-size:14px;font-weight:700;text-decoration:none}
.nav a:active{background:var(--linea)}
@media (hover:hover) and (pointer:fine){.nav a:hover{color:var(--tinta);background:var(--linea)}}
.nav a:focus-visible{outline:2px solid var(--marca);outline-offset:2px}
.mes{margin-top:6px;font-size:13px;color:var(--gris)}
.hero{margin-top:6px;font:800 clamp(44px,14vw,56px)/1 Unbounded,system-ui,sans-serif;letter-spacing:-.02em}
.hero small{font:700 16px Figtree,system-ui,sans-serif;letter-spacing:0;color:var(--gris);margin-left:8px}
.sub{margin-top:8px;font-size:14px}
.delta{margin-top:10px;font-size:14px}
.delta b{color:var(--tinta)}
.bloque{margin-top:26px;padding-top:18px;border-top:1px solid var(--linea)}
.bloque h2{font-size:13px;font-weight:700;color:var(--gris);margin-bottom:12px}
.barra{display:grid;grid-template-columns:1fr auto;align-items:center;gap:4px 12px;margin-bottom:12px;font-size:14px}
.barra span{overflow-wrap:anywhere}
.pista{grid-column:1/-1;height:8px;border-radius:4px;background:var(--tinte);overflow:hidden}
.pista i{display:block;height:100%;border-radius:4px;background:var(--marca)}
.split{display:flex;gap:2px;height:12px;margin-bottom:10px}
.split i{border-radius:4px}
.o-qr{--c:var(--marca)}.o-nfc{--c:${aclarar(marca, 0.45)}}.o-otro{--c:#cfd4d2}
.split i{background:var(--c)}
.ley{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 14px;font-size:14px}
.ley span::before{content:"";display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px;background:var(--c)}
.momento{font-size:20px;font-weight:700;letter-spacing:-.01em}
.consejo{margin-top:4px;font-size:14px}
.pie{margin-top:32px;font-size:12.5px;color:var(--gris)}
.pie p+p{margin-top:4px}
</style>
</head>
<body>
<main>
<header class="neg"><i aria-hidden="true">${esc(nombre.trim().charAt(0).toUpperCase())}</i><div><h1>${esc(nombre)}</h1><p class="muted">Tus resultados</p></div></header>
${navegacion(id, clave, elegido, hoy)}
<p class="mes">${titulo}</p>
<p class="hero num">${miles(c.visitas)}<small>${c.visitas === 1 ? 'visita' : 'visitas'}</small></p>
${subHero}
${bloqueComparacion(c, elegido)}
${cuerpo}
<footer class="pie"><p>Contamos cuántas veces abrieron tu página y tocaron cada botón con enlace. Las llamadas, los correos, los formularios y el Wi-Fi no se cuentan. No guardamos datos de quienes la visitan.</p>${actualizado ? `<p>${actualizado}</p>` : ''}</footer>
</main>
</body>
</html>`;
}

export function paginaAviso(titulo, texto, estado) {
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer"><title>${esc(titulo)}</title>
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;text-align:center;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f5f5f4;color:#17201c}h1{font-size:1.3rem;margin:0 0 8px}p{margin:0;color:#5d6964;line-height:1.5;max-width:32ch}</style></head>
<body><main><h1>${esc(titulo)}</h1><p>${esc(texto)}</p></main></body></html>`,
    { status: estado, headers: cabeceras() }
  );
}

export const cabeceras = () => ({
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
});

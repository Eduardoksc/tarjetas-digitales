// Panel de resultados del cliente (diseño "Resumen"): visitas del mes, lo que más tocaron,
// cómo llegaron (QR o NFC) y su mejor momento. Se arma en el servidor: la página no lleva JavaScript.
// Entrada: /panel/<id>?k=<clave_panel>. La clave solo se compara con su huella (panel.json, escrito por el robot).

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_PLURAL = ['Domingos', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábados'];
const MIN_VISITAS_MOMENTO = 20; // con menos, el "mejor momento" sería casualidad

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const miles = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const mayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);


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

function bloqueComparacion(c) {
  const nomAnt = MESES[c.ant.mes - 1];
  const cuando = c.esActual ? `los primeros ${c.finAnt} días de ${nomAnt}` : nomAnt;
  if (!c.visitasAnt) return c.visitas ? `<p class="chip"><span>Es el primer mes con datos</span></p>` : '';
  const cambio = Math.round(((c.visitas - c.visitasAnt) / c.visitasAnt) * 100);
  const flecha = cambio > 0 ? `↑ ${cambio} %` : cambio < 0 ? `↓ ${Math.abs(cambio)} %` : 'Igual';
  return `<p class="chip"><b>${flecha}</b> <span>frente a ${esc(cuando)} (${miles(c.visitasAnt)})</span></p>`;
}

function bloqueToques(c, nombres) {
  const lista = Object.entries(c.porBoton).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!lista.length) return `<section class="card"><h2>Lo que más tocaron</h2><p class="suave">Todavía nadie ha tocado un botón este mes.</p></section>`;
  const max = lista[0][1];
  const barras = lista
    .map(([clave, n]) => {
      const nombre = nombres?.[clave] ?? clave;
      const ancho = Math.max(2, Math.round((n / max) * 100));
      return `<div class="barra"><span>${esc(nombre)}</span><b class="num">${miles(n)}</b><div class="pista" aria-hidden="true"><i style="width:${ancho}%"></i></div></div>`;
    })
    .join('');
  return `<section class="card"><h2>Lo que más tocaron</h2>${barras}</section>`;
}

// Dona con las tres opciones (siempre las tres, aunque alguna esté en 0)
function bloqueOrigen(c) {
  const { qr, nfc } = c.porOrigen;
  const otro = c.porOrigen[''];
  const total = qr + nfc + otro;
  if (!total) return '';
  const partes = [
    ['qr', 'Código QR', qr, '#3A7FE6'],
    ['nfc', 'NFC', nfc, '#B88A3F'],
    ['otro', 'Otro', otro, '#0F9DB7'],
  ];
  const pct = (n) => Math.round((n / total) * 100);
  // Cortes de la dona, con una ranura del color de la pieza entre partes
  const conVisitas = partes.filter((p) => p[2] > 0);
  const ranura = conVisitas.length > 1 ? 0.8 : 0;
  let ini = 0;
  const cortes = [];
  for (const [, , n, col] of conVisitas) {
    const fin = ini + (n / total) * 100;
    cortes.push(`${col} ${ini.toFixed(2)}% ${(fin - ranura).toFixed(2)}%`, `var(--pieza) ${(fin - ranura).toFixed(2)}% ${fin.toFixed(2)}%`);
    ini = fin;
  }
  const ley = partes.map(([k, nombre, n]) => `<div><span class="o-${k}">${nombre}</span><b class="num">${pct(n)} %</b></div>`).join('');
  const resumen = partes.map(([, nombre, n]) => `${nombre} ${pct(n)} %`).join(', ');
  return `<section class="card"><h2>Cómo llegaron</h2><div class="orig"><div class="dona" role="img" aria-label="${esc(resumen)}" style="background:conic-gradient(${cortes.join(',')})"></div><div class="ley">${ley}</div></div></section>`;
}

// ---------- Mis premios (B25d) ----------
// Resumen del mes (tabla premios_eventos, sin códigos) y estado de hoy (tabla premios). Sin tablas: todo en 0.
export async function cifrasPremios(db, id, meta, elegido, hoy) {
  const p = { sellos: 0, nuevas: 0, completas: 0, entregas: 0, enCurso: 0, porEntregar: 0, esActual: elegido.anio === hoy.anio && elegido.mes === hoy.mes };
  if (!db) return p;
  try {
    const { results } = await db
      .prepare('SELECT tipo, SUM(n) AS n FROM premios_eventos WHERE id = ?1 AND dia LIKE ?2 GROUP BY tipo')
      .bind(id, claveMes(elegido) + '-%')
      .all();
    const campo = { sello: 'sellos', tarjeta_nueva: 'nuevas', completa: 'completas', entrega: 'entregas' };
    for (const r of results ?? []) if (campo[r.tipo]) p[campo[r.tipo]] = Math.max(0, Number(r.n) || 0);
    if (p.esActual) {
      const fila = await db
        .prepare('SELECT SUM(CASE WHEN sellos > 0 AND sellos < ?2 THEN 1 ELSE 0 END) AS curso, SUM(CASE WHEN sellos >= ?2 THEN 1 ELSE 0 END) AS llenas FROM premios WHERE id = ?1')
        .bind(id, meta)
        .first();
      p.enCurso = Number(fila?.curso) || 0;
      p.porEntregar = Number(fila?.llenas) || 0;
    }
  } catch (e) {
    if (!/no such table/i.test(e.message)) console.log('panel premios: ' + e.message);
  }
  return p;
}

function bloquePremios(p) {
  if (!p) return '';
  const hay = p.sellos || p.nuevas || p.completas || p.entregas || p.enCurso || p.porEntregar;
  const cifra = (n, titulo, texto) => `<div><b class="num">${miles(n)}</b><span>${titulo}</span><p class="suave">${texto}</p></div>`;
  const cuerpo = hay
    ? `<div class="pr-cifras">${cifra(p.sellos, 'Sellos', 'dados en caja')}${cifra(p.nuevas, 'Clientes nuevos', 'empezaron su tarjeta')}${cifra(p.completas, 'Tarjetas llenas', 'completaron los sellos')}${cifra(p.entregas, 'Obsequios', 'entregados en caja')}</div>` +
      (p.esActual && (p.enCurso || p.porEntregar)
        ? `<p class="pr-hoy">Hoy: <b>${miles(p.enCurso)}</b> ${p.enCurso === 1 ? 'cliente lleva' : 'clientes llevan'} su tarjeta en curso${p.porEntregar ? ` y <b>${miles(p.porEntregar)}</b> ${p.porEntregar === 1 ? 'espera' : 'esperan'} su obsequio` : ''}.</p>`
        : '')
    : `<p class="suave">Todavía no se han dado sellos ${p.esActual ? 'este mes' : 'en ese mes'}. Recuérdale a tu equipo pedir el código en caja.</p>`;
  return `<section class="card oro"><h2>Mis premios</h2>${cuerpo}</section>`;
}

function bloqueMomento(c) {
  let texto;
  if (c.visitas < MIN_VISITAS_MOMENTO) {
    texto = `<p class="suave">Aún hay pocas visitas para saberlo. Aparece cuando lleguen ${MIN_VISITAS_MOMENTO}.</p>`;
  } else {
    const [k] = Object.entries(c.porMomento).sort((a, b) => b[1] - a[1])[0];
    const dSem = Math.floor(k / 100);
    const franja = k % 100;
    texto = `<p class="momento">${DIAS_PLURAL[dSem]}, de ${hora12(franja)} a ${hora12(franja + 2)}</p><p class="suave consejo">Es cuando más abren tu página. Ten a alguien pendiente a esa hora.</p>`;
  }
  return `<section class="card oro"><h2>Tu mejor momento</h2>${texto}</section>`;
}

// Selector de meses: el anterior, el que se ve y el siguiente si ya pasó
function navegacion(id, clave, elegido, hoy) {
  const ant = mesAnterior(elegido);
  const sig = mesSiguiente(elegido);
  const url = (m) => `/panel/${esc(id)}?k=${esc(encodeURIComponent(clave))}&amp;mes=${claveMes(m)}`;
  const hayAnt = ant.anio * 12 + ant.mes >= hoy.anio * 12 + hoy.mes - 24;
  const haySig = sig.anio * 12 + sig.mes <= hoy.anio * 12 + hoy.mes;
  const nombre = (m) => mayuscula(MESES[m.mes - 1]) + (m.anio !== hoy.anio ? ` ${m.anio}` : '');
  return `<nav class="seg" aria-label="Elegir mes">${hayAnt ? `<a href="${url(ant)}">‹ ${nombre(ant)}</a>` : ''}<span class="on" aria-current="page">${nombre(elegido)}</span>${
    haySig ? `<a href="${url(sig)}">${nombre(sig)} ›</a>` : ''
  }</nav>`;
}

export function paginaPanel({ id, clave, datos, c, elegido, hoy, premios = null, cumple = null }) {
  const nombre = datos.nombre || id;
  const nomMes = MESES[elegido.mes - 1];
  const subHero = c.visitas
    ? `<p class="sub">${c.visitas === 1 ? 'vez se abrió' : 'veces se abrió'} tu página.</p><p class="sub nota">Cuenta cada vez que alguien la abre: si una misma persona entra varias veces, suma varias.</p>`
    : `<p class="sub">Todavía no hay visitas ${c.esActual ? 'este mes' : 'en ese mes'}.</p>`;
  const google = c.porBoton.resenas ?? 0;
  const mini =
    c.visitas || c.toques
      ? `<div class="mini"><section class="card"><h2>Toques</h2><b class="num">${miles(c.toques)}</b><p class="suave">a tus botones</p></section><section class="card"><h2>A Google</h2><b class="num">${miles(google)}</b><p class="suave">toques a «Calificar en Google»</p></section></div>`
      : '';
  const cuerpo = c.visitas || c.toques ? bloqueToques(c, datos.botones) + bloqueOrigen(c) + bloqueMomento(c) : '';
  const actualizado = c.esActual ? `Datos hasta hoy, ${hora12(hoy.hora).replace(/^(\d+)/, `$1:${String(hoy.min).padStart(2, '0')}`)} (hora de Colombia).` : '';

  return documento(`Tus resultados · ${nombre}`, `<header class="neg"><i aria-hidden="true">${esc(nombre.trim().charAt(0).toUpperCase())}</i><div><h1>${esc(nombre)}</h1><p class="suave">Tus resultados</p></div></header>
${navegacion(id, clave, elegido, hoy)}
<section class="card"><h2>Visitas en ${nomMes}${elegido.anio !== hoy.anio ? ` de ${elegido.anio}` : ''}</h2><p class="hero num">${miles(c.visitas)}</p>${subHero}${bloqueComparacion(c)}</section>
${mini}
${bloquePremios(premios)}
${bloqueCumple(cumple, id, clave, elegido)}
${cuerpo}
<footer class="pie"><p>Contamos cuántas veces abrieron tu página y tocaron cada botón con enlace. Las llamadas, los correos, los formularios y el Wi-Fi no se cuentan. ${
    datos.cumple
      ? 'Los datos de cumpleaños los dejó cada cliente con su autorización: úsalos solo para saludarlo y darle su regalo.'
      : datos.premios
        ? 'Los sellos van con un código al azar, sin nombres.'
        : 'No guardamos datos de quienes la visitan.'
  }</p>${actualizado ? `<p>${actualizado}</p>` : ''}<p class="fl"><b>Fides</b><span>Link</span></p></footer>`);
}

// ---------- Cumpleaños (B31) ----------
const enlaceCumple = (id, clave, mes) => `/panel/${esc(id)}?k=${esc(encodeURIComponent(clave))}&amp;ver=cumple&amp;cm=${mes}`;

function bloqueCumple(r, id, clave, elegido) {
  if (!r) return '';
  const nomMes = MESES[elegido.mes - 1];
  const texto = r.inscritos
    ? `<div class="pr-cifras"><div><b class="num">${miles(r.delMes)}</b><span>Cumplen en ${nomMes}</span></div><div><b class="num">${miles(r.inscritos)}</b><span>Inscritos</span><p class="suave">en total</p></div></div>` +
      (r.delMes ? `<p class="pr-hoy">Regalos entregados en ${nomMes}: <b>${miles(r.canjeados)}</b> de ${miles(r.delMes)}.</p>` : '')
    : '<p class="suave">Todavía nadie se ha inscrito. Cuéntales a tus clientes que tienen un regalo en su mes.</p>';
  return `<section class="card oro"><h2>Cumpleaños</h2>${texto}<a class="ir" href="${enlaceCumple(id, clave, elegido.mes)}">Ver la lista de ${nomMes} ›</a></section>`;
}

// "573001234567" → "300 ••• 4567"
const celularOculto = (t) => {
  const local = t.startsWith('57') && t.length === 12 ? t.slice(2) : t;
  return `${local.slice(0, 3)} ••• ${local.slice(-4)}`;
};

// Lista de un mes: saludar por WhatsApp, marcar el regalo entregado (este año) y borrar a pedido. Sin JavaScript.
export function paginaCumple({ id, clave, datos, mes, anio, lista, resultado }) {
  const nombre = datos.nombre || id;
  const nomMes = MESES[mes - 1];
  const ant = mes === 1 ? 12 : mes - 1;
  const sig = mes === 12 ? 1 : mes + 1;
  const accion = enlaceCumple(id, clave, mes);
  const nav = `<nav class="seg" aria-label="Elegir mes"><a href="${enlaceCumple(id, clave, ant)}">‹ ${mayuscula(MESES[ant - 1])}</a><span class="on" aria-current="page">${mayuscula(nomMes)}</span><a href="${enlaceCumple(id, clave, sig)}">${mayuscula(MESES[sig - 1])} ›</a></nav>`;
  const regalo = datos.cumple?.premio ?? '';
  const filas = lista
    .map((p) => {
      const pila = p.nombre.split(' ')[0];
      const saludo = `¡Feliz cumpleaños, ${pila}! En ${nombre} te tenemos un regalo${regalo ? `: ${regalo}` : ''}. Te esperamos.`;
      const entregado = p.canjeado === String(anio);
      const oculto = `<input type="hidden" name="tel" value="${esc(p.telefono)}">`;
      return (
        `<li class="cu-fila${entregado ? ' hecho' : ''}"><div class="cu-quien"><b>${esc(p.nombre)}</b><span class="suave num">${celularOculto(p.telefono)}</span>` +
        (entregado ? '<span class="cu-ok">Regalo entregado</span>' : '') +
        `</div><div class="cu-acc"><a class="cu-b wa" href="https://wa.me/${esc(p.telefono)}?text=${esc(encodeURIComponent(saludo))}" target="_blank" rel="noopener">Saludar por WhatsApp</a>` +
        `<form method="post" action="${accion}">${oculto}<input type="hidden" name="accion" value="${entregado ? 'quitar' : 'canjear'}"><button class="cu-b" type="submit">${entregado ? 'Deshacer entregado' : 'Marcar regalo entregado'}</button></form>` +
        `<details class="cu-borrar"><summary>Borrar sus datos</summary><p class="suave">Solo si la persona lo pide. No se puede deshacer.</p><form method="post" action="${accion}">${oculto}<input type="hidden" name="accion" value="borrar"><button class="cu-b rojo" type="submit">Sí, borrar a ${esc(pila)}</button></form></details>` +
        `</div></li>`
      );
    })
    .join('');
  const mensaje = resultado?.texto ? `<p class="cu-msg ${resultado.tipo}" role="status">${esc(resultado.texto)}</p>` : '';
  const cuerpo = lista.length ? `<ul class="cu-lista">${filas}</ul>` : `<p class="suave">Nadie inscrito cumple años en ${nomMes}.</p>`;
  return documento(
    `Cumpleaños · ${nombre}`,
    `<header class="neg"><i aria-hidden="true">${esc(nombre.trim().charAt(0).toUpperCase())}</i><div><h1>${esc(nombre)}</h1><p class="suave">Cumpleaños</p></div></header>
${nav}
${mensaje}
<section class="card"><h2>Cumplen en ${nomMes} (${miles(lista.length)})</h2>${regalo ? `<p class="cu-regalo">Su regalo: <b>${esc(regalo)}</b></p>` : ''}${cuerpo}</section>
<p class="volver"><a class="ir" href="/panel/${esc(id)}?k=${esc(encodeURIComponent(clave))}">‹ Volver a tus resultados</a></p>
<footer class="pie"><p>Cada persona dejó su nombre, celular y mes con su autorización, solo para saludarla y darle su regalo. No los uses para otras promociones. Si alguien pide que borres sus datos, usa "Borrar sus datos".</p><p class="fl"><b>Fides</b><span>Link</span></p></footer>`
  );
}

const CSS_CUMPLE = `.ir{display:inline-flex;align-items:center;min-height:44px;margin-top:10px;font-weight:700;color:var(--cian);text-decoration:none}
.ir:focus-visible,.cu-b:focus-visible,.cu-borrar summary:focus-visible{outline:2px solid var(--cian);outline-offset:2px}
.volver{margin-top:8px}
.cu-regalo{margin-bottom:12px;font-size:14px;color:var(--suave)}.cu-regalo b{color:var(--oro)}
.cu-lista{list-style:none;margin:0;padding:0}
.cu-fila{padding:14px 0;border-top:1px solid rgba(255,255,255,.08)}
.cu-fila:first-child{border-top:0;padding-top:4px}
.cu-quien{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px}
.cu-quien b{font-size:16px}
.cu-ok{font-size:12.5px;font-weight:700;color:var(--oro)}
.cu-acc{display:grid;gap:8px;margin-top:10px}
.cu-acc form{margin:0}
.cu-b{display:flex;align-items:center;justify-content:center;width:100%;min-height:46px;padding:8px 14px;border:0;border-radius:12px;background:#203560;color:var(--texto);font:inherit;font-weight:700;text-decoration:none;cursor:pointer}
.cu-b.wa{background:#25d366;color:#0b3d1f}
.cu-b.rojo{background:#7a1f1f;color:#fff}
.hecho .cu-b:not(.wa){background:transparent;box-shadow:inset 0 0 0 1px rgba(255,255,255,.15);color:var(--suave)}
.cu-borrar summary{min-height:40px;display:flex;align-items:center;font-size:13.5px;color:var(--suave);cursor:pointer}
.cu-borrar p{margin:2px 0 8px;font-size:13px}
.cu-msg{margin-top:12px;padding:10px 14px;border-radius:12px;font-size:14px;font-weight:700}
.cu-msg.ok{background:rgba(37,211,102,.14);color:#7ee2a8}.cu-msg.aviso{background:rgba(255,143,128,.14);color:#ffb3a8}`;

// Cabeza y estilos comunes del panel y de su lista de cumpleaños
function documento(titulo, cuerpo) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#09152D">
<title>${esc(titulo)}</title>
<style>
@font-face{font-family:Figtree;font-weight:500;font-display:swap;src:url(/fonts/figtree-500.woff2) format("woff2")}
@font-face{font-family:Figtree;font-weight:700;font-display:swap;src:url(/fonts/figtree-700.woff2) format("woff2")}
@font-face{font-family:Unbounded;font-weight:800;font-display:swap;src:url(/fonts/unbounded-800.woff2) format("woff2")}
/* Colores del logo de FidesLink: azul noche, azul Fides, cian enlace y dorado Link */
:root{--noche:#09152D;--pieza:#121f3d;--pieza2:#17284c;--texto:#EEF3FB;--suave:#A3B3CE;--azul:#2390EC;--cian:#17D3F1;--oro:#D1BC97;color-scheme:dark}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;background:var(--noche)}
body{margin:0;min-height:100vh;background:radial-gradient(120% 50% at 50% -8%,#15315f 0%,var(--noche) 60%) no-repeat,var(--noche);color:var(--texto);font:500 15px/1.45 Figtree,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:440px;margin:0 auto;padding:max(26px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(28px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left))}
h1,h2,p{margin:0}
.num{font-variant-numeric:tabular-nums}
.suave{color:var(--suave)}
.neg{display:flex;align-items:center;gap:12px}
.neg i{flex:none;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:700;font-size:17px;background:linear-gradient(145deg,#1b3566,#0d1b37);box-shadow:inset 0 0 0 1.5px var(--oro),0 6px 14px -6px #000}
.neg h1{font-size:17px;font-weight:700;line-height:1.25}
.neg p{font-size:13px}
.seg{display:flex;gap:4px;margin:20px 0 4px;padding:4px;border-radius:16px;background:#070f22;box-shadow:inset 0 2px 5px rgba(0,0,0,.55),inset 0 -1px 0 rgba(255,255,255,.05)}
.seg a,.seg span{flex:1;display:flex;align-items:center;justify-content:center;min-height:48px;padding:0 6px;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;color:var(--suave);text-align:center}
.seg .on{color:var(--texto);background:linear-gradient(180deg,#203560,#172a50);box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 4px 10px -4px rgba(0,0,0,.7)}
.seg a{transition:background-color .15s,color .15s}
.seg a:active{background:rgba(255,255,255,.06);color:var(--texto)}
@media (hover:hover) and (pointer:fine){.seg a:hover{background:rgba(255,255,255,.06);color:var(--texto)}}
.seg a:focus-visible{outline:2px solid var(--cian);outline-offset:2px}
.card{margin-top:12px;padding:18px;border-radius:20px;background:linear-gradient(180deg,var(--pieza2),var(--pieza));box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 14px 30px -16px rgba(0,0,0,.75)}
.card h2{font-size:13px;font-weight:700;color:var(--suave);margin-bottom:12px}
.hero{margin-top:2px;font:800 clamp(44px,14vw,56px)/1 Unbounded,system-ui,sans-serif;letter-spacing:-.02em;color:#fff}
@supports (-webkit-background-clip:text) or (background-clip:text){.hero{background:linear-gradient(90deg,#fff 35%,var(--cian));-webkit-background-clip:text;background-clip:text;color:transparent}}
.sub{margin-top:8px;font-size:14px;color:var(--suave)}
.sub.nota{margin-top:4px;font-size:12.5px}
.chip{display:inline-flex;flex-wrap:wrap;gap:4px 6px;margin-top:12px;padding:6px 11px;border-radius:14px;background:rgba(209,188,151,.14);font-size:13px}
.chip b{color:var(--oro)}.chip span{color:var(--suave)}
.mini{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
.mini .card{margin:0;padding:15px 16px}
.mini h2{margin-bottom:4px}
.mini b{display:block;font:800 24px/1.15 Unbounded,system-ui,sans-serif}
.mini p{margin-top:4px;font-size:12.5px}
.barra{display:grid;grid-template-columns:1fr auto;gap:5px 12px;margin-bottom:11px;font-size:14px}
.barra span{overflow-wrap:anywhere}
.pista{grid-column:1/-1;height:8px;border-radius:4px;background:rgba(255,255,255,.07)}
.pista i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,var(--azul),var(--cian));box-shadow:0 0 12px -3px rgba(23,211,241,.55)}
.orig{display:flex;align-items:center;gap:20px}
.dona{flex:none;width:108px;height:108px;border-radius:50%;display:grid;place-items:center;box-shadow:0 10px 22px -12px rgba(0,0,0,.8)}
.dona::after{content:"";width:64px;height:64px;border-radius:50%;background:var(--pieza);box-shadow:inset 0 3px 8px rgba(0,0,0,.5)}
.ley{flex:1;display:grid;gap:10px;font-size:14px}
.ley div{display:flex;justify-content:space-between;gap:8px}
.ley b{white-space:nowrap}
.ley span::before{content:"";display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:8px;vertical-align:-1px;background:var(--c)}
.o-qr{--c:#3A7FE6}.o-nfc{--c:#B88A3F}.o-otro{--c:#0F9DB7}
.card.oro{box-shadow:inset 0 1px 0 rgba(255,255,255,.07),inset 3px 0 0 var(--oro),0 14px 30px -16px rgba(0,0,0,.75)}
.pr-cifras{display:grid;grid-template-columns:1fr 1fr;gap:16px 12px}
.pr-cifras b{display:block;font:800 24px/1.15 Unbounded,system-ui,sans-serif}
.pr-cifras span{display:block;margin-top:4px;font-size:14px;font-weight:700}
.pr-cifras p{font-size:12.5px}
.pr-hoy{margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08);font-size:14px}
.pr-hoy b{color:var(--oro)}
.momento{font-size:20px;font-weight:700;letter-spacing:-.01em}
.consejo{margin-top:4px;font-size:14px}
.pie{margin-top:28px;font-size:12.5px;color:var(--suave);text-align:center}
.pie p+p{margin-top:4px}
.pie .fl{margin-top:16px;font-size:14px;letter-spacing:-.01em}.fl b{font-weight:700;color:var(--azul)}.fl span{color:var(--oro)}
@media (max-width:339px){.orig{flex-direction:column;align-items:stretch}.dona{align-self:center}}
@media (prefers-reduced-motion:reduce){.seg a{transition:none}}
${CSS_CUMPLE}
</style>
</head>
<body>
<main>
${cuerpo}
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

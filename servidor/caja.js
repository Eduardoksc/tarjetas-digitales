// Página de caja de "Mis premios" (B25c): /caja/<id>?k=<clave_caja>.
// El empleado escribe el código que le muestra el cliente y suma el sello, entrega el obsequio o deshace el sello de hoy.
// Sin JavaScript, con formularios normales. Se guarda el código al azar y sus sellos y, solo con la autorización del
// cliente, su celular para recuperar la tarjeta si pierde el código (B36). El celular nunca sale completo en pantalla.
import { TABLA_PREMIOS } from './premios.js';

const MAX_INTENTOS = 10; // claves equivocadas por hora, desde un mismo celular y para un mismo negocio
const MAX_COMPRA = 50000000; // $50 millones: más es un error de tecleo

export const TABLAS_CAJA = [
  TABLA_PREMIOS,
  // Resumen para el panel (B25d): cuántos sellos, tarjetas nuevas, completas y obsequios por día. Sin códigos.
  'CREATE TABLE IF NOT EXISTS premios_eventos (dia TEXT NOT NULL, id TEXT NOT NULL, tipo TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (dia, id, tipo))',
  // Claves equivocadas por hora. "quien" es una huella corta de la IP con el negocio y la hora: no se puede volver atrás a la IP.
  'CREATE TABLE IF NOT EXISTS caja_intentos (hora TEXT NOT NULL, id TEXT NOT NULL, quien TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (hora, id, quien))',
  // B36: celular del cliente, solo para recuperar su tarjeta si pierde el código. Se guarda solo con su autorización
  // ("autorizado": fecha y hora de Colombia en que el empleado marcó la casilla). Un celular por tarjeta y una tarjeta por celular.
  'CREATE TABLE IF NOT EXISTS premios_clientes (id TEXT NOT NULL, telefono TEXT NOT NULL, codigo TEXT NOT NULL, autorizado TEXT NOT NULL, PRIMARY KEY (id, telefono), UNIQUE (id, codigo))',
];

let tablasListas = false;
export async function prepararTablas(db) {
  if (tablasListas) return;
  for (const sql of TABLAS_CAJA) await db.exec(sql);
  tablasListas = true;
}

// Fecha y hora de Colombia (UTC-5, sin horario de verano)
export function ahoraColombia() {
  const d = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
  return { dia: d.slice(0, 10), hora: d.slice(0, 13) };
}

async function sha256(texto) {
  const bits = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function quien(request, id, hora) {
  let ip = request.headers.get('cf-connecting-ip') ?? 'sin-ip';
  // IPv6: una conexión tiene millones de direcciones en su bloque /64, así que se cuenta el bloque
  if (ip.includes(':')) {
    const [izq, der = ''] = ip.toLowerCase().split('::');
    const a = izq ? izq.split(':') : [];
    const b = der ? der.split(':') : [];
    const completa = [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b];
    ip = completa.slice(0, 4).map((x) => x.replace(/^0+(?=.)/, '')).join(':') + '::/64';
  }
  return (await sha256(`${ip}|${id}|${hora}`)).slice(0, 16);
}

// ¿Ya se equivocó demasiadas veces en esta hora?
export async function bloqueado(db, request, id) {
  if (!db) return false;
  const { hora } = ahoraColombia();
  try {
    const fila = await db.prepare('SELECT n FROM caja_intentos WHERE hora = ?1 AND id = ?2 AND quien = ?3').bind(hora, id, await quien(request, id, hora)).first();
    return (fila?.n ?? 0) >= MAX_INTENTOS;
  } catch {
    return false; // la tabla aún no existe: nadie se ha equivocado
  }
}

export async function anotarFallo(db, request, id) {
  if (!db) return;
  const { dia, hora } = ahoraColombia();
  try {
    await prepararTablas(db);
    await db.batch([
      db.prepare('INSERT INTO caja_intentos (hora, id, quien, n) VALUES (?1, ?2, ?3, 1) ON CONFLICT (hora, id, quien) DO UPDATE SET n = n + 1').bind(hora, id, await quien(request, id, hora)),
      db.prepare('DELETE FROM caja_intentos WHERE hora < ?1').bind(dia), // se borran los de días anteriores
    ]);
  } catch (e) {
    console.log('caja: ' + e.message);
  }
}

function evento(db, dia, id, tipo, n) {
  return db.prepare('INSERT INTO premios_eventos (dia, id, tipo, n) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (dia, id, tipo) DO UPDATE SET n = n + ?4').bind(dia, id, tipo, n);
}

async function leerTarjeta(db, id, codigo) {
  return db.prepare('SELECT sellos, completadas, entregados, ultimo_sello, ultimo_n FROM premios WHERE id = ?1 AND codigo = ?2').bind(id, codigo).first();
}

// "$75.000", "75000", "75,000" → 75000
export function pesos(valor) {
  const limpio = String(valor ?? '').replace(/[$\s.,]/g, '');
  if (!/^\d{1,9}$/.test(limpio)) return null;
  const n = Number(limpio);
  return n > 0 && n <= MAX_COMPRA ? n : null;
}

// ---------- Celular del cliente (B36) ----------
// Igual que la columna whatsapp del generador: celular de 10 dígitos que empieza por 3 → se le antepone 57.
export function celularValido(valor) {
  let d = String(valor ?? '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('3')) d = '57' + d;
  return d.length >= 11 && d.length <= 15 ? d : null;
}
// ¿Lo que escribió el empleado es un celular y no un código? Solo números (y espacios, +, -) y 7 dígitos o más.
export const pareceCelular = (valor) => /^[\d\s+()-]+$/.test(String(valor ?? '').trim()) && String(valor).replace(/\D/g, '').length >= 7;

// "573001234567" → "300 ••• 4567": en pantalla nunca va el número completo
export const celularOculto = (t) => {
  const local = t.startsWith('57') && t.length === 12 ? t.slice(2) : t;
  return `${local.slice(0, 3)} ••• ${local.slice(-4)}`;
};

export async function codigoDeCelular(db, id, telefono) {
  await prepararTablas(db);
  const fila = await db.prepare('SELECT codigo FROM premios_clientes WHERE id = ?1 AND telefono = ?2').bind(id, telefono).first();
  return fila?.codigo ?? null;
}

export async function celularDe(db, id, codigo) {
  const fila = await db.prepare('SELECT telefono FROM premios_clientes WHERE id = ?1 AND codigo = ?2').bind(id, codigo).first();
  return fila?.telefono ?? null;
}

export async function guardarCelular(db, id, codigo, valor, autorizo) {
  await prepararTablas(db);
  const tarjeta = await leerTarjeta(db, id, codigo);
  if (!tarjeta) return { tipo: 'aviso', texto: 'Primero suma el sello: el celular se guarda en una tarjeta que ya existe.', tarjeta };
  const telefono = celularValido(valor);
  if (!telefono) return { tipo: 'aviso', texto: 'Ese celular no parece válido. Escríbelo con sus 10 dígitos (ej: 300 123 4567).', tarjeta };
  if (!autorizo) return { tipo: 'aviso', texto: 'Marca la casilla: sin la autorización del cliente no se guarda su número.', tarjeta };
  const otro = await codigoDeCelular(db, id, telefono);
  if (otro && otro !== codigo)
    return { tipo: 'aviso', texto: `Ese celular ya tiene otra tarjeta (código ${conEspacio(otro)}). Búscala escribiendo el celular.`, tarjeta };
  const momento = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
  await db.batch([
    db.prepare('DELETE FROM premios_clientes WHERE id = ?1 AND codigo = ?2').bind(id, codigo),
    db.prepare('INSERT INTO premios_clientes (id, telefono, codigo, autorizado) VALUES (?1, ?2, ?3, ?4)').bind(id, telefono, codigo, momento),
  ]);
  return { tipo: 'ok', texto: 'Celular guardado. Si el cliente pierde su código, búscalo por este número.', tarjeta };
}

// Borrar a pedido del cliente (Ley 1581): la tarjeta y sus sellos siguen, solo se olvida el número
export async function borrarCelular(db, id, codigo) {
  await prepararTablas(db);
  await db.prepare('DELETE FROM premios_clientes WHERE id = ?1 AND codigo = ?2').bind(id, codigo).run();
  return { tipo: 'ok', texto: 'Celular borrado. La tarjeta y sus sellos siguen igual.', tarjeta: await leerTarjeta(db, id, codigo) };
}

// Cada operación devuelve { tipo: 'ok' | 'aviso', texto, tarjeta }
export async function consultar(db, id, codigo) {
  await prepararTablas(db);
  const t = await leerTarjeta(db, id, codigo);
  return { tipo: 'info', texto: t ? '' : 'Este código todavía no tiene sellos.', tarjeta: t };
}

export async function sumar(db, id, codigo, reglas, valorCompra) {
  await prepararTablas(db);
  const { dia } = ahoraColombia();
  let n = 1;
  if (reglas.tipo === 'compras') {
    const valor = pesos(valorCompra);
    if (!valor) return { tipo: 'aviso', texto: 'Escribe el valor de la compra en pesos (ej: 75000).', tarjeta: await leerTarjeta(db, id, codigo) };
    n = Math.floor(valor / reglas.valorSello);
    if (n < 1) return { tipo: 'aviso', texto: `La compra no alcanza para un sello: cada sello es de ${miles(reglas.valorSello)}.`, tarjeta: await leerTarjeta(db, id, codigo) };
  }
  const antes = await leerTarjeta(db, id, codigo);
  if (antes?.ultimo_sello === dia) return { tipo: 'aviso', texto: 'Este código ya recibió su sello hoy. Es uno por día.', tarjeta: antes };
  if (antes && antes.sellos >= reglas.meta) return { tipo: 'aviso', texto: 'La tarjeta ya está llena. Entrega el obsequio para empezar una nueva.', tarjeta: antes };

  const meta = reglas.meta;
  const sellosAntes = antes?.sellos ?? 0;
  const nuevos = Math.min(meta, sellosAntes + n);
  const sumados = nuevos - sellosAntes;
  const completa = nuevos >= meta ? 1 : 0;
  // La condición del UPDATE repite las reglas: si dos cajas suman a la vez, solo una gana
  const pasos = [
    db.prepare('INSERT OR IGNORE INTO premios (id, codigo, creado) VALUES (?1, ?2, ?3)').bind(id, codigo, dia),
    db
      .prepare(
        'UPDATE premios SET sellos = ?3, completadas = completadas + ?4, ultimo_sello = ?5, ultimo_n = ?6 ' +
          'WHERE id = ?1 AND codigo = ?2 AND sellos = ?7 AND (ultimo_sello IS NULL OR ultimo_sello <> ?5)'
      )
      .bind(id, codigo, nuevos, completa, dia, sumados, sellosAntes),
  ];
  const resultado = await db.batch(pasos);
  if (!resultado[1]?.meta?.changes) return { tipo: 'aviso', texto: 'No se pudo sumar: otra caja acaba de cambiar esta tarjeta. Consulta de nuevo.', tarjeta: await leerTarjeta(db, id, codigo) };

  const eventos = [evento(db, dia, id, 'sello', sumados)];
  if (!antes) eventos.push(evento(db, dia, id, 'tarjeta_nueva', 1));
  if (completa) eventos.push(evento(db, dia, id, 'completa', 1));
  await db.batch(eventos);

  const tarjeta = await leerTarjeta(db, id, codigo);
  const nuevo = !antes ? ' Es el primer sello de este código: confirma con el cliente que lo escribiste bien y pídele su celular.' : '';
  const texto = completa
    ? `¡Tarjeta llena! Entrega el obsequio${reglas.premio ? ` (${reglas.premio})` : ''}.`
    : `${sumados === 1 ? 'Sello sumado' : `${sumados} sellos sumados`}.${nuevo}`;
  return { tipo: 'ok', texto, tarjeta };
}

export async function entregar(db, id, codigo, reglas) {
  await prepararTablas(db);
  const { dia } = ahoraColombia();
  const r = await db
    .prepare('UPDATE premios SET sellos = 0, entregados = entregados + 1, ultimo_n = 0 WHERE id = ?1 AND codigo = ?2 AND sellos >= ?3')
    .bind(id, codigo, reglas.meta)
    .run();
  if (!r.meta?.changes) return { tipo: 'aviso', texto: 'Esta tarjeta no está llena: todavía no tiene obsequio.', tarjeta: await leerTarjeta(db, id, codigo) };
  await evento(db, dia, id, 'entrega', 1).run();
  return { tipo: 'ok', texto: 'Obsequio entregado. El cliente empieza una tarjeta nueva.', tarjeta: await leerTarjeta(db, id, codigo) };
}

// Deshace el sello de hoy (por si se escribió mal el código o se sumó dos veces)
export async function deshacer(db, id, codigo, reglas) {
  await prepararTablas(db);
  const { dia } = ahoraColombia();
  const antes = await leerTarjeta(db, id, codigo);
  if (!antes || antes.ultimo_sello !== dia || !antes.ultimo_n) return { tipo: 'aviso', texto: 'Solo se puede deshacer el sello de hoy, antes de entregar el obsequio.', tarjeta: antes };
  const quitaCompleta = antes.sellos >= reglas.meta ? 1 : 0;
  const r = await db
    .prepare('UPDATE premios SET sellos = sellos - ultimo_n, completadas = completadas - ?3, ultimo_sello = NULL, ultimo_n = 0 WHERE id = ?1 AND codigo = ?2 AND ultimo_sello = ?4 AND ultimo_n > 0')
    .bind(id, codigo, quitaCompleta, dia)
    .run();
  if (!r.meta?.changes) return { tipo: 'aviso', texto: 'No se pudo deshacer. Consulta de nuevo.', tarjeta: await leerTarjeta(db, id, codigo) };
  const eventos = [evento(db, dia, id, 'sello', -antes.ultimo_n)];
  if (quitaCompleta) eventos.push(evento(db, dia, id, 'completa', -1));
  if (antes.sellos - antes.ultimo_n === 0 && antes.completadas === 0 && antes.entregados === 0) eventos.push(evento(db, dia, id, 'tarjeta_nueva', -1));
  await db.batch(eventos);
  return { tipo: 'ok', texto: 'Listo: se quitó el sello de hoy.', tarjeta: await leerTarjeta(db, id, codigo) };
}

// ---------- Página ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const miles = (n) => '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const conEspacio = (c) => c.slice(0, 3) + ' ' + c.slice(3);

export const cabecerasCaja = () => ({
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
});

// B36: celular del cliente. Sin celular, el formulario para guardarlo con su autorización; con celular, el botón que le
// envía por WhatsApp el enlace que recupera su tarjeta en el celular, y el de borrarlo a pedido.
function htmlCelular(codigo, t, reglas, accion, celular, enlaceTarjeta) {
  if (!t) return '';
  const oculto = `<input type="hidden" name="codigo" value="${codigo}">`;
  if (celular) {
    const msg = `Hola, esta es tu tarjeta de premios de ${reglas.nombre}. Ábrela en tu celular para recuperar tus sellos: ${enlaceTarjeta}`;
    return (
      `<div class="cel"><p class="suave chico">Celular: <b class="num">${celularOculto(celular)}</b></p>` +
      `<a class="b wa" href="https://wa.me/${celular}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Enviarle su tarjeta por WhatsApp</a>` +
      `<form method="post" action="${accion}">${oculto}<input type="hidden" name="accion" value="borrar_celular"><button class="b sec" type="submit">Borrar celular (si el cliente lo pide)</button></form></div>`
    );
  }
  return (
    `<form class="cel" method="post" action="${accion}">${oculto}<input type="hidden" name="accion" value="celular">` +
    `<label for="celular">Celular del cliente</label>` +
    `<p class="suave chico ayuda">Para que no pierda sus sellos si borra el navegador o cambia de celular.</p>` +
    `<input id="celular" name="celular" type="tel" inputmode="numeric" autocomplete="off" required placeholder="300 123 4567">` +
    `<label class="casilla"><input type="checkbox" name="autorizo" value="si" required> El cliente autorizó guardar su número solo para recuperar su tarjeta.</label>` +
    `<button class="b sec" type="submit">Guardar celular</button></form>`
  );
}

function htmlTarjeta(codigo, t, reglas, accion, celular, enlaceTarjeta) {
  const sellos = t?.sellos ?? 0;
  const llena = sellos >= reglas.meta;
  let puntos = '';
  for (let i = 0; i < reglas.meta; i++) puntos += `<i${i < sellos ? ' class="si"' : ''}></i>`;
  const oculto = `<input type="hidden" name="codigo" value="${codigo}">`;
  const hoy = ahoraColombia().dia;
  const botones = [];
  if (llena)
    botones.push(`<form method="post" action="${accion}">${oculto}<input type="hidden" name="accion" value="entregar"><button class="b oro" type="submit">Entregar obsequio${reglas.premio ? `: ${esc(reglas.premio)}` : ''}</button></form>`);
  if (t?.ultimo_sello === hoy && t?.ultimo_n > 0)
    botones.push(`<form method="post" action="${accion}">${oculto}<input type="hidden" name="accion" value="deshacer"><button class="b sec" type="submit">Deshacer el sello de hoy</button></form>`);
  return (
    `<section class="card tarjeta${llena ? ' llena' : ''}"><h2>Código <span class="cod">${conEspacio(codigo)}</span></h2>` +
    `<p class="cuenta num"><b>${sellos}</b> de ${reglas.meta} sellos</p><p class="pts" aria-hidden="true">${puntos}</p>` +
    (t ? `<p class="suave chico">Obsequios entregados: ${t.entregados}</p>` : '') +
    botones.join('') +
    htmlCelular(codigo, t, reglas, accion, celular, enlaceTarjeta) +
    `</section>`
  );
}

export function paginaCaja({ id, clave, reglas, resultado, codigo, celular, origen }) {
  const enlaceTarjeta = `${origen ?? ''}/${encodeURIComponent(id)}/#premios-${codigo ?? ''}`;
  const accion = `/caja/${encodeURIComponent(id)}?k=${encodeURIComponent(clave)}`;
  const compras = reglas.tipo === 'compras';
  const regla = compras ? `Un sello por cada ${miles(reglas.valorSello)} en compras` : 'Un sello por visita';
  const mensaje = resultado?.texto ? `<p class="msg ${resultado.tipo}" role="status">${esc(resultado.texto)}</p>` : '';
  const tarjeta = codigo && resultado ? htmlTarjeta(codigo, resultado.tarjeta, reglas, accion, celular, enlaceTarjeta) : '';
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#09152D">
<title>Caja · ${esc(reglas.nombre)}</title>
<style>
@font-face{font-family:Figtree;font-weight:500;font-display:swap;src:url(/fonts/figtree-500.woff2) format("woff2")}
@font-face{font-family:Figtree;font-weight:700;font-display:swap;src:url(/fonts/figtree-700.woff2) format("woff2")}
@font-face{font-family:Unbounded;font-weight:800;font-display:swap;src:url(/fonts/unbounded-800.woff2) format("woff2")}
:root{--noche:#09152D;--pieza:#121f3d;--pieza2:#17284c;--texto:#EEF3FB;--suave:#A3B3CE;--azul:#2390EC;--cian:#17D3F1;--oro:#D1BC97;--bien:#3ddc97;--alerta:#ffb547;color-scheme:dark}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;background:var(--noche)}
body{margin:0;min-height:100vh;background:radial-gradient(120% 50% at 50% -8%,#15315f 0%,var(--noche) 60%) no-repeat,var(--noche);color:var(--texto);font:500 16px/1.45 Figtree,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:440px;margin:0 auto;padding:max(24px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(28px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left))}
h1,h2,p{margin:0}
.num{font-variant-numeric:tabular-nums}
.suave{color:var(--suave)}.chico{font-size:13px;margin-top:8px}
.neg{display:flex;align-items:center;gap:12px}
.neg i{flex:none;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:700;font-size:17px;background:linear-gradient(145deg,#1b3566,#0d1b37);box-shadow:inset 0 0 0 1.5px var(--oro)}
.neg h1{font-size:17px;font-weight:700;line-height:1.25}
.neg p{font-size:13px}
.card{margin-top:14px;padding:18px;border-radius:20px;background:linear-gradient(180deg,var(--pieza2),var(--pieza));box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 14px 30px -16px rgba(0,0,0,.75)}
.card h2{font-size:13px;font-weight:700;color:var(--suave);margin-bottom:10px}
label{display:block;margin:0 0 8px;font-size:14px;font-weight:700}
label+input{margin-bottom:14px}
input{display:block;width:100%;min-height:56px;padding:10px 14px;border:1.5px solid #3a4f78;border-radius:14px;background:#070f22;color:var(--texto);font:inherit;font-size:18px}
input:focus{outline:2px solid var(--cian);outline-offset:1px;border-color:var(--cian)}
.codigo{font:800 24px/1 Unbounded,system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase}
.codigo::placeholder{color:#6f81a3;font:500 16px Figtree,system-ui,sans-serif;letter-spacing:0;text-transform:none}
.b{display:flex;align-items:center;justify-content:center;width:100%;min-height:54px;margin-top:10px;padding:10px 16px;border:0;border-radius:999px;font:inherit;font-size:16px;font-weight:700;cursor:pointer;background:linear-gradient(90deg,var(--azul),#1aa6ee);color:#fff;transition:transform .15s,filter .15s}
.b:active{transform:scale(.975);filter:brightness(.92)}
.b.sec{background:transparent;color:var(--texto);box-shadow:inset 0 0 0 1.5px #3a4f78}
.b.oro{background:var(--oro);color:#1b1407}
.b:focus-visible{outline:2px solid var(--cian);outline-offset:3px}
.fila{display:grid;grid-template-columns:2fr 1fr;gap:10px}
.msg{margin-top:14px;padding:12px 14px;border-radius:14px;font-weight:700}
.msg.ok{background:rgba(61,220,151,.14);color:var(--bien)}
.msg.aviso{background:rgba(255,181,71,.14);color:var(--alerta)}
.msg.info{background:rgba(163,179,206,.12);color:var(--suave)}
.cod{color:var(--texto);font:800 15px/1 Unbounded,system-ui,sans-serif;letter-spacing:.1em}
.cuenta{font-size:16px;color:var(--suave)}
.cuenta b{font:800 40px/1 Unbounded,system-ui,sans-serif;color:var(--texto);margin-right:4px}
.pts{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.pts i{width:18px;height:18px;border-radius:50%;box-shadow:inset 0 0 0 1.5px #3a4f78}
.pts i.si{background:linear-gradient(135deg,var(--azul),var(--cian));box-shadow:none}
.tarjeta.llena{box-shadow:inset 0 0 0 1.5px var(--oro),0 14px 30px -16px rgba(0,0,0,.75)}
.tarjeta.llena .pts i.si{background:var(--oro)}
.cel{margin-top:16px;padding-top:14px;border-top:1px solid #2a3c62}
.ayuda{margin:-4px 0 10px}
.cel input[type=tel]{margin-bottom:12px}
.casilla{display:flex;gap:10px;align-items:flex-start;margin:0;font-size:14px;font-weight:500;line-height:1.35}
.casilla input{flex:none;width:22px;height:22px;min-height:0;margin:0;accent-color:var(--cian)}
.b.wa{background:#25d366;color:#0b3d1f;text-decoration:none}
.reglas{margin-top:22px;font-size:13px;color:var(--suave);text-align:center}
.reglas p+p{margin-top:4px}
@media (prefers-reduced-motion:reduce){.b{transition:none}.b:active{transform:none}}
</style>
</head>
<body>
<main>
<header class="neg"><i aria-hidden="true">${esc(reglas.nombre.trim().charAt(0).toUpperCase())}</i><div><h1>${esc(reglas.nombre)}</h1><p class="suave">Caja · Mis premios</p></div></header>
${mensaje}
${tarjeta}
<section class="card"><h2>${codigo ? 'Siguiente cliente' : 'Sumar un sello'}</h2>
<form method="post" action="${accion}">
<label for="codigo">Código o celular del cliente</label>
<input class="codigo" id="codigo" name="codigo" required maxlength="20" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="El código de su celular, o su número"${codigo ? '' : ' autofocus'}>
${compras ? '<label for="valor">Valor de la compra</label><input id="valor" name="valor" inputmode="numeric" autocomplete="off" placeholder="75000">' : ''}
<div class="fila"><button class="b" type="submit" name="accion" value="sumar">${compras ? 'Sumar sellos' : 'Sumar sello'}</button><button class="b sec" type="submit" name="accion" value="consultar" formnovalidate>Consultar</button></div>
</form></section>
<footer class="reglas"><p>${regla}. Uno por código al día. Al juntar ${reglas.meta}, se entrega el obsequio${reglas.premio ? `: ${esc(reglas.premio)}` : ''}.</p>${reglas.vigencia ? `<p>Vence: ${esc(reglas.vigencia)}</p>` : ''}<p>Guarda esta página en favoritos. No la compartas con clientes.</p></footer>
</main>
</body>
</html>`;
}

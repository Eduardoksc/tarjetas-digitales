// Mis premios (B25): tarjeta de sellos por visitas o compras, en la base D1 del contador (variable CONTADOR).
// No guarda datos de la persona: solo el código al azar que creó su celular y cuántos sellos lleva.
// El cliente solo lee su avance (/premios/<id>/<código>). Sumar sellos y entregar el obsequio es de la caja (B25c), con clave.

// Sin 0, O, 1, I ni L, para que el empleado no se equivoque al escribirlo. Igual que ALFABETO_CODIGO en generar.mjs.
export const ALFABETO_CODIGO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const LARGO_CODIGO = 6;
const CODIGO = new RegExp(`^[${ALFABETO_CODIGO}]{${LARGO_CODIGO}}$`);

// "k7q 42x" o "K7Q-42X" → "K7Q42X"; null si no es un código válido
export function codigoValido(valor) {
  const c = String(valor ?? '').toUpperCase().replace(/[\s-]/g, '');
  return CODIGO.test(c) ? c : null;
}

export const TABLA_PREMIOS =
  'CREATE TABLE IF NOT EXISTS premios (' +
  'id TEXT NOT NULL, codigo TEXT NOT NULL, ' +
  'sellos INTEGER NOT NULL DEFAULT 0, ' + // sellos de la tarjeta en curso
  'completadas INTEGER NOT NULL DEFAULT 0, ' + // tarjetas llenas, entregadas o no
  'entregados INTEGER NOT NULL DEFAULT 0, ' + // obsequios entregados en caja
  'ultimo_sello TEXT, ' + // día del último sello (AAAA-MM-DD, hora de Colombia): uno por día
  'creado TEXT NOT NULL, ' +
  'PRIMARY KEY (id, codigo))';

// Reglas del programa que escribió el robot (dist/<id>/caja.json). null si el negocio no tiene "Mis premios".
export async function reglasPremios(env, request, id) {
  try {
    const r = await env.ASSETS.fetch(new URL(`/${id}/caja.json`, request.url));
    if (!r.ok) return null;
    const datos = await r.json();
    return Number.isInteger(datos.meta) ? datos : null;
  } catch {
    return null;
  }
}

// Sellos de un código. Sin base, sin tabla o sin fila: 0 (todavía nadie le ha sumado).
export async function avance(db, id, codigo) {
  if (!db) return { sellos: 0, entregados: 0 };
  try {
    const fila = await db.prepare('SELECT sellos, entregados FROM premios WHERE id = ?1 AND codigo = ?2').bind(id, codigo).first();
    return { sellos: fila?.sellos ?? 0, entregados: fila?.entregados ?? 0 };
  } catch (e) {
    if (!/no such table/i.test(e.message)) console.log('premios: ' + e.message);
    return { sellos: 0, entregados: 0 };
  }
}

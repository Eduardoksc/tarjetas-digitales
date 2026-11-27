// /premios/<id>/<código>: cuántos sellos lleva ese código en la tarjeta de ese negocio.
// Lo usa el script de "Mis premios" de la tarjeta. No crea tarjetas ni toca los sellos.
// B36: como un código se puede recuperar con un enlace, se limita adivinar: cada consulta de un código que no existe
// cuenta como intento, y 30 en una hora desde un mismo celular, para un mismo negocio, bloquean con 429 hasta la hora siguiente.
import { slugValido } from '../../../servidor/contador.js';
import { ahoraColombia, quien } from '../../../servidor/caja.js';
import { avance, codigoValido, reglasPremios } from '../../../servidor/premios.js';

const MAX_FALLIDAS = 30;
const TABLA = 'CREATE TABLE IF NOT EXISTS premios_intentos (hora TEXT NOT NULL, id TEXT NOT NULL, quien TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (hora, id, quien))';

const CABECERAS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' };
const respuesta = (datos, status = 200) => new Response(JSON.stringify(datos), { status, headers: CABECERAS });

async function fallidas(db, request, id, hora) {
  try {
    const fila = await db.prepare('SELECT n FROM premios_intentos WHERE hora = ?1 AND id = ?2 AND quien = ?3').bind(hora, id, await quien(request, id, hora)).first();
    return fila?.n ?? 0;
  } catch {
    return 0; // la tabla aún no existe
  }
}

async function anotar(db, request, id, dia, hora) {
  try {
    await db.exec(TABLA);
    await db.batch([
      db.prepare('INSERT INTO premios_intentos (hora, id, quien, n) VALUES (?1, ?2, ?3, 1) ON CONFLICT (hora, id, quien) DO UPDATE SET n = n + 1').bind(hora, id, await quien(request, id, hora)),
      db.prepare('DELETE FROM premios_intentos WHERE hora < ?1').bind(dia), // se borran los de días anteriores
    ]);
  } catch (e) {
    console.log('premios: ' + e.message);
  }
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const id = String(params.id ?? '').toLowerCase();
  const codigo = codigoValido(params.codigo);
  if (!slugValido(id) || !codigo) return respuesta({ error: 'no válido' }, 404);

  const reglas = await reglasPremios(env, request, id);
  if (!reglas) return respuesta({ error: 'sin premios' }, 404);

  const db = env.CONTADOR;
  const { dia, hora } = ahoraColombia();
  if (db && (await fallidas(db, request, id, hora)) >= MAX_FALLIDAS) return respuesta({ error: 'demasiados intentos' }, 429);

  const { sellos, entregados, existe } = await avance(db, id, codigo);
  if (!existe) await anotar(db, request, id, dia, hora);
  return respuesta({ sellos: Math.min(sellos, reglas.meta), meta: reglas.meta, entregados });
}

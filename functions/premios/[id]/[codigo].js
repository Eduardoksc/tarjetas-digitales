// /premios/<id>/<código>: cuántos sellos lleva ese código en la tarjeta de ese negocio.
// Solo lee: no crea filas ni escribe en la base. Lo usa el script de "Mis premios" de la tarjeta.
import { slugValido } from '../../../servidor/contador.js';
import { avance, codigoValido, reglasPremios } from '../../../servidor/premios.js';

const CABECERAS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' };
const respuesta = (datos, status = 200) => new Response(JSON.stringify(datos), { status, headers: CABECERAS });

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const id = String(params.id ?? '').toLowerCase();
  const codigo = codigoValido(params.codigo);
  if (!slugValido(id) || !codigo) return respuesta({ error: 'no válido' }, 404);

  const reglas = await reglasPremios(env, request, id);
  if (!reglas) return respuesta({ error: 'sin premios' }, 404);

  const { sellos, entregados } = await avance(env.CONTADOR, id, codigo);
  return respuesta({ sellos: Math.min(sellos, reglas.meta), meta: reglas.meta, entregados });
}

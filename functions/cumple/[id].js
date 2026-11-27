// /cumple/<id> (POST): inscripción al regalo de cumpleaños (B31) desde la hoja de la tarjeta.
// Recibe nombre, celular, mes y la casilla de autorización; responde una página "Listo" sin JavaScript.
// Diez inscripciones por hora desde una misma conexión, por negocio, como máximo.
import { slugValido } from '../../servidor/contador.js';
import { datosCumple, inscribir, paginaCliente, paginaListo } from '../../servidor/cumple.js';

const NO_DISPONIBLE = { titulo: 'No disponible', texto: 'Este negocio no tiene inscripción de cumpleaños.', estado: 404 };

// El formulario sale de la tarjeta: en Cloudflare es la misma dirección; la copia de GitHub Pages es otro sitio
function origenPermitido(request) {
  const origen = request.headers.get('origin');
  if (!origen || origen === 'null' || origen === new URL(request.url).origin) return true;
  try {
    return new URL(origen).hostname.endsWith('.github.io');
  } catch {
    return false;
  }
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const id = String(params.id ?? '').toLowerCase();
  if (!slugValido(id)) return paginaCliente({ id: '', datos: null, ...NO_DISPONIBLE });
  const datos = await datosCumple(env, request, id);
  if (!datos) return paginaCliente({ id, datos: null, ...NO_DISPONIBLE });
  if (!origenPermitido(request)) return paginaCliente({ id, datos, titulo: 'No permitido', texto: 'Inscríbete desde la tarjeta del negocio.', estado: 403 });
  if (!env.CONTADOR) return paginaCliente({ id, datos, titulo: 'Inténtalo más tarde', texto: 'La inscripción todavía no está lista.', estado: 503 });

  let form;
  try {
    form = await request.formData();
  } catch {
    return paginaCliente({ id, datos, titulo: 'Revisa tus datos', texto: 'No pudimos leer el formulario.', estado: 400 });
  }
  let r;
  try {
    r = await inscribir(env.CONTADOR, request, id, datos, form);
  } catch (e) {
    console.log('cumple: ' + e.message);
    return paginaCliente({ id, datos, titulo: 'No se pudo guardar', texto: 'Intenta de nuevo en un momento.', estado: 503 });
  }
  if (r.error) return paginaCliente({ id, datos, titulo: 'Revisa tus datos', texto: r.error, estado: r.estado });
  return paginaListo({ id, datos, nombre: r.nombre, mes: r.mes });
}

// Abrir /cumple/<id> en el navegador lleva a la tarjeta, con la hoja abierta
export function onRequestGet(context) {
  const id = String(context.params.id ?? '').toLowerCase();
  const destino = slugValido(id) ? `/${id}/#cumple` : '/';
  return new Response(null, { status: 302, headers: { Location: destino, 'Cache-Control': 'no-store' } });
}

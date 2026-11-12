// Cuenta una visita cuando alguien abre una tarjeta (/001/ o /001/index.html).
// El QR impreso lleva ?o=qr y el chip NFC ?o=nfc, para saber cómo llegó la persona.
import { contar, esRobot, slugValido } from '../servidor/contador.js';

const PAGINA = /^\/([a-z0-9][a-z0-9-]*)\/(index\.html)?$/;
const ORIGENES = ['qr', 'nfc'];

export async function onRequest(context) {
  const { request, env } = context;
  // La huella de la clave del panel solo la lee el panel, nunca el público
  if (/^\/[^/]+\/panel\.json$/.test(new URL(request.url).pathname)) return new Response('No encontrado', { status: 404 });
  const respuesta = await context.next();
  // 304 = el celular ya tenía la página guardada, pero igual es una visita
  if (request.method !== 'GET' || (respuesta.status !== 200 && respuesta.status !== 304)) return respuesta;
  const url = new URL(request.url);
  const m = url.pathname.match(PAGINA);
  if (m && m[1] !== 'ir' && m[1] !== 'panel' && slugValido(m[1]) && !esRobot(request)) {
    const o = (url.searchParams.get('o') ?? '').toLowerCase();
    context.waitUntil(contar(env, { id: m[1], tipo: 'visita', origen: ORIGENES.includes(o) ? o : '' }));
  }
  return respuesta;
}

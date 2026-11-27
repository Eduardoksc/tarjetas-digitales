// Cuenta una visita cuando alguien abre una tarjeta (/001/ o /001/index.html).
// El QR impreso lleva ?o=qr y el chip NFC ?o=nfc, para saber cómo llegó la persona.
import { contar, esRobot, slugValido } from '../servidor/contador.js';

const PAGINA = /^\/([a-z0-9][a-z0-9-]*)\/(index\.html)?$/;
const ORIGENES = ['qr', 'nfc'];

const PROTEGIDOS = /(^|\/)(panel|caja)\.json$/;
function rutaProtegida(ruta) {
  let r = ruta;
  // Decodifica varias veces (%252E → %2E → .) y bloquea si no se puede decodificar
  for (let i = 0; i < 3; i++) {
    try {
      const siguiente = decodeURIComponent(r);
      if (siguiente === r) break;
      r = siguiente;
    } catch {
      return true;
    }
  }
  r = r.toLowerCase().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/[/.\s]+$/, '');
  return PROTEGIDOS.test(r);
}

export async function onRequest(context) {
  const { request, env } = context;
  // Las huellas de las claves del panel y de la caja solo las leen esas páginas, nunca el público.
  // Se normaliza la dirección (%2E, //, mayúsculas, barra final) para que ninguna variante se cuele.
  if (rutaProtegida(new URL(request.url).pathname)) return new Response('No encontrado', { status: 404 });
  const respuesta = await context.next();
  // 304 = el celular ya tenía la página guardada, pero igual es una visita
  if (request.method !== 'GET' || (respuesta.status !== 200 && respuesta.status !== 304)) return respuesta;
  const url = new URL(request.url);
  const m = url.pathname.match(PAGINA);
  if (m && m[1] !== 'ir' && m[1] !== 'panel' && m[1] !== 'caja' && m[1] !== 'premios' && m[1] !== 'cumple' && slugValido(m[1]) && !esRobot(request)) {
    const o = (url.searchParams.get('o') ?? '').toLowerCase();
    context.waitUntil(contar(env, { id: m[1], tipo: 'visita', origen: ORIGENES.includes(o) ? o : '' }));
  }
  return respuesta;
}

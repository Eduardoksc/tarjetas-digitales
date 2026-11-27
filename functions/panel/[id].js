// /panel/<id>?k=<clave_panel>[&mes=AAAA-MM]: panel de resultados del negocio.
// /panel/<id>?k=<clave_panel>&ver=cumple&cm=<1-12>: lista de cumpleaños del mes (B31), con acciones por POST.
// Sin la clave correcta no muestra nada. No lleva JavaScript y no se guarda en caché.
// Como la lista de cumpleaños tiene nombres y celulares, diez claves equivocadas en una hora bloquean esa conexión.
import { slugValido } from '../../servidor/contador.js';
import { cabeceras, cifras, cifrasPremios, claveValida, hoyColombia, paginaAviso, paginaCumple, paginaPanel } from '../../servidor/panel.js';
import { anotarFallo, bloqueado } from '../../servidor/caja.js';
import { accionCumple, listaCumple, resumenCumple } from '../../servidor/cumple.js';

const NO_VALIDO = ['Enlace no válido', 'Revisa que copiaste el enlace completo que te enviamos.', 404];
const BLOQUEADO = ['Demasiados intentos', 'Espera una hora e intenta de nuevo con el enlace correcto.', 429];

// Revisa el enlace y la clave. Devuelve { id, clave, datos, url } o una Response de error.
async function entrar(context) {
  const { request, env, params } = context;
  const id = String(params.id ?? '').toLowerCase();
  const url = new URL(request.url);
  const clave = url.searchParams.get('k') ?? '';
  if (!slugValido(id) || !clave) return paginaAviso(...NO_VALIDO);
  const limite = 'panel:' + id; // contador aparte del de la caja
  if (await bloqueado(env.CONTADOR, request, limite)) return paginaAviso(...BLOQUEADO);

  let datos = null;
  try {
    const r = await env.ASSETS.fetch(new URL(`/${id}/panel.json`, request.url));
    if (r.ok) datos = await r.json();
  } catch {
    datos = null;
  }
  if (!datos) return paginaAviso(...NO_VALIDO); // negocio sin panel: no se escribe nada en la base
  if (!(await claveValida(datos, clave))) {
    await anotarFallo(env.CONTADOR, request, limite);
    return paginaAviso(...NO_VALIDO);
  }
  if (!env.CONTADOR) return paginaAviso('Panel en preparación', 'Todavía no estamos contando las visitas. Vuelve pronto.', 503);
  return { id, clave, datos, url };
}

const mesCumple = (url, hoy) => {
  const n = Number(url.searchParams.get('cm'));
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : hoy.mes;
};

async function verCumple(env, e, resultado = null, estado = 200) {
  const hoy = hoyColombia();
  const mes = mesCumple(e.url, hoy);
  const lista = await listaCumple(env.CONTADOR, e.id, mes);
  return new Response(paginaCumple({ id: e.id, clave: e.clave, datos: e.datos, mes, anio: hoy.anio, lista, resultado }), { status: estado, headers: cabeceras() });
}

export async function onRequestGet(context) {
  const { env } = context;
  const e = await entrar(context);
  if (e instanceof Response) return e;
  const { id, clave, datos, url } = e;
  if (url.searchParams.get('ver') === 'cumple' && datos.cumple) return verCumple(env, e);

  const hoy = hoyColombia();
  let elegido = { anio: hoy.anio, mes: hoy.mes };
  const m = (url.searchParams.get('mes') ?? '').match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const pedido = { anio: Number(m[1]), mes: Number(m[2]) };
    const indice = pedido.anio * 12 + pedido.mes;
    const actual = hoy.anio * 12 + hoy.mes;
    if (pedido.mes >= 1 && pedido.mes <= 12 && indice <= actual && indice >= actual - 24) elegido = pedido;
  }

  const ids = [id, datos.alias].filter((x) => x && slugValido(x));
  let c;
  try {
    c = await cifras(env.CONTADOR, ids, elegido, hoy);
  } catch (err) {
    // La tabla aún no existe (nadie ha visitado) u otro error de la base
    if (!/no such table/i.test(err.message)) return paginaAviso('No pudimos cargar tus datos', 'Intenta de nuevo en unos minutos.', 503);
    c = await cifras({ prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }) }) }) }, ids, elegido, hoy);
  }
  // Mis premios: con el id real (los sellos no se guardan por alias)
  const premios = Number.isInteger(datos.premios?.meta) ? await cifrasPremios(env.CONTADOR, id, datos.premios.meta, elegido, hoy) : null;
  // Cumpleaños del mes que se está viendo (el año da igual: se cuenta el regalo entregado ese año)
  const cumple = datos.cumple ? await resumenCumple(env.CONTADOR, id, elegido.mes, elegido.anio) : null;
  return new Response(paginaPanel({ id, clave, datos, c, elegido, hoy, premios, cumple }), { headers: cabeceras() });
}

// Acciones de la lista de cumpleaños: canjear, quitar (deshacer entregado) y borrar
export async function onRequestPost(context) {
  const { request, env } = context;
  // Rechaza formularios enviados desde otro sitio (con "no-referrer" el navegador manda Origin: null desde aquí mismo)
  const origen = request.headers.get('origin');
  if (origen && origen !== 'null' && origen !== new URL(request.url).origin) return paginaAviso('No permitido', 'Abre el panel desde su enlace.', 403);
  const e = await entrar(context);
  if (e instanceof Response) return e;
  if (!e.datos.cumple) return paginaAviso(...NO_VALIDO);
  let form;
  try {
    form = await request.formData();
  } catch {
    return verCumple(env, e, { tipo: 'aviso', texto: 'No se pudo leer el formulario.' }, 400);
  }
  const accion = String(form.get('accion') ?? '');
  if (!['canjear', 'quitar', 'borrar'].includes(accion)) return verCumple(env, e, { tipo: 'aviso', texto: 'Acción no válida.' }, 400);
  let resultado;
  try {
    resultado = await accionCumple(env.CONTADOR, e.id, accion, form.get('tel'), hoyColombia().anio);
  } catch (err) {
    console.log('panel cumple: ' + err.message);
    resultado = { tipo: 'aviso', texto: 'No se pudo guardar. Intenta de nuevo en un momento.' };
  }
  return verCumple(env, e, resultado);
}

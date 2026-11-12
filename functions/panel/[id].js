// /panel/<id>?k=<clave_panel>[&mes=AAAA-MM]: panel de resultados del negocio.
// Sin la clave correcta no muestra nada. No lleva JavaScript y no se guarda en caché.
import { slugValido } from '../../servidor/contador.js';
import { cabeceras, cifras, claveValida, hoyColombia, paginaAviso, paginaPanel } from '../../servidor/panel.js';

const NO_VALIDO = ['Enlace no válido', 'Revisa que copiaste el enlace completo que te enviamos.', 404];

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const id = String(params.id ?? '').toLowerCase();
  const url = new URL(request.url);
  const clave = url.searchParams.get('k') ?? '';
  if (!slugValido(id) || !clave) return paginaAviso(...NO_VALIDO);

  let datos = null;
  try {
    const r = await env.ASSETS.fetch(new URL(`/${id}/panel.json`, request.url));
    if (r.ok) datos = await r.json();
  } catch {
    datos = null;
  }
  if (!datos || !(await claveValida(datos, clave))) return paginaAviso(...NO_VALIDO);
  if (!env.CONTADOR) return paginaAviso('Panel en preparación', 'Todavía no estamos contando las visitas. Vuelve pronto.', 503);

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
  } catch (e) {
    // La tabla aún no existe (nadie ha visitado) u otro error de la base
    if (!/no such table/i.test(e.message)) return paginaAviso('No pudimos cargar tus datos', 'Intenta de nuevo en unos minutos.', 503);
    c = await cifras({ prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }) }) }) }, ids, elegido, hoy);
  }
  return new Response(paginaPanel({ id, clave, datos, c, elegido, hoy }), { headers: cabeceras() });
}

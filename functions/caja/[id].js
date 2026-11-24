// /caja/<id>?k=<clave_caja>: página del empleado para sumar sellos de "Mis premios" y entregar el obsequio.
// Sin la clave correcta no muestra nada. Diez claves equivocadas en una hora bloquean ese celular por el resto de la hora.
import { slugValido } from '../../servidor/contador.js';
import { claveValida, paginaAviso } from '../../servidor/panel.js';
import { codigoValido, reglasPremios } from '../../servidor/premios.js';
import { anotarFallo, bloqueado, cabecerasCaja, consultar, deshacer, entregar, paginaCaja, sumar } from '../../servidor/caja.js';

const NO_VALIDO = ['Enlace no válido', 'Revisa que copiaste el enlace completo que te enviamos.', 404];
const BLOQUEADO = ['Demasiados intentos', 'Espera una hora e intenta de nuevo con el enlace correcto.', 429];

// Revisa el enlace y la clave. Devuelve { id, clave, reglas } o una Response de error.
async function entrar(context) {
  const { request, env, params } = context;
  const id = String(params.id ?? '').toLowerCase();
  const clave = new URL(request.url).searchParams.get('k') ?? '';
  if (!slugValido(id) || !clave) return paginaAviso(...NO_VALIDO);
  const db = env.CONTADOR;
  if (await bloqueado(db, request, id)) return paginaAviso(...BLOQUEADO);
  const reglas = await reglasPremios(env, request, id);
  if (!reglas) return paginaAviso(...NO_VALIDO); // negocio sin premios: no se escribe nada en la base
  if (!(await claveValida(reglas, clave))) {
    await anotarFallo(db, request, id);
    return paginaAviso(...NO_VALIDO);
  }
  if (!db) return paginaAviso('Caja en preparación', 'Todavía no está conectada la base de datos de los sellos.', 503);
  return { id, clave, reglas, db };
}

const pagina = (datos, status = 200) => new Response(paginaCaja(datos), { status, headers: cabecerasCaja() });

export async function onRequestGet(context) {
  const e = await entrar(context);
  if (e instanceof Response) return e;
  return pagina({ id: e.id, clave: e.clave, reglas: e.reglas });
}

export async function onRequestPost(context) {
  const { request } = context;
  // Rechaza formularios enviados desde otro sitio. Con "no-referrer" el navegador manda Origin: null desde esta misma
  // página, así que null se acepta: la protección de fondo es que la clave va en la dirección del formulario.
  const origen = request.headers.get('origin');
  if (origen && origen !== 'null' && origen !== new URL(request.url).origin) return paginaAviso('No permitido', 'Abre la caja desde su enlace.', 403);
  const e = await entrar(context);
  if (e instanceof Response) return e;

  let form;
  try {
    form = await request.formData();
  } catch {
    return pagina({ id: e.id, clave: e.clave, reglas: e.reglas }, 400);
  }
  const accion = String(form.get('accion') ?? 'sumar');
  const codigo = codigoValido(form.get('codigo'));
  if (!codigo) {
    const resultado = { tipo: 'aviso', texto: 'Ese código no es válido. Son 6 letras y números, como K7Q 42X (sin 0, O, 1, I ni L).' };
    return pagina({ id: e.id, clave: e.clave, reglas: e.reglas, resultado }, 400);
  }

  let resultado;
  try {
    if (accion === 'consultar') resultado = await consultar(e.db, e.id, codigo);
    else if (accion === 'entregar') resultado = await entregar(e.db, e.id, codigo, e.reglas);
    else if (accion === 'deshacer') resultado = await deshacer(e.db, e.id, codigo, e.reglas);
    else resultado = await sumar(e.db, e.id, codigo, e.reglas, form.get('valor'));
  } catch (err) {
    console.log('caja: ' + err.message);
    resultado = { tipo: 'aviso', texto: 'No se pudo guardar. Intenta de nuevo en un momento.' };
  }
  return pagina({ id: e.id, clave: e.clave, reglas: e.reglas, resultado, codigo });
}

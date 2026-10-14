/**
 * OPCIONAL: agrega a tu hoja un menú "Tarjetas → Publicar cambios ahora".
 * Al presionarlo, avisa a GitHub para que reconstruya las páginas YA,
 * sin esperar la actualización de cada hora.
 *
 * Este código NO está en el camino del cliente final: solo lo usas tú al editar.
 *
 * Instalación:
 *  1. En tu hoja: Extensiones → Apps Script. Pega este código y guarda.
 *  2. Cambia GITHUB_USUARIO y GITHUB_REPO si es necesario.
 *  3. En Apps Script: ícono de engranaje (Configuración del proyecto) →
 *     "Propiedades de la secuencia de comandos" → Agregar propiedad:
 *       Nombre: GITHUB_TOKEN     Valor: (tu token de GitHub, ver la guía)
 *  4. Recarga la hoja. Aparecerá el menú "Tarjetas".
 */

const GITHUB_USUARIO = 'Eduardoksc';
const GITHUB_REPO = 'tarjetas-digitales';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Tarjetas')
    .addItem('Publicar cambios ahora', 'publicarAhora')
    .addToUi();
}

function publicarAhora() {
  const ui = SpreadsheetApp.getUi();
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) {
    ui.alert('Falta el token de GitHub. Revisa el paso de instalación en la guía.');
    return;
  }

  const respuesta = UrlFetchApp.fetch(
    'https://api.github.com/repos/' + GITHUB_USUARIO + '/' + GITHUB_REPO + '/dispatches',
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      payload: JSON.stringify({ event_type: 'actualizar-hoja' }),
      muteHttpExceptions: true,
    }
  );

  const codigo = respuesta.getResponseCode();
  if (codigo === 204) {
    ui.alert('Listo. Los cambios estarán publicados en unos 2 a 6 minutos.');
  } else {
    ui.alert('No se pudo avisar a GitHub (código ' + codigo + '). Revisa el token y el nombre del repositorio.');
  }
}

// Contador de visitas y toques (Cloudflare Pages Functions + base de datos D1).
// No guarda direcciones IP ni datos de la persona: solo suma 1 en la fila de esa hora.
// Si la base de datos no está conectada (variable CONTADOR), la tarjeta funciona igual y no se cuenta nada.

const SLUG = /^[a-z0-9][a-z0-9-]{0,40}$/;
// Vistas previas de WhatsApp, buscadores y robots: no son clientes
const ROBOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|skype|curl|wget|python|headless|lighthouse/i;

let tablaLista = false;

export const slugValido = (s) => SLUG.test(s ?? '');
export const esRobot = (request) => ROBOT.test(request.headers.get('user-agent') ?? '') || request.headers.get('purpose') === 'prefetch' || request.headers.get('sec-purpose')?.includes('prefetch');

// Hora de Colombia (UTC-5, sin horario de verano)
function momento() {
  const d = new Date(Date.now() - 5 * 3600 * 1000);
  return { dia: d.toISOString().slice(0, 10), hora: d.getUTCHours() };
}

export async function contar(env, { id, tipo, boton = '', origen = '' }) {
  const db = env.CONTADOR;
  if (!db) return;
  try {
    if (!tablaLista) {
      await db.exec(
        'CREATE TABLE IF NOT EXISTS eventos (dia TEXT NOT NULL, hora INTEGER NOT NULL, id TEXT NOT NULL, tipo TEXT NOT NULL, boton TEXT NOT NULL, origen TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (dia, hora, id, tipo, boton, origen))'
      );
      tablaLista = true;
    }
    const { dia, hora } = momento();
    await db
      .prepare('INSERT INTO eventos (dia, hora, id, tipo, boton, origen, n) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1) ON CONFLICT (dia, hora, id, tipo, boton, origen) DO UPDATE SET n = n + 1')
      .bind(dia, hora, id, tipo, boton, origen)
      .run();
  } catch (e) {
    console.log('contador: ' + e.message); // nunca rompe la tarjeta
  }
}

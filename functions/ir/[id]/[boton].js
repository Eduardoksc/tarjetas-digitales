// /ir/<id>/<botón>: suma un toque y lleva al enlace real de ese botón.
// Solo lleva a los enlaces que el robot escribió en /<id>/enlaces.json: no sirve para mandar a otra página cualquiera.
import { contar, esRobot, slugValido } from '../../../servidor/contador.js';

const BOTON = /^[a-z0-9_]{1,20}$/;

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const id = String(params.id ?? '');
  const boton = String(params.boton ?? '');
  const inicio = new URL(slugValido(id) ? `/${id}/` : '/', request.url);
  if (!slugValido(id) || !BOTON.test(boton)) return Response.redirect(inicio, 302);

  let destino = '';
  try {
    const r = await env.ASSETS.fetch(new URL(`/${id}/enlaces.json`, request.url));
    if (r.ok) destino = (await r.json())[boton] ?? '';
  } catch {
    destino = '';
  }
  // Solo https (el robot ya los limpió con urlSegura); cualquier otra cosa vuelve a la tarjeta
  if (!/^https:\/\//.test(destino)) return Response.redirect(inicio, 302);

  if (!esRobot(request)) context.waitUntil(contar(env, { id, tipo: 'toque', boton }));
  return new Response(null, { status: 302, headers: { Location: destino, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

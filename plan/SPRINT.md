# Sprint actual

Un sprint es una vuelta corta (una semana) que termina con algo que ya se puede probar. Solo hay un sprint abierto a la vez.

## Sprint 1: cerrar el MVP

**Del 23 al 29 de noviembre de 2026.**

**Meta:** que cualquier QR impreso, viejo o nuevo, abra la tarjeta correcta, que todo esté probado en un celular real y que se cierren los riesgos de seguridad que encontró la auditoría.

| # | Tarea | Quién | Estado |
|---|---|---|---|
| B01 | Redirigir los QR viejos de `github.io` | Claude | Pendiente |
| S1 | Sacar `panel.json` de la copia de GitHub Pages (con B01) | Claude | Pendiente |
| S2 | Token del botón de la hoja con permiso mínimo | Claude + Eduardo | Pendiente |
| S3 | Límite de pedidos y "fail open" en Cloudflare | Eduardo | Guía lista; falta hacerlo |
| S4 | Revisar editores de la hoja y fuerza de las claves de panel | Eduardo | Pendiente |
| B02 | Probar el formulario en un celular real | Eduardo | Pendiente |
| B03 | Probar la vista previa al compartir por WhatsApp | Eduardo | Pendiente |
| B04 | Probar un hablador con QR y NFC | Eduardo | Pendiente |

**Cómo se prueba al final:**
- Escanear un QR viejo y uno nuevo.
- Comprobar que `<github.io>/001/panel.json` ya no existe.
- Publicar con el botón nuevo de la hoja.
- Enviar una solicitud desde el formulario.
- Ver las visitas en el panel de `001`.

## Sprint 2 (siguiente): diseño con Hallmark

**Del 30 de noviembre al 6 de diciembre de 2026.** Empieza solo cuando cierre el sprint 1.

**Meta:** una segunda opinión de diseño sobre las tarjetas y el sitio, y aplicar lo que apruebes sin romper las reglas de las tarjetas.

| # | Tarea | Dónde | Quién |
|---|---|---|---|
| D0 | Preparar Hallmark (copiarla a `.claude\skills`, capturas, `.gitignore`) | Tu equipo | Claude |
| D1 | Auditoría de las tarjetas Mostrador y Premium | `tarjetas-digitales` | Claude |
| D2 | Pulido aprobado de las tarjetas, más W1 y W2 | `tarjetas-digitales` | Claude |
| D3 | Auditoría del sitio fides-link.com | `sitio-web` | Claude |
| D4 | Rediseño del sitio con la marca fija y `design.md` | `sitio-web` | Claude |

**Cómo se prueba al final:**
- Las capturas de antes y después (`.hallmark/compare.html`) de una tarjeta Mostrador, una Premium y la portada del sitio.
- Las tarjetas siguen pesando unos 70 KB sin logo y se ven bien a 360 px.
- El sitio no inventa cifras ni testimonios.

D5 (panel) y el resto del backlog quedan para un sprint posterior.

## Cómo trabajar un sprint con Claude

1. **Al empezar la sesión:** "Lee `plan/SPRINT.md` y sigamos con la siguiente tarea pendiente."
2. **Una tarea por sesión.** Si se te ocurre otra cosa, di "anótala en el backlog" y sigue con la del sprint.
3. **Al terminar una tarea:** Claude marca **Hecho** aquí y en el [BACKLOG](BACKLOG.md).
4. **Al cerrar el sprint:** se revisa la meta, lo que quedó pendiente vuelve al backlog y se arma el sprint siguiente con las primeras tareas de la lista.

## Sprints anteriores

Ninguno todavía.

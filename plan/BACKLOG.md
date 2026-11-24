# Backlog: todo lo que falta, ordenado por importancia

Cada tarea es chica (una sesión de Claude o una tarde tuya). Las de arriba van primero. Una idea nueva entra aquí con su número; no se trabaja hasta que llegue su turno en un [sprint](SPRINT.md).

Estados: **Pendiente**, **En sprint**, **Hecho**. Quién: **Claude** (código) o **Eduardo** (algo que solo tú puedes hacer).

Las tareas **S** salen de la auditoría de seguridad de Cloudflare y las **W**, de la guía Modern Web Guidance de Google, ambas del 22 nov 2026 (ver PRD, sección 7). Las **D** son de diseño con Hallmark (PRD, sección 8). Los detalles técnicos no están aquí, porque el repositorio es público.

## Prioridad 1: cerrar el MVP

| # | Tarea | Quién | Estado |
|---|---|---|---|
| B01 | Los QR viejos de `eduardoksc.github.io/tarjetas-digitales/<id>/` llevan a `t.fides-link.com/<id>/`. Idea: en la copia de GitHub Pages, cada tarjeta redirige sola. | Claude | Pendiente |
| S1 | La copia de GitHub Pages deja de publicar los `panel.json` (va junto con B01). | Claude | Pendiente |
| S2 | El botón "Publicar cambios ahora" usa un token que solo dispara la publicación (`workflow_dispatch`, permiso Actions), no uno que puede escribir en el repositorio. Claude cambia el script y la guía; tú creas el token nuevo y borras el viejo. | Claude + Eduardo | Pendiente |
| S3 | Revisar en Cloudflare: el plan, que Functions siga sirviendo las tarjetas si se acaba el cupo diario ("fail open") y una regla de límite de pedidos para las tarjetas y `/ir/`. | Eduardo (Claude te guía) | Pendiente |
| S4 | Revisar quién puede editar la hoja y que las claves de panel sean largas y al azar (cambiar las que no). | Eduardo | Pendiente |
| B02 | Probar en un celular real el formulario a WhatsApp, con y sin JavaScript (que los espacios no lleguen como `+`). | Eduardo | Pendiente |
| B03 | Probar en un chat real de WhatsApp la vista previa al compartir una tarjeta (foto, nombre, descripción). | Eduardo | Pendiente |
| B04 | Imprimir un hablador con QR (`?o=qr`) y NFC (`?o=nfc`) y comprobar en el panel que cada uno cuenta en su lugar. | Eduardo | Pendiente |
| B05 | Primera tarjeta de un cliente real de un nicho elegido, con su `clave_panel`. | Eduardo | Pendiente |
| B06 | Quitar la etiqueta "Pronto" del panel en la landing, porque ya está en línea. Se hace en la carpeta `sitio-web`. | Claude | Pendiente |
| B26 | En las visitas de venta, preguntar si pagarían por un programa de premios por visita o por compra en el celular, y anotar las respuestas en `marketing/prospectos/`. Decide si B25 sube de prioridad. | Eduardo | Pendiente |

## Fidelización (plan Cosecha): decidido el 22 nov 2026

Solo se venden **dos programas**: premios por visitas o compras, y descuento en el mes de cumpleaños. Pueden usar JavaScript (PRD, regla 2), pero la tarjeta debe seguir abriendo y funcionando aunque ese código falle.

| # | Tarea | Quién | Estado |
|---|---|---|---|
| B25 | **Premios por visitas o compras.** Diseño elegido el 23 nov 2026: **opción 1, tarjeta de sellos** (`plan/muestras/premios.html`). Cada visita es un sello con el ícono del negocio y la última casilla es el regalo. La tarjeta no dice cuál es el premio: dice "reclama tu obsequio" y cada negocio decide qué entrega (decidido el 23 nov 2026); en compras, cada sello vale un monto fijo. El cliente toca "Mis premios" (debajo de la reseña) y ve sus sellos y un código corto; el celular guarda solo un identificador al azar, sin datos personales. El empleado suma el sello en la página de caja (con su clave) y, al completar, marca el premio como entregado. El premio nunca depende de calificar. Se hace en cuatro partes: | Claude | Pendiente |
| B25a | Hoja y generador: columnas `premio`, `premio_tipo` (visitas o compras), `premio_meta` (número de sellos, máximo 12), `premio_valor_sello` (solo compras), `premio_vigencia` y `clave_caja` (12 caracteres o más, se guarda solo su huella, como `clave_panel`). Botón "Mis premios" y la hoja de sellos en Mostrador y Premium, con avisos si falta algo. | Claude | Hecho (23 nov 2026) |
| B25b | Servidor y tarjeta: tabla de premios en D1, consulta del avance por código y el JavaScript mínimo que crea el código al azar y pinta los sellos. Si falla, la tarjeta sigue igual. | Claude | Pendiente |
| B25c | Página de caja `/caja/<id>?k=`: escribir el código, sumar un sello (o el valor de la compra), entregar el premio y empezar otra tarjeta. Un sello por código al día y límite de intentos de clave. | Claude | Pendiente |
| B25d | Panel: tarjetas activas, sellos del mes, premios completados y entregados. | Claude | Pendiente |
| B31 | **Descuento en el mes de cumpleaños.** El botón abre una ventana con el premio en grande ("50% en el mes de tu cumpleaños") y sus condiciones, y pide nombre, celular y **mes** (nunca la fecha completa), con una casilla obligatoria y sin marcar de autorización de datos que enlaza a la política. Se guarda en D1 con la fecha y el texto de la autorización aceptada. Al terminar, el cliente ve "Listo: muestra esto en caja en tu mes". En el panel, pestaña "Cumpleaños": lista por mes, botón de WhatsApp con el saludo ya escrito, marcar canjeado y borrar a pedido. | Claude | Pendiente |
| B32 | **Correo mensual de cumpleañeros.** El día 1 de cada mes, un robot de Cloudflare (Cron) envía al dueño un correo con un enlace protegido por su clave a la lista del mes, descargable en PDF. Los nombres no van adjuntos al correo. Columna `correo_panel` en la hoja. Servicio de correo con plan gratuito (por ejemplo Resend). | Claude | Pendiente |
| B33 | **Pie de las tarjetas** con enlaces a "Privacidad" y "Términos" de fides-link.com, en letra pequeña para que no compita con la reseña. | Claude | Pendiente |
| B34 | **Actualizar la política de privacidad y los términos** en `sitio-web`: hoy dicen que de los clientes de un negocio no se guarda ningún dato, y con B25 y B31 deja de ser cierto. Explicar qué se guarda, quién es el responsable (el negocio), FidesLink como encargado, el identificador en el celular y cómo pedir el borrado. Antes de lanzar B25 o B31. | Claude + Eduardo | Pendiente |
| B29 | **Panel con análisis:** consejos automáticos por reglas, sin IA (bajadas y subidas de visitas, botón que nadie toca, mejor día y hora, premios ganados y cobrados, cumpleaños del mes), con una recomendación concreta por mes. La IA se evalúa después. | Claude | Pendiente |
| B30 | **Panel para PC y tablet:** hoy tiene 440 px de ancho fijo; de 768 px en adelante, las tarjetas en dos o tres columnas. Sigue pensado primero para el celular. Va con B29. | Claude | Pendiente |

**Antes de lanzar:** S3 (límite de pedidos y "fail open" en Cloudflare), porque cada inscripción y cada visita sumada escriben en la base de datos.

## Prioridad 2: seguridad y calidad web (después del MVP)

| # | Tarea | Quién | Estado |
|---|---|---|---|
| S5 | Cabeceras de seguridad en las tarjetas y el panel: CSP con la huella del script del formulario, sin encuadre en otros sitios, `nosniff`, HSTS gradual, y `script-src 'none'` para los SVG de `/logos/`. | Claude | Pendiente |
| S6 | Robot de publicación: permisos por job, `persist-credentials: false`, acciones fijadas por SHA y wrangler instalado con lockfile en lugar de `npx --yes`. | Claude | Pendiente |
| S7 | El generador también aplica a `alias` los nombres reservados (`logos`, `fonts`, `ir`, `panel`) y reserva el id de una fila inválida. | Claude | Pendiente |
| S8 | Límites en la lectura del `.xlsx` (tamaño descomprimido y rango de celdas) y aviso cuando un vínculo con nombre reemplaza otra URL visible. | Claude | Pendiente |
| S9 | Siguiente auditoría (perfil `standard`) con lo que quedó sin revisar: URLs viejas de cada despliegue de Cloudflare con claves revocadas, claves en texto plano en la hoja compartida, `_routes.json` y cabeceras. | Claude | Pendiente |
| W1 | Con portada, la foto lleva `fetchpriority="high"` (es lo más grande de la página); sin portada, el logo. | Claude | Pendiente |
| W2 | La hoja del formulario no arrastra la página de atrás al desplazarse (`overscroll-behavior: contain`). | Claude | Pendiente |
| D0 | Preparar Hallmark: ~~copiarla a `.claude\skills`~~ (hecho el 22 nov 2026), instalar `puppeteer-core` solo para las capturas y agregar `.hallmark/` a `.gitignore`. | Claude | En parte |
| D1 | `/hallmark audit` de las tarjetas Mostrador (`dist/001/`) y Premium (`dist/002/`) a 360 y 390 px, con el informe comparado contra `ux-tarjetas` y `taste`. | Claude | Pendiente |
| D2 | Aplicar con profundidad **polish** los hallazgos de D1 que apruebes, sin romper las reglas de las tarjetas (PRD, sección 8). Junto con W1 y W2. | Claude | Pendiente |
| D3 | `/hallmark audit` del sitio fides-link.com con el servidor de Astro. Se hace en una sesión abierta en `sitio-web`. | Claude | Pendiente |
| D4 | `/hallmark redesign` del sitio (**restyle** con la marca fija, o **full** si D3 lo justifica) y `design.md` del sistema. En `sitio-web`. | Claude | Pendiente |
| D5 | `/hallmark audit --scope app` del panel de resultados. | Claude | Pendiente |
| B07 | Prueba automática mínima: construir con `ejemplo-negocios.csv` y fallar si cambia la cantidad de páginas o aparecen avisos nuevos. | Claude | Pendiente |
| B08 | Que un texto de la hoja con `{{ALGO}}` no se reemplace por otro token (reemplazo en una sola pasada). | Claude | Pendiente |
| B09 | Limpiar los logos SVG antes de publicarlos (complementa S5). | Claude | Pendiente |
| B10 | Que el robot solo publique si la hoja cambió, no cada 10 minutos. | Claude | Pendiente |
| B12 | Probar los vínculos con nombre con una exportación real de Google Sheets. | Claude | Pendiente |
| B13 | Dividir `generar.mjs` (1.658 líneas) en archivos por tema: colores, íconos, logos, hoja y formulario. | Claude | Pendiente |

B11 (permisos del token de Apps Script) quedó dentro de S2.

## Prioridad 3: después del MVP, si un cliente lo pide

Están fuera del alcance en el [PRD](PRD.md). Se mueven arriba solo con una razón de un cliente real.

| # | Tarea | Condición para empezarla |
|---|---|---|
| B20 | Resumen mensual por WhatsApp | Que haya clientes con panel. Mientras tanto, a mano. |
| B21 | Bandeja de solicitudes (ver y gestionar citas) | 5 de 20 negocios dicen que pagarían por ella. |
| B22 | Promociones con fecha de vencimiento | Que un cliente la pida. |
| B23 | Botón "guardar contacto" | Que un cliente la pida. |
| B24 | Wi-Fi directo, factura electrónica, cuenta de mesa | Que un cliente la pida. |
| B27 | **(No se vende por ahora.)** **Referidos con descuento:** botón "Recomiéndanos" que comparte la tarjeta por WhatsApp con un enlace propio de cada cliente (código al azar, sin datos personales). Cuando un amigo abre la tarjeta con ese enlace, el contador lo registra; cada amigo que llega suma 5% de descuento para quien recomendó, hasta 20%. El cliente ve su porcentaje en "Mis beneficios" y el negocio lo comprueba con su clave en el mostrador. | Plan Cosecha (mensual). Decidido el 22 nov 2026. |
| B28 | **(No se vende por ahora.)** **Recordatorio de próxima cita:** botón que agrega al calendario del celular un aviso a los N días ("Hora de tu corte en …"), con un archivo de calendario estático por negocio. Sin JavaScript. Columna nueva `recordatorio_dias`. | Plan Cosecha. |

## Descartado

| Idea | Por qué |
|---|---|
| Animaciones escalonadas con `sibling-index()` (sugerencia de Google) | No es "Widely available"; rompería la regla de celulares viejos. |
| Cambiar la hoja del formulario a `<dialog>` nativo | Necesita JavaScript para abrir y la tarjeta debe funcionar sin él. La hoja actual ya cumple foco, Escape y `aria-modal`. |

## Hecho

Lo que se termine en cada sprint baja aquí, con la fecha.

| # | Tarea | Fecha |
|---|---|---|
| — | MVP de la tarjeta, contador y panel (ver el PRD, sección 4) | 11 nov 2026 |
| — | Auditoría de seguridad (Cloudflare) y revisión web (Google) | 22 nov 2026 |
| B25a | Mis premios: columnas, pieza y hoja de sellos en los dos temas, `caja.json` protegido (fuera del sprint 1, a pedido de Eduardo) | 23 nov 2026 |
| B35 | Íconos nuevos para los botones: regalo, cumpleaños, premio, VIP, sellos, descuento, café, corazón, compartir y mascotas, con sus palabras en español | 23 nov 2026 |

# PRD: qué tiene que hacer FidesLink Tarjetas

Fecha: 22 de noviembre de 2026. Borrador para que Eduardo lo apruebe o lo corrija.

Este documento dice **qué tiene que hacer** el producto y **qué queda fuera por ahora**. Si una idea nueva no está aquí, va al [BACKLOG](BACKLOG.md) y espera su turno: no se construye "porque se ocurrió hoy".

Los precios y la estrategia de venta no van aquí, porque este repositorio es público. Están en `Tarjetas/marketing/precios/`.

## 1. El problema

Los negocios de barrio (barberías, salones, parroquias, consultorios, conjuntos) viven de las reseñas de Google y de WhatsApp. Pero el cliente que está frente al mostrador no sabe dónde calificar, ni tiene a mano el WhatsApp, el catálogo o el Wi-Fi.

## 2. La solución

Una tarjeta digital por negocio que el cliente abre con un QR o un chip NFC. Su trabajo principal es **convertir la visita en una reseña de Google**. Además, junta los botones del negocio y le cuenta al dueño cuántas personas la usaron.

## 3. Para quién

| Persona | Qué necesita |
|---|---|
| **Cliente final** | De pie, con un celular viejo y mala señal, abrir la tarjeta en segundos y calificar o escribir. |
| **Dueño del negocio** | Más reseñas, verse profesional y saber si la tarjeta sirve. No administra nada. |
| **Operador (Eduardo)** | Crear o cambiar una tarjeta llenando una fila de Google Sheets, sin programar. |

## 4. El MVP: la versión más chica que ya le sirve a alguien

El MVP es **lo que hoy se vende en fides-link.com sin la etiqueta "Pronto"**. Está casi todo construido:

| Función | Estado |
|---|---|
| Tarjeta desde una fila de la hoja, publicada sola cada 10 minutos | Hecho |
| Reseña de Google como acción principal | Hecho |
| Hasta 8 botones (WhatsApp, catálogo, llamar, correo, páginas) | Hecho |
| Formulario de citas o pedidos que llega por WhatsApp | Hecho |
| Wi-Fi, redes sociales, portada y logo con colores automáticos | Hecho |
| Temas Mostrador y Premium | Hecho |
| Dirección propia `t.fides-link.com/<negocio>/` | Hecho |
| Contador de visitas y toques, con QR o NFC | Hecho |
| Panel de resultados para el dueño | Hecho, en línea |
| Los QR viejos de `github.io` llevan a `t.fides-link.com` | **Falta** |
| Probado en un celular real (formulario y vista previa al compartir) | **Falta** |
| Los cuatro arreglos de seguridad de la auditoría del 22 nov 2026 (sección 7) | **Falta** |

**El MVP está terminado cuando** las filas que faltan estén hechas y una tarjeta de un cliente real lleve un mes funcionando sin arreglos a mano.

## 5. Qué queda fuera por ahora

No se construye hasta que el MVP esté terminado y un cliente real lo pida:

- **Resumen mensual por WhatsApp.** La landing lo promete como "Pronto". Mientras no exista, se envía a mano.
- **Bandeja de solicitudes** (ver y gestionar citas). Solo si 5 de 20 negocios dicen que pagarían por ella.
- **Factura electrónica, cuenta de mesa y "Wi-Fi directo".**
- **Promociones con fecha de vencimiento y "guardar contacto".**
- **Más temas de diseño.**
- **Otros programas de fidelización** (recomendados con descuento, recordatorio de cita, club, regalos). Por ahora solo se venden dos: premios por visitas o compras, y descuento en el mes de cumpleaños (plan Cosecha, ver el [BACKLOG](BACKLOG.md)). Sin juegos de azar, que en Colombia son juegos promocionales vigilados por Coljuegos, y el premio nunca depende de dejar una reseña (regla de Google).
- **Datos de salud o de tarjetas de crédito en los formularios:** no se recogen nunca, por las reglas del plan gratuito de Cloudflare.

## 6. Reglas que no se negocian

Están en detalle en [CLAUDE.md](../CLAUDE.md). En resumen:

1. La reseña manda: nada compite con ella.
2. Funciona en el peor celular con la peor señal: cero JavaScript, salvo el formulario y, desde el 22 nov 2026, los dos programas de fidelización (premios y cumpleaños). Ese código solo se carga en las tarjetas que tienen el programa activo, y si falla o no carga, la tarjeta sigue abriendo con la reseña y los botones.
3. Una fila de la hoja basta: nada exige diseño manual por negocio.
4. No se guardan datos de las personas. **Única excepción (decidida el 22 nov 2026):** el módulo Beneficios del plan Cosecha (B31) guarda nombre, celular y mes de cumpleaños de quien se inscribe, solo con su autorización expresa, para que el negocio los vea en su panel. El negocio es el responsable de esos datos y FidesLink el encargado (Ley 1581 de 2012); hay aviso de privacidad y se borran a pedido. **Segunda excepción (decidida el 27 nov 2026, B36):** en Mis premios, el empleado puede guardar en caja el celular del cliente, con su autorización (queda registrada la fecha y la hora), solo para recuperar su tarjeta de sellos si pierde el código. Nunca se publica, no se usa para promociones sin otra autorización y se borra a pedido.
5. Las estrellas nunca se muestran llenas.

## 7. Seguridad y calidad web: lo que se exige

Sale de dos revisiones del 22 de noviembre de 2026: la auditoría de seguridad de Cloudflare (skill `security-audit`, pasada rápida) y la guía Modern Web Guidance de Google Chrome. El informe completo **no está en este repositorio, porque es público**: está en `C:\Users\kike\security-audit-skill\tarjetas-digitales\run-1\`.

**Lo que ya cumple el código:**
- todo texto de la hoja se escapa y todo enlace se limpia;
- `/ir` no lleva a cualquier sitio;
- el SQL usa parámetros;
- la clave del panel nunca se guarda;
- no hay secretos en el código ni en el historial.

**Plantillas:** siguen casi todas las reglas de Google:
- fuentes de respaldo estables;
- `dvh` con respaldo;
- zonas seguras del celular;
- botones de 48 px.

**Lo que se exige de ahora en adelante:**
1. **Cada credencial tiene solo el permiso que necesita.** El botón de la hoja solo puede disparar la publicación, no escribir en el repositorio.
2. **Ningún dato del panel se publica donde no hay control de acceso.** Nada de `panel.json` en la copia de GitHub Pages.
3. **Un visitante no puede gastar el cupo gratuito de todos.** Hay un límite de pedidos en Cloudflare, y si el cupo se acaba, las tarjetas siguen abriendo.
4. **Las páginas llevan cabeceras de seguridad:** CSP, sin encuadre en otros sitios y `nosniff`, también para los logos SVG.
5. **Compatibilidad:** se mantiene "solo CSS ampliamente soportado" (Baseline Widely available). Las ideas de Google que solo son "Newly available", como `sibling-index()`, se descartan si no traen respaldo.

## 8. Diseño con Hallmark

Hallmark es una skill de diseño que evita que una página "se vea hecha por IA". Pone un piso de reglas que no se negocian (todo color y fuente en tokens, foco visible, movimiento reducido, nunca inventar cifras ni testimonios) y tiene un linter (`sloplint`) que toma capturas y marca los "tics" de página generada.

**Cómo se usa en un diseño que ya existe:** Hallmark solo actúa sobre lo existente si se le nombra:
- `/hallmark audit <ruta>`: solo informa, no cambia nada.
- `/hallmark redesign <ruta>`, en tres profundidades:
  - **polish:** solo corrige lo que el linter marca;
  - **restyle:** mantiene la distribución y cambia colores, tipos y controles;
  - **full:** rehace la composición y conserva el contenido y los enlaces.

### Tarjetas: auditoría y pulido, nunca rediseño completo

Las tarjetas ya tienen un sistema cuidado (Mostrador y Premium, las skills `ux-tarjetas`, `taste`, `estetica-premium` y `micro-interacciones`). Hallmark entra como **segunda opinión**:

1. `/hallmark audit` sobre `dist/001/` (Mostrador) y `dist/002/` (Premium), a 360 y 390 px.
2. De lo que encuentre, solo se aplica lo que apruebes, con profundidad **polish**.

**Si Hallmark choca con las reglas de las tarjetas, ganan las reglas de las tarjetas (CLAUDE.md):**
- Cero JavaScript, salvo el formulario.
- Solo CSS ampliamente soportado (celulares viejos).
- El color de la marca va solo arriba.
- Nada de degradados entre la foto y el color.
- Las estrellas nunca van llenas.
- Unos 70 KB sin logo.

**Reglas de Hallmark que no aplican tal cual a las tarjetas:**
- La regla del primer pantallazo a 1280 × 800 es de escritorio; las tarjetas son de celular.
- `overflow-x: clip` no existe en Android viejos: se usa con respaldo o no se usa.
- La marca de Hallmark en la primera línea del CSS se acepta, pero corta.

### Sitio web (fides-link.com): donde Hallmark rinde más

Hallmark está hecho para sitios y landings. Se usa en la carpeta `sitio-web`, en su propia sesión:

1. `/hallmark audit` con el servidor de Astro corriendo (`--url`), página por página.
2. `/hallmark redesign` con profundidad **restyle** y la marca FidesLink fija (`--brand`: logo, colores y tipos de `MARCA.md`), o **full** si la auditoría muestra que la composición es el problema.
3. `lock the system`: escribir un `design.md` para que todas las páginas compartan el mismo sistema.

Sus reglas encajan con lo que ya pide el sitio: nunca inventar testimonios, cifras ni logos de clientes, porque todavía no hay casos reales, y una sola idea por pantalla.

### Panel de resultados

Es una "pantalla de app" para Hallmark (`--scope app`). Se audita después del sitio.

### Requisitos para usarla

- **Instalación:** quedó en `C:\Users\kike\.agents\skills\hallmark`. Claude Code solo carga skills desde `.claude\skills`: hay que copiarla allí para que funcione `/hallmark`.
- **Capturas:** `sloplint --render` necesita `puppeteer-core` y Chrome. Sin eso, el linter revisa solo el código.
- **Imágenes generadas:** no se configura `TOGETHER_API_KEY`. Las imágenes y comps generados se envían a un servicio externo (Together AI), y las fotos de las tarjetas son las del negocio.
- **Archivos de Hallmark:** la carpeta `.hallmark/` que crea en cada proyecto se agrega a `.gitignore` en las tarjetas, porque el repositorio es público.

## 9. Cómo se mide el éxito

- Toques a "Calificar en Google" por mes, en el panel de cada negocio.
- Que los primeros 5 clientes sigan con la tarjeta después de 3 meses.
- Horas por cliente: si armar una tarjeta toma más de 2 horas, hay que simplificar.

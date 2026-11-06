# Brief de diseño de las tarjetas

Describe la tarjeta **como está hoy** en la carpeta del proyecto, incluido el rediseño con foto limpia, toldo y mosaico, que aún no se ha publicado. Es el punto de partida para seguir mejorándola con ejemplos.

Hay dos temas. Cada bloque describe primero **Mostrador**, el tema por defecto. **Premium** se activa con `estilo` = `premium`.

## Estética

- **Mostrador:** minimalista con la marca arriba — foto limpia, toldo de color, logo montado, tiquete elevado, mosaico tipo app, tipografía contundente, fondo claro neutro.
- **Premium:** lujo nocturno — negro profundo, oro metálico, satinado, medallón, sobrio, silencioso.

## Referencia

- **Estado actual:** [BA CU](https://eduardoksc.github.io/tarjetas-digitales/003/), [De Quei Matti](https://eduardoksc.github.io/tarjetas-digitales/004/) y [La Spaghettata](https://eduardoksc.github.io/tarjetas-digitales/005/). Estos enlaces muestran la versión publicada, todavía sin las mejoras de este brief.
- **Referencias externas:** Starbucks (foto y logo montado) y la hoja de botones con brillo (forma de píldora y filo de luz en el botón de reseña; el contorno dorado para Premium). De ellas se iguala la sensación y el estilo, no el contenido.

## Intención

Que el cliente, de pie frente al mostrador y con el celular en una mano, deje una reseña en Google en segundos, sin sentirse presionado. Que sienta que está en la tarjeta **de ese negocio**, no en una plantilla. Y que el dueño, al verla, quiera pagar por ella.

## Jerarquía y layout

- **Qué destaca:** la reseña, siempre. Debe verse completa sin hacer scroll en un celular de 360 × 800.
- **Mostrador**, columna única centrada (máximo 440 px), con todo centrado, de arriba abajo:
  1. Foto limpia con corte neto, si hay. El toldo del color de la marca sube sobre ella con esquinas redondeadas y el logo montado en el borde. Luego nombre, slogan y titular. Sin foto, el titular es más grande. El borde inferior del toldo es curvo.
  2. Tiquete blanco con sombra, montado entre el toldo y el fondo claro: "G" de Google, texto, 5 estrellas vacías, botón "Calificar en Google →" y nota.
  3. Primera acción a todo el ancho, llena del color de la marca.
  4. Demás acciones en mosaico de dos columnas, blancas, con el ícono arriba. Si una queda sola, va a todo el ancho.
  5. Wi-Fi desplegable, si el negocio lo tiene.
  6. Redes en círculos del color de la marca y pie opcional.
- **Premium**, misma estructura HTML (máximo 480 px): medallón o cápsula del logo, titular con línea dorada, reseña como pieza de oro, acciones en botones cuadrados en cuadrícula y redes en círculos satinados.

## Sistema visual

| | Mostrador | Premium |
|---|---|---|
| **Tipografía** | Unbounded 800 (titular, `clamp(32px, 9.6vw, 44px)` con foto y `clamp(36px, 11vw, 50px)` sin foto) y Figtree 500 y 700 (resto) | Inter 400 y 600 |
| **Fondo** | Toldo del color de la marca; abajo, `#f5f5f4` con piezas blancas | Negro `#0d0d0d` con un brillo radial cálido arriba |
| **Texto** | Blanco o negro sobre el toldo (`--sobre`); abajo, tinta y gris teñidos (`--tinta`, `--gris`) | Marfil `#f4efe6` y `#a8a196` |
| **Color protagonista** | `--marca`, de la columna `color` | Oro: `#d4b06a` y degradado `#eacaa6` → `#9a7b33`. No usa el color del negocio |
| **Color secundario** | `--acento`, sacado solo del logo | No aplica |
| **Bordes** | Línea de 1 px (`--regla`); radios de 28 px (toldo), 24 px (tiquete), 18 px (mosaico) y píldora (botón de reseña). Sombra del tiquete en dos capas, teñida con la marca | Filo dorado de 1 px (`--linea`); radios de 16 px (botones) y 20 px (reseña) |
| **Espaciado** | Margen lateral de 22 px; separación de 10 px; piezas de 100 px en mosaico y 64 px a lo ancho | Margen lateral de 24 px; botones de 100 px de alto |
| **Iconografía** | Trazo de 1.8 en cuadro de 24; marcas oficiales rellenas (`iconos.mjs`); el ícono va en un círculo de 44 px, teñido con la marca | Trazo de 1.6 en oro, sin cuadro |

Decisión abierta: Premium sigue con Inter, que el detector de Impeccable marca como tipografía demasiado común. Mostrador ya pasó a Figtree.

## Restricciones

**Siempre:**

- La tarjeta se arma sola desde una fila de Google Sheets, sin diseño manual por negocio.
- Aguanta cualquier color y cualquier logo: contraste AA, con texto a 4.5:1 y texto grande e íconos a 3:1.
- Áreas táctiles de 48 px o más.
- Peso menor a 100 KB sin logo ni portada; fuentes servidas desde el propio sitio.
- Español sencillo, tuteando.
- Textos y enlaces de la hoja pasan por `esc()` y `urlSegura()`.
- Las dos plantillas comparten la estructura HTML.

**Nunca:**

- Estrellas llenas ni textos que sugieran una calificación.
- Nada que iguale a la reseña en tamaño o posición.
- JavaScript en el cliente (regla actual, se puede revisar).
- `opacity` en textos.
- Google Fonts ni peticiones a terceros.
- WebP en logos.
- La "G" de Google modificada.
- Difuminados o degradados entre la foto y el color.

## Comportamiento

- **Responsive:** diseñada para celular, revisada a 360 y 390 px; en pantallas grandes es la misma columna centrada. Respeta las zonas seguras del celular.
- **Entrada (Mostrador):** la página aparece ya lista y solo el tiquete se posa. La ola de las estrellas termina en una luz que recorre una vez el botón de reseña, todo antes de 0.85 s. Las estrellas vuelven a quedar vacías.
- **Al tocar (Mostrador):** respuesta inmediata. La pieza se hunde a `scale(.975)`, el ícono se llena y la flecha avanza 4 px; el tiquete se encoge a `scale(.985)` y su botón se oscurece; los círculos se encogen a `scale(.92)` con un aro.
- **Al tocar (Premium):** `scale(.98)` y el filo dorado se aviva.
- **Hover:** solo con mouse (`hover: hover` y `pointer: fine`), con la misma respuesta más suave. Las estrellas no se llenan.
- **Wi-Fi:** se abre y se cierra con `<details>`, y un toque selecciona la clave.
- **Movimiento reducido:** con `prefers-reduced-motion` no hay entrada, ola ni luz, ni desplazamientos. Se mantienen los cambios de color que confirman el toque.

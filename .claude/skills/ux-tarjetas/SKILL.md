---
name: ux-tarjetas
description: Reglas de experiencia de usuario para las tarjetas digitales (temas Mostrador y Premium). Úsala siempre que cambies plantilla.html, el HTML o CSS que genera generar.mjs, textos por defecto, íconos o botones, o cuando el usuario pida mejorar, revisar o evaluar cómo se ve o se usa una tarjeta. Exige revisar la página generada a 360 px y 390 px de ancho antes de dar una mejora por buena.
---

# UX de las tarjetas digitales

## Quién la usa y dónde

La persona tiene el **celular en una mano**, de pie frente a un **mostrador**, una mesa o una caja. Acaba de escanear un QR o de acercar el teléfono a un NFC. Tiene pocos segundos, quizás mala señal y quizás un celular viejo. No va a leer párrafos ni a explorar la página.

**La acción principal es dejar la reseña en Google.** Todo lo demás (WhatsApp, catálogo, redes) es secundario y no debe competir con ella.

## Reglas

1. **Una mano, celular primero.**
   - Diseña para 360 a 390 px de ancho.
   - La reseña debe verse completa en la primera pantalla, sin hacer scroll.
   - Nada depende de hover, de gestos de dos dedos ni de la orientación horizontal.
2. **La reseña manda.**
   - Es el bloque más grande y el primero que se puede tocar.
   - Ningún otro botón puede igualarla en tamaño, color o posición.
   - Si un cambio agrega elementos arriba de la reseña, justifícalo.
3. **Áreas táctiles de al menos 48 × 48 px**, con al menos 8 px de separación entre elementos tocables. Eso incluye el enlace del pie y cualquier botón nuevo, no solo las teclas.
4. **Contraste mínimo WCAG AA.**
   - Texto normal: 4.5:1. Texto grande (≥ 24 px, o ≥ 18.66 px en negrita): 3:1. Íconos y bordes que dan información: 3:1.
   - Calcúlalo con el color **final** que se ve. `opacity` y `rgba` aclaran el texto: hay que mezclar con el fondo antes de medir.
   - Pruébalo con varios colores de negocio: uno claro (amarillo, `#f2d16b`), uno medio (`#ad6225`) y uno oscuro (`#1f6f5c`). El color lo elige el negocio, no tú.
5. **Sin JavaScript**, salvo que sea indispensable y no exista alternativa en HTML o CSS. Si lo agregas:
   - Explica por qué en la respuesta.
   - La página debe funcionar igual si el script no carga.
6. **Carga rápida: peso total bajo 100 KB sin contar el logo.** Eso incluye el HTML, la tipografía y cualquier otro recurso.
   - Hoy la página publicada pesa unos 10.6 KB de HTML más 21.8 KB de fuente, cerca de 32 KB.
   - Nada de librerías, CDNs, Google Fonts, imágenes decorativas ni peticiones a terceros (la "G" de Google ya va en línea como SVG).
7. **Textos cortos, en español claro.**
   - Tutea con calidez: "Escríbenos", "Cómo llegar".
   - Unos 16 caracteres por botón cuadrado y unos 32 en el titular.
   - Sin tecnicismos ni inglés innecesario.
   - Ortografía completa: tildes y signos de apertura `¿ ¡`, sin espacios dentro.
   - El mensaje de WhatsApp lo escribe **el cliente al negocio**, no al revés.
8. **Movimiento con respeto.** Toda animación o transición nueva necesita su versión en `@media (prefers-reduced-motion: reduce)`, que la quite o la deje en su estado final.
9. **Jerarquía visual clara y carga cognitiva baja.**
   - Mucho aire entre bloques: es mejor quitar un elemento que apretarlo.
   - Elimina los textos redundantes. Por ejemplo, el nombre del negocio repetido justo debajo de un logo que ya lo dice, o una nota que repite lo que dice el botón.
   - Cada pantalla tiene una sola cosa que destaca: la reseña.
10. **Respeta el tema activo.** El tema por defecto es **"Mostrador luminoso"** (`plantilla.html`, descrito en `CLAUDE.md`): papel cálido, tiquete de reseña con franja del color del negocio, acciones en filas y redes en círculos. Los negocios con `estilo` = `premium` usan **Premium** (`plantilla-premium.html`), que sigue la skill `estetica-premium`. Un cambio en la estructura HTML va en las dos plantillas, y se verifica en las dos.
11. **La reseña no presiona.** Las estrellas se muestran vacías; nunca llenas ni preseleccionadas. Tampoco se usan textos que sugieran una calificación ("¡Danos 5 estrellas!").
12. **Interacciones:** cualquier estado interactivo o animación sigue la skill `micro-interacciones`.

## Verificación obligatoria antes de dar una mejora por buena

No digas que una mejora está lista sin hacer estos pasos y reportar el resultado de cada uno.

1. **Construir:** `SHEET_CSV_FILE=ejemplo-negocios.csv node generar.mjs` (en PowerShell: `$env:SHEET_CSV_FILE="ejemplo-negocios.csv"; node generar.mjs`).
   - No debe aparecer ningún ⚠ nuevo que no se explique por el cambio.
   - Si el cambio depende de un caso que el CSV de ejemplo no cubre (5 botones, un logo claro, un color amarillo), usa un CSV temporal en el scratchpad y no modifiques `ejemplo-negocios.csv`.
2. **Peso:** suma lo que pesan `dist/<id>/index.html` y `dist/fonts/*`. Debe dar menos de 100 KB.
3. **Revisión visual a 360 px y a 390 px de ancho** (alto de unos 800 y 844 px), con captura de pantalla en ambos anchos.
   - **Para cambios locales sin publicar:** construye primero y después usa `preview_start` con el nombre `tarjetas-dist` (definido en `.claude/launch.json`). Sirve `dist/` en `http://localhost:4173/<id>/` con Python. Como sirve la carpeta en vivo, basta con reconstruir y recargar la página. El navegador integrado no abre `file://` ni servidores que Claude arranque por su cuenta con Bash.
   - **Para lo que ya está publicado:** `https://eduardoksc.github.io/tarjetas-digitales/<id>/`.
   - Ajusta el ancho con `resize_window` (ancho y alto personalizados) y vuelve a `desktop` al terminar.
4. **Qué revisar en cada captura:**
   - La reseña cabe completa sin scroll.
   - Nada se desborda ni se corta horizontalmente.
   - Los textos largos no rompen el diseño.
   - Los botones miden ≥ 48 px. Mídelo con `getBoundingClientRect()` si hay duda.
   - El contraste del texto sobre el color del negocio cumple AA.
5. **Movimiento reducido:** confirma que el CSS nuevo tiene su regla dentro de `prefers-reduced-motion`.

Reporta el resultado como una lista corta: qué se cumplió, qué no, y las capturas de 360 px y 390 px. Si algo no se pudo verificar (por ejemplo, no hubo forma de ver la página), dilo con claridad en vez de darlo por bueno.

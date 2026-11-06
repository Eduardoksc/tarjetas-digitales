---
name: micro-interacciones
description: Transiciones y micro-interacciones CSS para las tarjetas digitales (respuesta inmediata al tocar, :hover, :active, :focus-visible). Úsala cuando agregues o cambies botones, enlaces, estados interactivos, animaciones o transiciones en plantilla.html, en cualquier tema (Mostrador o Premium). Se usa junto con ux-tarjetas, cuya verificación sigue siendo obligatoria.
---

# Micro-interacciones

El objetivo es que cada toque se sienta **inmediato y nativo**, como una app premium, sin JavaScript y sin perder velocidad en celulares viejos.

## Reglas

1. **Todo elemento tocable tiene sus estados:** reposo, `:active` (presionado), `:focus-visible` (teclado o lector de pantalla) y `:hover` (solo en dispositivos con puntero). Ningún botón queda sin respuesta visual al tocarlo.
2. **Respuesta inmediata al presionar.**
   - La transición de entrada a `:active` debe ser corta, de 60 a 120 ms. La salida puede ser un poco más lenta (150 a 250 ms) para que se sienta suave.
   - **Tema Mostrador:** el tiquete se encoge apenas (`scale(.985)`), su botón "Calificar en Google" se oscurece y la flecha avanza 4 px. Una pieza del mosaico se hunde (`scale(.975)`) y su ícono se llena; la pieza principal se oscurece y su flecha avanza. Los círculos de redes se encogen (`scale(.92)`) y muestran un aro. Las estrellas nunca se llenan.
   - **Tema Premium:** `transform: scale(.98)` y un cambio progresivo de brillo u opacidad (por ejemplo, de `opacity: 1` a `.92`). Nada de relieves gruesos.
3. **Solo se animan propiedades baratas:** `transform`, `opacity` y, con moderación, `box-shadow`. Nunca `width`, `height`, `top`, `margin` ni `background-position` en bucle, porque traban celulares viejos.
4. **Curvas:** `cubic-bezier(.2, .8, .2, 1)` o `ease-out` para entrar, `ease` para salir. Nada de rebotes exagerados ni de `linear` en interacciones.
5. **`:hover` solo dentro de `@media (hover: hover) and (pointer: fine)`.** En celular, el hover se queda "pegado" después del toque y confunde.
6. **`:focus-visible` siempre visible:** un contorno de al menos 2 px con contraste 3:1 contra el fondo. No se quita el contorno sin poner otro.
7. **Sin JavaScript.** Todo con CSS (`transition`, `@keyframes`, pseudoclases). Quita el resaltado azul de Android con `-webkit-tap-highlight-color: transparent`, pero solo si el estado `:active` propio ya da respuesta visible.
8. **Animaciones de entrada con moderación.**
   - Como máximo una animación protagonista por página. En Mostrador, la ola de las estrellas (que vuelven a quedar vacías, nunca terminan llenas) acaba en una luz que recorre una vez el botón de reseña.
   - Ninguna animación puede retrasar la posibilidad de tocar la reseña.
   - Ninguna dura más de 600 ms en total.
9. **`prefers-reduced-motion: reduce` es obligatorio.** Toda transición o animación nueva lleva su regla ahí, que la quita o la deja en su estado final. El feedback de `:active` puede quedarse como un cambio instantáneo, sin transición.
10. **iPhone:** Safari a veces no aplica `:active` al tocar un enlace. Verifica el estado presionado en un iPhone real o en la emulación táctil. Si no responde, dilo; no agregues JavaScript sin consultarlo antes.

## Verificación

Además de la verificación de `ux-tarjetas` (360 px y 390 px):
- Revisa en el CSS que cada selector interactivo nuevo tenga `:active`, `:focus-visible` y su versión en `prefers-reduced-motion`.
- Confirma que `:hover` está dentro de la media query de puntero fino.
- Si es posible, toma una captura con el elemento en estado presionado o con foco. Si no lo es, dilo.

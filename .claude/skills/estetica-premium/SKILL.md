---
name: estetica-premium
description: Criterio estético del tema opcional "Premium" de las tarjetas (negro profundo, acentos de oro metálico, tipografía Inter, minimalismo). Úsala al diseñar, implementar o revisar el tema Premium, que se activa por negocio con la columna `estilo` = `premium`. No la apliques al tema por defecto "Mostrador". Se usa junto con ux-tarjetas y micro-interacciones.
---

# Estética Premium (tema opcional)

## Cuándo aplica

**Solo** a negocios con `estilo` = `premium` en la hoja: spas, joyerías, barberías de alta gama, restaurantes de manteles. El tema vive en `plantilla-premium.html`. El tema por defecto es **"Mostrador" con toldo de marca** (`plantilla.html`) y esta skill no lo modifica. Premium comparte su estructura HTML: la portada va como foto con filo dorado y el medallón del logo encima, y el Wi-Fi como un bloque satinado desplegable.

## Criterio

- **Minimalista, sobrio y elegante.** Cada elemento debe ganarse su lugar. Mucho aire entre bloques: el espacio vacío es parte del lujo.
- **Sin saturación ni decoración:** nada de texturas, brillos animados en bucle, bordes gruesos, sombras pesadas ni el relieve de tecla. Las esquinas son suaves (12 a 20 px de radio) y los bordes, si existen, son de 1 px.
- **El oro es acento, no relleno.** Se usa en la acción principal (reseña y estrellas), en líneas finas y en detalles. Nunca de fondo en toda la página ni en todos los botones.

## Paleta (tokens CSS)

| Token | Valor de partida | Uso |
|---|---|---|
| `--fondo` | `#0b0b0d` con un degradado radial muy sutil hacia `#16161a` | Fondo "negro profundo enriquecido" |
| `--superficie` | `#141417` | Botones secundarios y tarjetas |
| `--linea` | `rgba(212, 175, 55, .28)` | Bordes de 1 px |
| `--texto` | `#f4efe6` (marfil) | Texto principal |
| `--texto-suave` | `#b9b2a6` | Texto secundario. Sin `opacity`; verifica 4.5:1 |
| `--oro` | `linear-gradient(135deg, #f3e2a0 0%, #d4af37 45%, #a8822a 100%)` | Acento metálico |
| `--oro-solido` | `#d4af37` | Íconos, foco y alternativa cuando no se puede usar degradado |

- **Contraste AA obligatorio (regla de `ux-tarjetas`):**
  - Texto sobre oro: usa el **tono más claro** del degradado para medir. El texto sobre oro va en negro (`#0b0b0d`).
  - Texto con degradado (`background-clip: text`): mide con el **tono más oscuro** contra el fondo, y declara antes un `color` sólido de respaldo para navegadores viejos.
- **El color del negocio** no pinta el fondo en este tema. La identidad la dan el logo y, como mucho, un detalle mínimo.

## Tipografía

- **Inter**, servida desde el propio sitio con `@fontsource/inter` y copiada a `dist/fonts/` como hoy se hace con Unbounded. **Nunca** desde Google Fonts.
- Como máximo 2 pesos (por ejemplo 400 y 600), solo el subconjunto `latin`. El titular puede usar Inter 600 con `letter-spacing` negativo leve, en lugar de Unbounded.
- **Presupuesto:** la página Premium sin logo debe pesar menos de 100 KB. Mídelo; no lo supongas.

## Componentes

- **Reseña (acción principal):**
  - Bloque con borde fino de oro o fondo `--superficie` y un acento dorado.
  - Estrellas en oro sólido o degradado, que se llenan con la misma animación breve de hoy.
  - La "G" de Google va sin modificar, sobre un círculo blanco.
- **Botones secundarios:** `--superficie`, borde `--linea`, ícono en `--oro-solido` y texto `--texto`. Al presionar, aplica la micro-interacción Premium de la skill `micro-interacciones`.
- **Logo:** placa oscura o sin placa. Los logos oscuros sobre negro necesitan una placa clara sobria; la detección automática de la placa sigue aplicando.

## Verificación

Aplica la verificación completa de `ux-tarjetas` (build, peso, 360 px y 390 px, contraste) con al menos:
- un negocio Premium con logo claro;
- uno con logo oscuro;
- uno sin logo.

Confirma también que los negocios **sin** `estilo` siguen viéndose exactamente igual en Mostrador.

# CLAUDE.md

Guía para Claude Code (claude.ai/code) al trabajar en este repositorio.

## Qué es

Generador de sitio estático de **tarjetas digitales para negocios locales de Colombia**. Una hoja de Google Sheets (una fila por negocio) alimenta a `generar.mjs`, que crea una página HTML autocontenida por negocio en `dist/`. GitHub Actions la publica en GitHub Pages. El cliente final llega con un QR o NFC a `/<id>/` o `/<alias>/`.

Todo el proyecto (código, comentarios, avisos, guía) está en **español**, con nombres de variables y funciones en español. Mantén ese idioma y el tono sencillo: quien opera el sistema no es programador.

## Probar localmente

No hay pruebas automáticas ni linter. Para probar, construye el sitio con el CSV de ejemplo:

```bash
npm install                                          # sharp + tipografías Unbounded e Inter (solo la primera vez)
SHEET_CSV_FILE=ejemplo-negocios.csv node generar.mjs
```

En PowerShell: `$env:SHEET_CSV_FILE="ejemplo-negocios.csv"; node generar.mjs`

Qué esperar con `ejemplo-negocios.csv`:
- `dist/001/` y `dist/estilonorte/` (alias), con el logo SVG `estilo-norte.svg`.
- `dist/002/`, sin logo (muestra la inicial), con `logo_fondo=blanco` y `estilo=premium`.
- `dist/001/` tiene Wi-Fi para clientes y redes sociales.
- `003` está `pausado`: no se genera.
- Se generan también `dist/index.html`, `dist/404.html`, `dist/robots.txt`, `dist/fonts/` y `dist/logos/`.
- La consola muestra `✔` por negocio y `⚠` por cada problema. El resumen final cuenta páginas, pausadas y advertencias.

Para verificar un cambio, revisa la salida de consola (los avisos nuevos o perdidos) y el HTML generado. Para verla en el navegador integrado, usa `preview_start` con `tarjetas-dist` (`.claude/launch.json`), que sirve `dist/` en `http://localhost:4173/<id>/`. Fuera de Claude, `dist/001/index.html` también se puede abrir directo, porque las rutas `../fonts` y `../logos` son relativas. Revisa siempre a 360 px y 390 px de ancho: la skill `ux-tarjetas` tiene la lista de chequeo completa.

Variables útiles para pruebas:
- `LOGOS_DIR`: carpeta de logos distinta de `logos/`.
- `SHEETS_BASE`: reemplaza `https://docs.google.com` para simular la descarga.
- `SHEET_XLSX_FILE`: junto con `SHEET_CSV_FILE`, un `.xlsx` de la hoja para probar los vínculos con nombre.
- `PIE_TEXTO` / `PIE_URL`: pie de página opcional.

`fallar()` termina con código 1. Pasa si no hay hoja configurada, si faltan las columnas `id`, `estado` o `nombre`, si la hoja está vacía o si no queda **ningún negocio activo**. En ese último caso Actions no publica y el sitio anterior sigue en línea; esta protección no se debe quitar.

## Arquitectura

```
Google Sheets ──CSV──► generar.mjs ──► dist/ ──► GitHub Pages ──► QR/NFC en el celular
logos/ + plantilla.html + iconos.mjs ──┘
```

Archivos:
- `generar.mjs`: todo el pipeline, en Node ESM puro sin framework (Node ≥ 20).
- `plantilla.html` (tema Mostrador) y `plantilla-premium.html` (tema Premium): HTML y CSS con marcadores `{{TOKEN}}`. No tienen JavaScript. Si cambias la estructura HTML de una, cambia también la otra.
- `iconos.mjs`: trazos SVG de marcas (Simple Icons, CC0): whatsapp, instagram, facebook, tiktok, youtube, x, telegram, maps, waze.
- `logos/`: archivos de logo referenciados por la columna `logo`.
- `ejemplo-negocios.csv`: datos de ejemplo con todas las columnas.
- `.github/workflows/publicar.yml`: corre en push a `main`, cada 10 min (cron), a mano y con `repository_dispatch` (`actualizar-hoja`).
- `apps-script/boton-publicar.gs`: menú opcional "Tarjetas → Publicar cambios ahora" en la hoja. Dispara `repository_dispatch` con un token de GitHub.
- `GUIA_PASO_A_PASO.md`: manual del operador. Si cambias columnas, valores o comportamiento visible, actualízalo también.

Flujo de `generar.mjs`:
1. **`leerCSV()`** usa `SHEET_CSV_FILE` (local). Si no existe, intenta `SHEET_ID`/`SHEET_GID` (export directo, con la hoja compartida por enlace) y después `SHEET_CSV_URL` (publicada en la web, de respaldo). Hace 3 intentos por fuente y rechaza respuestas HTML. `parsearCSV()` es un parser propio que soporta comillas y BOM.
   - **Vínculos con nombre:** el CSV solo trae el texto visible de cada celda. Si en la hoja se usó "Insertar vínculo" con otro texto (o `=HYPERLINK`), `aplicarVinculos()` descarga la versión `.xlsx` de la hoja (`export?format=xlsx`, o `output=xlsx` en el enlace publicado) y reemplaza ese texto por el enlace real. Lo hace solo en `COLUMNAS_ENLACE` (reseñas, catálogo, botones extra y redes). Lee el zip con `leerZip()` (sin dependencias) y elige la pestaña cuyos encabezados coinciden con los del CSV. Si falla, avisa y sigue con el texto. Para probarlo en local usa `SHEET_XLSX_FILE`.
2. **Encabezados** normalizados con `normalizar()`: minúsculas, sin tildes, y todo lo que no sea alfanumérico pasa a `_`. Por eso `Google Reseñas` equivale a `google_resenas`. El orden de las columnas no importa y las columnas desconocidas se ignoran.
3. **`prepararNegocio()`** valida cada fila. Los errores de datos llaman a `avisar()` (no detienen el build) y omiten el botón o la fila.
4. **`prepararLogo()`** con `sharp`. Es opcional: sin él, los logos se copian tal cual. Recorta márgenes (`trim`), reduce a 800 px como máximo y sale como PNG (si tiene transparencia real) o JPG. Nunca WebP, porque falla en celulares viejos. Detecta si el logo es claro o si trae un fondo liso (`colorFondoLiso`) para elegir la placa. Los SVG se copian sin procesar. El nombre de salida es `<id>-<md5 8>.<ext>` para invalidar la caché.
5. **`htmlPagina()`** reemplaza los tokens con `replaceAll` en secuencia.
6. Escribe `dist/<id>/index.html` y, si hay alias, una copia idéntica en `dist/<alias>/index.html`. `dist/` se borra completo al inicio de cada build.

Tokens de la plantilla: `{{TITULO}}`, `{{COLOR}}`, `{{COLOR_TEXTO}}`, `{{COLOR_ICONO}}`, `{{CAB_CLASE}}`, `{{NOMBRE}}`, `{{LOGO_HTML}}`, `{{SLOGAN_HTML}}`, `{{TITULAR}}`, `{{RESENA_HTML}}`, `{{N_BOTONES}}`, `{{BOTONES}}`, `{{REDES_HTML}}`, `{{PIE_HTML}}`, `{{COLOR_ACENTO}}`, `{{TOLDO_CLASE}}`, `{{PORTADA_HTML}}`, `{{WIFI_HTML}}`. `{{NOMBRE}}` sale envuelto en `<span class="nom-txt">` y `{{CAB_CLASE}}` puede incluir `nombre-en-logo`.

Reglas de seguridad que se deben mantener:
- Todo texto que venga de la hoja pasa por `esc()`.
- Todo enlace pasa por `urlSegura()`, que solo acepta http(s), lo fuerza a `https:` y agrega `https://` si falta.
- Los colores pasan por `colorHex()`, que acepta solo 6 dígitos hex.
- `id` y `alias` pasan por `slugValido()`, y el nombre de logo por `/^[\w. -]+$/`. Así no se puede escribir fuera de `dist/` ni leer fuera de `logos/`.

## Columnas de la hoja (pestaña Negocios)

| Columna | Regla en el código | Si está vacía o es inválida |
|---|---|---|
| `id` * | Se pasa a minúsculas. Patrón `^[a-z0-9][a-z0-9-]*$`. `logos` está reservado | Fila omitida. Si se repite, gana la primera |
| `estado` * | `activo`, `activa` o `si` (normalizado, así que `Sí` también vale) | Cualquier otro valor pausa la página. El id sigue contando como usado |
| `nombre` * | Texto libre | Fila omitida |
| `slogan` | Texto bajo el nombre | No se muestra |
| `color` | Hex de 6 dígitos, con o sin `#` | Usa `#1f6f5c` (con aviso si era inválido) |
| `logo` | Archivo en `logos/` (png, jpg, jpeg, webp o svg) o un enlace `https://`, que se usa sin procesar. `buscarLogo()` ignora mayúsculas y acepta el nombre sin extensión (en Windows funcionaba y en GitHub, que usa Linux, no) | Muestra la inicial del nombre |
| `logo_fondo` | `blanco`, `oscuro` o `sin` | Automático (ver reglas de diseño) |
| `titular` | Frase grande. Avisa si pasa de 32 caracteres | "Nos encantó verte." |
| `google_resenas` | Enlace para dejar reseña | Sin bloque de reseña |
| `texto_resenas` | Máximo 45 caracteres | "Toca las estrellas y cuéntale a Google" |
| `nota_resenas` | Línea bajo las estrellas | "20 segundos. Ayudas a que más gente nos encuentre." |
| `catalogo` / `texto_catalogo` | Enlace / texto del botón (máximo 16) | Sin botón / "Ver catálogo" |
| `whatsapp` | Solo dígitos. Si tiene 10 dígitos y empieza por 3, se le antepone `57`. Debe quedar de 11 a 15 dígitos | Sin botón |
| `mensaje_whatsapp` | Texto que el **cliente** envía al negocio (`wa.me/<tel>?text=`) | "Hola, vi su tarjeta y quisiera más información." |
| `texto_whatsapp` | Máximo 16 | "Escríbenos" |
| `boton4_url`, `boton4_texto`, `boton4_icono` (y `boton5_*`) | Ícono según `elegirIcono()`: 1) `botonN_icono` (claves en `ICONOS_EXTRA`, con alias en `ALIAS_ICONO`), 2) red social o mapa por el dominio, 3) palabras del texto (`ICONO_POR_TEXTO`: "Pedidos" → domicilio, "Sedes" → tienda, "Citas" → reservas…), 4) servicio por dominio (`ICONO_POR_DOMINIO`: Rappi, DiDi Food, Doctoralia, Calendly, Booksy…), 5) globo | Sin botón. El texto por defecto depende del ícono (`TEXTO_ICONO`) o del dominio ("Pide en Rappi") |
| `portada` | Foto (JPG, PNG o WEBP) en `logos/`. Se recorta a 900×500 y se comprime a 70 KB como máximo (`prepararPortada`) | Sin foto |
| `wifi_red`, `wifi_clave` | Botón "Wi-Fi gratis" que despliega la red y la clave con `<details>` (sin JavaScript). Sin clave, dice "Red abierta" | Sin Wi-Fi. Clave sin red: avisa |
| `orden_botones` | Claves `catalogo`, `whatsapp`, `boton4`, `boton5` (también acepta menu, wa, extra, extra1, extra2), separadas por coma, `;` o espacio. Las que falten se agregan en el orden por defecto | `catalogo, whatsapp, boton4, boton5` |
| `estilo` | `premium` (normalizado, así que `Premium` también vale) usa `plantilla-premium.html` | Tema Mostrador. Otro valor: avisa y usa Mostrador |
| `nombre_en_logo` | `si` oculta el nombre en pantalla cuando el logo ya lo trae escrito. Lo deja para lectores de pantalla y Google | Se muestra el nombre. Sin logo, avisa y lo muestra |
| `instagram`, `facebook`, `tiktok`, `youtube`, `x`, `telegram` | Enlace completo o solo el usuario (`@usuario`). El enlace debe ser de esa red (`enlaceRed`). Se muestran como círculos centrados al final (`{{REDES_HTML}}`) | Sin círculo. Si es inválido, avisa |
| `alias` | Mismo patrón que `id`. Se ignora si choca con un id (incluso pausado) o con otro alias | Sin alias |

\* Obligatorias: si falta alguno de esos encabezados, el build falla.

Una fila activa que no tenga **ningún** botón válido (contando la reseña) se omite. La reseña siempre va en su bloque superior, sin importar `orden_botones`.

## Reglas de diseño: dos temas

La columna `estilo` elige la plantilla (`PLANTILLAS` en `generar.mjs`). Las dos comparten exactamente la misma estructura HTML y los mismos tokens; solo cambia el CSS.

### "Mostrador" con toldo de marca (`plantilla.html`, por defecto)

- **Toldo de marca:** la parte de arriba (portada opcional, logo, nombre, slogan y titular) va en el color del negocio (`--marca`), con texto en `--sobre`. `textoSobre()` da `#ffffff` o `#000000` (`TEXTO_OSCURO`) con umbral 0.179, así que cualquier color da al menos 4.58:1. El borde inferior es curvo y el tiquete de reseña se monta sobre él.
- **Color secundario automático** (`--acento`): `colorDelLogo()` saca el color con carácter más repetido del logo (sin su fondo, blancos ni grises). Si no hay o se parece al principal, se usa el principal. `legibleSobre()` lo oscurece hasta 3:1 sobre el papel. Va en la franja del tiquete, las estrellas, los íconos de las filas y la inicial.
- **Abajo, papel cálido** (`--papel #f4efe6`). Texto `--tinta #1a1712` y secundario `--gris #6b655a` (5:1). Nunca `opacity` en textos: baja el contraste.
- **Estructura**, de arriba abajo:
  1. Toldo: portada (si hay), logo, nombre y slogan centrados, y titular `h2` en Unbounded 800, `clamp(30px, 10vw, 44px)`. Con `nombre_en_logo` = `si`, el nombre se oculta en pantalla (`.nombre-en-logo .nom-txt`).
  2. Reseña: tiquete blanco con franja del acento, la "G" de Google sin modificar, **5 estrellas de contorno vacías** y la nota bajo una línea perforada. Una ola breve las ilumina y vuelven a quedar vacías: **nunca se muestran llenas**, para no sugerir una calificación.
  3. Acciones en filas de carta (ícono, texto y flecha), separadas por líneas de 1 px.
  4. Wi-Fi (si hay): una fila más que se despliega.
  5. Redes sociales en círculos de 48 px, centrados, en el color de la marca.
  6. Pie opcional.
- Tipografías: Unbounded 800 (titular) e Inter 500 (resto).

### "Premium" (`plantilla-premium.html`, `estilo` = `premium`)

Negro profundo, la reseña como pieza de oro, botones cuadrados satinados con filo dorado, redes en círculos satinados y logo en medallón (o cápsula si es ancho). **No usa el color del negocio**. Tipografía Inter 400 y 600. Sus reglas detalladas están en la skill `estetica-premium`.

### Comunes a ambos temas

- **Movimiento:** la entrada es escalonada y termina antes de 0.6 s. La respuesta al tocar es inmediata. `:hover` solo dentro de `(hover: hover) and (pointer: fine)`; ahí las estrellas se llenan hasta la que se señala. Todo tiene su versión en `prefers-reduced-motion`. Ver la skill `micro-interacciones`.
- **Íconos:** los de marca van rellenos (`iconos.mjs`). Los genéricos (`ICONOS` en `generar.mjs`) son de trazo en un `viewBox` de 24.
- **Placa del logo** (si `logo_fondo` está vacío):
  - Sin logo: inicial.
  - Logo opaco con borde liso: placa de ese mismo color (`color`).
  - Logo opaco con fondo de degradado o foto: se muestra tal cual con esquinas redondeadas (`tal`).
  - Logo transparente claro: placa `oscuro`.
  - Cualquier otro: placa `blanco`.
- **Límites de texto:** unos 16 caracteres por botón (en Premium son cuadrados), unos 32 en el titular y 45 en `texto_resenas`. Si los superas, el script avisa pero no corta.
- **Restricciones técnicas:**
  - Mobile-first, `max-width` de 440 px (480 px en Premium), respeta `safe-area-inset`.
  - **Cero JavaScript en el cliente.**
  - Fuentes servidas desde el propio sitio (`dist/fonts/`, copiadas desde `@fontsource`), sin pedidos a Google Fonts. Peso sin logo: unos 64 KB, más la portada si hay (máximo 70 KB).
  - `color-scheme: light only` en Mostrador, para que Android no oscurezca la página. `dark` en Premium.
  - Respeta `prefers-reduced-motion`.
  - `noindex` y `robots.txt` con `Disallow: /`.
  - Pensado para celulares viejos: solo CSS ampliamente soportado y logos en PNG/JPG.

## Particularidades conocidas

- Los tokens se reemplazan en secuencia. Un texto de la hoja que contenga `{{OTRO_TOKEN}}` se expande. No es XSS, pero es un error.
- `fonts` no está reservado como `id`, a diferencia de `logos`. Un negocio con ese id chocaría con la carpeta de la tipografía.
- Los SVG de `logos/` se publican sin limpiar.
- El workflow despliega en cada ejecución (cada 10 min) aunque no haya cambios.
- El token del botón de Apps Script tiene permiso Contents: Read and write. Es más de lo necesario.
- `urlSegura()` rechaza enlaces sin dominio real (una palabra suelta como "Sedes").
- Los cron de GitHub Actions se retrasan horas cuando GitHub tiene carga; "cada 10 minutos" es lo pedido, no lo garantizado.
- La lectura de vínculos con nombre (`.xlsx`) se probó con un archivo armado a mano, no con una exportación real de Google. Si Google cambia el formato, el robot avisa y sigue con el texto del CSV.

# CLAUDE.md

Guía para Claude Code (claude.ai/code) al trabajar en este repositorio.

## Qué es

Generador de sitio estático de **tarjetas digitales para negocios locales de Colombia**. Una hoja de Google Sheets (una fila por negocio) alimenta a `generar.mjs`, que crea una página HTML autocontenida por negocio en `dist/`. GitHub Actions la publica en GitHub Pages. El cliente final llega con un QR o NFC a `/<id>/` o `/<alias>/`.

Todo el proyecto (código, comentarios, avisos, guía) está en **español**, con nombres de variables y funciones en español. Mantén ese idioma y el tono sencillo: quien opera el sistema no es programador.

## Plan de trabajo (`plan/`)

- `plan/PRD.md`: qué hace el producto, cuál es el MVP y qué queda fuera por ahora.
- `plan/BACKLOG.md`: todas las tareas pendientes, numeradas y por prioridad.
- `plan/SPRINT.md`: el sprint abierto (una semana, una meta que se puede probar).

Reglas:
- Trabaja en las tareas del sprint, una por sesión.
- Una idea nueva que no está en el sprint va al backlog con su número; no se construye en ese momento. Si choca con "Qué queda fuera" del PRD, dilo antes.
- Al terminar una tarea, márcala **Hecho** en `SPRINT.md` y en `BACKLOG.md`. Al cambiar el alcance, actualiza el PRD.
- Precios y estrategia de venta no van en `plan/`: este repositorio es público (están en `Tarjetas/marketing/precios/`).

## Probar localmente

No hay pruebas automáticas ni linter. Para probar, construye el sitio con el CSV de ejemplo:

```bash
npm install                                          # sharp + tipografías Unbounded, Figtree e Inter (solo la primera vez)
SHEET_CSV_FILE=ejemplo-negocios.csv node generar.mjs
```

En PowerShell: `$env:SHEET_CSV_FILE="ejemplo-negocios.csv"; node generar.mjs`

Qué esperar con `ejemplo-negocios.csv`:
- `dist/001/` y `dist/estilonorte/` (alias), con el logo SVG `estilo-norte.svg`.
- `dist/002/`, sin logo (muestra la inicial), con `logo_fondo=blanco` y `estilo=premium`.
- `dist/001/` tiene Wi-Fi para clientes y redes sociales.
- `dist/001/` (Mostrador, "Agenda tu cita") y `dist/002/` (Premium, "Haz tu pedido") tienen el formulario a WhatsApp por defecto, y `dist/004/` (parroquia, "Pedir una misa") uno con campos propios (`boton4_campos`). Ábrelos directo con `#solicitud-4` o `#solicitud-5`.
- `dist/001/panel.json` (columna `clave_panel` = `panel-prueba-001`): el panel de resultados, que solo corre en Cloudflare (`/panel/001?k=panel-prueba-001`).
- `dist/001/` (visitas, 8 sellos con tijeras) y `dist/002/` (compras, 6 sellos de $25.000 con taza) tienen "Mis premios" y su `caja.json`. Ábrelos con `#premios`.
- `dist/001/` tiene el botón "Tu cumpleaños" (columnas `cumple` y `cumple_condiciones`) y `panel.json` lleva `cumple`. Ábrelo con `#cumple`; la inscripción solo se guarda en Cloudflare (`/cumple/001`).
- `003` está `pausado`: no se genera.
- Se generan también `dist/index.html`, `dist/404.html`, `dist/robots.txt`, `dist/fonts/` y `dist/logos/`.
- La consola muestra `✔` por negocio y `⚠` por cada problema. El resumen final cuenta páginas, pausadas y advertencias.

Para verificar un cambio, revisa la salida de consola (los avisos nuevos o perdidos) y el HTML generado. Para verla en el navegador integrado, usa `preview_start` con `tarjetas-dist` (`.claude/launch.json`), que sirve `dist/` en `http://localhost:4173/<id>/`. Fuera de Claude, `dist/001/index.html` también se puede abrir directo, porque las rutas `../fonts` y `../logos` son relativas. Revisa siempre a 360 px y 390 px de ancho: la skill `ux-tarjetas` tiene la lista de chequeo completa.

Variables útiles para pruebas:
- `LOGOS_DIR`: carpeta de logos distinta de `logos/`.
- `SHEETS_BASE`: reemplaza `https://docs.google.com` para simular la descarga.
- `SHEET_XLSX_FILE`: junto con `SHEET_CSV_FILE`, un `.xlsx` de la hoja para probar los vínculos con nombre.
- `PIE_TEXTO` / `PIE_URL`: pie de página opcional.
- `SITIO_URL`: dirección pública, para `og:url` y `og:image`. Sin ella, en Actions se deduce de `GITHUB_REPOSITORY`; en local, esas etiquetas se omiten y la consola lo dice con un `·`.
- `CONTADOR_URL`: dirección https donde corre el contador en Cloudflare (ej. `https://t.fides-link.com`, variable `vars.CONTADOR_URL` en Actions). Con ella, los enlaces https de reseña, botones y redes salen como `<CONTADOR_URL>/ir/<id>/<clave>` (`enlace()`), se escribe `dist/<id>/enlaces.json` con los destinos reales . `dist/_routes.json` se escribe siempre. Teléfono, correo y formularios van directo. Vacía o inválida: enlaces directos (inválida avisa con `⚠`).

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
- `functions/` y `servidor/contador.js`: contador de visitas y toques en Cloudflare Pages Functions con una base D1 (ver "Contador de visitas y toques"). Solo corre en Cloudflare; el job `cloudflare` del workflow los publica junto con `dist/`.
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

Tokens de la plantilla: `{{TITULO}}`, `{{COLOR}}`, `{{COLOR_TEXTO}}`, `{{COLOR_ICONO}}`, `{{CAB_CLASE}}`, `{{NOMBRE}}`, `{{LOGO_HTML}}`, `{{SLOGAN_HTML}}`, `{{TITULAR}}`, `{{RESENA_HTML}}`, `{{N_BOTONES}}`, `{{BOTONES}}`, `{{REDES_HTML}}`, `{{PIE_HTML}}`, `{{COLOR_ACENTO}}`, `{{COLOR_ACENTO_TEXTO}}`, `{{COLOR_TINTA}}`, `{{COLOR_GRIS}}`, `{{COLOR_TINTE}}`, `{{COLOR_ICONO_MOSAICO}}`, `{{COLOR_SOMBRA}}`, `{{TOLDO_CLASE}}`, `{{PORTADA_HTML}}`, `{{WIFI_HTML}}`, `{{DESCRIPCION}}`, `{{META_ENLACES}}`, `{{FORMULARIOS_HTML}}`, `{{PREMIOS_HTML}}`, `{{LIENZO_CLASE}}`, `{{COLOR_LIENZO}}`, `{{COLOR_LIENZO_TRAZO}}`. `{{PREMIOS_HTML}}` es la pieza "Mis premios" (`htmlPremiosPieza()`), debajo de `{{RESENA_HTML}}`; su hoja (`htmlPremiosHoja()`) sale dentro de `{{FORMULARIOS_HTML}}`. `{{LIENZO_CLASE}}` va en `<body class>` y es `lz lz-formas`, `lz lz-puntos`, `lz lz-arcos` o vacío.  `{{NOMBRE}}` sale envuelto en `<span class="nom-txt">`, `{{SLOGAN_HTML}}` es un `<p class="slogan">` fuera del `h1` y `{{CAB_CLASE}}` puede incluir `nombre-en-logo`. `{{TOLDO_CLASE}}` puede incluir `con-portada` y `sin-resena`. `{{DESCRIPCION}}` es el slogan o "Contacto y enlaces de <nombre>."; `{{META_ENLACES}}` son `og:url`, `og:image` (portada, o logo que no sea SVG) y `twitter:card`. Los `{{COLOR_*}}` de la paleta salen de `paletaMarca()`; Premium no los usa.

Reglas de seguridad que se deben mantener:
- Todo texto que venga de la hoja pasa por `esc()`.
- Todo enlace pasa por `urlSegura()`, que solo acepta http(s), lo fuerza a `https:` y agrega `https://` si falta. Rechaza otros esquemas, enlaces con usuario o clave y direcciones numéricas.
- Solo `boton4_url` a `boton9_url` usan `enlaceBoton()`, que además acepta teléfono (`enlaceLlamada()`, siempre `tel:` con solo dígitos y `+`) y correo (`enlaceCorreo()`, sin `?subject=` ni `?bcc=`). Reseñas, catálogo, redes, logo y pie siguen solo con http(s).
- Los colores pasan por `colorHex()`, que acepta solo 6 dígitos hex.
- `id` y `alias` pasan por `slugValido()`, y el nombre de logo por `/^[\w. -]+$/`. `logos`, `fonts`, `ir`, `panel`, `caja`, `premios` y `cumple` están reservados como `id`.
- El panel (`/panel/<id>?k=`) solo se abre con la clave correcta: `panel.json` guarda la huella PBKDF2 (10.000 vueltas, sal `fides-panel:<id>`), nunca la clave, y el middleware lo bloquea al público en Cloudflare (en la copia de `github.io` sí es visible, por eso la clave debe tener 12 caracteres o más). La clave nunca se escribe en la consola, porque los registros de Actions son públicos.
- `caja.json` (Mis premios) guarda la huella de `clave_caja` igual (sal `fides-caja:<id>`). El middleware lo bloquea en Cloudflare y el workflow lo borra de la copia de GitHub Pages (`dist-github`), porque esa clave sirve para sumar sellos y, desde B36, para buscar una tarjeta por el celular del cliente. `/caja` y `/premios` también están reservados como `id`.
- `/ir/<id>/<clave>` solo redirige a un `https://` que esté en `dist/<id>/enlaces.json` (escrito por el robot); cualquier otra cosa vuelve a `/<id>/`. No es una redirección abierta. El contador no guarda IP ni datos de la persona. Así no se puede escribir fuera de `dist/` ni leer fuera de `logos/`.

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
| `logo_forma` | `circulo` (sello redondo, por defecto) o `cuadrado` (insignia de esquinas suaves, clase `cuadrada`; también acepta `insignia`). Sirve para logos casi cuadrados, como escudos, que en el círculo quedan pequeños | Círculo. Otro valor: avisa y usa círculo |
| `titular` | Frase grande. Avisa si pasa de 32 caracteres | "Nos encantó verte." |
| `google_resenas` | Enlace para dejar reseña | Sin bloque de reseña |
| `texto_resenas` | Máximo 45 caracteres. Debajo de las estrellas siempre va el botón "Calificar en Google" | "¿Cómo te fue? Cuéntanos tu experiencia" |
| `nota_resenas` | Línea bajo las estrellas | "20 segundos. Ayudas a que más gente nos encuentre." |
| `catalogo` / `texto_catalogo` | Enlace / texto del botón (máximo 16) | Sin botón / "Ver catálogo" |
| `whatsapp` | Solo dígitos. Si tiene 10 dígitos y empieza por 3, se le antepone `57`. Debe quedar de 11 a 15 dígitos | Sin botón |
| `mensaje_whatsapp` | Texto que el **cliente** envía al negocio (`wa.me/<tel>?text=`) | "Hola, vi su tarjeta y quisiera más información." |
| `texto_whatsapp` | Máximo 16 | "Escríbenos" |
| `boton4_url`, `boton4_texto`, `boton4_icono` (y `boton5_*` a `boton9_*`, tope en `ULTIMO_BOTON_EXTRA`) | Página, teléfono o correo (`enlaceBoton()`). Teléfono sin `+`: celular `3…` o fijo `60…` de 10 dígitos, con o sin `57`, o `018000`; con `+`: 8 a 15 dígitos. Ícono según `elegirIcono()`: 1) `botonN_icono` (claves en `ICONOS_EXTRA`; `claveIcono()` acepta mayúsculas, plurales y muchas palabras en español de `ALIAS_ICONO`, como Iglesia, Grupos o Requisitos). Íconos de nicho: iglesia, personas, boda, salud, casa, documento, tijeras, info; de fidelización y otros negocios: regalo, cumpleanos, premio, vip, sellos, descuento, cafe, corazon, compartir, mascotas (por texto van antes que los demás, para que "Regala una cita" no salga como reserva), 2) `llamar` o `correo` si el enlace es `tel:` o `mailto:`, y red social o mapa por el dominio, 3) palabras del texto (`ICONO_POR_TEXTO`: "Pedidos" → domicilio, "Sedes" → tienda, "Citas" → reservas…), 4) servicio por dominio (`ICONO_POR_DOMINIO`: Rappi, DiDi Food, Doctoralia, Calendly, Booksy…), 5) globo | Sin botón, con aviso si es inválido. `boton10_url` o mayor: aviso. El texto por defecto depende del ícono (`TEXTO_ICONO`) o del dominio ("Pide en Rappi") |
| `botonN_url` = `formulario: A \| B \| C` | Formulario a WhatsApp (`opcionesFormulario()`). Opciones separadas por `\|` (o salto de línea), máximo `MAX_OPCIONES` (6), unas 24 letras cada una. `formulario` sin opciones: el motivo se escribe. Necesita `whatsapp` válido. Ícono `formulario` (o `reservas`/`domicilio` según el texto, o `botonN_icono`). Texto por defecto "Haz tu solicitud" | Sin `whatsapp`: aviso y sin botón. Más de 6 opciones: aviso y se cortan |
| `botonN_campos` | Campos propios del formulario (`camposFormulario()`), uno por renglón o separados por `;`, máximo `MAX_CAMPOS` (8). `Nombre: A \| B` = opciones en botones (máx. 6); con `(desplegable)` en el nombre, lista desplegable (máx. 12). Sin `\|` ni marca, los dos puntos son parte del nombre. Marcas entre paréntesis o corchetes: `opcional`, `desplegable`, `botones`, `fecha`, `hora`, `fecha y hora`, `número`, `teléfono`, `correo`, `texto largo`, `texto`; un paréntesis que no es marca se queda en el nombre. Sin marca, el tipo sale del nombre (`tipoPorNombre()`). Todos obligatorios salvo `(opcional)` | Formulario por defecto (`camposPorDefecto()`): motivo, nombre y detalle |
| `portada` | Foto (JPG, PNG o WEBP) en `logos/`. Se recorta a 900×500 y se comprime a 70 KB como máximo (`prepararPortada`) | Sin foto |
| `wifi_red`, `wifi_clave` | Botón "Wi-Fi gratis" que despliega la red y la clave con `<details>` (sin JavaScript). Sin clave, dice "Red abierta" | Sin Wi-Fi. Clave sin red: avisa |
| `orden_botones` | Claves `catalogo`, `whatsapp`, `boton4` a `boton9` y `cumple` (también acepta menu, wa, extra, extra1, extra2), separadas por coma, `;` o espacio. Las que falten se agregan en el orden por defecto | `catalogo, whatsapp, boton4` … `boton9` |
| `estilo` | `premium` (normalizado, así que `Premium` también vale) usa `plantilla-premium.html` | Tema Mostrador. Otro valor: avisa y usa Mostrador |
| `nombre_en_logo` | `si` oculta el nombre en pantalla cuando el logo ya lo trae escrito. Lo deja para lectores de pantalla y Google | Se muestra el nombre. Sin logo, avisa y lo muestra |
| `instagram`, `facebook`, `tiktok`, `youtube`, `x`, `telegram` | Enlace completo o solo el usuario (`@usuario`). El enlace debe ser de esa red (`enlaceRed`). Se muestran como círculos centrados al final (`{{REDES_HTML}}`) | Sin círculo. Si es inválido, avisa |
| `botonN_detalle`, `detalle_catalogo`, `detalle_whatsapp` | Subtítulo bajo el texto del botón (`.det`), en gris en el mosaico y en `--sobre` en la acción principal. Avisa si pasa de `MAX_DETALLE` (30) | Sin subtítulo |
| `botonN_etiqueta`, `etiqueta_catalogo`, `etiqueta_whatsapp` | Píldora pequeña (`.eti`, ej. "Nuevo"): en la esquina en el mosaico, junto al texto en los botones anchos. `--acento` (en la principal, `--sobre` con texto `--marca`; en Premium, oro). Avisa si pasa de `MAX_ETIQUETA` (10) | Sin etiqueta |
| `lienzo` | `formas`, `puntos` o `arcos` (`LIENZOS`): fondo fijo detrás de la página (`body.lz::before`, `position: fixed`) que no se mueve al bajar. En Mostrador usa `lienzoSuave`/`lienzoTrazo` de `paletaMarca()` (12 % y 26 % de la marca sobre `--fondo`); en Premium, oro muy tenue | Sin lienzo. Otro valor: avisa |
| `alias` | Mismo patrón que `id`. Se ignora si choca con un id (incluso pausado) o con otro alias | Sin alias |
| `clave_panel` | Clave del panel de resultados del cliente, 12 caracteres o más sin espacios. El robot escribe `dist/<id>/panel.json` con su huella, el nombre, los colores y el texto de cada botón (WhatsApp lleva "(WhatsApp)") | Sin panel. Corta o con espacios: avisa |
| `premio`, `premio_tipo`, `premio_meta`, `premio_valor_sello`, `premio_vigencia`, `premio_icono`, `clave_caja` | Mis premios, tarjeta de sellos (`leerPremios()`, B25). La tarjeta nunca dice el premio: dice "reclama tu obsequio" y el negocio decide qué da; `premio` es opcional y solo va a `caja.json` para el empleado. `premio_tipo` `visitas` (por defecto) o `compras`; `premio_meta` de `MIN_SELLOS` (3) a `MAX_SELLOS` (12); `premio_valor_sello` en pesos, obligatorio con compras; `premio_icono` es un ícono genérico de `ICONOS` (por defecto un visto bueno); `clave_caja` de 12 o más, distinta de `clave_panel`. El robot escribe `dist/<id>/caja.json` con las reglas y la huella. Pieza `.mp` y hoja `#premios` (`.pr-*`); los sellos puestos llevan la clase `si` y el código (`.pr-codigo`) queda oculto hasta B25b | Sin "Mis premios". Meta fuera de rango, sin `clave_caja`, compras sin valor o clave corta: avisa |
| `cumple`, `cumple_condiciones`, `cumple_texto` (y `detalle_cumple`, `etiqueta_cumple`) | Cumpleaños (`leerCumple()`, B31). `cumple` es el regalo (máx. `MAX_CUMPLE`, 60) y activa la acción `cumple` (ícono `cumpleanos`, texto "Tu cumpleaños", al final del orden por defecto; si el regalo cabe en 30, es su subtítulo). Necesita `clave_panel`. Hoja `#cumple` (`htmlCumpleHoja()`, `.cu-*`) | Sin botón. Sin `clave_panel` o con condiciones sin `cumple`: avisa |

\* Obligatorias: si falta alguno de esos encabezados, el build falla.

Una fila activa que no tenga **ningún** botón válido (contando la reseña) se omite. La reseña siempre va en su bloque superior, sin importar `orden_botones`.

## Reglas de diseño: dos temas

La columna `estilo` elige la plantilla (`PLANTILLAS` en `generar.mjs`). Las dos comparten exactamente la misma estructura HTML y los mismos tokens; solo cambia el CSS.

### "Mostrador": foto limpia, toldo y mosaico (`plantilla.html`, por defecto)

- **El color de la marca va solo arriba** (`--marca`, en el toldo), con texto en `--sobre`. Abajo, fondo claro neutro (`--fondo #f5f5f4`, sin beige) y piezas blancas. A página completa se veía pesado. `textoSobre()` da `#ffffff` o `#000000` (`TEXTO_OSCURO`) con umbral 0.179, así que cualquier color da al menos 4.58:1.
- **Foto limpia arriba:** la portada tiene corte neto: **nada de difuminados ni degradados** entre la foto y el color (el usuario lo rechazó). El toldo sube 28 px sobre la foto con esquinas redondeadas y el logo se monta en el borde. Con o sin foto, todo va centrado; sin foto, el titular crece. El borde inferior del toldo es curvo.
- **Color casi blanco:** si `color` tiene luminancia > 0.7 y el logo trae un color con carácter, ese pasa a ser `--marca` y el robot avisa ⚠ (caso De Quei Matti con `#ffffff`).
- **Color secundario automático** (`--acento`): `colorDelLogo()` saca el color con carácter más repetido del logo (sin su fondo, blancos ni grises). Si no hay o se parece al principal, se usa el principal. `paletaMarca()` lo oscurece hasta 3:1 sobre el blanco. Va en el botón del tiquete, las estrellas y la inicial. `--sobre-acento` es el texto del botón (4.58:1 o más).
- **Acciones en mosaico, para no parecer Linktree:** la primera (`.tl.pri`) va a todo el ancho, llena del color de la marca; las demás, en dos columnas, blancas, con el ícono en un círculo `--tinte` arriba y el texto abajo. Una acción que queda sola en su fila (`.tl:nth-child(even):last-child`) ocupa el ancho, con ícono a la izquierda y flecha. `--icono` queda a 3:1 sobre el tinte. `--tinta` y `--gris` (4.6:1 sobre blanco) son los textos. Nunca `opacity` en textos: baja el contraste.
- **Estructura**, de arriba abajo:
  1. Toldo (`.toldo`): portada (si hay), logo en un sello grande de 168 px con doble aro, blanco y de la marca, montado entre la foto y el toldo (o insignia cuadrada de 156 px con `logo_forma`, o cápsula si es ancho, clase `apilada`), nombre (`h1`), slogan (`p`) y titular `h2` en Unbounded 800, `clamp(32px, 9.6vw, 44px)` con foto y `clamp(36px, 11vw, 50px)` sin foto. Con `nombre_en_logo` = `si`, el nombre se oculta en pantalla (`.nombre-en-logo .nom-txt`).
  2. Reseña: tiquete blanco montado entre el toldo y el fondo claro, con sombra de dos capas teñida con la marca (`--sombra-cerca`, `--sombra-lejos`). Lleva la "G" de Google sin modificar, **5 estrellas de contorno vacías como adorno**, el botón en píldora **"Calificar en Google →"** y la nota bajo una línea perforada. Toda la pieza es un solo enlace. Una ola breve ilumina las estrellas y vuelven a quedar vacías: **nunca se muestran llenas**, para no sugerir una calificación.
  3. Acciones en mosaico. La reseña sigue mandando por tamaño, sombra y posición.
  4. Wi-Fi (si hay): una pieza blanca a lo ancho que se despliega.
  5. Cierre (`<footer class="base">`): redes en círculos de 48 px en el color de la marca (ícono en `--sobre`), pie opcional y, siempre, "Privacidad · Términos" (`LEGAL_HTML`, B33: `<p class="pie legal">` con enlaces directos a fides-link.com, sin contador), que sale dentro de `{{PIE_HTML}}` en los dos temas.
- Tipografías: Unbounded 800 (titular) y Figtree 500 y 700 (resto; 700 en el nombre, el botón de reseña y la acción principal). Figtree pesa menos que Inter: 11 KB por peso. Mientras carga Unbounded se usa `Unbounded Respaldo` (fuente del sistema con `size-adjust: 116%`), para que el titular no mueva la reseña.

### "Premium" (`plantilla-premium.html`, `estilo` = `premium`)

Negro profundo, la reseña como pieza de oro, botones cuadrados satinados con filo dorado, redes en círculos satinados y logo en un sello de 156 px con aros dorados (insignia de 148 px con `logo_forma` = `cuadrado`, o cápsula si es ancho). **No usa el color del negocio**. Tipografía Inter 400 y 600. Sus reglas detalladas están en la skill `estetica-premium`.

### Comunes a ambos temas

- **Movimiento:** en Mostrador la página aparece ya lista. Solo el tiquete se posa y hay un único momento protagonista: la ola de las estrellas termina en una luz que recorre una vez el botón "Calificar en Google", todo antes de 0.85 s (ver `/impeccable animate`). En Premium, la entrada es escalonada y su destello es aparte. La respuesta al tocar es inmediata: la pieza se hunde (`scale(.975)`), el ícono del mosaico se llena y la flecha avanza; el botón de reseña se oscurece y su flecha avanza. `:hover` solo dentro de `(hover: hover) and (pointer: fine)`, con una respuesta parecida. Las estrellas no se llenan nunca, ni con hover. Todo tiene su versión en `prefers-reduced-motion`. Ver la skill `micro-interacciones`.
- **Íconos:** los de marca van rellenos (`iconos.mjs`). Los genéricos (`ICONOS` en `generar.mjs`) son de trazo en un `viewBox` de 24.
- **Tamaño del logo en el sello:** `escalaLogo()` mide hasta dónde llega el dibujo desde el centro (sin el fondo liso ni lo transparente) y escribe `--k` en el `.logo`: la fracción del sello que puede ocupar sin que el círculo le corte nada, de 0.62 a 0.96. Un logo redondo (como Bear Beard) llena el sello; uno cuadrado queda en unos 0.7. Sobre placa blanca, el blanco del logo cuenta como fondo (`escalaSobreBlanco`). En la placa, la imagen se agranda aunque el archivo sea pequeño (`object-fit: contain`); el robot ya avisa si mide menos de `LOGO_MIN_PX`. Sin `sharp`, `--k` es 0.72.
- **Placa del logo** (si `logo_fondo` está vacío):
  - Sin logo: inicial.
  - Logo opaco con borde liso: placa de ese mismo color (`color`).
  - Logo opaco con fondo de degradado o foto: se muestra tal cual con esquinas redondeadas (`tal`).
  - Logo transparente claro: placa `oscuro`.
  - Cualquier otro: placa `blanco`.
- **Cantidad de acciones:** 8 como máximo (catálogo, WhatsApp y `boton4` a `boton9`). Sin reseña, el toldo se acorta (`.sin-resena`) y las acciones van 20 px debajo. En Premium, de 6 a 8 acciones van en parejas, porque en tres columnas "Administración" se parte.
- **Límites de texto:** unos 16 caracteres por botón (en Premium son cuadrados), unos 32 en el titular y 45 en `texto_resenas`. Si los superas, el script avisa pero no corta.
- **Restricciones técnicas:**
  - Mobile-first, `max-width` de 440 px (480 px en Premium), respeta `safe-area-inset`.
  - **Cero JavaScript en el cliente**, con dos excepciones: el formulario a WhatsApp (ver abajo) y "Mis premios" (`SCRIPT_PREMIOS`, ver "Mis premios"). La hoja de cumpleaños no tiene script propio: `SCRIPT_FORMULARIO` solo la abre y la cierra (arma mensajes solo en `form[data-wa]`) y el formulario se envía normal. Cada script va solo en las tarjetas que lo usan, y sin él la hoja sigue funcionando. La medición de visitas y toques se hace en el servidor (ver "Contador de visitas y toques"), no en la página.
  - Fuentes servidas desde el propio sitio (`dist/fonts/`, copiadas desde `@fontsource`), sin pedidos a Google Fonts. Peso sin logo en Mostrador: unos 70 KB, más la portada si hay (máximo 70 KB).
  - `color-scheme: light only` en Mostrador, para que Android no oscurezca la página. `dark` en Premium.
  - Respeta `prefers-reduced-motion`.
  - `noindex` y `robots.txt` con `Disallow: /`.
  - Pensado para celulares viejos: solo CSS ampliamente soportado y logos en PNG/JPG.

### Formulario a WhatsApp (`botonN_url` = `formulario: …`)

Hoja que sube desde abajo, en las dos plantillas (`{{FORMULARIOS_HTML}}`, al final del `<body>`). La genera `htmlFormularios()`; el botón del mosaico es `<a href="#solicitud-N" aria-haspopup="dialog">`.

- **Sin JavaScript (respaldo):** `.hoja:target` la muestra, con una sola `<textarea name="text">` con la plantilla ya escrita y un `<input type="hidden" name="phone">`, en un `<form method="get" action="https://api.whatsapp.com/send" target="_blank">`. Cerrar es un enlace a `#`.
- **Campos:** cada formulario es una lista de campos `{ etiqueta, enMensaje, tipo, opciones, opcional, pos }` (de `botonN_campos` o `camposPorDefecto()`). `htmlCampo()` los pinta como `.fm-campo` con `data-et`, `data-tipo`, `data-pos` y `data-req`: `botones` (radios en `.fm-chips`), `desplegable` (`<select>`), `largo` (`<textarea>`), `date`, `time`, `datetime-local`, `tel`, `email`, `numero` (texto con `inputmode="numeric"`) o `text`.
- **Con JavaScript (`SCRIPT_FORMULARIO`, ES5, sin librerías):** pone la clase `js` en `<html>`, quita la caja única, muestra `.fm-con-js`, pone `min` = hoy en las fechas, abre y cierra con la clase `abierta` sin tocar el hash, cierra con Escape, el velo o la X, mantiene el foco dentro de la hoja y lo devuelve al botón. Al enviar valida los obligatorios (`.mal`, `aria-invalid`, foco al primero), arma `*NUEVA SOLICITUD WEB*`, el título del botón en negrita y una línea `• *Etiqueta:* valor` por campo con dato, ordenadas por `data-pos` (en el formulario por defecto: nombre, motivo, detalle). Una etiqueta que termina en `?` no lleva dos puntos. Las fechas salen en palabras ("domingo 15 de noviembre de 2026, 7:30 p. m."); abre `https://wa.me/<whatsapp>?text=` + `encodeURIComponent` en otra pestaña, limpia y cierra. Si se llega con `#solicitud-N` en la dirección, abre la versión completa.
- **Sin JavaScript**, la caja trae el título y cada pregunta en su renglón, con las opciones entre paréntesis.
- **Datos:** no se guarda nada; el número sale de la columna `whatsapp` (solo dígitos) y las etiquetas y opciones pasan por `esc()`.
- Estilos: `.hoja`, `.hoja-caja`, `.fm-*`. En Mostrador la opción elegida va en `--marca` y el botón de envío en verde WhatsApp (`#25d366` con texto `#0b3d1f`); en Premium, oro. Respeta `prefers-reduced-motion`.
- No se ha probado en un celular real que `api.whatsapp.com/send` reciba bien el respaldo sin JavaScript (los espacios llegan como `+`).

## Contador de visitas y toques (`functions/`)

Promesa de fides-link.com: "cuántos te visitaron, qué tocaron y cuándo". Se mide en el servidor, sin JavaScript en la tarjeta.

- `functions/_middleware.js`: cuenta una **visita** en cada GET (200 o 304) a `/<slug>/` o `/<slug>/index.html`. `?o=qr` u `?o=nfc` en la dirección dicen cómo llegó (el QR impreso y el chip NFC deben llevarlo).
- `functions/ir/[id]/[boton].js`: cuenta un **toque** y responde 302 al enlace real (`enlaces.json`), con `Cache-Control: no-store`.
- `servidor/contador.js`: `contar()` hace un upsert en la tabla `eventos (dia, hora, id, tipo, boton, origen, n)` de la base D1 enlazada como `CONTADOR`, con la hora de Colombia (UTC-5). Crea la tabla si no existe. Si no hay base enlazada o falla, la tarjeta sigue igual. Ignora robots y vistas previas (`ROBOT`, prefetch).
- `_routes.json` excluye fuentes, logos y `enlaces.json`, para no gastar el cupo gratuito (100.000 invocaciones al día; D1: 100.000 filas escritas al día).
- Las visitas por alias se guardan con el alias como `id`.
- Probar en local: `npx wrangler@4.151.3 pages dev dist --d1 CONTADOR=prueba --persist-to <carpeta>` con un `dist/` construido con `CONTADOR_URL`.
- **Panel del cliente** (`functions/panel/[id].js` + `servidor/panel.js`, diseño "Resumen" con estética "Noche": colores del logo de FidesLink, no del negocio; selector de meses hundido y dona para QR, NFC y Otro, que salen siempre aunque estén en 0): `/panel/<id>?k=<clave_panel>&mes=AAAA-MM` (hasta 24 meses atrás). Se arma en el servidor, sin JavaScript, con `Cache-Control: no-store`, `noindex` y `no-referrer`. Muestra visitas del mes (cifra en Unbounded), la comparación con el mes anterior (en el mes en curso, contra los mismos días), "Lo que más tocaron" (barras, hasta 8), "Mis premios" (si el negocio tiene sellos), "Cómo llegaron" (solo si hay QR o NFC) y "Tu mejor momento" (día y franja de 2 horas, desde 20 visitas). Suma las visitas del alias. Clave mala o sin panel: 404 "Enlace no válido"; 10 claves malas en una hora bloquean esa conexión (429, `caja_intentos` con `panel:<id>`), porque el panel muestra la lista de cumpleaños. Abrir el panel no cuenta como visita. Con cumpleaños, lleva el bloque "Cumpleaños" y la lista (ver "Cumpleaños").
- Solo se cuentan toques a "Calificar en Google", no reseñas. El resumen mensual por WhatsApp todavía no existe.

## Mis premios: tarjeta de sellos (B25)

- **Tarjeta (`SCRIPT_PREMIOS`, ES5, solo con columnas de premios):** la primera vez que se abre "Mis premios", el celular crea un código de 6 letras al azar (`ALFABETO_CODIGO`, sin 0, O, 1, I ni L; solo con `crypto.getRandomValues`, descartando bytes para no tener sesgo; sin él no hay código y queda el aviso `.pr-sin-js`, que se oculta con la clase `pr-ok` en `<html>`) y lo guarda en `localStorage` (`fides-premios:<id>`). Con él pide `/premios/<id>/<código>` (XMLHttpRequest, 6 s) y pinta sellos (`.pr-sello.si`), puntos (`.mp-pts i.si`), el avance y `.pr-lleno` al completar. Si falla, la hoja abre igual con el código y sin sellos. Sin JavaScript se ve `.pr-sin-js`. Un código de 6 letras (31^6 ≈ 887 millones por negocio) solo deja leer cuántos sellos lleva, sin datos personales; si B25c necesita más, se agrega un secreto largo en el celular.
- **Recuperar la tarjeta (B36):** la hoja tiene el botón `.pr-guardar` ("Guardar mi código en WhatsApp", con la clase `fm-enviar`), que abre `wa.me/?text=` **sin número** con un enlace `/<id>/#premios-<código>`: el cliente elige su propio chat («Tú») y no se le llena el WhatsApp al negocio. Al abrir ese enlace, `SCRIPT_PREMIOS` guarda el código en `localStorage` (reemplaza el que hubiera), quita el `#` y abre la hoja con "Tarjeta recuperada en este celular".
- **Servidor:** `functions/premios/[id]/[codigo].js` no toca los sellos: valida id y código (`codigoValido()`), exige `caja.json` (`reglasPremios()`) y responde `{sellos, meta, entregados}` con `no-store`. Cada consulta de un código que no existe se anota en `premios_intentos` (con `quien()` de la caja); 30 en una hora, por negocio y por IP, responden 429 (la tarjeta abre igual, sin sellos). `servidor/premios.js` tiene la tabla `premios (id, codigo, sellos, completadas, entregados, ultimo_sello, ultimo_n, creado)` en la base `CONTADOR`; la crea la caja.
- **Caja (`functions/caja/[id].js` + `servidor/caja.js`):** `/caja/<id>?k=<clave_caja>`, en el estilo "Noche" del panel, sin JavaScript, con formularios POST a la misma dirección. Valida la clave con `claveValida()` contra `caja.json`. Acciones: `sumar` (visitas: 1; compras: `floor(valor / valorSello)`, hasta la meta), `consultar`, `entregar` (solo con la tarjeta llena: vuelve a 0 y suma `entregados`) y `deshacer` (solo el sello de hoy, con `ultimo_n`). Un registro por código al día; los `UPDATE` repiten las reglas para que dos cajas a la vez no dupliquen. El primer sello de un código avisa que se confirme con el cliente.
- **Celular del cliente (B36):** tabla `premios_clientes (id, telefono, codigo, autorizado)`, un celular por tarjeta y una tarjeta por celular. Se guarda desde la caja (acción `celular`) solo con la casilla `autorizo` marcada; `autorizado` es la fecha y hora de Colombia. `celularValido()` usa la regla de la columna `whatsapp`. En el campo del código se puede escribir el celular (`pareceCelular()`: solo dígitos, 7 o más) y se busca su tarjeta. En pantalla sale oculto (`300 ••• 4567`), con "Enviarle su tarjeta por WhatsApp" (`wa.me/<celular>` con el enlace `#premios-<código>`) y `borrar_celular` (borrado a pedido). El panel no muestra teléfonos y el número no se usa para promociones.
- **Límite de intentos:** 10 claves equivocadas por hora, por negocio y por IP, bloquean con 429 (tabla `caja_intentos`, con una huella corta de IP + negocio + hora, que se borra al día siguiente). Un id sin premios responde 404 sin escribir en la base. El POST rechaza otro `Origin` (acepta `null`, que es lo que manda el navegador con `no-referrer`).
- **Resumen para el panel:** tabla `premios_eventos (dia, id, tipo, n)` con `sello`, `tarjeta_nueva`, `completa` y `entrega` por día, sin códigos. `deshacer` descuenta.
- **Panel (B25d):** `panel.json` lleva `premios: { meta, tipo }` (o `null`). Con eso, `cifrasPremios()` suma el mes elegido de `premios_eventos` y, en el mes en curso, cuenta en `premios` las tarjetas en curso y las llenas sin entregar. `bloquePremios()` va después de las cifras de visitas, aunque no haya visitas. Usa el `id` real, no el alias.
- Cabeceras de la caja: `no-store`, `noindex`, `no-referrer`, `nosniff`, `X-Frame-Options: DENY` y CSP sin scripts.
- Se usa siempre el `id` real (`data-id`), así la página del alias comparte los sellos. En la copia de `github.io` no hay Functions: se ve el código, sin sellos.
- Probar en local: `wrangler pages dev` como en el contador; abrir `/caja/001?k=caja-prueba-001` (o `002` con `caja-prueba-002`, por compras), sumar sellos con el código que muestra la tarjeta y verlos en `/001/#premios`.

## Cumpleaños (B31)

- **Tarjeta:** acción `cumple` (`href="#cumple"`, `aria-haspopup`) y hoja `#cumple` con el regalo (`.cu-premio`), las condiciones, nombre, celular (`type=tel`), mes (`<select>` de 12) y la casilla obligatoria sin marcar (`.cu-casilla`) con el texto de `textoAutorizacion()` y enlace a `POLITICA_URL`. Es un `<form method="post">` normal a `<CONTADOR_URL>/cumple/<id>` (o `/cumple/<id>` sin contador), con `required` del navegador: no necesita JavaScript.
- **Servidor (`functions/cumple/[id].js` + `servidor/cumple.js`):** solo POST (GET redirige a `/<id>/#cumple`). Exige `panel.json` con `cumple`, Origin propio, `null` o `*.github.io`, nombre de 2 a 40 letras, `celularValido()` de la caja, mes 1–12 y `autorizo=si`. Tabla `cumple (id, telefono, nombre, mes, autorizado, texto, canjeado)` con clave `(id, telefono)`: un celular ya inscrito **no se cambia** desde la tarjeta (`ON CONFLICT DO NOTHING`, y la respuesta es el mismo "Listo" para no revelar quién está inscrito), porque cualquiera podría escribir el número de otra persona; para corregir, el dueño borra la fila en el panel y la persona se inscribe de nuevo. `texto` es la autorización aceptada; `canjeado` es el año en que se entregó el regalo. Límite: 10 inscripciones por hora, por negocio y por conexión (`cumple_envios`, con `quien()`). Responde una página clara con el color del negocio ("¡Listo, <nombre>!"), con `no-store`, CSP sin scripts y `X-Frame-Options: DENY`.
- **Panel:** `bloqueCumple()` (cumplen en el mes que se ve, inscritos y regalos entregados) y `/panel/<id>?k=…&ver=cumple&cm=<1-12>` (`paginaCumple()`): por persona, nombre, celular oculto, "Saludar por WhatsApp" (`wa.me` con saludo y regalo), "Marcar regalo entregado" / "Deshacer entregado" y "Borrar sus datos" dentro de un `<details>`. Las acciones son POST a la misma dirección (`onRequestPost`, con revisión de Origin).
- El correo del día 1 con la lista en PDF es B32 y todavía no existe. Los datos no están en `dist/` ni en GitHub Pages: solo en D1.

## Particularidades conocidas

- El robot avisa (sin detener el build) cuando un botón extra lleva a una red que ya está en los círculos, cuando dos acciones empiezan igual ("Pedir" y "Pedidos") y cuando el titular trae signos sobrantes (". !").
- `PRODUCT.md` y `.impeccable/` son de la skill `impeccable` (instalada en local, fuera de Git): contexto del producto y diagnósticos de `/impeccable critique`.
- Los tokens se reemplazan en secuencia. Un texto de la hoja que contenga `{{OTRO_TOKEN}}` se expande. No es XSS, pero es un error.
- Las visitas que entran por la copia de GitHub Pages (`github.io`) no se cuentan: el contador solo corre en Cloudflare. Los toques sí, porque los botones apuntan a `CONTADOR_URL`.
- El formulario a WhatsApp, el Wi-Fi, los teléfonos y los correos no pasan por el contador.
- Los SVG de `logos/` se publican sin limpiar.
- La vista previa al compartir depende de quien la genere: `robots.txt` (`Disallow: /`) puede dejar sin datos a los rastreadores que lo respetan, como el de X. No se ha probado en un chat real, porque requiere publicar.
- El workflow despliega en cada ejecución (cada 10 min) aunque no haya cambios.
- El token del botón de Apps Script tiene permiso Contents: Read and write. Es más de lo necesario.
- `urlSegura()` rechaza enlaces sin dominio real (una palabra suelta como "Sedes").
- Los cron de GitHub Actions se retrasan horas cuando GitHub tiene carga; "cada 10 minutos" es lo pedido, no lo garantizado.
- La lectura de vínculos con nombre (`.xlsx`) se probó con un archivo armado a mano, no con una exportación real de Google. Si Google cambia el formato, el robot avisa y sigue con el texto del CSV.

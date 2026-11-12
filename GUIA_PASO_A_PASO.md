# Tarjetas digitales: guía paso a paso (versión 3)

Cómo funciona todo en una frase: **tú editas una hoja de Google, un robot de GitHub convierte cada fila en una página ya terminada, y el cliente solo abre esa página (sin esperas).**

```
Hoja de Google  ──(robot de GitHub)──►  Una página por negocio  ──►  QR / NFC del hablador
 (tú editas)        (automático)          tudominio.co/001
```

---

## Qué trae esta versión (diseño "Mostrador" y tema "Premium")

1. **Dos diseños.** Por defecto, **Mostrador**: arriba, la foto del local con corte limpio (opcional) y un **toldo con el color del negocio**, con el logo montado sobre el borde. Abajo, fondo claro con la reseña y los botones. Si escribes `premium` en la columna `estilo`, ese negocio usa **Premium**: fondo negro con detalles de oro.
2. **Color secundario automático.** El robot saca un segundo color del logo (por ejemplo, el verde de BA CU) y lo usa en las estrellas y el botón de la reseña. No hay que escribirlo.
3. **Foto de portada opcional** (columna `portada`): una foto del local o de un plato arriba, con el logo encima. Sin foto, el titular se hace un poco más grande. En los dos casos todo va centrado.
4. **Wi-Fi gratis** (columnas `wifi_red` y `wifi_clave`): un botón que muestra la red y la clave al tocarlo.
5. **Íconos que corresponden a cada botón:** bolsa para pedidos, tienda para sedes, cubiertos para el menú, calendario para citas, y "Pide en Rappi" automático con un enlace de Rappi.
6. **La reseña es un tiquete con cinco estrellas vacías y un botón "Calificar en Google →".** Una ola breve ilumina las estrellas, pero **no se muestran llenas**, para no presionar al cliente a poner cinco. Todo el tiquete lleva a la reseña de Google, donde el cliente elige su calificación.
7. **Acciones en mosaico** (menú, WhatsApp, pedidos…). La primera de la lista va a todo el ancho, en el color de la marca: pon primero la más importante con `orden_botones`. Las demás van en dos columnas, con el ícono arriba y el texto abajo. Si una queda sola, ocupa todo el ancho. Al tocar un botón, se hunde y su ícono se llena, para que el cliente sepa que funcionó. En Premium son botones cuadrados con filo dorado.
8. **Formulario a WhatsApp** (en un botón extra): el cliente elige el motivo con un toque, escribe su nombre y la fecha, y te llega a WhatsApp un mensaje ordenado. Ver "Formulario a WhatsApp" en la sección de botones.
9. **Subtítulo, etiqueta y lienzo** (opcionales), y **contador de visitas y toques** (ver PASO 4): una línea corta bajo el texto de cada botón ("Elige el día y la hora"), una etiqueta como "Nuevo" y un fondo suave que se queda quieto al bajar (`lienzo`: formas, puntos o arcos). Ver la sección de botones y la de colores.
10. **Redes sociales en círculos** al final de la página: Instagram, Facebook, TikTok, YouTube, X y Telegram.
11. **El nombre no se repite** si el logo ya lo trae escrito (columna `nombre_en_logo`).
12. **Vínculos con nombre:** puedes usar Insertar → Vínculo con un texto corto; el robot usa el enlace real.
13. **Logos que siempre se ven bien.** El robot recorta márgenes y pone el logo en una placa que se adapta a su forma. Si el logo trae su propio fondo liso (como un JPG con fondo crema), la placa toma ese color. Si trae un fondo con degradado, se muestra tal cual con las esquinas redondeadas.
14. **Textos editables desde la hoja:** el titular, el nombre de cada botón y la nota debajo de las estrellas.
15. **Actualizaciones rápidas:** el robot lee la hoja directamente y corre cada 10 minutos (GitHub a veces lo retrasa; usa "Publicar ahora" para verlo al momento).
16. **Compatibilidad con celulares viejos:** logos en PNG/JPG, sin funciones recientes del navegador, y se le pide al navegador que no oscurezca la página por su cuenta.

### Cómo actualizar tu repositorio

Reemplaza o agrega estos archivos (en VS Code, o en GitHub con **Add file → Upload files**) y confirma el cambio. Después de reemplazar `package.json`, ejecuta `npm install` una vez en tu computador (instala la tipografía del titular) y sube también `package-lock.json`:

| Archivo | Qué hacer |
|---|---|
| `generar.mjs` | Reemplazar |
| `iconos.mjs` | Agregar (es nuevo) |
| `plantilla.html` | Reemplazar |
| `package.json` y `package-lock.json` | Reemplazar / agregar |
| `.github/workflows/publicar.yml` | Reemplazar (ahora corre cada 10 minutos) |

Luego sigue la sección **"Actualizaciones rápidas"** para activar la lectura directa de la hoja. Si no haces nada más, todo sigue funcionando como antes con tu enlace publicado.

---

## PASO 1: La hoja de Google

Pestaña **Negocios**, fila 1 con estos encabezados (el orden no importa; solo agrega los que necesites):

| Columna | Qué escribir | ¿Obligatoria? |
|---|---|---|
| `id` | Número único: 001, 002, 003… **Nunca se cambia** | Sí |
| `estado` | `activo` o `pausado` (ver valores abajo) | Sí |
| `nombre` | Nombre del negocio | Sí |
| `slogan` | Frase corta bajo el nombre | No |
| `color` | Color del negocio, ej. `#B83A5B` | No |
| `logo` | Nombre del archivo en la carpeta `logos`, ej. `logo004.png` | No |
| `logo_fondo` | `blanco`, `oscuro` o `sin` | No |
| `titular` | Frase grande de arriba. Vacío = "Nos encantó verte." (máx. unas 30 letras) | No |
| `google_resenas` | Enlace para dejar reseña | Recomendada |
| `texto_resenas` | Texto junto al logo de Google. Vacío = "¿Cómo te fue? Cuéntanos tu experiencia". El botón "Calificar en Google" va siempre debajo, así que no hace falta repetir "Google" aquí | No |
| `nota_resenas` | Línea bajo las estrellas. Vacío = "20 segundos. Ayudas a que más gente nos encuentre." | No |
| `catalogo` | Enlace al catálogo | No |
| `texto_catalogo` | Nombre del botón. Vacío = "Ver catálogo" | No |
| `whatsapp` | Número, ej. `300 123 4567` | Recomendada |
| `mensaje_whatsapp` | Mensaje que aparece escrito al abrir el chat | No |
| `texto_whatsapp` | Nombre del botón. Vacío = "Escríbenos" | No |
| `boton4_url`, `boton4_texto`, `boton4_icono` | Un botón extra: una página, un teléfono para llamar o un correo (ver "Llamar y correo") | No |
| `boton5_…` a `boton9_…` | Más botones extra, con las mismas tres columnas. Crea solo las columnas que vayas a usar. El máximo es `boton9` | No |
| `orden_botones` | El orden de los botones cuadrados | No |
| `estilo` | Vacío = diseño normal; `premium` = negro y oro | No |
| `portada` | Foto del local o de un producto, guardada en la carpeta `logos/` (ej. `foto005.jpg`). Va arriba, en grande. El robot la recorta y la aligera | No |
| `wifi_red`, `wifi_clave` | Nombre y clave del Wi-Fi para clientes. Aparece un botón "Wi-Fi gratis" que muestra los datos al tocarlo | No |
| `nombre_en_logo` | `si` si el logo ya trae el nombre escrito: así no se repite debajo | No |
| `instagram`, `facebook`, `tiktok`, `youtube`, `x`, `telegram` | El usuario (`@minegocio`) o el enlace completo de cada red. Salen como círculos con el ícono al final de la página | No |
| `alias` | Nombre corto extra para el enlace, ej. `estilonorte` | No |

**Íconos de los botones:** el robot elige el ícono solo, según el texto del botón y el enlace. "Pedidos" o "Domicilios" muestran una bolsa de entrega; "Sedes" o "Tiendas", una tienda; "Menú" o "Carta", cubiertos; "Citas", "Agendar" o "Reservas", un calendario (sirve para barberías, consultorios, spas…). Un enlace de **Rappi** muestra la bolsa y el texto "Pide en Rappi"; uno de Doctoralia, Calendly o Booksy, el calendario. Si quieres otro, elígelo de la lista en `boton4_icono` o escribe una palabra en español: el robot entiende mayúsculas, plurales y muchas palabras ("Iglesia", "Misas", "Grupos", "Requisitos", "Matrimonios", "Consultorio", "Barbería", "Conjunto", "Ayuda"…). Íconos disponibles: `menu`, `catalogo`, `domicilio`, `tienda`, `reservas`, `llamar`, `correo`, `horario`, `promos`, `pago`, `maps`, `waze`, `web`, `enlace`, `formulario`, `iglesia`, `personas`, `boda`, `salud`, `casa`, `documento`, `tijeras`, `info`. Si escribes una palabra que no conoce, el robot avisa y elige uno solo.

**Color secundario:** no hay que escribirlo. El robot lo saca del logo (por ejemplo, el verde de BA CU) y lo usa en las estrellas y los íconos.

**Wi-Fi en la tarjeta:** la clave queda visible para cualquiera que abra la tarjeta. Úsalo solo con la red de clientes, nunca con la red interna del negocio.

**Enlaces largos:** en las columnas de enlaces (reseñas, catálogo, botones extra y redes) puedes usar **Insertar → Vínculo** y ponerle un nombre corto (por ejemplo "Sedes"), para que la celda no se llene con un enlace enorme. El robot usa el enlace real, no el nombre. Si algún día ves el aviso ⚠ "No se pudieron leer los vínculos con nombre", pega el enlace completo en esas celdas.

**Columna `estilo`:** déjala vacía para el diseño normal (Mostrador) o escribe `premium` para el diseño negro y oro. Si tenías valores viejos en esa columna, bórralos: cualquier palabra distinta de `premium` hace que el robot avise con ⚠ y use el diseño normal.

**Columna `color`:** es el **color principal de la marca** del negocio, en hexadecimal (por ejemplo `#AD6225`). En el diseño Mostrador pinta el toldo, el primer botón y los círculos de redes. Usa el color **oficial** (del manual de marca), no uno tomado de una captura o de Instagram, porque esos traen filtros. En Premium no se usa.

Mira `ejemplo-negocios.csv`: tiene filas de ejemplo con todo esto.

**Importante:** selecciona la columna `id` y aplica **Formato → Número → Texto sin formato**, para que `001` no se convierta en `1`.

### Valores permitidos

| Columna | Valores | Si lo dejas vacío |
|---|---|---|
| `estado` | `activo` (también `si` o `activa`). Cualquier otra cosa, por ejemplo `pausado`, oculta la página | La página se oculta |
| `logo_fondo` | `blanco` (placa blanca), `oscuro` (placa oscura, para logos blancos) o `sin` (el logo va directo sobre el color) | Se elige solo (ver abajo) |
| `orden_botones` | Nombres separados por coma: `catalogo`, `whatsapp`, `boton4` a `boton9`. La reseña siempre va arriba, no hace falta ponerla | `catalogo, whatsapp, boton4` y así hasta `boton9` |
| `boton4_icono` a `boton9_icono` | Los de la lista de la hoja (`maps`, `menu`, `reservas`, `horario`, `iglesia`, `personas`, `boda`, `salud`, `casa`, `documento`, `tijeras`, `info`…) o una palabra en español que el robot entienda | Se elige solo según el enlace |

Consejo: en `estado` y `logo_fondo` pon una lista desplegable en **Datos → Validación de datos**, así no te equivocas al escribir.

---

## Logos: qué enviar y cómo se ajustan

| Característica | Lo ideal | Aceptable |
|---|---|---|
| **Formato** | **SVG** o **PNG con fondo transparente** | JPG o WEBP |
| **Tamaño** | Entre 800 y 2000 píxeles en el lado más largo | Mínimo 300 píxeles |
| **Forma** | Cualquiera, entre cuadrado y 3 veces más ancho que alto | Más de 5 a 1 se verá pequeño |
| **Peso** | Menos de 1 MB | Hasta unos 5 MB |
| **Márgenes** | No importan: el robot los recorta | |

Qué hace el robot con cada logo:

1. **Recorta** los márgenes vacíos (blancos o transparentes).
2. **Reduce** el archivo y lo convierte a PNG (si tiene transparencia) o JPG, que abren en cualquier celular.
3. **Lo ajusta** al espacio disponible sin deformarlo. Un logo muy ancho se pone arriba del nombre; uno cuadrado o redondo, al lado.
4. **Elige la placa solo** (si `logo_fondo` está vacío): logo transparente = placa blanca (oscura si el logo es blanco o muy claro); logo con fondo liso = placa de ese mismo color, sin bordes visibles; logo con fondo degradado = se muestra tal cual, con esquinas redondeadas.
5. **Te avisa** (⚠) si es muy pequeño, muy alargado o no se encuentra. Si te equivocas en el nombre, el aviso te muestra los archivos que sí existen.

Los SVG no se tocan: se ven nítidos a cualquier tamaño.

---

## Botones: íconos, nombres y orden

**Reseña.** El bloque de estrellas aparece si hay `google_resenas`. Siempre va arriba.

**Botones.** En el diseño Mostrador van en mosaico; en Premium, cuadrados. Cada uno muestra un ícono que el robot elige solo:

| Si el botón… | Ícono |
|---|---|
| Lleva a Instagram, Facebook, TikTok, YouTube, X, Telegram, Google Maps o Waze | El de esa red o mapa |
| Dice "Menú" o "Carta" | Cubiertos |
| Dice "Pedidos", "Domicilios" o "Pide…", o lleva a Rappi o DiDi Food | Bolsa de entrega |
| Dice "Sedes", "Tiendas" o "Locales" | Tienda |
| Dice "Citas", "Agendar", "Reservas" o "Turnos", o lleva a Doctoralia, Calendly, Booksy o AgendaPro | Calendario |
| Dice "Cómo llegar" o "Ubicación" | Pin del mapa |
| Lleva a un teléfono, o dice "Llámanos" o "Teléfono" | Teléfono |
| Lleva a un correo, o dice "Correo" o "Email" | Sobre |
| Dice "Promociones", "Horario", "Pagos" o "Catálogo" / "Servicios" | Etiqueta, reloj, tarjeta o cuadrícula |
| WhatsApp | Logo de WhatsApp |
| Nada de lo anterior | Globo (página web) |

Si el ícono automático no es el que quieres, escribe el que prefieras en `boton4_icono` a `boton9_icono` (ver la lista en "Íconos de los botones").

**Nombres.** Escribe el texto en su columna. Caben **unas 16 letras** ("Ver catálogo", "Escríbenos", "Cómo llegar"). Si te pasas, el robot lo avisa con un ⚠. Si dejas vacío el texto de un botón de Rappi, dice "Pide en Rappi"; uno de citas, "Agenda tu cita".

**Llamar y correo.** Solo en `boton4_url` a `boton9_url` (no en reseñas, catálogo ni redes):

| Quieres | Escribe | Si dejas vacío el texto |
|---|---|---|
| Llamar a un celular | `300 123 4567` | "Llámanos" |
| Llamar a un fijo de Colombia (con el 60 y el indicativo) | `601 555 1234` | "Llámanos" |
| Llamar a una línea gratuita | `01 8000 123456` | "Llámanos" |
| Llamar a otro país | `tel:+1 415 555 2671` | "Llámanos" |
| Escribir un correo | `hola@negocio.com` | "Enviar correo" |

El ícono sale solo. Si el número o el correo no están completos, el robot avisa con un ⚠ y no muestra el botón. **En Google Sheets no empieces la celda con `+`**, porque lo toma como una fórmula: escribe `tel:` antes, como en el ejemplo. Los números fijos de 7 dígitos sin el 60 ya no se pueden marcar en Colombia, así que el robot no los acepta. El correo no admite asunto ni copias (`?subject=`, `?bcc=`).

**Formulario a WhatsApp.** También solo en `boton4_url` a `boton9_url`. Sirve para que el cliente pida algo con sus datos, sin escribir todo desde cero: una misa en la parroquia, una cita en la barbería, una reserva, un encargo. Al tocar el botón sube una hoja con:

- **¿Qué necesitas?**: las opciones que tú escribas, como botones grandes. Es obligatorio.
- **Nombre**: obligatorio.
- **Detalle o fecha**: opcional.

Al tocar "Enviar por WhatsApp" se abre WhatsApp con este mensaje, listo para enviar al número de la columna `whatsapp`:

```
*NUEVA SOLICITUD WEB*
*Agenda tu cita*

• *Nombre:* Rosa Gómez
• *Motivo:* Corte y barba
• *Detalle:* Sábado 10 a. m.
```

Cómo se escribe en la hoja:

| Columna | Escribe | Ejemplo |
|---|---|---|
| `boton5_url` | `formulario:` y las opciones separadas por `\|` (la rayita vertical; en la mayoría de teclados está a la izquierda del 1 o con AltGr + 1) | `formulario: Intención de misa \| Misa de difuntos \| Acción de gracias \| Otro` |
| `boton5_texto` | El texto del botón y el título de la hoja (unas 16 letras) | `Pedir una misa` |

- Hasta **6 opciones**, de unas 24 letras cada una. Si pones más, el robot muestra las primeras 6 y avisa con un ⚠.
- Si escribes solo `formulario` (sin opciones), el motivo queda como una caja para escribir.
- **Necesita la columna `whatsapp`** con un número válido: es a donde llegan las solicitudes. Si falta, el robot avisa y no muestra el botón.
- Ícono: una hoja con renglones. Si el texto dice "cita" o "reserva", sale el calendario; si dice "pedido" o "encargo", la bolsa. También lo puedes escoger en `boton5_icono`.
- **No guardamos nada:** los datos van directo del celular del cliente a tu WhatsApp. El cliente siempre ve el mensaje antes de enviarlo.
- **Celulares muy viejos** (o con JavaScript apagado): en lugar de los botones aparece una sola caja con "Nombre:", "Motivo:" y "Detalle o fecha:" ya escritos, para completar. El mensaje llega igual, solo que menos ordenado.

**Formulario con tus propias preguntas.** Si necesitas otras preguntas (por ejemplo, para las misas), agrega la columna `boton5_campos` (o la del botón que uses) y escribe **una pregunta por renglón**. En Google Sheets, **Alt + Enter** hace un renglón nuevo dentro de la celda. También puedes separarlas con `;`. En `boton5_url` basta con escribir `formulario`.

Ejemplo para una parroquia (`boton5_texto` = `Pedir una misa`):

```
Intención: Eterno descanso | Salud y recuperación | Acción de gracias | Intenciones particulares
¿Por quién se ofrece la misa?
¿Quién ofrece la misa?
Fecha y hora
Tipo de misa (desplegable): Comunitaria | Particular
```

| Si escribes | Aparece |
|---|---|
| `Intención: A \| B \| C` | Las opciones como botones grandes (hasta 6) |
| `Tipo de misa (desplegable): A \| B` | Una lista desplegable (hasta 12 opciones) |
| `Fecha y hora` | Calendario con reloj. No deja escoger días que ya pasaron |
| `Fecha` / `Hora` | Solo calendario / solo reloj |
| `Teléfono` o `Celular` | Teclado de números |
| `Intención`, `Detalle`, `Mensaje` u `Observaciones` (sin opciones) | Una caja grande |
| Cualquier otra pregunta | Una caja de una línea |
| `(opcional)` al final | Esa pregunta no es obligatoria. **Las demás sí lo son** |

Si el tipo automático no te sirve, escríbelo entre paréntesis: `(fecha)`, `(hora)`, `(fecha y hora)`, `(número)`, `(teléfono)`, `(correo)`, `(texto largo)`. Máximo 8 preguntas: un formulario largo cansa al cliente.

Te llega así (las fechas, escritas en palabras):

```
*NUEVA SOLICITUD WEB*
*Pedir una misa*

• *Intención:* Eterno descanso
• *¿Por quién se ofrece la misa?* Rosa Gómez
• *¿Quién ofrece la misa?* Familia Gómez Pérez
• *Fecha y hora:* domingo 15 de noviembre de 2026, 7:30 p. m.
• *Tipo de misa:* Comunitaria
```

Ideas por negocio: parroquia (intención de misa, bautizo, matrimonio, partida de bautismo), consultorio (valoración, control, urgencia), restaurante (almuerzo, cena, cumpleaños), peluquería (corte, color, uñas), veterinaria (baño, consulta, vacuna), taller (mantenimiento, frenos, diagnóstico), conjunto residencial (reservar salón, reportar daño), panadería (encargo de torta).

**Cantidad.** Puedes tener hasta 8 acciones: catálogo, WhatsApp y `boton4` a `boton9`, además de la reseña, el Wi-Fi y las redes. Con más, el cliente tarda en encontrar lo que busca y la tarjeta se vuelve una lista; si necesitas más, júntalas en una página y pon un solo botón. Una columna `boton10_url` no se usa: el robot lo avisa con un ⚠. En Premium: con 1 botón queda ancho; con 2 o 4, en parejas; con 3, en fila; con 5, tres arriba y dos abajo; con 6 a 8, en parejas (con 7, el último queda ancho).

**Orden.** En `orden_botones` escribe los nombres separados por comas, por ejemplo `whatsapp, catalogo`. Un botón sin datos simplemente no aparece.

**Subtítulo y etiqueta (opcionales).** Debajo del texto de un botón puedes poner una línea corta que explique qué hace, y en la esquina una etiqueta pequeña para llamar la atención:

| Botón | Subtítulo | Etiqueta |
|---|---|---|
| Catálogo | `detalle_catalogo` | `etiqueta_catalogo` |
| WhatsApp | `detalle_whatsapp` | `etiqueta_whatsapp` |
| Botón 4 a 9 | `boton4_detalle` … `boton9_detalle` | `boton4_etiqueta` … `boton9_etiqueta` |

Ejemplo: `boton4_texto` = `Agenda tu cita`, `boton4_detalle` = `Elige el día y la hora`, `boton4_etiqueta` = `Nuevo`. El subtítulo cabe en unas 30 letras y la etiqueta en unas 10; si te pasas, el robot avisa con un ⚠. Úsalos con medida: si todos los botones tienen etiqueta, ninguna resalta.

**Tarjeta sin reseña.** Si `google_resenas` está vacía, no sale el bloque de estrellas y las acciones suben. Sirve para consultorios, conjuntos residenciales y negocios que no buscan reseñas.

## Vista previa al compartir

Cuando alguien pega el enlace de una tarjeta en un chat, la vista previa usa datos de la hoja:

- **Título:** `nombre`.
- **Descripción:** `slogan`. Sin slogan, dice "Contacto y enlaces de" más el nombre.
- **Imagen:** la `portada`. Sin portada, el `logo`, si es JPG o PNG (los logos SVG no se muestran en esas apps).

No hay que hacer nada: el robot arma la dirección de la imagen solo. Al pasar a un dominio propio, crea la variable `SITIO_URL` (paso 4) para que apunte allá.

Las apps guardan la vista previa de cada enlace durante un tiempo, así que un cambio puede tardar en verse. Como las tarjetas están bloqueadas para los buscadores (`robots.txt`), las redes que respetan ese bloqueo, como X, pueden mostrar el enlace sin imagen ni texto.

---

## Colores y fondo

El toldo de arriba lleva el color del negocio. El texto encima se vuelve blanco o negro solo, según qué tan claro sea el color, para que siempre se lea. Abajo, la reseña va en un tiquete blanco, con las estrellas y su botón en el color secundario que el robot saca del logo (más oscuro si hace falta para que se vean bien).

Escribe el color como `#B83A5B` (6 letras o números después del `#`). Si es incorrecto, el robot avisa y usa uno por defecto.

**Lienzo de fondo (opcional).** En la columna `lienzo` puedes poner un fondo suave, del color del negocio, que se queda quieto mientras el cliente baja por la página:

| `lienzo` | Cómo se ve |
|---|---|
| `formas` | Dos círculos grandes y suaves a los lados y un aro abajo |
| `puntos` | Una trama de puntos pequeños |
| `arcos` | Arcos finos que bajan desde arriba, como ondas |
| (vacío) | Fondo claro liso, como siempre |

En Premium el lienzo va en dorado muy tenue.

**Por qué el color puede verse distinto en cada celular.** La pantalla de cada aparato muestra los colores a su manera, y algunos navegadores de Android oscurecen las páginas por su cuenta. La página ya le pide al navegador que no lo haga, pero la diferencia de pantalla a pantalla no se puede eliminar.

---

## Actualizaciones rápidas

**Por qué antes tardaba.** Había tres esperas seguidas: (1) el robot corría solo **cada hora**, (2) Google tarda varios minutos en actualizar la hoja "publicada en la web", y (3) GitHub tarda 1 o 2 minutos en publicar.

**Cómo lo acelera esta versión:**

| Mejora | Qué hace |
|---|---|
| Lectura directa de la hoja | Se salta la espera de Google: el robot lee los datos actuales |
| Robot cada 10 minutos | El cambio se publica solo, sin que hagas nada (en promedio en pocos minutos) |
| Botón "Publicar ahora" (opcional) | Publica en 1 o 2 minutos al presionarlo |

GitHub a veces retrasa las tareas programadas cuando tiene mucha carga, así que los 10 minutos son aproximados.

### Activar la lectura directa (una sola vez)

1. En tu hoja: **Compartir → Acceso general → "Cualquier persona con el enlace" → Lector**.
2. Copia el **ID de la hoja**: es el texto largo de la dirección, entre `/d/` y `/edit`.
3. Mira el número que aparece después de `gid=` en la dirección cuando estás en la pestaña **Negocios**. Normalmente es `0`.
4. En GitHub: **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   - `SHEET_ID` = el ID de la hoja
   - `SHEET_GID` = el número del paso 3 (si es `0` puedes omitirla)
5. **Deja la variable `SHEET_CSV_URL`**: sirve de respaldo. Si la lectura directa falla, el robot usa el enlace publicado y te lo avisa con un ⚠.

> ⚠ Compartir la hoja por enlace hace que **cualquiera que tenga ese enlace pueda ver todas sus pestañas**. Por eso: no guardes en ese archivo precios que cobras, datos de pago ni nada privado. Lleva tus cuentas en **otro archivo** que no compartas.

### Botón "Publicar ahora" (opcional)

1. En GitHub: foto de perfil → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**. Ponle nombre `Hoja de tarjetas`, elige **solo el repositorio** `tarjetas-digitales` y en permisos pon **Contents: Read and write**. Copia el token (solo se muestra una vez).
2. En tu hoja: **Extensiones → Apps Script**, pega el contenido de `apps-script/boton-publicar.gs` y guarda.
3. En Apps Script, ícono de engranaje → **Propiedades de la secuencia de comandos** → agrega `GITHUB_TOKEN` con el token.
4. Recarga la hoja. Verás el menú **Tarjetas → Publicar ahora**.

Este código **no** está en el camino del cliente final: solo lo usas tú al editar.

---

## PASO 2: Publica la hoja como CSV (respaldo)

Solo si quieres tener el respaldo. **Archivo → Compartir → Publicar en la Web →** pestaña **Negocios → CSV → Publicar**, y copia el enlace en la variable `SHEET_CSV_URL`.

## PASO 3: El repositorio en GitHub

Repositorio público `tarjetas-digitales`. Con Git:

```
git init
git add .
git commit -m "Primer envío"
git branch -M main
git remote add origin https://github.com/Eduardoksc/tarjetas-digitales.git
git push -u origin main
```

## PASO 4: Variables de GitHub

**Settings → Secrets and variables → Actions → pestaña Variables**: `SHEET_ID` y `SHEET_GID` (lectura directa) y/o `SHEET_CSV_URL` (respaldo). Opcional: `PIE_TEXTO` y `PIE_URL` para un pie en cada página, y `SITIO_URL` solo cuando pases a un dominio propio (por ejemplo `https://t.tumarca.co`).

**Medir visitas y toques (opcional).** Para saber cuántas personas abren cada tarjeta, qué botones tocan, a qué hora y si llegaron por el QR o por el NFC:
1. En Cloudflare, ve a **Storage & databases → D1 → Create database** y llámala `fides-contador`.
2. Ve a **Workers & Pages → fides-tarjetas → Settings → Bindings → Add → D1 database**. En *Variable name* escribe `CONTADOR` y elige `fides-contador`. Guarda.
3. En GitHub, crea la variable `CONTADOR_URL` con la dirección de las tarjetas en Cloudflare, por ejemplo `https://t.fides-link.com`.
4. Publica de nuevo ("Publicar cambios ahora" o Actions → Run workflow).
5. Al imprimir: el **QR** debe llevar `?o=qr` al final (`https://t.fides-link.com/001/?o=qr`) y el **chip NFC** `?o=nfc`. Así se sabe cómo llegó cada persona. Los QR que ya imprimiste siguen funcionando; esas visitas cuentan "sin origen".

**Panel de resultados para el cliente (opcional).** Cada negocio puede ver sus números del mes en su celular:
1. En la hoja, agrega la columna `clave_panel` (si no existe).
2. En la fila del negocio, inventa una clave de **12 letras o números o más, sin espacios**, difícil de adivinar. Por ejemplo, tres palabras y cuatro números: `tijera-luna-cafe-4821`. No uses el nombre del negocio ni su teléfono.
3. Publica. Para no armar el enlace a mano, agrega en la hoja una columna `enlace_panel` (el robot la ignora) con esta fórmula en la fila 2 y arrástrala hacia abajo, cambiando `A2` por la celda del id y `Z2` por la de `clave_panel`:
   `=SI(Z2="";"";"https://t.fides-link.com/panel/"&A2&"?k="&Z2)`
   El enlace queda así: `https://t.fides-link.com/panel/001?k=tijera-luna-cafe-4821` (cambia `001` por su id y la clave por la suya).
4. Envíaselo por WhatsApp y dile que lo guarde en favoritos. Muestra las visitas del mes, la comparación con el mes anterior, qué botones tocaron más, si llegaron por QR o NFC y su mejor día y hora. Abajo puede ver los meses anteriores.

Quien tenga el enlace ve los números, así que solo dáselo al dueño. Si se filtra, cambia la clave en la hoja y publica: el enlace viejo deja de funcionar. Las llamadas, los correos, los formularios y el Wi-Fi no se cuentan.

No se guarda ningún dato de la persona: solo se suma 1 por hora, tarjeta y botón. Si no haces estos pasos, las tarjetas funcionan igual y no se cuenta nada. Las visitas que entran por la dirección vieja de GitHub (`github.io`) no se cuentan.

## PASO 5: Activa la publicación

**Settings → Pages → Source: GitHub Actions.** Luego **Actions → Publicar tarjetas → Run workflow**. Para ver los avisos de cada negocio, abre la ejecución y entra al paso **Crear las páginas desde la hoja**: ahí salen los ✔ de lo que se creó, los ⚠ de lo que hay que corregir y la fuente de datos que se usó.

## PASO 6: Dominio propio (antes de imprimir nada)

Una tarjeta impresa no se corrige, **el enlace sí**. Compra un dominio corto, conéctalo en **Settings → Pages → Custom domain** y activa **Enforce HTTPS**.

> Antes de tener muchos clientes pagando, revisa los términos de GitHub Pages sobre uso comercial: pueden no permitir usarlo como alojamiento de un negocio. Como el enlace de las tarjetas será tu dominio, mudarte a otro alojamiento (por ejemplo Cloudflare Pages) no afecta lo que ya imprimiste.

---

## Cómo agregar un negocio nuevo (5 minutos)

1. Guarda el logo en la carpeta `logos/` del proyecto (confirma y sincroniza en VS Code).
2. En la hoja agrega una fila: el siguiente `id`, `activo`, nombre, color, logo y enlaces.
3. Espera unos minutos, o presiona **Publicar ahora**.
4. Abre `tudominio.co/004` en tu celular y **pruébalo antes de entregar**: reseña, catálogo, WhatsApp y los demás botones.
5. Genera el QR de ese enlace.

**Pausar un cliente que no pagó:** cambia `estado` a `pausado`. Para reactivarlo, vuelve a `activo`: el mismo QR y NFC vuelven a funcionar.

---

## Cómo administrarlo cuando crezcas

| Negocios | Qué pasa | Qué hacer |
|---|---|---|
| **1 a 10** | Todo se maneja a mano sin problema | Una lista de pasos fija para cada alta (ver arriba). Prueba cada tarjeta en tu celular |
| **10 a 50** | Aparecen errores de datos (enlaces malos, ceros del `id`, logos pequeños) y cuesta recordar quién pagó | Listas desplegables en la hoja, columna de fecha de pago en **otro archivo**, y mira los ⚠ del robot cada semana |
| **50 a 200** | Los logos originales hacen pesar el repositorio; la publicación tarda un poco más; el soporte te consume tiempo | Reduce cada logo a unos 1000 px **antes** de subirlo. Construir las páginas toma poco más de un minuto con 200 logos. Muda el alojamiento a uno que permita uso comercial. Activa las notificaciones de GitHub Actions por correo para enterarte si el robot falla. Haz una copia de la hoja cada mes (Archivo → Descargar) |
| **200 o más** | Una sola hoja se vuelve incómoda y todo depende de ti | Una hoja por cliente o una base de datos, un panel donde el cliente edite sus propios datos, y personas que te ayuden con el soporte |

Reglas que sirven en todas las etapas:
- **Nunca cambies un `id`** ni reutilices uno: está impreso en los habladores.
- **Un solo lugar para las claves** (Google, GitHub, dominio) con verificación en dos pasos.
- **Pausa, no borres:** una fila pausada se puede reactivar sin reimprimir nada.
- **El robot protege el sitio:** si la hoja falla o queda sin negocios activos, no publica nada y lo anterior sigue funcionando.

---

## El hablador: QR y NFC

- **QR siempre. NFC como extra.** El QR funciona en cualquier celular; el NFC no todos lo tienen activo.
- Usa un generador de QR **estático** (que no caduque ni te cobre mensualidad). Imprime el enlace `https://tudominio.co/001`.
- **NFC:** tarjetas o stickers **NTAG213**, con una app gratuita como *NFC Tools*.
- Imprime una frase que invite a actuar: **"Escanea y cuéntanos qué tal estuvo"**.
- Prueba cada hablador en un iPhone y en un Android antes de dejarlo.

---

## Cómo probar en tu computador (opcional)

Con Node instalado:

```
npm install
SHEET_CSV_FILE=ejemplo-negocios.csv node generar.mjs
```

En Windows (PowerShell):

```
npm install
$env:SHEET_CSV_FILE="ejemplo-negocios.csv"; node generar.mjs
```

Crea la carpeta `dist` con las páginas y muestra los avisos en español. Abre `dist/001/index.html` en el navegador.

---

## Si algo falla

| Síntoma | Causa probable | Solución |
|---|---|---|
| "Google devolvió una página web en vez de datos" (lectura directa) | La hoja no está compartida por enlace, o `SHEET_GID` no es el de la pestaña Negocios | Revisa el paso "Activar la lectura directa". Mientras tanto el robot usa el enlace publicado |
| "Falta la dirección de la hoja" | No existen las variables | Paso 4 (pestaña **Variables**, no Secrets) |
| Sale "Esta tarjeta no está disponible" | El enlace no coincide con un `id`, o el `id` perdió los ceros | Formato de la columna `id` como texto sin formato; vuelve a ejecutar el robot |
| Un negocio no aparece | Estado distinto de `activo`, o la fila tiene errores | Mira los ⚠ en el paso "Crear las páginas desde la hoja" |
| El logo no se ve, sale la inicial | El archivo no está subido a GitHub, o el nombre en la columna `logo` no coincide | Confirma que el logo esté en `logos/` **y subido** (commit y push). Las mayúsculas y la extensión ya no importan (`logo005`, `logo005.png` y `LOGO005.PNG` sirven). El aviso lista los archivos que existen |
| Aviso "… no sirve. Usa una página, un teléfono o un correo" | En `botonN_url` hay un número incompleto, un correo mal escrito, otro tipo de enlace o un enlace con usuario y clave | Corrígelo como en "Llamar y correo" |
| Un botón no abre la página correcta | En la celda quedó un texto (ej. "Sedes") en vez de un enlace | Pega el enlace, o usa Insertar → Vínculo; el robot avisa con ⚠ si no es un enlace válido |
| El logo se ve borroso | El archivo es muy pequeño | Pide un SVG o un PNG de más de 800 px |
| Un logo blanco no se ve | La placa es clara | Pon `oscuro` en `logo_fondo` |
| Aviso "el color … es casi blanco" | En `color` quedó blanco o un color muy claro, y la tarjeta se perdería | El robot usa el color del logo mientras tanto. Escribe en `color` el color fuerte de la marca (el aviso te lo sugiere) |
| Aviso "los botones … se parecen" | Dos botones empiezan igual, como "Pedir" y "Pedidos" | Cambia el texto de uno, por ejemplo "Tienda en línea" |
| Aviso "ya sale en los círculos de redes" | Un botón extra lleva a la misma red que la columna de esa red | Borra el botón o la columna; no hace falta mostrarlo dos veces |
| El titular se sale o queda enorme | Es demasiado largo | Usa menos de 30 letras en `titular` |
| Un logo trae marca de agua (por ejemplo, de una herramienta de IA) | El archivo original ya la tenía | Pide al cliente el logo original sin marca de agua |
| En el celular se ve distinto que en el computador | El celular guarda la versión anterior de la página | Abre el enlace en una ventana privada o borra los datos del navegador; espera unos minutos después de publicar. Si persiste, mándame una captura y el modelo del celular |
| El cambio no se ve | Falta publicar, o el robot aún no corrió | Espera hasta 10 minutos, presiona **Publicar ahora**, o ejecuta el robot a mano en **Actions** |
| El robot dejó de correr solo | GitHub pausa tareas programadas tras 60 días sin actividad en el repositorio | Haz un cambio pequeño o ejecútalo a mano |

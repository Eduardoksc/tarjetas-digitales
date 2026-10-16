# Tarjetas digitales: guía paso a paso (versión 3)

Cómo funciona todo en una frase: **tú editas una hoja de Google, un robot de GitHub convierte cada fila en una página ya terminada, y el cliente solo abre esa página (sin esperas).**

```
Hoja de Google  ──(robot de GitHub)──►  Una página por negocio  ──►  QR / NFC del hablador
 (tú editas)        (automático)          tudominio.co/001
```

---

## Qué trae esta versión

1. **Logos estandarizados.** El robot recorta los márgenes vacíos, los deja en un tamaño estándar y la tarjeta se adapta a su forma.
2. **El color cambia toda la página.** El primer botón (por defecto el de reseñas) lleva el color del negocio, un poco más profundo, con un borde blanco para que se distinga.
3. **Íconos de marca en cada botón:** el de WhatsApp, Instagram, Facebook, TikTok, YouTube, Google Maps, etc. El ícono se elige solo según el enlace.
4. **Botones personalizables:** nombre, orden y un botón extra más.
5. **Actualizaciones rápidas:** el robot lee la hoja directamente (sin esperar a que Google "publique") y corre cada 10 minutos. Hay además un botón opcional "Publicar ahora" en la hoja.
6. **Mejor compatibilidad con celulares viejos:** logos en PNG/JPG (no WebP) y un diseño que no depende de funciones recientes del navegador.

### Cómo actualizar tu repositorio

Reemplaza o agrega estos archivos (en VS Code, o en GitHub con **Add file → Upload files**) y confirma el cambio:

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
| `slogan` | Frase corta | No |
| `color` | Color del negocio, ej. `#B83A5B` | No |
| `estilo` | `completo` o `suave` | No |
| `logo` | Nombre del archivo en la carpeta `logos`, ej. `logo004.png` | No |
| `logo_fondo` | `blanco`, `oscuro` o `sin` | No |
| `google_resenas` | Enlace para dejar reseña | Recomendada |
| `texto_resenas` | Nombre del botón. Vacío = "Califícanos en Google" | No |
| `catalogo` | Enlace al catálogo | No |
| `texto_catalogo` | Nombre del botón. Vacío = "Ver catálogo" | No |
| `whatsapp` | Número, ej. `300 123 4567` | Recomendada |
| `mensaje_whatsapp` | Mensaje que aparece escrito al abrir el chat | No |
| `texto_whatsapp` | Nombre del botón. Vacío = "Escríbenos por WhatsApp" | No |
| `boton4_texto`, `boton4_url`, `boton4_icono` | Un botón extra (redes, web, ubicación…) | No |
| `boton5_texto`, `boton5_url`, `boton5_icono` | Otro botón extra | No |
| `orden_botones` | El orden de los botones | No |
| `alias` | Nombre corto extra para el enlace, ej. `estilonorte` | No |

Mira `ejemplo-negocios.csv`: tiene filas de ejemplo con todo esto.

**Importante:** selecciona la columna `id` y aplica **Formato → Número → Texto sin formato**, para que `001` no se convierta en `1`.

### Valores permitidos

| Columna | Valores | Si lo dejas vacío |
|---|---|---|
| `estado` | `activo` (también vale `si` o `activa`). Cualquier otra cosa, por ejemplo `pausado`, oculta la página | La página se oculta |
| `estilo` | `completo` (toda la página del color del negocio) o `suave` (fondo claro con un toque de color y el primer botón en el color del negocio) | `completo` |
| `logo_fondo` | `blanco` (tarjeta blanca), `oscuro` (tarjeta oscura, para logos blancos) o `sin` (sin tarjeta, directo sobre el color) | Se elige solo: tarjeta blanca, u oscura si el logo es claro |
| `orden_botones` | Nombres separados por coma: `resenas`, `catalogo`, `whatsapp`, `boton4`, `boton5` | `resenas, catalogo, whatsapp, boton4, boton5` |
| `boton4_icono`, `boton5_icono` | `instagram`, `facebook`, `tiktok`, `youtube`, `x`, `telegram`, `maps`, `waze`, `web`, `enlace` | Se elige solo según el enlace |

Consejo: en `estado`, `estilo` y `logo_fondo` pon una lista desplegable en **Datos → Validación de datos**, así no te equivocas al escribir.

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
3. **Lo ajusta** al espacio disponible sin deformarlo: uno ancho ocupa el ancho, uno cuadrado se ve más grande y uno alto se acomoda a lo alto.
4. **Si el logo es blanco o muy claro**, lo pone solo sobre una tarjeta oscura.
5. **Te avisa** (⚠) si es muy pequeño, muy alargado o no se encuentra. Si te equivocas en el nombre, el aviso te muestra los archivos que sí existen.

Los SVG no se tocan: se ven nítidos a cualquier tamaño.

---

## Botones: íconos, nombres y orden

**Íconos.** Cada botón muestra el ícono del servicio al que lleva:

| Botón | Ícono |
|---|---|
| Reseñas | Estrella |
| Catálogo | Lista |
| WhatsApp | Logo de WhatsApp |
| Extras (`boton4`, `boton5`) | Se elige según el enlace: Instagram, Facebook, TikTok, YouTube, X, Telegram, Google Maps, Waze; cualquier otra página muestra un globo |

Si el ícono automático no es el que quieres, escribe el que prefieras en `boton4_icono` o `boton5_icono`.

**Nombres.** Escribe el texto en su columna (`texto_resenas`, `texto_catalogo`, `texto_whatsapp`, `boton4_texto`, `boton5_texto`). Si un extra no tiene texto, usa uno según su ícono: "Síguenos en Instagram", "Cómo llegar", etc. Procura que sea corto (menos de 40 letras).

**Orden.** En `orden_botones` escribe los nombres separados por comas. El primero queda arriba, más grande y resaltado con el color del negocio.

| Negocio | `orden_botones` |
|---|---|
| Restaurante con domicilios | `catalogo, whatsapp, resenas` |
| Peluquería o barbería | `whatsapp, resenas` |

Los botones que no estén en la lista van al final, y un botón sin datos simplemente no aparece.

---

## Colores y fondo

- `completo` (por defecto): toda la página lleva el color del negocio. El texto se vuelve blanco u oscuro solo, según qué tan claro sea el color. Los botones son blancos con un ícono del color del negocio, y el primero va resaltado con el color del negocio y un borde blanco.
- `suave`: fondo claro con un toque del color, y el primer botón lleva el color completo.

Escribe el color como `#B83A5B` (6 letras o números después del `#`). Si es incorrecto, el robot avisa y usa uno por defecto.

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

**Settings → Secrets and variables → Actions → pestaña Variables**: `SHEET_ID` y `SHEET_GID` (lectura directa) y/o `SHEET_CSV_URL` (respaldo). Opcional: `PIE_TEXTO` y `PIE_URL` para un pie en cada página.

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
| El logo no se ve, sale la inicial | El nombre del archivo no coincide con la columna `logo` | El aviso lista los archivos que existen; corrige mayúsculas y extensión |
| El logo se ve borroso | El archivo es muy pequeño | Pide un SVG o un PNG de más de 800 px |
| Un logo blanco no se ve | El fondo es claro | Pon `oscuro` en `logo_fondo` |
| En el celular se ve distinto que en el computador | El celular guarda la versión anterior de la página | Abre el enlace en una ventana privada o borra los datos del navegador; espera unos minutos después de publicar. Si persiste, mándame una captura y el modelo del celular |
| El cambio no se ve | Falta publicar, o el robot aún no corrió | Espera hasta 10 minutos, presiona **Publicar ahora**, o ejecuta el robot a mano en **Actions** |
| El robot por hora dejó de correr | GitHub pausa tareas programadas tras 60 días sin actividad en el repositorio | Haz un cambio pequeño o ejecútalo a mano |

# Tarjetas digitales: guía paso a paso

Cómo funciona todo en una frase: **tú editas una hoja de Google, un robot de GitHub convierte cada fila en una página ya terminada, y el cliente solo abre esa página (sin esperas).**

```
Hoja de Google  ──(robot de GitHub)──►  Una página por negocio  ──►  QR / NFC del hablador
 (tú editas)        (automático)          tudominio.co/001
```

Nada de esto cuesta dinero, salvo el dominio propio (opcional pero muy recomendado).

---

## Qué trae esta carpeta

| Archivo | Para qué sirve |
|---|---|
| `generar.mjs` | El "cocinero": lee la hoja y crea una página por negocio |
| `plantilla.html` | El diseño que se repite en todos los negocios |
| `.github/workflows/publicar.yml` | El robot de GitHub que lo hace todo solo |
| `apps-script/boton-publicar.gs` | (Opcional) Botón en tu hoja para publicar al instante |
| `logos/` | Aquí guardas los logos de tus clientes |
| `ejemplo-negocios.csv` | Ejemplo de cómo debe verse la hoja |

---

## PASO 1: Prepara la hoja de Google

1. Crea una hoja nueva en Google Sheets y ponle de nombre **Tarjetas**.
2. Renombra la pestaña de abajo como **Negocios**.
3. En la **fila 1** escribe estos encabezados, uno por columna, **exactamente así**:

| Columna | Qué escribir | ¿Obligatoria? |
|---|---|---|
| `id` | Número único: 001, 002, 003… **Nunca se cambia** | Sí |
| `estado` | `activo` o `pausado` | Sí |
| `nombre` | Nombre del negocio | Sí |
| `slogan` | Frase corta (opcional) | No |
| `color` | Color del negocio, ej. `#B83A5B` | No |
| `logo` | Nombre del archivo en la carpeta `logos`, ej. `estilo-norte.png` | No |
| `google_resenas` | Enlace para dejar reseña (ver abajo) | Recomendada |
| `catalogo` | Enlace al catálogo | No |
| `whatsapp` | Número, ej. `300 123 4567` | Recomendada |
| `mensaje_whatsapp` | Mensaje que aparece escrito al abrir el chat | No |
| `boton4_texto` | Texto de un botón extra, ej. `Síguenos en Instagram` | No |
| `boton4_url` | Enlace de ese botón extra | No |
| `alias` | Nombre corto extra para el enlace, ej. `estilonorte` | No |

4. Copia las filas de `ejemplo-negocios.csv` para ver cómo se llena.
5. **Truco útil:** selecciona la columna `estado`, ve a *Datos → Validación de datos* y crea una lista desplegable con `activo` y `pausado`. Así no te equivocas escribiendo.

**Cómo conseguir el enlace de reseñas de un negocio:**
el dueño entra a su **Perfil de Negocio de Google** (el que sale cuando buscas el negocio en Google), toca **"Pedir reseñas"** y copia el enlace corto que aparece (algo como `https://g.page/r/...../review`). Ese enlace va en `google_resenas`.

> Importante: el botón de **Califícanos en Google** aparece primero y más grande porque es el que le da resultados al dueño. Si un negocio no tiene reseñas, el primer botón con datos toma ese lugar.

---

## PASO 2: Publica la hoja como CSV (para que el robot la pueda leer)

1. En la hoja: **Archivo → Compartir → Publicar en la Web**.
2. En el primer menú elige la pestaña **Negocios** (no "Todo el documento").
3. En el segundo menú elige **Valores separados por comas (.csv)**.
4. Presiona **Publicar** y copia el enlace largo que aparece. Guárdalo, lo usarás en el paso 4.

> ⚠ Esto hace públicos los datos de esa pestaña (cualquiera con el enlace puede verlos). Como son datos que de todos modos aparecen en la tarjeta (nombre, WhatsApp, enlaces), no hay problema. **Nunca pongas en esa pestaña** precios que cobras, datos de pago, cédulas ni nada privado. Si quieres llevar cuentas, hazlo en **otra pestaña** que no publiques.

---

## PASO 3: Sube el proyecto a GitHub

1. Entra a github.com e inicia sesión.
2. Crea un repositorio nuevo llamado **tarjetas-digitales**, **público**.
3. Sube todos los archivos de esta carpeta. Dos formas:
   - **Fácil:** en la página del repositorio vacío, toca **"uploading an existing file"** y arrastra todo el contenido de la carpeta (asegúrate de que `.github` también se suba; si tu sistema oculta las carpetas que empiezan con punto, usa la forma con Git).
   - **Con Git (ya lo usas):**
     ```
     git init
     git add .
     git commit -m "Primer envío"
     git branch -M main
     git remote add origin https://github.com/Eduardoksc/tarjetas-digitales.git
     git push -u origin main
     ```

---

## PASO 4: Conecta GitHub con tu hoja

1. En el repositorio, ve a **Settings → Secrets and variables → Actions**.
2. Abre la pestaña **Variables** y toca **New repository variable**.
3. Nombre: `SHEET_CSV_URL`  ·  Valor: el enlace largo del paso 2. Guarda.
4. (Opcional) Crea otra variable `PIE_TEXTO` con el texto que quieras al final de cada página, por ejemplo `Tarjeta digital por E.S.C`, y `PIE_URL` con tu página. Si no las creas, no se muestra pie.

---

## PASO 5: Activa la publicación

1. En el repositorio: **Settings → Pages**.
2. En **Source** elige **GitHub Actions**.
3. Ve a la pestaña **Actions**, entra a **Publicar tarjetas** y toca **Run workflow**.
4. Espera 1 a 2 minutos. Cuando salga con check verde, tus páginas ya existen en:
   `https://eduardoksc.github.io/tarjetas-digitales/001/`

Si sale en rojo, abre la ejecución: el mensaje en español te dice qué falló (hoja no publicada, columna que falta, etc.).

---

## PASO 6: Dominio propio (muy recomendado antes de imprimir nada)

Una tarjeta impresa no se corrige, **el enlace sí**. Con un dominio tuyo, si algún día cambias de plataforma, todas las tarjetas siguen funcionando.

1. Compra un dominio corto (en Colombia un `.co` o `.com.co`; entre más corto, más fácil de escanear y leer).
2. En GitHub: **Settings → Pages → Custom domain**, escribe tu dominio y sigue las instrucciones de GitHub para apuntarlo (te indicará qué registros poner en la página donde compraste el dominio).
3. Activa **Enforce HTTPS** cuando GitHub te lo permita.
4. Desde ese momento, el enlace de cada negocio es: `tudominio.co/001`

---

## PASO 7: Botón "Publicar cambios ahora" (opcional)

Sin esto, los cambios en la hoja se publican solos **cada hora**. Con esto, los publicas cuando quieras.

1. En GitHub: foto de perfil → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Ponle nombre `Hoja de tarjetas`, elige **solo el repositorio** `tarjetas-digitales`, y en permisos pon **Contents: Read and write**. Genera y copia el token (solo se muestra una vez).
3. En tu hoja: **Extensiones → Apps Script**, pega el contenido de `apps-script/boton-publicar.gs` y guarda.
4. En Apps Script, ícono de engranaje → **Propiedades de la secuencia de comandos** → agrega `GITHUB_TOKEN` con el valor del token.
5. Recarga la hoja. Verás el menú **Tarjetas → Publicar cambios ahora**. La primera vez te pedirá permisos: acéptalos.

> Google tarda hasta unos 5 minutos en actualizar la hoja publicada, así que tras presionar el botón espera entre 2 y 6 minutos.

---

## Cómo agregar un negocio nuevo (5 minutos)

1. Guarda el logo en la carpeta `logos/` del repositorio (en GitHub: **Add file → Upload files**). Mejor en PNG o SVG, cuadrado, con fondo transparente o blanco.
2. En la hoja agrega una fila: el siguiente `id` (004, 005…), `activo`, nombre, color, logo y enlaces.
3. Presiona **Publicar cambios ahora** (o espera la actualización automática).
4. Abre `tudominio.co/004` en tu celular y **pruébalo antes de entregar**: reseña, catálogo y WhatsApp.
5. Genera el QR de ese enlace.

**Pausar un cliente que no pagó:** cambia `estado` a `pausado`. Su página desaparece en la siguiente publicación (verá "Esta tarjeta no está disponible"). Para reactivarlo, vuelve a `activo`: **el mismo QR y NFC vuelven a funcionar**.

---

## El hablador: QR y NFC

- **QR siempre. NFC como extra.** El QR funciona en cualquier celular; el NFC no todos lo tienen activo.
- **QR:** usa un generador **estático** (que no caduque ni te cobre mensualidad). Evita los "QR dinámicos" gratuitos que luego dejan de funcionar o te piden pagar. Imprime el enlace `https://tudominio.co/001`.
- **NFC:** compra tarjetas o stickers **NTAG213** (baratos y compatibles). Con una app gratuita como *NFC Tools* escribes el mismo enlace del QR en la tarjeta.
- Imprime siempre una frase que invite a actuar: **"Escanea y cuéntanos qué tal estuvo"**.
- Prueba cada hablador en un iPhone y en un Android antes de dejarlo.
- Lleva un cuaderno o columna interna (en otra pestaña) con: ID, negocio, fecha de instalación, precio acordado y fecha de pago.

---

## Cómo probar en tu computador (opcional)

Si tienes Node instalado:

```
SHEET_CSV_FILE=ejemplo-negocios.csv node generar.mjs
```

Esto crea una carpeta `dist` con las páginas y te muestra avisos en español si alguna fila tiene errores. Puedes abrir `dist/001/index.html` en el navegador.

---

## Si algo falla

| Síntoma | Causa probable | Solución |
|---|---|---|
| El robot sale en rojo: "Google devolvió una página web" | La hoja no está publicada como CSV | Repite el paso 2 |
| "Falta la dirección de la hoja" | No existe la variable `SHEET_CSV_URL` | Paso 4 |
| Un negocio no aparece | Estado distinto de `activo`, o la fila tiene errores | Mira los avisos amarillos (⚠) en la ejecución del robot |
| El logo no se ve | El nombre del archivo no coincide con la columna `logo` | Revisa mayúsculas y la extensión (`.png`) |
| El cambio no se ve | Falta publicar o el celular guardó la versión anterior | Presiona publicar, espera unos minutos y recarga |
| El robot por hora dejó de correr | GitHub pausa tareas programadas si el repositorio lleva 60 días sin actividad | Haz cualquier cambio pequeño o ejecútalo a mano |

**Protección incluida:** si la hoja falla o queda sin negocios activos, el robot **no publica nada**, así que el sitio anterior sigue funcionando. Las tarjetas de tus clientes no se caen por un error tuyo en la hoja.

---

## Siguiente nivel (cuando llegues a 30 o 40 negocios)

- **Catálogos:** crea un producto aparte. Un catálogo pequeño con Sheets + Apps Script para el cliente que lo pida; su enlace va en la columna `catalogo`. Si tiene muchos productos y fotos, conviene preparar su página también por adelantado.
- **Estadísticas de escaneos:** agregar una medición simple por negocio para mostrarle al dueño cuántas personas escanearon. Es un gran argumento para mantener la mensualidad.
- **Mover el alojamiento a Cloudflare Pages** si quieres aún más velocidad en Colombia. Como el enlace es tuyo, el cambio no afecta ninguna tarjeta impresa.

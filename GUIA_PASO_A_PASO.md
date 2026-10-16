# Tarjetas digitales: guía paso a paso (versión 2)

Cómo funciona todo en una frase: **tú editas una hoja de Google, un robot de GitHub convierte cada fila en una página ya terminada, y el cliente solo abre esa página (sin esperas).**

```
Hoja de Google  ──(robot de GitHub)──►  Una página por negocio  ──►  QR / NFC del hablador
 (tú editas)        (automático)          tudominio.co/001
```

---

## Qué cambió en esta versión

1. **Logos estandarizados.** El robot recorta solo los márgenes vacíos del logo, lo deja en un tamaño estándar y la tarjeta se adapta a su forma (ancho, cuadrado o alto). Ya no se corta ni queda con espacios en blanco.
2. **El color cambia toda la página.** Antes solo afectaba el primer botón. Ahora el fondo completo lleva el color del negocio, y las letras se ponen en blanco u oscuro solas para que siempre se lean.
3. **Botones personalizables.** Cada botón tiene su columna de texto, hay un botón extra más y puedes cambiar el orden por negocio.

### Cómo actualizar tu repositorio (si ya tienes el anterior)

Reemplaza o agrega estos archivos en tu repositorio `tarjetas-digitales` (en GitHub: **Add file → Upload files**, y confirma el cambio):

| Archivo | Qué hacer |
|---|---|
| `generar.mjs` | Reemplazar |
| `plantilla.html` | Reemplazar |
| `package.json` | Reemplazar |
| `package-lock.json` | Agregar (es nuevo) |
| `.github/workflows/publicar.yml` | Reemplazar |
| `apps-script/` | Puedes borrar esta carpeta si quieres: ya no se usa |

Tu hoja actual sigue funcionando sin cambios. Las columnas nuevas son opcionales. Eso sí: **por defecto todas las páginas pasan a fondo completo** (el color del negocio en toda la página). Si alguna prefieres con el fondo claro de antes, pon `suave` en la columna `estilo`.

Después ve a **Actions → Publicar tarjetas → Run workflow**.

---

## PASO 1: La hoja de Google

Pestaña **Negocios**, fila 1 con estos encabezados (el orden no importa, y puedes agregar solo los que necesites):

| Columna | Qué escribir | ¿Obligatoria? |
|---|---|---|
| `id` | Número único: 001, 002, 003… **Nunca se cambia** | Sí |
| `estado` | `activo` o `pausado` | Sí |
| `nombre` | Nombre del negocio | Sí |
| `slogan` | Frase corta | No |
| `color` | Color del negocio, ej. `#B83A5B` | No |
| `estilo` | `completo` (todo el fondo del color) o `suave` (fondo claro). Si lo dejas vacío es `completo` | No |
| `logo` | Nombre del archivo en la carpeta `logos`, ej. `estilo-norte.png` | No |
| `logo_fondo` | `blanco`, `oscuro` o `sin`. Normalmente vacío (se elige solo) | No |
| `google_resenas` | Enlace para dejar reseña | Recomendada |
| `texto_resenas` | Nombre del botón de reseñas. Vacío = "Califícanos en Google" | No |
| `catalogo` | Enlace al catálogo | No |
| `texto_catalogo` | Nombre del botón. Vacío = "Ver catálogo" | No |
| `whatsapp` | Número, ej. `300 123 4567` | Recomendada |
| `mensaje_whatsapp` | Mensaje que aparece escrito al abrir el chat | No |
| `texto_whatsapp` | Nombre del botón. Vacío = "Escríbenos por WhatsApp" | No |
| `boton4_texto` / `boton4_url` | Un botón extra (Instagram, Facebook, página web…) | No |
| `boton5_texto` / `boton5_url` | Otro botón extra (por ejemplo "Cómo llegar") | No |
| `orden_botones` | El orden de los botones, ver más abajo | No |
| `alias` | Nombre corto extra para el enlace, ej. `estilonorte` | No |

Mira `ejemplo-negocios.csv`: tiene filas de ejemplo con todo esto.

**Importante:** selecciona la columna `id` y aplica **Formato → Número → Texto sin formato**, para que `001` no se convierta en `1`.

---

## Logos: qué enviar y cómo se ajustan

Pídele al cliente su logo así:

| Característica | Lo ideal | Aceptable |
|---|---|---|
| **Formato** | **SVG** o **PNG con fondo transparente** | JPG o WEBP |
| **Tamaño** | Entre 800 y 2000 píxeles en el lado más largo | Mínimo 300 píxeles |
| **Forma** | Cualquiera, entre cuadrado y 3 veces más ancho que alto | Muy alargado (más de 5 a 1) se verá pequeño |
| **Peso** | Menos de 1 MB | Hasta unos 5 MB |
| **Márgenes** | No importan: el robot los recorta | |

Qué hace el robot con cada logo:

1. **Recorta** los márgenes vacíos (blancos o transparentes) alrededor.
2. **Reduce** el archivo si es demasiado grande y lo convierte a un formato liviano.
3. **Lo ajusta** al espacio disponible sin deformarlo: un logo ancho ocupa todo el ancho, uno cuadrado se ve más grande y uno alto se acomoda a lo alto.
4. **Si el logo es blanco o muy claro**, lo pone solo sobre una tarjeta oscura para que se vea. Si quieres forzarlo, usa la columna `logo_fondo`:
   - `blanco`: tarjeta blanca (lo normal)
   - `oscuro`: tarjeta oscura (para logos blancos)
   - `sin`: sin tarjeta, directo sobre el color (para logos pensados para ese color)
5. **Te avisa** (⚠ en el robot) si el logo es muy pequeño, muy alargado o no se encuentra.

Los logos SVG no se tocan: se ven nítidos a cualquier tamaño, así que son la mejor opción cuando existan.

El nombre del archivo debe coincidir **exactamente** con lo que pongas en la columna `logo` (mayúsculas y extensión incluidas). Si te equivocas, el aviso del robot te muestra los archivos que sí existen.

---

## Colores y fondo

- `estilo = completo` (por defecto): toda la página lleva el color del negocio. El texto se vuelve blanco u oscuro solo, según qué tan claro sea el color. Los botones son blancos con un ícono del color del negocio.
- `estilo = suave`: fondo claro con un toque del color, y el primer botón lleva el color completo.

Escribe el color como `#B83A5B` (6 letras o números después del `#`). Si el color es incorrecto, el robot avisa y usa uno por defecto.

---

## Botones: nombres y orden

**Cambiar el nombre de un botón:** escribe el texto en su columna (`texto_resenas`, `texto_catalogo`, `texto_whatsapp`, `boton4_texto`, `boton5_texto`). Ejemplos: "Cuéntanos qué tal estuvo", "Ver nuestro menú", "Agenda tu cita". Procura que sea corto (menos de 40 letras).

**Cambiar el orden:** en `orden_botones` escribe los nombres separados por comas. El primero queda arriba y más grande. Los nombres válidos son: `resenas`, `catalogo`, `whatsapp`, `boton4`, `boton5`.

| Negocio | `orden_botones` |
|---|---|
| Restaurante con domicilios | `catalogo, whatsapp, resenas` |
| Peluquería o barbería | `whatsapp, resenas` |
| Si lo dejas vacío | `resenas, catalogo, whatsapp, boton4, boton5` |

Los botones que no estén en la lista van al final en el orden normal, y un botón sin datos (por ejemplo, sin enlace de catálogo) simplemente no aparece.

Los botones extra eligen su ícono según el enlace: Instagram (cámara), Google Maps o Waze (ubicación), otras redes (enlace) y cualquier otra página (globo).

---

## PASO 2: Publica la hoja como CSV

1. En la hoja: **Archivo → Compartir → Publicar en la Web**.
2. En el primer menú elige la pestaña **Negocios** (no "Todo el documento").
3. En el segundo menú elige **Valores separados por comas (.csv)**.
4. Presiona **Publicar** y copia el enlace largo.

> ⚠ Esto hace públicos los datos de esa pestaña. Como son datos que de todos modos aparecen en la tarjeta, no hay problema. **Nunca pongas ahí** precios que cobras, datos de pago ni nada privado. Para tus cuentas usa **otra pestaña** que no publiques.

---

## PASO 3: Sube el proyecto a GitHub

1. Crea un repositorio llamado **tarjetas-digitales**, público.
2. Sube todos los archivos de esta carpeta (incluida `.github` y `package-lock.json`). Con Git:
   ```
   git init
   git add .
   git commit -m "Primer envío"
   git branch -M main
   git remote add origin https://github.com/Eduardoksc/tarjetas-digitales.git
   git push -u origin main
   ```

## PASO 4: Conecta GitHub con tu hoja

1. **Settings → Secrets and variables → Actions → pestaña Variables → New repository variable.**
2. Nombre: `SHEET_CSV_URL`, valor: el enlace del paso 2.
3. (Opcional) `PIE_TEXTO` y `PIE_URL` para un pie al final de cada página (por ejemplo "Tarjeta digital por E.S.C").

## PASO 5: Activa la publicación

1. **Settings → Pages → Source: GitHub Actions.**
2. **Actions → Publicar tarjetas → Run workflow.**
3. Con el check verde, tus páginas están en `https://eduardoksc.github.io/tarjetas-digitales/001/`

Para ver los avisos de cada negocio, abre la ejecución y entra al paso **Crear las páginas desde la hoja**: ahí salen los ✔ de lo que se creó y los ⚠ de lo que hay que corregir, con la explicación.

## PASO 6: Dominio propio (antes de imprimir nada)

Una tarjeta impresa no se corrige, **el enlace sí**. Con un dominio tuyo, si algún día cambias de plataforma, todas las tarjetas siguen funcionando. Compra un dominio corto, conéctalo en **Settings → Pages → Custom domain** y activa **Enforce HTTPS**.

> Antes de tener muchos clientes pagando, revisa los términos de GitHub Pages sobre uso comercial: pueden no permitir usarlo como alojamiento de un negocio. Como el enlace de las tarjetas será tu dominio, mudarte a otro alojamiento (por ejemplo Cloudflare Pages) no afecta lo que ya imprimiste.

---

## Cómo agregar un negocio nuevo (5 minutos)

1. Guarda el logo en la carpeta `logos/` del repositorio (**Add file → Upload files**).
2. En la hoja agrega una fila: el siguiente `id`, `activo`, nombre, color, logo y enlaces.
3. Ve a **Actions → Publicar tarjetas → Run workflow** (o espera la actualización automática de cada hora).
4. Abre `tudominio.co/004` en tu celular y **pruébalo antes de entregar**: reseña, catálogo y WhatsApp.
5. Genera el QR de ese enlace.

> Después de editar la hoja, Google tarda unos minutos en actualizar la versión publicada. Espera unos 5 minutos antes de ejecutar el robot.

**Pausar un cliente que no pagó:** cambia `estado` a `pausado`. Su página desaparece en la siguiente publicación. Para reactivarlo, vuelve a `activo`: el mismo QR y NFC vuelven a funcionar.

---

## El hablador: QR y NFC

- **QR siempre. NFC como extra.** El QR funciona en cualquier celular; el NFC no todos lo tienen activo.
- Usa un generador de QR **estático** (que no caduque ni te cobre mensualidad). Imprime el enlace `https://tudominio.co/001`.
- **NFC:** tarjetas o stickers **NTAG213**, con una app gratuita como *NFC Tools* escribes el mismo enlace del QR.
- Imprime una frase que invite a actuar: **"Escanea y cuéntanos qué tal estuvo"**.
- Prueba cada hablador en un iPhone y en un Android antes de dejarlo.

---

## Cómo probar en tu computador (opcional)

Con Node instalado:

```
npm install
SHEET_CSV_FILE=ejemplo-negocios.csv node generar.mjs
```

Crea la carpeta `dist` con las páginas y muestra los avisos en español. Abre `dist/001/index.html` en el navegador.

---

## Si algo falla

| Síntoma | Causa probable | Solución |
|---|---|---|
| El robot sale en rojo: "Google devolvió una página web" | La hoja no está publicada como CSV | Repite el paso 2 |
| "Falta la dirección de la hoja" | No existe la variable `SHEET_CSV_URL` | Paso 4 (pestaña **Variables**, no Secrets) |
| Sale "Esta tarjeta no está disponible" | El enlace no coincide con un `id`, o el `id` perdió los ceros | Formato de la columna `id` como texto sin formato; vuelve a ejecutar el robot |
| Un negocio no aparece | Estado distinto de `activo`, o la fila tiene errores | Mira los ⚠ en el paso "Crear las páginas desde la hoja" |
| El logo no se ve, sale la inicial | El nombre del archivo no coincide con la columna `logo` | El aviso lista los archivos que existen; corrige mayúsculas y extensión |
| El logo se ve borroso | El archivo es muy pequeño | Pide un SVG o un PNG de más de 800 px |
| El logo se ve pequeño | Es muy alargado | Pide la versión compacta o cuadrada del logo |
| Un logo blanco no se ve | El fondo es claro | Pon `oscuro` en `logo_fondo` |
| El cambio no se ve | Falta publicar o el celular guardó la versión anterior | Ejecuta el robot, espera unos minutos y recarga (o abre en ventana privada) |
| El robot por hora dejó de correr | GitHub pausa tareas programadas tras 60 días sin actividad | Haz un cambio pequeño o ejecútalo a mano |

**Protección incluida:** si la hoja falla o queda sin negocios activos, el robot **no publica nada**, así que el sitio anterior sigue funcionando.

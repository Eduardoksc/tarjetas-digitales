---
name: taste
description: Criterio de gusto para que las tarjetas no parezcan "una página hecha por IA": originalidad, elegancia, sobriedad y movimiento con intención. Úsala al proponer, comparar o pulir cualquier dirección visual de plantilla.html (Mostrador, Premium u otra), al generar muestras de diseño o cuando el usuario pida algo "más elegante", "más original" o "más premium". Complementa a ux-tarjetas, micro-interacciones y estetica-premium; no las reemplaza.
---

# Taste: diseño con criterio, no plantilla genérica

Una tarjeta buena se reconoce porque **una persona con oficio tomó decisiones**. Una genérica se reconoce porque todas sus decisiones son las "por defecto".

## Señales de "hecho por IA" que se deben evitar

- Degradados morados, azules o índigo, brillos y resplandores sin motivo, y "glassmorphism" (vidrio esmerilado).
- Todo centrado, todo con el mismo radio grande y la misma sombra suave, en tarjetas idénticas apiladas.
- Emojis como íconos, textos como "¡Bienvenido!", "Descubre más" o "Experiencia única", y mayúsculas para "dar estilo".
- Animaciones que rebotan, flotan o pulsan en bucle sin comunicar nada.
- Oro chillón: un amarillo saturado que pretende ser oro.
- Bordes gruesos, contornos negros de 2 px, o varias tipografías decorativas a la vez.
- Copiar una "landing" de SaaS: hero grande, subtítulo gris y botón de píldora.

## Qué hace a un diseño elegante y propio

1. **Una sola idea fuerte por dirección.** Por ejemplo: "la tecla que se hunde", "el recibo del mostrador" o "la etiqueta de joyería". Todo lo demás se subordina a esa idea.
2. **Jerarquía por escala y peso, no por adornos.** Un titular grande con un contraste de tamaño claro (al menos 2.5 veces el texto base) dice más que diez sombras.
3. **Paleta contenida:** el color del negocio, un neutro cálido (papel, marfil, negro profundo) y como máximo un acento. Si un color no comunica algo, sobra.
4. **Detalle de oficio:**
   - Líneas finas de 1 px.
   - Una escala de radios coherente (por ejemplo 6, 14 y 24 px) y no un radio distinto por elemento.
   - Alineación óptica (los íconos se ven centrados, no solo lo están numéricamente).
   - `letter-spacing` negativo leve en titulares grandes y positivo en etiquetas pequeñas.
   - Comillas tipográficas y tildes correctas.
5. **Asimetría deliberada.** Alinear a la izquierda con un buen margen suele verse más editorial y sobrio que centrar todo.
6. **Movimiento con intención:**
   - Una sola "firma" de movimiento por diseño (por ejemplo, las estrellas que se llenan), una entrada breve y escalonada, y respuesta táctil inmediata.
   - El movimiento cuenta qué pasa, no decora.
   - Las reglas técnicas están en `micro-interacciones`.
7. **Contexto local.** Español de Colombia natural y cálido, y referencias del mundo real del negocio (mostrador, recibo, carta, vitrina) en vez de metáforas tecnológicas.
8. **El negocio es el protagonista**, no el diseño. El logo y el nombre deben verse a gusto en las tres paletas, sin importar el color que el cliente elija.

## Proceso para proponer diseños

1. Lee `CLAUDE.md` y las skills `ux-tarjetas`, `micro-interacciones` y `estetica-premium`. Los diseños deben cumplirlas: 48 px, contraste AA, menos de 100 KB, sin JavaScript y `prefers-reduced-motion`.
2. Propón **2 o 3 direcciones claramente distintas**, cada una con su idea en una frase. No hagas tres variaciones de lo mismo.
3. **Usa contenido real** (un negocio de la hoja o del CSV de ejemplo), nunca texto de relleno. Pruébalo también con un color de marca claro y con uno oscuro.
4. Critica cada dirección con la lista de señales de arriba antes de mostrarla. Corrige o descarta lo que parezca genérico.
5. Muestra las direcciones lado a lado, a 360 px y 390 px, y di con honestidad qué gana y qué cede cada una (identidad del negocio, legibilidad, costo de implementación).
6. Si el usuario trae instrucciones que choquen con estas reglas (por ejemplo, `opacity: .7` en textos, que rompe el contraste AA), cumple la intención con una solución que respete la regla y explica el cambio.

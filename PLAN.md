# PLAN.md — Prestamo (nombre de trabajo)

> ## ⚠️ ALCANCE RECORTADO — 4 de septiembre de 2026
>
> El proyecto pasó a ser una **entrega académica con fecha límite el lunes 7 de
> septiembre de 2026**. El alcance se recortó a cuatro cosas:
>
> 1. Ingreso con enlace mágico
> 2. Publicar un ítem con foto
> 3. Buscador y catálogo público
> 4. Ficha del ítem
>
> Eso es **exactamente la Fase 1** de este plan. Las **Fases 2, 3, 4 y 5 quedan
> aplazadas**: nada de pagos, reservas, calificaciones ni panel de admin.
>
> El plan completo se conserva tal cual más abajo porque sigue siendo válido
> para después de la entrega. Lo único que cambia es **cuándo** se construye
> cada fase, no **qué** ni **cómo**.
>
> **Criterio de esta entrega:** que funcione y esté desplegado, por encima de
> que esté pulido. Las decisiones que se tomen apurando quedan anotadas en la
> sección "Deuda asumida por la fecha" al final de la Fase 1.

Marketplace de renta de objetos entre particulares y negocios, en Guatemala.

**Estado:** plan escrito, esperando aprobación. No se ha escrito nada de código todavía.
**Fecha:** 4 de septiembre de 2026.

---

## Cómo leer este documento

Está escrito asumiendo que no programaron antes. Cada vez que uso un término técnico lo explico la primera vez, en una línea. Al final hay un [glosario](#glosario) con todos juntos.

El plan tiene 6 fases (una fase 0 de preparación + 5 fases de producto). Cada fase termina con algo que ustedes pueden abrir en el navegador y usar. Cada fase termina desplegada en internet.

---

## 0. Resumen de decisiones ya tomadas

Estas cuatro las confirmaste antes de escribir el plan. Las repito aquí porque son la columna vertebral de todo lo demás.

| Decisión | Qué elegimos | Consecuencia principal |
|---|---|---|
| **Manejo del dinero** | Recurrente cobra al renter → el dinero cae completo en la cuenta de la plataforma → ustedes transfieren al publicador a mano cuando se marca "devuelto" | La app **lleva la contabilidad**, no mueve dinero al publicador. Se construye rápido, pero cada reserva completada les cuesta ~3 minutos de trabajo manual |
| **Comisión** | 15% descontado al publicador | El precio que se ve en el buscador es el precio que se paga. El publicador que pide Q100/día recibe Q85/día |
| **Depósito de garantía** | Fuera del MVP | Menos código, menos estados. A cambio: hay que arrancar con objetos de bajo valor y avisar claramente que la plataforma no cubre daños |
| **Cancelaciones** | Reembolso total, ejecutado a mano por ustedes desde Recurrente | Cero código de reembolsos automáticos en el MVP. La app solo marca la reserva como cancelada y la pone en su lista de pendientes |

---

## 1. La investigación de la pasarela de pago (lo que el brief dejó pendiente)

El brief pedía averiguar si Recurrente soporta retención o split de pago. **La respuesta es no.**

**Qué sí tiene la API pública de Recurrente:**
- Checkout alojado (una página de pago hecha por ellos, a la que mandamos al usuario)
- Webhooks (avisos automáticos a nuestro servidor cuando un pago se completa)
- Reembolsos
- Suscripciones (no las usamos)
- Transferencias entre cuentas *de Recurrente*
- Ambiente de pruebas (sandbox) con tarjeta de prueba `4242 4242 4242 4242`
- Comisión aproximada: 4.5% por transacción

**Qué NO tiene:**
- Cuentas conectadas / sub-cuentas por vendedor (lo que Stripe llama *Connect*)
- Split automático de un pago entre plataforma y vendedor
- Escrow / retención de fondos
- "Autorizar ahora, cobrar después" (*authorize / capture* separados)

> **Traducción a lenguaje simple:** Recurrente sirve para que *una* empresa cobre a *sus* clientes. No está construido para que una plataforma cobre en nombre de mucha gente distinta y les reparta el dinero después. Esa pieza tendríamos que hacerla nosotros.

### Cómo lo resolvemos: "escrow contable"

*Escrow* = un tercero de confianza guarda el dinero hasta que ambas partes cumplen.

Nosotros lo hacemos así:

```
Renter paga Q500  →  Recurrente cobra su ~4.5% (Q22.50)  →  Q477.50 caen en la
cuenta de Recurrente DE LA PLATAFORMA (de ustedes)
                                         ↓
          El dinero se queda ahí. La app anota: "le debemos Q425 a Juan"
          (Q500 menos 15% de comisión de plataforma = Q425)
                                         ↓
          Renter marca "devuelto sin problema"
                                         ↓
          La reserva aparece en el panel de admin: "PENDIENTE DE PAGAR: Juan, Q425"
                                         ↓
          Ustedes entran a Recurrente/su banco, transfieren Q425 a Juan,
          y tocan "marcar como pagado" en el panel
```

La plataforma se queda con Q500 − Q425 = Q75 brutos, menos los Q22.50 de Recurrente = **Q52.50 netos por esa renta**. Vale la pena que vean ese número: con comisión de 15% y Recurrente cobrando 4.5%, su margen real es ~10.5%, no 15%.

**Limitaciones honestas de esta opción:**

1. **Es trabajo manual.** Cada reserva completada requiere que un humano haga una transferencia. A 10 reservas por semana es media hora de trabajo. A 100 por semana es insostenible y hay que migrar a otra cosa.
2. **Retienen dinero que no es suyo.** En muchos países, guardar fondos de terceros es una actividad financiera regulada. En Guatemala esto debería revisarlo un contador o abogado *antes de lanzar*. No es un problema técnico y no lo puedo resolver yo, pero sería irresponsable no señalarlo.
3. **No hay verificación de identidad.** Si alguien publica un objeto, cobra, y nunca lo entrega, ustedes tienen su correo y su teléfono y nada más.
4. **Los errores humanos son caros.** Transferir al publicador equivocado o el monto equivocado es un problema real. Por eso el panel de admin (Fase 4) muestra el monto exacto y los datos bancarios juntos, y guarda un registro de quién marcó qué.

**Alternativa que descartamos y por qué:** buscar un procesador con split real (dLocal, Mercado Pago). Agrega semanas de investigación y trámites, obliga a cada publicador a pasar verificación de identidad (KYC) antes de poder cobrar — lo que mataría el registro abierto que quieren — y no hay garantía de que acepten un marketplace sin historial. Es la decisión correcta *después* de validar que el negocio funciona, no antes.

---

## 2. Cambios que propongo al modelo de datos

El modelo del brief está bien. Propongo estos cambios, cada uno con su razón.

### Cambio 1 — Guardar el dinero como números enteros de centavos

En vez de `precio_por_dia = 125.50`, guardamos `precio_por_dia_centavos = 12550`.

*Por qué:* las computadoras cometen errores diminutos con decimales (`0.1 + 0.2` da `0.30000000000000004`). Con dinero eso se acumula y en algún momento un total no cuadra por un centavo, y no vas a saber por qué. Trabajando con enteros el error es imposible. Solo dividimos entre 100 al momento de mostrarlo en pantalla.

*Si eligiéramos lo contrario:* funcionaría el 99% del tiempo y el 1% restante sería un bug carísimo de encontrar.

### Cambio 2 — Las fechas de reserva son DATE, no timestamp

`inicio_en` y `fin_en` guardan solo el día (`2026-09-15`), no día y hora.

*Por qué:* nadie renta un taladro "de las 14:30 a las 09:15". Se renta por días. Si guardamos horas, entramos al infierno de las zonas horarias: el servidor de Vercel está en UTC, ustedes están en `America/Guatemala` (UTC−6), y una reserva del 15 podría aparecer como del 14 según quién la mire. Con solo la fecha, ese problema no existe.

*Convención:* el rango es **inclusivo en ambos extremos**. Del 15 al 17 son **3 días**, no 2. Fórmula: `dias = (fin − inicio) + 1`. Esto queda escrito en el código y en las pruebas porque es la fuente de error número uno en sistemas de reservas.

### Cambio 3 — Congelar el precio dentro de la reserva

`reservations` guarda `precio_por_dia_centavos` copiado del listing al momento de solicitar.

*Por qué:* si el publicador sube su precio la semana que viene, las reservas viejas no deben cambiar de monto. Sin esta copia, el historial se reescribe solo y la contabilidad deja de cuadrar.

### Cambio 4 — Datos bancarios del publicador

Campos nuevos en `users`: `banco`, `tipo_cuenta`, `numero_cuenta`, `nombre_titular`.

*Por qué:* elegimos pagar a mano. Sin estos datos no pueden pagarle a nadie. Se piden **la primera vez que alguien acepta una solicitud**, no al registrarse — pedirlos antes espanta gente que solo quiere ver el catálogo.

*Nota de seguridad:* estos datos solo los puede leer su dueño y los administradores. Nunca aparecen en el perfil público.

### Cambio 5 — Bandera de administrador

Campo `es_admin` en `users`.

*Por qué:* el panel de pagos pendientes (Fase 4) es la herramienta con la que ustedes operan el negocio. Necesita una puerta cerrada.

### Cambio 6 — Las categorías van en el código, no en la base de datos

Una lista fija: `herramientas`, `mobiliario_eventos`, `equipo_audio_video`, `deportes_aire_libre`, `hogar_jardin`, `otros`.

*Por qué:* una tabla de categorías implica una pantalla para administrarlas, que nadie va a usar en el MVP. Cambiar la lista es editar una línea de código y volver a desplegar (5 minutos).

*Si eligiéramos lo contrario:* medio día más de trabajo para flexibilidad que no necesitan todavía.

### Cambio 7 — Una calificación por persona por reserva

Regla en la base de datos: `UNIQUE (reservation_id, autor_id)`.

*Por qué:* sin esto, alguien enojado puede dejar 40 reseñas de una estrella sobre la misma renta.

### Cambio 8 — Campos de operación en `payments`

Agregar: `liberado_en` (cuándo pagaron al publicador), `liberado_por` (qué admin), `referencia_transferencia` (el número de la transferencia bancaria), `notas_admin`.

*Por qué:* cuando un publicador escriba "no me pagaron", necesitan poder responder en 10 segundos con fecha y número de referencia.

### Modelo final

```
users
  id (uuid, viene de Supabase Auth)   correo   nombre   telefono_whatsapp
  ciudad   foto_url   es_admin   banco   tipo_cuenta   numero_cuenta
  nombre_titular   creado_en

listings
  id   user_id → users   titulo   categoria   descripcion
  precio_por_dia_centavos   ciudad   cantidad_disponible   activo   creado_en

listing_photos
  id   listing_id → listings   url   orden

reservations
  id   listing_id → listings   renter_id → users
  inicio_en (date)   fin_en (date)   dias
  precio_por_dia_centavos (copia congelada)
  precio_total_centavos   comision_plataforma_centavos   monto_publicador_centavos
  estado   creado_en   actualizado_en

payments
  id   reservation_id → reservations   monto_centavos   estado
  procesador_id_externo   liberado_en   liberado_por → users
  referencia_transferencia   notas_admin   creado_en

reviews
  id   reservation_id → reservations   autor_id → users   calificado_id → users
  estrellas (1-5)   comentario   creado_en
  UNIQUE (reservation_id, autor_id)
```

---

## 3. La máquina de estados de una reserva

*Máquina de estados* = la lista cerrada de situaciones en las que puede estar una reserva, y qué movimientos son legales entre ellas. Si no la definimos con precisión, terminan con reservas "pagadas pero rechazadas" y nadie sabe qué pasó.

```
                    ┌──────────────┐
                    │  solicitada  │ ← el renter envía la solicitud
                    └──────┬───────┘
                  ┌────────┴────────┐
      publicador  │                 │  publicador
      acepta      ▼                 ▼  rechaza
            ┌──────────┐      ┌───────────┐
            │ aceptada │      │ rechazada │ (final)
            └────┬─────┘      └───────────┘
                 │ el renter paga (Recurrente confirma por webhook)
                 ▼
            ┌──────────┐
            │  pagada  │   ← el dinero está en la cuenta de la plataforma
            └────┬─────┘
                 │ el publicador marca "entregué el objeto"
                 ▼
            ┌───────────┐
            │ entregada │
            └─────┬─────┘
          ┌───────┴────────┐
 el renter│                │ el renter marca
 marca    ▼                ▼ "hubo un problema"
   ┌──────────┐      ┌──────────────┐
   │ devuelta │      │ con_problema │
   └────┬─────┘      └──────┬───────┘
        │                   │
        ▼                   ▼
  PAGO A LIBERAR      PAGO CONGELADO
  (aparece en el      (ustedes lo resuelven
   panel de admin)     hablando con ambos)

  Desde solicitada, aceptada o pagada, cualquiera de los dos puede → cancelada
  Si estaba pagada: el reembolso lo hacen ustedes a mano desde Recurrente
```

**Quién dispara cada transición — esto es lo que hay que programar con candado:**

| De → A | Quién puede | Condición que verifica el servidor |
|---|---|---|
| — → solicitada | El renter (con sesión) | Hay disponibilidad en esas fechas; no es su propio listing |
| solicitada → aceptada | **Solo** el dueño del listing | Sigue habiendo disponibilidad *en este instante*; tiene datos bancarios cargados |
| solicitada → rechazada | Solo el dueño del listing | — |
| aceptada → pagada | **Nadie desde la app: solo el webhook de Recurrente** | La firma del webhook es válida y el monto coincide |
| pagada → entregada | Solo el dueño del listing | — |
| entregada → devuelta | Solo el renter | — |
| entregada → con_problema | Solo el renter | — |
| solicitada/aceptada/pagada → cancelada | Cualquiera de los dos | — |

La fila del webhook es la más importante de todo el documento: **el navegador del usuario nunca puede declarar que un pago ocurrió.** Si lo permitiéramos, cualquiera con conocimientos básicos podría marcarse pagos gratis. Solo el aviso firmado que Recurrente manda directamente a nuestro servidor cuenta.

---

## 4. El cálculo de disponibilidad (componente de alto riesgo)

**La regla:** una reserva nueva del día A al día B es posible solo si, contando todas las reservas ya comprometidas de ese mismo listing que se traslapan con el rango A–B, ninguno de esos días llega a `cantidad_disponible`.

"Comprometidas" = estado `aceptada`, `pagada` o `entregada`. Las `solicitada` **no** bloquean: el publicador puede recibir 3 solicitudes para la misma semana y aceptar una.

**Dos rangos se traslapan si:** `inicio_nuevo <= fin_existente` **Y** `fin_nuevo >= inicio_existente`. Se ve simple y es donde todo el mundo se equivoca. Va a tener sus propias pruebas.

**Los casos que las pruebas deben cubrir:**
- Rango idéntico a uno existente
- Nuevo rango completamente adentro de uno existente
- Nuevo rango completamente afuera, conteniendo al existente
- Toca solo el primer día / solo el último día
- Termina exactamente el día que el otro empieza (**sí se traslapa** — ese día el objeto está ocupado)
- Empieza el día siguiente al que el otro termina (no se traslapa)
- Con `cantidad_disponible = 3`: dos reservas traslapadas pasan, la tercera pasa, la cuarta se rechaza
- Reservas canceladas y rechazadas no cuentan
- Fecha de inicio en el pasado → rechazada
- `fin < inicio` → rechazada

**El problema difícil — dos aceptaciones al mismo tiempo.** Si el publicador tiene 1 unidad y dos solicitudes para la misma semana, y toca "aceptar" en las dos casi simultáneamente, ambas podrían verificar "sí hay disponible" antes de que ninguna se guarde. Resultado: dos reservas aceptadas para un objeto que no existe dos veces.

*La solución:* la verificación y la escritura se hacen **dentro de una función en la base de datos** que primero pone un candado sobre la fila del listing (`SELECT ... FOR UPDATE`). La segunda petición se queda esperando a que la primera termine, y cuando le toca, ya ve la realidad actualizada y se rechaza correctamente.

*Por qué así y no verificando desde el código de la app:* entre la lectura y la escritura desde el servidor hay milisegundos donde otro puede colarse. Dentro de la base de datos, con candado, no hay hueco. Es más difícil de escribir pero es la única forma correcta.

---

## 5. Las fases

Cada fase es una **rebanada vertical**: un pedazo completo del producto que se puede usar de punta a punta, no una capa suelta. Preferimos "el usuario ya puede publicar y ver su publicación" antes que "ya está toda la base de datos pero no se ve nada".

### Mapa de dependencias

```
  FASE 0 ── Preparación
     │
     ▼
  FASE 1 ── Identidad + publicar + catálogo público
     │        (ingreso por correo, formulario, fotos, buscador)
     │
     ▼
  FASE 2 ── Disponibilidad + solicitar + aceptar/rechazar
     │        (calendario, cálculo de traslape, correos)
     │
     ▼
  FASE 3 ── Pagos con Recurrente
     │        (checkout, webhook, estado pagada)
     │
     ▼
  FASE 4 ── Ciclo de entrega + panel de admin + cancelaciones
     │        (entregado/devuelto/problema, pagos pendientes)
     │
     ▼
  FASE 5 ── Perfiles + calificaciones + carga semilla + lanzamiento
```

La cadena es estricta: cada fase necesita la anterior. No hay nada que se pueda hacer en paralelo si son una o dos personas, y tratar de hacerlo sería peor.

**La única excepción útil:** la carga de los 20-30 ítems semilla (Fase 5) puede empezarse **manualmente en papel o en una hoja de cálculo desde la Fase 1** — juntando fotos, títulos, precios y contactos de conocidos. Eso no requiere código y es el trabajo que más determina si el lanzamiento funciona. Empiécenlo desde la semana 1.

---

### FASE 0 — Preparación

**Objetivo:** tener el esqueleto vacío pero funcionando y publicado en internet, con todas las cuentas creadas. Cero funcionalidad de producto.

**Qué existe al terminar:** una página en `https://algo.vercel.app` que dice "Prestamo" y nada más, pero que se actualiza sola cada vez que guardamos código.

**Archivos creados:**
```
package.json  next.config.ts  tsconfig.json  tailwind.config.ts
.env.local  .env.example  .gitignore
app/layout.tsx  app/page.tsx  app/globals.css
lib/supabase/client.ts  lib/supabase/server.ts
lib/dinero.ts        (formatear quetzales)
lib/fechas.ts        (días entre fechas, zona horaria)
supabase/migrations/0001_inicial.sql
README.md  CLAUDE.md
```

**Decisiones técnicas explicadas:**

- **Next.js con App Router** — Next.js es el marco de trabajo (*framework*: un conjunto de piezas ya resueltas para no escribir todo desde cero) que permite tener el sitio web y el servidor en un mismo proyecto. *App Router* es su forma moderna de organizar las páginas: cada carpeta es una dirección web. *Si eligiéramos lo contrario* (Pages Router, el estilo viejo): la mitad de la documentación y ejemplos de hoy no aplicarían.

- **TypeScript** — JavaScript con avisos de error mientras escribimos. Si el código dice `precio.toUpperCase()` sobre un número, avisa antes de que un usuario lo vea. *Si eligiéramos JavaScript puro:* escribiríamos un poco más rápido y encontraríamos los errores en producción en vez de en la computadora.

- **Tailwind CSS** — se escribe el diseño con etiquetas cortas dentro del HTML (`class="text-lg font-bold"`) en vez de en archivos aparte. Para un equipo pequeño es mucho más rápido y nunca hay que inventar nombres de estilos.

- **Migraciones en archivos SQL numerados** — cada cambio a la base de datos se escribe en un archivo (`0001_inicial.sql`, `0002_agregar_pagos.sql`) que se guarda con el código. *Por qué:* si hacen cambios a mano en el panel de Supabase, nadie recuerda qué se cambió ni se puede volver atrás. Con archivos, la historia de la base de datos es tan reconstruible como la del código.

- **Row Level Security (RLS) desde el primer día** — Supabase expone la base de datos directamente al navegador. Sin RLS (*seguridad a nivel de fila*: reglas de "quién puede leer y escribir cada fila"), **cualquier persona en internet podría leer todos sus datos y borrarlos**. Es la falla de seguridad más común en proyectos con Supabase. Se activa en la primera migración, con todo cerrado por defecto, y se abre puerta por puerta.

- **CLAUDE.md** — un archivo con las convenciones del proyecto que yo leo automáticamente en cada sesión. Ahí queda: dinero en centavos, fechas inclusivas, español en la interfaz, nombres de tablas en inglés y campos en español, etc.

**Criterio de terminado (verificable):**
- [x] `npm run dev` levanta el sitio en `localhost:3000` sin errores
- [x] `npm run build` termina sin errores ni advertencias de tipos
- [ ] La URL de Vercel abre y muestra la página
- [ ] Guardar un cambio en el código actualiza la URL pública en menos de 2 minutos
- [ ] Existen proyecto de Supabase, cuenta de Resend con dominio verificado, y cuenta de Recurrente en modo prueba
- [ ] Las variables de entorno están en Vercel y `.env.local` está en `.gitignore`
- [x] `.env.example` lista todas las variables necesarias, sin valores reales

**Cómo probarla a mano:** abrir la URL de Vercel desde el teléfono. Cambiar el texto "Prestamo" por "Prestamo 🔧", guardar, esperar 2 minutos, recargar en el teléfono, ver el cambio.

**Esfuerzo:** 3 a 4 días. Suena mucho para "no hacer nada", pero crear cuentas, verificar un dominio de correo y conectar servicios es donde se atoran los proyectos nuevos.

**Riesgo principal:** la verificación del dominio para Resend depende de tocar la configuración DNS del dominio (los registros que dicen a internet dónde vive su sitio) y puede tardar hasta 48 horas. **Mitigación:** hacerlo el primer día de todo, en paralelo con lo demás. Si no tienen dominio propio todavía, Resend permite enviar desde un subdominio de prueba mientras tanto.

**Tareas:**
- [x] Repositorio de git local iniciado en la rama `main`
- [ ] Crear el repositorio en GitHub y subir el código
- [x] Proyecto de Next.js 16 + TypeScript + Tailwind 4 (escrito a mano, con versiones fijas)
- [ ] Conectar el repositorio a Vercel y hacer el primer despliegue
- [ ] Crear proyecto de Supabase (región más cercana a Guatemala)
- [x] Escribir `0001_inicial.sql` con las 6 tablas y RLS activado, todo cerrado
- [ ] Crear cuenta de Resend y verificar dominio
- [ ] Configurar Resend como SMTP en Supabase Auth
- [ ] Crear cuenta de Recurrente y obtener llaves de prueba
- [ ] Cargar todas las variables de entorno en Vercel
- [x] Escribir `README.md` (cómo levantar el proyecto) y `CLAUDE.md` (convenciones)

---

### FASE 1 — Identidad, publicar y catálogo público

**Objetivo:** que un desconocido pueda entrar, ver un catálogo, ingresar con su correo, publicar algo con fotos, y verlo aparecer en el buscador.

**Qué existe al terminar:** ya se puede *mostrar* el marketplace. No se puede reservar ni pagar nada, pero es el primer momento en que se puede enseñar a alguien y preguntarle "¿publicarías algo aquí?".

**Pantallas terminadas:** Ingreso, Explorar/Buscar, Ficha del ítem (sin calendario ni botón de reservar), Publicar ítem, Mis publicaciones (lista simple), Mi perfil (editar datos).

**Archivos creados/modificados:**
```
app/page.tsx                          Explorar (portada)
app/ingresar/page.tsx                 pedir correo
app/auth/callback/route.ts            recibir el enlace mágico
app/item/[id]/page.tsx                ficha del ítem
app/publicar/page.tsx                 formulario
app/mis-publicaciones/page.tsx
app/mi-perfil/page.tsx
app/api/listings/route.ts             crear listing
app/api/listings/[id]/route.ts        editar / desactivar
app/api/upload/route.ts               subir fotos a Supabase Storage
components/TarjetaItem.tsx  components/BarraBusqueda.tsx
components/SubidorFotos.tsx  components/Encabezado.tsx
lib/categorias.ts  lib/ciudades.ts
middleware.ts                         proteger páginas privadas
supabase/migrations/0002_rls_listings.sql
```

**Decisiones técnicas explicadas:**

- **Enlace mágico (magic link) en vez de contraseña** — el usuario escribe su correo, recibe un enlace, lo toca y ya está adentro. *Ventaja:* no programamos "olvidé mi contraseña", ni reglas de contraseña, ni el riesgo de guardar contraseñas mal. Menos código y menos superficie de ataque. *Desventaja real:* si el correo cae en spam o el usuario usa un correo que no revisa desde el teléfono, se pierde. En Guatemala, donde mucha gente vive en WhatsApp y poco en el correo, esto va a costar algunos usuarios. Lo aceptamos porque construir ingreso por SMS o WhatsApp agregaría semanas y costo por mensaje. **Mitigación:** en la pantalla de ingreso, texto grande diciendo "revisá tu correo, puede llegar a spam".

- **Las fotos van a Supabase Storage, no a la base de datos** — la base de datos guarda solo el enlace (`https://.../foto123.jpg`). *Por qué:* guardar archivos dentro de una base de datos la vuelve lentísima y cara.

- **Redimensionar las fotos en el navegador antes de subirlas** — una foto de celular moderno pesa 4 MB. Diez ítems con 4 fotos son 160 MB, la portada tardaría eternidades en cargar en una conexión móvil guatemalteca, y se comerían el plan gratuito de Supabase. Las achicamos a máximo 1600px de ancho antes de mandarlas. *Si eligiéramos lo contrario:* el sitio se sentiría roto en celular, que es donde va a estar el 80% de sus usuarios.

- **La búsqueda es `ILIKE '%palabra%'` de Postgres, no un buscador especializado** — busca la palabra dentro del título y la descripción, sin distinguir mayúsculas. *Por qué:* con menos de 1,000 ítems es instantáneo y son 3 líneas de código. *Limitación honesta:* buscar "taladros" no encuentra "taladro", y "martilo" mal escrito no encuentra nada. Cuando el catálogo crezca, se cambia por búsqueda de texto completo de Postgres (medio día de trabajo, más adelante).

- **La portada se genera en el servidor** — el HTML llega ya armado desde el servidor en vez de armarse en el navegador. *Por qué:* carga más rápido en celulares lentos y Google puede indexar los ítems, que es tráfico gratis que un marketplace nuevo necesita desesperadamente.

**Criterio de terminado (verificable):**
- [ ] Alguien sin cuenta puede ver el catálogo y abrir cualquier ficha
- [ ] Pedir el enlace mágico → llega el correo en menos de 1 minuto → al tocarlo, se entra
- [ ] Publicar un ítem con 3 fotos funciona y el ítem aparece en la portada de inmediato
- [ ] Buscar por palabra, por categoría y por ciudad filtra correctamente, y combinados también
- [ ] Un usuario **no** puede editar ni borrar el ítem de otro, ni siquiera manipulando la petición a mano
- [ ] Todo se ve bien en un celular de 375px de ancho
- [ ] Los precios se muestran como `Q125.00`, nunca como `12500` ni `125.0000001`
- [ ] Cerrar sesión funciona y la sesión sobrevive a recargar la página

**Cómo probarla a mano (con datos de ejemplo):**
1. En una ventana normal, entrar y publicar: *"Taladro percutor Black&Decker"*, categoría herramientas, Q75/día, Guatemala, 1 unidad, 2 fotos.
2. Publicar un segundo: *"20 sillas plegables blancas"*, mobiliario para eventos, Q8/día, Mixco, 20 unidades.
3. En **ventana de incógnito** (sin sesión): buscar "sillas" → debe aparecer solo el segundo. Filtrar por ciudad Guatemala → solo el primero.
4. Ingresar con un **segundo correo distinto**, intentar abrir la página de editar del ítem del primer usuario → debe rechazar.
5. Abrir la portada desde el celular.

**Esfuerzo:** 1.5 a 2 semanas.

**Riesgo principal:** las políticas de RLS son sutiles y una mal escrita deja datos abiertos sin que nada falle visiblemente — todo *parece* funcionar. **Mitigación:** la prueba número 4 de arriba (segundo usuario intentando tocar datos ajenos) se corre al final de cada fase, no solo de esta. Además, escribo las políticas RLS como parte de la misma migración que crea la tabla, nunca después.

**Tareas:**
- [ ] Migración de RLS para `users`, `listings`, `listing_photos`
- [ ] Configurar el bucket de Supabase Storage con sus permisos
- [ ] Pantalla de ingreso + ruta de callback + `middleware.ts`
- [ ] Completar perfil (nombre, teléfono, ciudad, foto) tras el primer ingreso
- [ ] Formulario de publicar, con validación de todos los campos
- [ ] Subidor de fotos con redimensionado en el navegador
- [ ] Portada con buscador y filtros
- [ ] Ficha del ítem
- [ ] Mis publicaciones (con editar y desactivar)
- [ ] Revisión completa en pantalla de celular
- [ ] Desplegar y probar en producción

---

### FASE 2 — Disponibilidad, solicitud y aceptación

**Objetivo:** cerrar el circuito de la reserva *sin dinero*. Alguien solicita fechas, el publicador acepta o rechaza, ambos reciben correo.

**Qué existe al terminar:** el producto ya sirve para coordinar rentas reales, cobrando en efectivo por fuera. **Este es el punto en el que podrían hacer una prueba real con 5 conocidos antes de tocar la parte de pagos.** Fuertemente recomendado.

**Pantallas terminadas:** Ficha del ítem con calendario y botón de solicitar, Mis rentas, Detalle de solicitud/reserva (con aceptar y rechazar).

**Archivos creados/modificados:**
```
app/item/[id]/page.tsx                     + calendario y selector de fechas
app/reserva/[id]/page.tsx                  detalle
app/mis-rentas/page.tsx
app/mis-publicaciones/page.tsx             + solicitudes pendientes
app/api/reservations/route.ts              crear solicitud
app/api/reservations/[id]/aceptar/route.ts
app/api/reservations/[id]/rechazar/route.ts
app/api/listings/[id]/disponibilidad/route.ts
lib/disponibilidad.ts                      ← el corazón del riesgo
lib/disponibilidad.test.ts                 ← sus pruebas
lib/estados.ts                             transiciones permitidas
lib/correos/plantillas.ts  lib/correos/enviar.ts
components/CalendarioDisponibilidad.tsx  components/SelectorFechas.tsx
supabase/migrations/0003_reservations.sql
supabase/migrations/0004_funcion_aceptar.sql   ← la función con candado
```

**Decisiones técnicas explicadas:**

- **Aceptación manual, no reserva automática** (esto ya venía en el brief, y es correcto). El publicador decide. *Por qué:* alguien que apenas conoce la plataforma no va a tolerar que se le comprometa su taladro sin su permiso. *Costo:* el renter espera. Si el publicador no contesta en 48h, el renter se va. **Mitigación:** el correo de "nueva solicitud" es urgente y directo, y en la Fase 4 agregamos un contador visible de solicitudes pendientes.

- **La aceptación corre dentro de una función de base de datos con candado** — explicado en la sección 4. Es la parte más difícil de todo el proyecto y la que más pruebas va a llevar.

- **Pruebas automáticas solo para el cálculo de disponibilidad** — *prueba automática* es código que verifica otro código y se corre en segundos. No vamos a probar automáticamente toda la app (eso duplicaría el tiempo del proyecto), pero sí esta pieza: es la única donde un error silencioso genera dos personas peleándose por el mismo objeto, y donde probar a mano todos los casos de traslape sería tedioso y poco confiable.

- **Los correos se mandan con la API de Resend directamente desde el Route Handler**, no como SMTP. *Por qué:* SMTP en Supabase solo sirve para los correos de autenticación (el enlace mágico). Los correos de "tenés una solicitud nueva" los manda nuestro código.

- **Si el correo falla, la reserva igual se guarda** — el envío va después de guardar y su error se registra pero no rompe la operación. *Por qué:* que Resend esté caído no puede impedir que alguien reserve.

- **El teléfono de WhatsApp se revela solo al aceptar** — antes de eso, ninguno ve el número del otro. *Por qué:* si el teléfono fuera público, la plataforma se convierte en un directorio y todos coordinan por fuera sin pagar comisión. Este detalle es de negocio, no técnico, pero se implementa con una regla de RLS.

**Criterio de terminado (verificable):**
- [ ] Las pruebas de `lib/disponibilidad.test.ts` pasan, incluyendo los 10 casos de la sección 4
- [ ] El calendario de la ficha muestra en gris los días sin disponibilidad
- [ ] Solicitar muestra el total correcto antes de enviar (`días × precio`, con los días bien contados)
- [ ] No se puede solicitar el propio ítem
- [ ] No se puede solicitar con fecha de inicio en el pasado
- [ ] Aceptar cambia el estado y revela el teléfono a ambos lados
- [ ] Intentar aceptar dos solicitudes traslapadas sobre 1 unidad: la segunda es rechazada con mensaje claro
- [ ] Un usuario no puede aceptar una solicitud de un ítem que no es suyo
- [ ] Llegan los correos de "nueva solicitud" y "solicitud aceptada"

**Cómo probarla a mano (con datos de ejemplo):**
1. Con el usuario A, publicar *"Carpa para 50 personas"*, Q400/día, **1 unidad**.
2. Con el usuario B (otro correo, otro navegador), solicitar del **10 al 12 de octubre** → debe mostrar 3 días × Q400 = **Q1,200**. Si muestra Q800, el conteo de días está mal.
3. Con un usuario C, solicitar del **11 al 14 de octubre** (se traslapa).
4. Con A, aceptar la de B → funciona, aparece el teléfono de B.
5. Con A, aceptar la de C → **debe rechazarse** diciendo que ya no hay disponibilidad.
6. Con un usuario D, solicitar del **13 al 15** → se traslapa con B (que va hasta el 12)? No. Debe **permitirse**.
7. Con D, solicitar del **12 al 14** → se traslapa con B en el día 12. Debe **rechazarse**.
8. Repetir todo con un ítem de **5 unidades**: cinco reservas traslapadas deben pasar, la sexta no.

**Esfuerzo:** 1.5 a 2 semanas.

**Riesgo principal:** el cálculo de traslape con múltiples unidades es genuinamente difícil y es donde más probable es que se escape un error. **Mitigación:** pruebas automáticas escritas *antes* del código de disponibilidad, no después; y la secuencia manual de arriba corrida completa antes de dar la fase por cerrada.

**Tareas:**
- [ ] Migración de `reservations` con RLS
- [ ] Escribir las pruebas de disponibilidad (antes que el código)
- [ ] Implementar `lib/disponibilidad.ts` hasta que pasen
- [ ] Función SQL de aceptación con candado (`0004`)
- [ ] Componente de calendario con días ocupados en gris
- [ ] Endpoint de crear solicitud, con todas las validaciones
- [ ] Endpoints de aceptar y rechazar
- [ ] Pantallas Mis rentas y Detalle de reserva
- [ ] Plantillas y envío de los dos correos
- [ ] Regla de RLS que revela el teléfono solo tras aceptar
- [ ] Correr la secuencia manual completa
- [ ] Desplegar

---

### FASE 3 — Pagos con Recurrente

**Objetivo:** que al aceptar una solicitud, el renter pueda pagar de verdad con tarjeta, y que la plataforma sepa con certeza que el pago ocurrió.

**Qué existe al terminar:** entra dinero real. Es la fase de mayor riesgo del proyecto.

**Archivos creados/modificados:**
```
app/reserva/[id]/page.tsx                  + botón de pagar
app/reserva/[id]/pago-exitoso/page.tsx
app/reserva/[id]/pago-cancelado/page.tsx
app/api/pagos/crear-checkout/route.ts
app/api/webhooks/recurrente/route.ts       ← la pieza crítica
lib/recurrente/cliente.ts
lib/recurrente/firma.ts                    verificar la firma del webhook
lib/comision.ts                            el 15% en un solo lugar
supabase/migrations/0005_payments.sql
```

**Decisiones técnicas explicadas:**

- **Checkout alojado de Recurrente, no formulario propio de tarjeta** — mandamos al usuario a una página de Recurrente y vuelve cuando termina. *Por qué:* si los datos de tarjeta pasaran por nuestro servidor, entraríamos en obligaciones de cumplimiento PCI (las reglas de la industria de tarjetas), que son caras y serias. Con el checkout alojado, nosotros **nunca vemos un número de tarjeta**. *Desventaja:* el usuario ve la marca de Recurrente y se siente menos "nuestro". Es un intercambio que vale totalmente la pena.

- **El webhook es la única fuente de verdad del pago** — cuando el usuario regresa a nuestra página de "pago exitoso", eso **no** marca nada como pagado; solo muestra un mensaje. El estado cambia únicamente cuando Recurrente le avisa a nuestro servidor, y solo si la firma criptográfica del aviso es válida. *Por qué:* la página de retorno la puede visitar cualquiera escribiendo la URL. *Si eligiéramos lo contrario:* cualquier persona podría marcarse reservas pagadas sin pagar. Esto no es teórico, es el error clásico.

- **Los webhooks deben ser idempotentes** — *idempotente* significa que recibir el mismo aviso cinco veces produce el mismo resultado que recibirlo una. Recurrente puede reintentar si nuestro servidor tarda. Antes de procesar, verificamos si ya registramos ese `procesador_id_externo`.

- **Verificar el monto, no solo el evento** — el webhook dice "se pagaron Q1,200 por la reserva X". Comparamos contra lo que la reserva dice que costaba. Si no coincide, no marcamos pagado y registramos una alerta.

- **La comisión se calcula en un solo archivo (`lib/comision.ts`) y se congela dentro de la reserva** — si mañana suben la comisión a 18%, las reservas viejas siguen con 15%. El porcentaje vive en una variable de entorno, así que cambiarlo no requiere tocar código.

- **Redondeo de la comisión** — a veces el 15% no da un número exacto de centavos. Ejemplo: una renta de Q99.99 son 9999 centavos; el 15% son 1499.85 centavos, que no existen. Regla: `Math.round(9999 * 0.15) = 1500`, o sea Q15.00 de comisión y Q84.99 para el publicador. La plataforma se queda con el redondeo, siempre para el mismo lado. Queda escrito para que en un año nadie se pregunte por qué falta un centavo.

**Criterio de terminado (verificable):**
- [ ] Aceptar una solicitud habilita el botón de pagar solo para el renter
- [ ] El botón lleva a Recurrente con el monto correcto en quetzales
- [ ] Pagar con la tarjeta de prueba `4242 4242 4242 4242` cambia el estado a `pagada`
- [ ] Cancelar en Recurrente deja la reserva en `aceptada`, sin romper nada
- [ ] Un webhook con firma inválida es rechazado y no cambia nada
- [ ] Enviar el mismo webhook dos veces no crea dos pagos
- [ ] Un webhook con monto distinto al esperado no marca la reserva como pagada
- [ ] La fila en `payments` queda con `estado = retenido` y el id de Recurrente
- [ ] Nadie puede llegar a `pagada` visitando URLs a mano

**Cómo probarla a mano:**
1. Con las llaves de **prueba** de Recurrente, hacer una reserva de Q1,200 y pagarla con `4242 4242 4242 4242`. Verificar en la base de datos: `reservations.estado = 'pagada'`, `payments.monto_centavos = 120000`, `comision_plataforma_centavos = 18000`, `monto_publicador_centavos = 102000`.
2. Hacer otra reserva y **cancelar** en la pantalla de Recurrente. Verificar que sigue en `aceptada`.
3. Con una herramienta como Postman o `curl`, mandar un webhook falso con firma inventada al endpoint → debe responder error y no cambiar nada.
4. Reenviar el webhook real dos veces desde el panel de Recurrente → una sola fila en `payments`.
5. **Solo cuando todo lo anterior pase:** cambiar a llaves reales y hacer **una** reserva verdadera de Q10 con una tarjeta propia. Confirmar que el dinero llegó a la cuenta de Recurrente de la plataforma.

**Esfuerzo:** 1.5 a 2 semanas. Puede ser más si la documentación de Recurrente resulta incompleta o si el proceso de activación de la cuenta real (verificación de la empresa) toma tiempo.

**Riesgo principal:** dos riesgos. (1) Que la API de Recurrente no funcione como dice la documentación o le falten piezas — es un procesador local, no Stripe. (2) Que la activación de la cuenta real requiera papeles de empresa que no tengan a mano. **Mitigación:** el mismo día que aprueben el plan, abran la cuenta de Recurrente y pregúntenles directamente por soporte qué documentos necesitan para activar cobros reales. Es un trámite que corre en paralelo y no depende de programar nada. Si Recurrente resulta inviable, la siguiente opción es cobrar por transferencia bancaria manual con comprobante subido a la app — más feo, pero se construye en 3 días y no bloquea el lanzamiento.

**Tareas:**
- [ ] Abrir cuenta de Recurrente y arrancar el trámite de activación real (**día 1**)
- [ ] Leer la documentación completa de Recurrente y confirmar los endpoints
- [ ] Migración de `payments`
- [ ] `lib/comision.ts` con sus casos de redondeo
- [ ] Endpoint de crear checkout
- [ ] Endpoint de webhook con verificación de firma
- [ ] Idempotencia y verificación de monto
- [ ] Páginas de retorno (exitoso y cancelado)
- [ ] Registrar la URL del webhook en el panel de Recurrente (¡debe apuntar a la URL de Vercel, no a localhost!)
- [ ] Correr las 5 pruebas manuales
- [ ] Desplegar

---

### FASE 4 — Entrega, devolución, panel de administración y cancelaciones

**Objetivo:** cerrar el ciclo completo del dinero, incluyendo la herramienta con la que ustedes operan el negocio todos los días.

**Qué existe al terminar:** el producto funciona de punta a punta. Se puede publicar, buscar, reservar, pagar, entregar, devolver y cobrar.

**Archivos creados/modificados:**
```
app/reserva/[id]/page.tsx                    + botones del ciclo
app/api/reservations/[id]/entregar/route.ts
app/api/reservations/[id]/devolver/route.ts
app/api/reservations/[id]/problema/route.ts
app/api/reservations/[id]/cancelar/route.ts
app/admin/page.tsx                           panel
app/admin/pagos/page.tsx                     pendientes de liberar
app/admin/problemas/page.tsx                 reservas con problema
app/admin/cancelaciones/page.tsx             reembolsos pendientes
app/api/admin/liberar-pago/route.ts
app/mi-perfil/datos-bancarios/page.tsx
components/ContadorPendientes.tsx
supabase/migrations/0006_datos_bancarios.sql
supabase/migrations/0007_admin.sql
```

**Decisiones técnicas explicadas:**

- **El panel de admin es una pantalla protegida dentro de la misma app**, no un sistema aparte. *Por qué:* montar un sistema de administración separado duplicaría el trabajo. Con la bandera `es_admin` y una verificación en el servidor es suficiente. *Limitación:* si alguien roba el correo de un admin, entra al panel. Aceptable en el MVP, dado que el panel no mueve dinero por sí solo — solo muestra qué transferencia hacer a mano.

- **La verificación de admin va en el servidor, no en el navegador** — esconder un botón no protege nada; cualquiera puede escribir la URL. Cada endpoint de `/api/admin/` verifica la bandera antes de hacer nada.

- **"Liberar pago" en el panel no mueve dinero** — solo marca que ustedes ya hicieron la transferencia y guarda la referencia. *Por qué:* Recurrente no puede transferir a terceros por API. El panel es una lista de tareas con toda la información junta (nombre, banco, cuenta, monto exacto), para que hacer la transferencia sea copiar y pegar sin errores.

- **Se piden los datos bancarios al momento de aceptar la primera solicitud**, bloqueando la aceptación hasta que estén completos. *Por qué:* si los pedimos al registrarse, mucha gente abandona. Si no los pedimos nunca, terminan con dinero que no pueden entregar y un publicador enojado.

- **Contador de pendientes visible en el encabezado** — un número rojo junto al menú si hay solicitudes esperando respuesta. *Por qué:* es el respaldo por si Resend falla o el correo cae en spam. El brief lo pedía y es la mitigación correcta.

- **La cancelación no reembolsa automáticamente** — marca la reserva como cancelada y la pone en `/admin/cancelaciones`. Ustedes hacen el reembolso desde el panel de Recurrente y lo marcan como hecho. *Por qué:* así lo decidiste, y es lo correcto para el MVP — un reembolso automático mal programado devuelve dinero que no debía devolverse, y eso no se recupera.

**Criterio de terminado (verificable):**
- [ ] Solo el publicador ve el botón "entregué el objeto", y solo si está `pagada`
- [ ] Solo el renter ve "devuelto" y "hubo un problema", y solo si está `entregada`
- [ ] Marcar devuelto pone la reserva en `/admin/pagos` con el monto y los datos bancarios correctos
- [ ] Marcar problema la pone en `/admin/problemas` y **no** aparece en pagos a liberar
- [ ] Marcar como pagado en el panel guarda fecha, admin responsable y referencia
- [ ] Un usuario normal que escribe `/admin` a mano recibe rechazo
- [ ] No se puede aceptar una solicitud sin datos bancarios completos
- [ ] Cancelar una reserva pagada la lleva a `/admin/cancelaciones`
- [ ] El contador de pendientes muestra el número correcto
- [ ] Llega el correo de "pago liberado" al publicador

**Cómo probarla a mano (recorrido completo, de principio a fin):**
1. Usuario A publica *"Pulidora de piso"*, Q150/día, 1 unidad. Intenta aceptar una solicitud → **debe pedirle datos bancarios primero**.
2. A completa: Banco Industrial, monetaria, 123-456789-0, Juan Pérez.
3. Usuario B solicita 2 días → Q300.
4. A acepta. B paga con tarjeta de prueba.
5. A marca "entregado". B marca "devuelto sin problema".
6. Entrar como admin a `/admin/pagos` → debe verse: **Juan Pérez, Banco Industrial, monetaria, 123-456789-0, Q255.00** (Q300 − 15%).
7. Marcar como pagado con referencia "TRF-001". Verificar que sale de la lista y que a A le llegó el correo.
8. Repetir del 1 al 5 pero marcando **"hubo un problema"** → debe aparecer en `/admin/problemas`, nunca en pagos.
9. Con un usuario sin `es_admin`, escribir `/admin/pagos` en la barra de direcciones → rechazo.

**Esfuerzo:** 1 a 1.5 semanas.

**Riesgo principal:** que un pago se libere dos veces, o al publicador equivocado. **Mitigación:** el botón de "marcar como pagado" pide confirmación mostrando el monto y el nombre en grande; una vez marcado, la reserva desaparece de la lista y no puede volver; y la acción queda registrada con nombre del admin y fecha.

**Tareas:**
- [ ] Migraciones de datos bancarios y bandera de admin
- [ ] Formulario de datos bancarios + bloqueo en la aceptación
- [ ] Los cuatro endpoints del ciclo, con verificación de rol y estado
- [ ] Botones condicionales en el detalle de la reserva
- [ ] Panel de admin: pagos, problemas, cancelaciones
- [ ] Endpoint de liberar pago, con confirmación y registro
- [ ] Contador de pendientes en el encabezado
- [ ] Correo de "pago liberado"
- [ ] Marcar su propio usuario como admin en la base de datos
- [ ] Correr el recorrido completo de 9 pasos
- [ ] Desplegar

---

### FASE 5 — Perfiles, calificaciones, catálogo semilla y lanzamiento

**Objetivo:** agregar la confianza (perfiles y calificaciones), llenar el catálogo, y salir a producción de verdad.

**Qué existe al terminar:** el MVP completo, con 20-30 ítems reales adentro, listo para que llegue gente.

**Archivos creados/modificados:**
```
app/perfil/[id]/page.tsx                perfil público
app/reserva/[id]/calificar/page.tsx
app/api/reviews/route.ts
components/Estrellas.tsx  components/TarjetaResena.tsx
app/terminos/page.tsx  app/privacidad/page.tsx  app/como-funciona/page.tsx
app/error.tsx  app/not-found.tsx  app/loading.tsx
lib/analytics.ts
supabase/migrations/0008_reviews.sql
```

**Decisiones técnicas explicadas:**

- **Solo se puede calificar una reserva que llegó a `devuelta` o `con_problema`** — se verifica en el servidor. *Por qué:* sin esa regla, alguien puede difamar a un competidor sin haberle rentado nunca. Es la diferencia entre calificaciones que significan algo y ruido.

- **Ambos lados se califican, pero es opcional** — no bloqueamos nada por no calificar. *Por qué:* forzarlo genera calificaciones de 5 estrellas sin pensar, que no informan a nadie.

- **El promedio se calcula al momento de mostrarlo, no se guarda** — con cientos de reseñas, calcular el promedio en vivo es instantáneo. *Si eligiéramos guardarlo:* habría que recalcularlo cada vez que llega una reseña, y basta un error para que el número guardado quede mal para siempre.

- **Páginas de error y de "no encontrado" propias** — sin ellas, Next.js muestra una pantalla técnica en inglés que asusta a cualquiera. Media hora de trabajo, mucho efecto.

- **Términos y privacidad son obligatorios** — no por burocracia: los necesitan para dejar por escrito que la plataforma **no cubre daños ni robos**, y que actúa como intermediaria. Con el depósito de garantía fuera del MVP, este texto es su única protección. **Deberían hacerlo revisar por un abogado.**

- **Analítica mínima** — contar cuánta gente ve una ficha y cuántos solicitan. Sin eso, no sabrán *dónde* se cae la gente y estarán adivinando. Vercel Analytics se activa en 5 minutos.

**Criterio de terminado (verificable):**
- [ ] El perfil público muestra nombre, foto, ciudad, ítems activos y calificaciones
- [ ] El perfil público **no** muestra correo, teléfono ni datos bancarios
- [ ] Solo se puede calificar tras `devuelta` o `con_problema`
- [ ] No se puede calificar dos veces la misma reserva
- [ ] El promedio se ve correcto con 1, 3 y 10 reseñas
- [ ] Existen Términos, Privacidad y Cómo funciona, enlazados desde el pie de página
- [ ] Una URL inexistente muestra la página de "no encontrado" en español
- [ ] Hay 20+ ítems reales publicados, con fotos decentes, repartidos en al menos 3 categorías
- [ ] Todo el recorrido completo funciona con **llaves reales** de Recurrente
- [ ] Hay respaldo de las tablas a CSV, y quedó anotado cómo repetirlo

**Cómo probarla a mano:** el recorrido completo de la Fase 4, pero terminando con una calificación de cada lado y revisando que aparezca en ambos perfiles públicos. Y una revisión de las 9 pantallas en un celular real.

**Esfuerzo:** 1 a 1.5 semanas de código, **más el tiempo de cargar el catálogo semilla**, que es trabajo humano de conseguir objetos y fotos y puede tomar otra semana en paralelo.

**Riesgo principal:** el problema del huevo y la gallina — ver la sección 6.

**Tareas:**
- [ ] Migración de `reviews`
- [ ] Perfil público
- [ ] Pantalla y endpoint de calificar
- [ ] Componente de estrellas y promedios
- [ ] Términos, Privacidad y Cómo funciona
- [ ] Páginas de error, no encontrado y carga
- [ ] Activar Vercel Analytics
- [ ] Cargar 20-30 ítems reales
- [ ] Prueba completa con llaves reales
- [ ] Primer respaldo a CSV
- [ ] Desplegar y lanzar

---

## 6. El problema del arranque (huevo y gallina)

El brief lo identifica bien y es, honestamente, **un riesgo más grande que cualquier decisión técnica de este documento**. Un marketplace vacío no le sirve a nadie: sin ítems no llega gente a buscar, y sin gente buscando nadie publica.

**Lo que recomiendo, en orden:**

1. **Carguen ustedes mismos los primeros 20-30 ítems, a mano, antes de que la búsqueda pública exista para alguien más.** Conocidos, familiares, negocios pequeños de alquiler que ya existen. Pidan permiso, tomen las fotos ustedes, publiquen en nombre de ellos con su correo. Esto es trabajo de campo, no de programación, y **empieza en la semana 1**, no en la semana 8.

2. **Concentren todo en una sola categoría y una sola zona.** Un catálogo de 25 taladros y herramientas en zona 10 se ve útil. Un catálogo de 25 cosas al azar repartidas por todo el país se ve abandonado. Recomiendo **herramientas** o **mobiliario para eventos** — mobiliario tiene la ventaja de que los negocios que ya alquilan sillas y mesas son fáciles de encontrar y ya tienen inventario listo.

3. **No lancen "público" el día que el código esté listo.** Lancen a un grupo de WhatsApp de 30 conocidos primero. Si de esos 30 ninguno renta nada, el problema no es de tráfico y hacer publicidad sería tirar dinero.

4. **Pongan la comisión en cero las primeras semanas si hace falta.** El sistema ya la calcula; con la variable de entorno en 0 la desactivan sin tocar código. Consigan las primeras 10 rentas completadas y súbanla después.

5. **La métrica que importa no es usuarios registrados.** Es **rentas completadas de punta a punta**, incluyendo devolución. Diez de esas valen más que 500 registros.

---

## 7. Decisiones que necesito que confirmes antes de construir

Las cuatro grandes ya las respondiste. Quedan estas, todas más chicas, y todas tienen mi recomendación. Si estás de acuerdo con todo, basta con que digas "adelante" y arranco con la Fase 0.

| # | Decisión | Mi recomendación |
|---|---|---|
| 1 | **Nombre y dominio** | Necesito uno para configurar Resend en la Fase 0, y la verificación DNS tarda. "Prestamo" es difícil de registrar y de posicionar. Si no lo tienen, sugiero comprar uno esta semana (~Q100/año) — pero puedo arrancar con el subdominio de Vercel y agregarlo después |
| 2 | **Ciudad de lanzamiento** | Ciudad de Guatemala y municipios vecinos (Mixco, Villa Nueva, Santa Catarina Pinula). La lista de ciudades queda fija en el código y crece cuando haga falta |
| 3 | **Categoría de arranque** | Mobiliario para eventos **o** herramientas — una sola. Ver sección 6 |
| 4 | **¿Quién es admin?** | Sus dos correos. Necesito los correos exactos en la Fase 4 |
| 5 | **Prueba real en Fase 2** | Fuertemente recomendado: antes de construir pagos, hagan 3 rentas reales cobrando en efectivo, usando la app solo para coordinar. Si nadie quiere rentar cobrando en efectivo, tampoco va a querer pagando en línea, y se ahorran 3 semanas de trabajo |
| 6 | **Revisión legal** | Retener fondos de terceros y operar sin cubrir daños necesita al menos una consulta con un contador o abogado. No es opcional y no depende de mí |
| 7 | **Presupuesto mensual** | Los planes gratuitos de Vercel, Supabase y Resend alcanzan para empezar. Cuando crezcan: ~$45/mes entre los tres. Solo para que no los sorprenda |

---

## 8. Qué queda fuera del plan y por qué

Todo esto viene de la lista de "fuera del alcance" del brief. Lo repito con la razón concreta, porque en algún momento van a querer meter algo de aquí y conviene recordar el costo.

| Fuera del MVP | Por qué | Cuándo tendría sentido |
|---|---|---|
| Verificación de identidad (DPI, biometría) | Semanas de trabajo y un proveedor externo de pago. Además espanta usuarios en el registro | Cuando haya un fraude real, o al llegar a ~100 rentas |
| Chat interno | WhatsApp ya está instalado en todos los teléfonos de Guatemala y funciona mejor de lo que construiríamos. Un chat propio es 2-3 semanas | Cuando la coordinación por fuera se vuelva un problema medible |
| Seguro o garantía contra daños | Requiere una aseguradora o capital propio para responder. Es un producto financiero, no software | Nunca, hasta que sea una empresa con capital |
| Disputas automáticas | Con menos de 10 problemas al mes, resolverlos por WhatsApp es más rápido, más humano y más informativo | Cuando ustedes no den abasto a mano |
| Facturación FEL/SAT | Integración con la SAT, semanas de trabajo y trámites | Cuando la facturación sea una obligación real por volumen |
| App móvil nativa | El sitio web funciona bien en celular. Una app nativa es empezar de cero, más las tiendas de Apple y Google | Cuando haya usuarios recurrentes pidiéndola |
| Editor de fotos | Subida simple es suficiente. La gente ya edita en el celular | Nunca, probablemente |
| Notificaciones push | Requiere app nativa o permisos del navegador que casi nadie acepta | Con app nativa |
| Filtros avanzados (precio, distancia, orden) | Con menos de 200 ítems, filtrar por categoría y ciudad alcanza. La distancia en km necesita geolocalización real y es medio proyecto aparte | Cuando el catálogo pase de ~200 ítems |
| Referidos y promociones | Sin usuarios, no hay a quién referir | Después de validar |
| Multi-idioma y multi-moneda | Un solo país, un solo idioma | Al salir de Guatemala |
| API pública y carga masiva | Ningún publicador del MVP tiene tantos ítems como para necesitarla | Cuando entre un negocio con 200+ artículos |
| **Depósito de garantía** | Decisión tomada arriba: complica mucho la máquina de estados y da falsa seguridad sin verificación de identidad | Junto con verificación de identidad, nunca antes |
| **Reembolsos automáticos** | Decisión tomada arriba: un reembolso mal programado devuelve dinero que no se recupera | Cuando el volumen de cancelaciones sea molesto |

---

## 9. Nota honesta sobre el tiempo

El brief pidió que no lo suavice. No lo voy a suavizar.

**La suma de las fases da 6 a 9 semanas de trabajo enfocado.** Ese número asume que todo sale como está escrito. Casi nunca sale así, y menos en el primer proyecto de software de alguien.

**Lo que este proyecto combina, y por qué cada pieza es difícil por su cuenta:**

- **Es un marketplace de dos lados.** Hay que construir dos productos, no uno: el de quien publica y el de quien busca. Ambos tienen que estar completos para que *cualquiera* de los dos sirva. No se puede lanzar la mitad.
- **Mueve dinero de otras personas.** Un bug en un catálogo muestra una foto mal. Un bug en pagos le quita plata a alguien real, y no hay forma de disculparse con código.
- **Los publicadores son mixtos.** Un negocio con 20 sillas y un particular con un taladro tienen necesidades opuestas. Esa es la razón de `cantidad_disponible`, que es justamente lo que vuelve difícil el cálculo de disponibilidad.
- **La retención de fondos es manual porque el procesador local no la soporta.** Cada reserva completada les cuesta trabajo humano. Esto no es deuda técnica, es una decisión consciente, pero **tiene un techo**: por encima de ~50 reservas semanales deja de funcionar y hay que rehacer la parte de pagos.

**Lo que en mi experiencia hace que estos proyectos se pasen del plazo, en orden de probabilidad:**

1. **Trámites, no código.** Activar cobros reales en Recurrente, verificar el dominio para el correo, decidir el nombre. Cada uno puede sumar días de espera pura. **Por eso todos arrancan el día 1.**
2. **La documentación del procesador no coincide con la realidad.** Le puse 1.5-2 semanas a la Fase 3, pero es la que más varianza tiene. Podría ser 1 semana o podría ser 4.
3. **El alcance crece solo.** A media Fase 2 va a aparecer la idea de "sería bueno que también...". Cada una de esas cuesta días. **La regla:** todo lo que no está en este documento se anota en una lista aparte y se ve después de lanzar. Sin excepciones.
4. **Cansancio.** Ocho semanas es largo y las semanas 4 y 5 son las peores: ya no hay novedad y todavía falta mucho. Por eso cada fase termina con algo funcionando y desplegado — para tener una victoria visible cada semana y media.

**Mi estimación honesta: 8 a 12 semanas hasta tener esto lanzado y funcionando con usuarios reales**, contando trámites, imprevistos y el trabajo de conseguir los ítems del catálogo semilla. Si alguien les promete menos, o no leyó el alcance o no lo ha hecho antes.

**Y lo más importante:** el riesgo más grande de este proyecto **no es técnico**. El código va a funcionar. El riesgo es que se construyan las 8 semanas completas y después nadie publique nada. Por eso la recomendación de la sección 7, punto 5, es la más valiosa de todo el documento: **hagan tres rentas reales al final de la Fase 2**, con la app coordinando y el dinero en efectivo. Si eso no pasa, no construyan las Fases 3, 4 y 5.

---

## Glosario

| Término | Qué es |
|---|---|
| **API** | La forma en que dos programas se hablan entre sí sin humanos de por medio |
| **App Router** | La forma moderna de Next.js de organizar páginas: cada carpeta es una dirección web |
| **Centavos enteros** | Guardar Q125.50 como el número 12550, para que no haya errores de decimales |
| **Checkout alojado** | Una página de pago hecha por el procesador, a la que mandamos al usuario |
| **Despliegue (deploy)** | Publicar el código en internet para que otros lo usen |
| **Endpoint** | Una dirección de nuestro servidor que hace una cosa (ej. "crear reserva") |
| **Escrow** | Un tercero de confianza guarda el dinero hasta que ambas partes cumplen |
| **Framework** | Un conjunto de piezas ya resueltas, para no escribir todo desde cero |
| **Idempotente** | Que hacer la misma operación cinco veces da el mismo resultado que hacerla una |
| **KYC** | "Conocé a tu cliente": verificar la identidad real de alguien antes de darle dinero |
| **Magic link / enlace mágico** | Ingresar tocando un enlace que llega al correo, sin contraseña |
| **Máquina de estados** | La lista cerrada de situaciones posibles y los movimientos legales entre ellas |
| **Migración** | Un archivo con un cambio a la base de datos, guardado junto al código |
| **PCI** | Las reglas de la industria de tarjetas sobre cómo manejar datos de tarjeta |
| **Postgres** | La base de datos donde se guarda todo |
| **Prueba automática (test)** | Código que verifica otro código y se corre en segundos |
| **Rebanada vertical** | Un pedazo del producto completo de punta a punta, no una capa suelta |
| **RLS (Row Level Security)** | Reglas de "quién puede leer y escribir cada fila" dentro de la base de datos |
| **Route Handler** | Código que corre en el servidor y responde a una petición |
| **Sandbox** | Ambiente de pruebas donde los pagos son falsos |
| **Storage** | Donde se guardan archivos (las fotos), separado de la base de datos |
| **TypeScript** | JavaScript que avisa de errores mientras escribimos, no después |
| **Webhook** | Un aviso automático que un servicio externo le manda a nuestro servidor |

---

## Cómo seguimos

1. Leé el plan, sobre todo las secciones **7** (decisiones pendientes) y **9** (la nota de tiempo).
2. Contestame las 7 decisiones de la sección 7 — o decime "adelante con tus recomendaciones".
3. Con tu aprobación arranco la **Fase 0**, y **solo la Fase 0**.
4. Al cerrar cada fase te cuento: qué construí, qué probé, qué quedó pendiente y qué necesito de vos. Y actualizo este `PLAN.md` y el `README.md`.

**No voy a escribir código de la aplicación hasta que apruebes.**

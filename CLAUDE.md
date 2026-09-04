# CLAUDE.md — Convenciones del proyecto

Este archivo lo leo automáticamente al empezar cada sesión. Contiene las reglas
que no se negocian, para no tener que repetirlas ni contradecirlas por accidente.

El plan completo está en `PLAN.md`. Este archivo es solo el "cómo se escribe".

---

## Reglas que no se rompen

### 1. El dinero se guarda en centavos enteros
`precio_por_dia_centavos = 12550` significa Q125.50.
Nunca usar decimales para dinero. Nunca. Se dividen entre 100 solo al mostrar,
con `formatearQuetzales()` de `lib/dinero.ts`.

### 2. Las fechas de reserva son DATE y el rango es INCLUSIVO
Del 15 al 17 son **3 días**, no 2. `dias = (fin - inicio) + 1`.
La base de datos lo calcula sola (columna generada), así que el código de la app
nunca debe calcular ni escribir `dias` ni `precio_total_centavos`.

### 3. Nunca `timestamp` para fechas de reserva
Solo `date`. Meter horas trae el infierno de zonas horarias entre UTC (Vercel)
y `America/Guatemala` (los usuarios). Para `creado_en` y similares sí va
`timestamptz`.

### 4. RLS activado en toda tabla nueva, en la misma migración que la crea
Nunca "después". Una tabla sin RLS en Supabase está abierta a todo internet.

### 5. El estado de pago solo lo cambia el webhook verificado
La página de retorno de Recurrente **no** marca nada como pagado. Solo el aviso
firmado que llega a `/api/webhooks/recurrente`. Si el navegador pudiera declarar
un pago, cualquiera se regalaría reservas.

### 6. Toda verificación de permisos va en el servidor
Esconder un botón no protege nada. Cada Route Handler verifica quién es el
usuario y si tiene derecho a hacer eso, antes de tocar la base de datos.

### 7. La comisión se calcula en un solo lugar
`lib/comision.ts`. El porcentaje sale de `process.env.COMISION_PLATAFORMA`.
Al crear la reserva se congela el monto calculado; no se recalcula nunca después.

---

## Nombres

- **Tablas y columnas de la base de datos:** en español, minúsculas, con guion
  bajo (`precio_por_dia_centavos`). Excepción: los nombres de tabla quedaron en
  inglés desde el brief (`users`, `listings`, `reservations`) — se respeta.
- **Archivos y componentes de React:** en español (`TarjetaItem.tsx`,
  `SelectorFechas.tsx`).
- **Rutas de la app:** en español (`/publicar`, `/mis-rentas`, `/reserva/[id]`).
  Son visibles para el usuario.
- **Variables y funciones:** en español (`calcularDisponibilidad`,
  `precioTotal`). Un equipo que piensa en español no debería traducir mentalmente.

---

## Interfaz

- Todo en **español de Guatemala**. Nada de "tú" — usar "vos" o formas neutras.
- Moneda: **quetzales**, formato `Q125.00`.
- Zona horaria: `America/Guatemala`.
- **Primero el celular.** Se diseña para 375px de ancho y después se ensancha.
  La mayoría de los usuarios va a entrar desde el teléfono.
- Los mensajes de error se escriben para una persona, no para un programador.
  Mal: "Error 400: invalid date range". Bien: "La fecha de entrega no puede ser
  antes de la de inicio."

---

## Cómo se trabaja

- **Una fase a la vez**, según `PLAN.md`. No adelantar trabajo de fases futuras.
- **Migraciones numeradas** en `supabase/migrations/`. Nunca cambiar la base de
  datos a mano desde el panel de Supabase sin dejarlo escrito en un archivo.
  Una migración ya aplicada no se edita: se escribe una nueva.
- **Pruebas automáticas solo donde importan.** En este proyecto: el cálculo de
  disponibilidad (`lib/disponibilidad.ts`) y el de comisión (`lib/comision.ts`).
  El resto se prueba a mano con los guiones de `PLAN.md`.
- **Al cerrar cada fase:** actualizar `PLAN.md` (marcar casillas) y `README.md`,
  desplegar a Vercel, y reportar qué se construyó, qué se probó y qué quedó
  pendiente.

---

## Explicaciones

El equipo no tiene experiencia previa programando. Cada decisión técnica se
explica en lenguaje simple: qué se eligió, por qué, y qué pasaría si se
eligiera lo contrario. Los términos técnicos se explican la primera vez que
aparecen. Hay un glosario al final de `PLAN.md`.

Los comentarios en el código explican **por qué**, no **qué**. El "qué" ya lo
dice el código.

---

## Cosas que NO se construyen en el MVP

Ver `PLAN.md` sección 8. Resumen: verificación de identidad, chat interno,
seguro contra daños, disputas automáticas, facturación FEL, app nativa,
filtros avanzados, referidos, multi-idioma, API pública, depósito de garantía
y reembolsos automáticos.

Si aparece una idea nueva a mitad de una fase, va a una lista de "después de
lanzar". No entra al alcance actual.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

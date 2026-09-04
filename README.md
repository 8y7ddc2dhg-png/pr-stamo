# Prestamo

Marketplace para rentar objetos entre particulares y negocios, en Guatemala.
Publicás algo que no usás todo el tiempo; alguien más lo renta por unos días.

- **Plan de desarrollo completo:** [`PLAN.md`](./PLAN.md)
- **Convenciones de código:** [`CLAUDE.md`](./CLAUDE.md)
- **Estado actual:** Fase 0 (preparación) — en progreso

---

## Estado de las fases

| Fase | Qué incluye | Estado |
|---|---|---|
| 0 | Repositorio, despliegue, cuentas de servicios, base de datos | 🟡 Casi lista |
| 1 | Ingreso por correo, publicar ítems, catálogo público | ⬜ Pendiente |
| 2 | Disponibilidad, solicitud de reserva, aceptar/rechazar | ⬜ Pendiente |
| 3 | Pagos con Recurrente | ⬜ Pendiente |
| 4 | Entrega, devolución, panel de administración | ⬜ Pendiente |
| 5 | Perfiles, calificaciones, catálogo semilla, lanzamiento | ⬜ Pendiente |

---

## Cómo levantar el proyecto en tu computadora

### Requisitos

- **Node.js 20 o superior** — el programa que ejecuta el código.
  Verificar con `node -v`. Si no está, ver "Instalar Node.js" más abajo.
- **Git** — ya viene incluido en macOS.
- Cuentas en: Supabase, Vercel, Resend y Recurrente.

### Pasos

```bash
# 1. Instalar las dependencias (las piezas de código que usamos de terceros)
npm install

# 2. Crear tu archivo de secretos a partir de la plantilla
cp .env.example .env.local

# 3. Abrir .env.local y llenar los valores reales (ver el archivo, está comentado)

# 4. Levantar el sitio
npm run dev
```

Abrir http://localhost:3000

### Otros comandos

```bash
npm run build    # compila para producción; falla si hay errores de tipos
npm run start    # corre la versión compilada
npm run lint     # revisa el estilo del código
npm test         # corre las pruebas automáticas (desde la Fase 2)
```

---

## Instalar Node.js (macOS)

Descargar el instalador oficial para macOS desde **https://nodejs.org** —
la versión que dice **LTS** (soporte a largo plazo). Es un archivo `.pkg`,
se abre con doble clic y pide la contraseña del Mac.

Al terminar, **cerrar y volver a abrir la terminal**, y verificar:

```bash
node -v
```

Debe imprimir algo como `v22.x.x`.

---

## Estructura del proyecto

```
app/                    Las páginas del sitio. Cada carpeta es una dirección web.
  api/                  Código que corre en el servidor (crear reservas, webhooks)
components/             Piezas de interfaz reutilizables (tarjetas, botones)
lib/                    Lógica que no es interfaz
  supabase/             Conexión a la base de datos
  dinero.ts             Formatear y calcular quetzales
  fechas.ts             Días entre fechas, zona horaria
supabase/migrations/    Los cambios a la base de datos, numerados y en orden
```

---

## Base de datos

Los cambios a la base de datos viven en `supabase/migrations/`, numerados.
**Nunca se cambia la base de datos a mano desde el panel de Supabase sin
dejarlo escrito en un archivo de migración**, porque después nadie recuerda qué
se cambió ni se puede reconstruir.

Para aplicar una migración: panel de Supabase → **SQL Editor** → pegar el
contenido del archivo → **Run**.

Las migraciones se corren **en orden** y **una sola vez cada una**. Una
migración ya aplicada no se edita; si hay que corregir algo, se escribe una nueva.

| Archivo | Qué hace | ¿Aplicada? |
|---|---|---|
| `0001_inicial.sql` | Las 6 tablas, los índices, RLS activado y cerrado | ✅ Sí |
| `0002_rls_listings.sql` | Permisos de publicaciones y fotos; vista `perfiles_publicos` | ⬜ Pendiente |
| `0003_storage_fotos.sql` | Bucket `fotos-items` y permisos de archivos | ⬜ Pendiente |

---

## Por qué las versiones están fijadas con números exactos

En `package.json` las versiones no llevan `^` ni `~`: dicen `"next": "16.3.4"`,
no `"next": "^16.3.4"`. El `^` significa "instalá cualquier versión más nueva
compatible", y eso hace que el proyecto se comporte distinto en dos máquinas o
que se rompa solo un martes cualquiera. Con números exactos, lo que funciona
hoy funciona igual en seis meses.

Dos versiones están deliberadamente **por debajo** de la más nueva:

| Paquete | Fijado en | Por qué no la última |
|---|---|---|
| `typescript` | 6.0.3 | TypeScript 7 ya salió, pero las reglas de ESLint todavía no lo soportan y `npm run lint` truena |
| `eslint` | 9.39.5 | ESLint 10 quitó una función que `eslint-plugin-react` todavía usa, y ese plugin viene dentro de la configuración de Next.js |

Se suben cuando las herramientas se pongan al día. No antes: una revisión de
código que no corre no sirve de nada.

---

## Servicios que usamos

| Servicio | Para qué | Si se cae |
|---|---|---|
| [Vercel](https://vercel.com) | Alojar el sitio | Se cae todo |
| [Supabase](https://supabase.com) | Base de datos, ingreso, fotos | Se cae todo |
| [Resend](https://resend.com) | Correos | Nadie se entera de solicitudes nuevas |
| [Recurrente](https://recurrente.com) | Cobrar con tarjeta | No se puede pagar |

---

## Respaldos

Una vez por semana, desde el panel de Supabase → Table Editor → cada tabla →
Export to CSV. Guardar en la carpeta `respaldos/` (está en `.gitignore`, porque
trae datos personales de usuarios reales y no deben subirse a GitHub).

---

## Seguridad — lo que nunca hay que hacer

- **No subir `.env.local` a GitHub.** Ya está en `.gitignore`; no sacarlo de ahí.
- **No usar `SUPABASE_SERVICE_ROLE_KEY` en código del navegador.** Esa llave se
  salta todas las reglas de seguridad. Solo va en el servidor.
- **No confiar en la página de retorno del pago.** Solo el webhook verificado
  puede marcar una reserva como pagada.
- **No desactivar RLS** en ninguna tabla, por ninguna razón.

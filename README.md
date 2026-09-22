# CRM

Pipeline de prospectos y control de cobros mensuales. Un solo usuario, sin login.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres) · Tailwind 4 · Vercel

---

## Cómo arranca hoy

Sin claves de Supabase la app corre en **modo demo**: datos de ejemplo en memoria,
todo navegable, los cambios se pierden al reiniciar. Sirve para probarla ya.

```bash
npm install
npm run dev
```

Un cartel amarillo arriba avisa cuando estás en modo demo. Desaparece solo en
cuanto conectes la base.

---

## Conectar Supabase (10 minutos)

1. Creá un proyecto en [supabase.com](https://supabase.com) (plan free alcanza
   de sobra para este volumen).

2. **SQL Editor → New query** → pegá todo `supabase/schema.sql` → **Run**.
   Crea las 4 tablas, los enums, los índices y las políticas de acceso.
   Se puede volver a correr sin romper nada.

3. **Project Settings → API**, copiá `Project URL` y la clave `anon public`.

4. En la raíz del proyecto:

   ```bash
   cp .env.local.example .env.local
   ```

   Pegá los dos valores en `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

5. `npm run dev`. Si el cartel amarillo ya no está, quedó conectado.

### Deploy en Vercel

Ya está desplegado y conectado a este repo:

**https://mycrm-alfonso-s-projects14.vercel.app**

Cada `git push` a `main` dispara un deploy solo. Las variables de entorno están
cargadas en los tres entornos (production, preview, development).

La app está detrás de la **protección de deployments de Vercel**: para abrirla
hay que estar logueado en la cuenta de Vercel dueña del proyecto. Se entra una
vez por dispositivo. Se saca desde el panel, en
**Project → Settings → Deployment Protection**.

---

## Cómo se usa

| Pantalla | Para qué |
|---|---|
| **Hoy** | MRR, cobrado vs pendiente del mes, y la lista de lo que necesita atención hoy |
| **Pipeline** | Kanban de prospectos. Arrastrá las tarjetas, o cambiá la etapa con el menú de cada una |
| **Clientes** | Tabla con semáforo de pago y botón de un toque para marcar cobrado |
| **Anuncios** | Mockup. Todavía no hay conexión con Meta |
| **Archivados** | Papelera: restaurar lo archivado, o borrarlo de verdad |

Atajos pensados para usarlo entre reunión y reunión:

- **Marcar pagado** desde la lista de Hoy o desde la tabla de clientes: un toque,
  cobra todos los servicios pendientes de ese cliente en el mes.
- **Hablé hoy** y **+3d** en cada prospecto de la lista de Hoy: actualizan el
  último contacto o posponen el seguimiento sin abrir la ficha.
- **WhatsApp** en todos lados: abre `wa.me` con el número ya cargado y un saludo
  con el nombre del contacto.

---

## Dos decisiones que conviene conocer

### El estado de pago no se guarda

No hay ninguna columna `estado_del_mes`. El estado sale de si existe o no una
fila en `payments` para ese servicio y ese mes:

- hay fila del mes en curso → **pagado**
- no hay, y todavía no llegó el día de cobro → **pendiente**
- no hay, y el día de cobro ya pasó → **vencido**

Por eso el 1° de cada mes todos los clientes vuelven solos a pendiente, sin
tareas programadas ni nada que se pueda olvidar de correr. El historial no se
toca nunca.

Detalle: si un servicio cobra el 31 y el mes tiene 30 días, vence el 30.

### Pago inicial y mes gratis

Un cliente puede tener, además de sus servicios mensuales, un **pago inicial**:
el cobro de arranque del proyecto (armado del sitio, setup de campañas). Es uno
por cliente, por única vez, y **no entra en el MRR** porque no se repite. Sí
aparece en "Atención hoy" mientras esté sin cobrar, y en el historial una vez
cobrado.

Cada servicio mensual puede tener **primer mes gratis**: el mes de su fecha de
inicio no se cobra. Ese mes el servicio muestra "Mes gratis" en vez de
pendiente/vencido, no cuenta como deuda y no lleva botón de cobro. El MRR sigue
mostrando el monto contratado —el acuerdo vale eso— y el dashboard aclara abajo
cuánto no se cobra este mes por promo, para que los números cierren a la vista.

### Nada se borra de un toque

El botón de las fichas dice **Archivar**, no borrar: el cliente o prospecto sale
de las listas, del MRR y de las búsquedas, pero conserva todo — servicios,
historial de pagos, notas — y se restaura en un toque desde **Archivados**
(link al pie de Clientes y de Pipeline).

El borrado definitivo existe, pero vive sólo dentro de Archivados y pide una
confirmación aparte que dice cuántos pagos se van a perder. Son dos pasos
deliberados: un dedazo no te borra un año de historial.

No confundir con **Pausar cliente**, que es otra cosa: el cliente sigue en la
lista pero no le cobrás este mes (temporada baja, por ejemplo).

### Las monedas no se mezclan

Cada servicio tiene su moneda. El MRR y los totales se muestran separados
(`$U 23.000` y `US$ 650`), nunca convertidos: no hay tipo de cambio en ningún
lado del código.

---

## Seguridad

Hay tres capas posibles, hoy activa sólo la primera:

1. **Protección de Vercel** (activa): la URL de producción pide login de Vercel.
   Es lo único que separa los datos de internet.
2. **Candado propio de la app** (apagado): poné `CRM_PASSWORD` en las variables
   de entorno y la app pide esa clave, una vez por dispositivo, por un año.
   Está en `src/proxy.ts`.
3. **RLS de Supabase** (abierta a propósito): la anon key tiene acceso total a
   las tablas, porque la app no tiene login de usuarios.

Si algún día querés cerrarla, poné `CRM_PASSWORD` en las variables de entorno de
Vercel. Con eso solo, la app pasa a pedir esa clave una vez por dispositivo y la
recuerda por un año (`src/proxy.ts`). Para cerrarla de verdad hay que además
cambiar las políticas RLS de Supabase — está explicado al final de
`supabase/schema.sql`.

---

## Mapa del código

```
supabase/schema.sql          El esquema. Pegar en el SQL Editor.

src/lib/
  types.ts                   Tipos del dominio + etiquetas en español
  billing.ts                 Estado de pago, MRR, "atención hoy"  ← la lógica
  dates.ts                   Fechas como 'YYYY-MM-DD', hoy en hora uruguaya
  money.ts                   Totales y formato por moneda
  whatsapp.ts                Teléfono uruguayo → link de wa.me
  actions.ts                 Server actions (todas las escrituras)
  ads-mock.ts                Mockup de Ads + dónde va la API de Meta
  data/
    types.ts                 La interfaz Repo
    supabase-repo.ts         Implementación real
    demo-repo.ts             Implementación en memoria (modo demo)
    index.ts                 Elige una u otra según haya claves

src/app/                     Rutas
src/components/              UI
src/proxy.ts                 Candado opcional, apagado por defecto
```

Para agregar un campo: `supabase/schema.sql` → `src/lib/types.ts` →
el formulario correspondiente → `src/lib/actions.ts`.

---

## Pendiente: integración con Meta Ads

La sección Anuncios es solo visual. En `src/lib/ads-mock.ts` está comentado, con
endpoints y campos concretos, exactamente qué reemplazar:

- el endpoint de insights de la Marketing API y sus parámetros
- de dónde salen las conversiones (`actions`, y qué `action_type` sirve para
  restaurantes)
- la columna `meta_ad_account_id` que hay que agregar a `clients`
- por qué el token va como System User y sin prefijo `NEXT_PUBLIC_`

La UI ya consume el resultado de `getAdsInsights()`, así que al conectar la API
no hay que tocar las pantallas.

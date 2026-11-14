# Puesta en marcha

Esta guía deja la app funcionando en internet. Necesitas:

- Una cuenta de **GitHub** con este repositorio.
- Una cuenta gratis de **Cloudflare** (cloudflare.com).
- Una cuenta gratis de **Resend** (resend.com) para enviar los códigos por correo.
- Node.js 22 en tu computadora, solo para el paso 3. Si no lo tienes, pídele a Claude que te genere las llaves.

En los pasos, `TU-USUARIO` es tu usuario de GitHub y `app-control-hoteles` el nombre del repositorio.

---

## 1. Cloudflare: base de datos, fotos y token

1. Entra a Cloudflare → **Storage & Databases → D1 → Create database**. Nombre: `control-hoteles`. Copia el **Database ID**.
2. **R2 → Create bucket**. Nombre: `control-hoteles-fotos`. (R2 pide activar el plan gratuito con una tarjeta; no cobra dentro del límite gratis de 10 GB.)
3. Copia tu **Account ID**: aparece en la página principal de la cuenta, en la columna derecha.
4. **My Profile → API Tokens → Create Token → Edit Cloudflare Workers** (plantilla). En *Account Resources* elige tu cuenta. Agrega también el permiso **D1: Edit**. Crea el token y cópialo.

## 2. Resend: correos con el código

1. Crea la cuenta y ve a **API Keys → Create API Key**. Cópiala.
2. Para enviar a cualquier correo necesitas verificar un dominio propio en **Domains** (por ejemplo `pradoalto.com`). Mientras no tengas dominio, Resend solo deja enviar al correo con el que creaste la cuenta: sirve para que el dueño pruebe.
3. El remitente (`MAIL_FROM`) queda así: `Control de Hoteles <acceso@tu-dominio.com>`.

## 3. Llaves para avisos y seguridad

En tu computadora, dentro de la carpeta del proyecto:

```bash
node scripts/generar-claves-vapid.mjs
```

Te muestra tres valores: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_JWK` y `AUTH_PEPPER`. Guárdalos para el paso 4. **No los compartas.** Si cambias estas llaves después, todos tendrán que volver a activar los avisos y a iniciar sesión.

## 4. GitHub: secretos y variables

En el repositorio: **Settings → Secrets and variables → Actions**.

**Secrets** (pestaña *Secrets*, botón *New repository secret*):

| Nombre | Valor |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token del paso 1.4 |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID del paso 1.3 |
| `OWNER_EMAIL` | Correos de gerencia, con acceso total. Si son varios, sepáralos con coma: `uno@gmail.com,otro@gmail.com` |
| `RESEND_API_KEY` | Llave del paso 2.1 |
| `MAIL_FROM` | Remitente del paso 2.3 |
| `VAPID_PUBLIC_KEY` | Del paso 3 |
| `VAPID_PRIVATE_JWK` | Del paso 3 (el texto completo entre llaves) |
| `AUTH_PEPPER` | Del paso 3 |

**Variables** (pestaña *Variables*):

| Nombre | Valor |
|---|---|
| `D1_DATABASE_ID` | Database ID del paso 1.1 |
| `PAGES_ORIGIN` | `https://TU-USUARIO.github.io` (sin barra al final, sin el nombre del repositorio) |
| `VAPID_SUBJECT` | `mailto:tu-correo@ejemplo.com` |
| `API_URL` | Se completa en el paso 6 |

## 5. Publicar la API

1. Ve a **Actions → API (pruebas y Cloudflare) → Run workflow**.
2. Al terminar en verde, abre Cloudflare → **Workers & Pages → control-hoteles-api**. Copia la dirección que termina en `.workers.dev` (por ejemplo `https://control-hoteles-api.tu-cuenta.workers.dev`).
3. Pruébala en el navegador agregando `/api/health` al final. Debe responder `{"ok":true,...}`.

## 6. Publicar la app

1. Crea la variable `API_URL` con la dirección del paso 5.2 (sin barra al final).
2. En **Settings → Pages**, en *Source* elige **GitHub Actions**.
3. Ve a **Actions → Publicar app (GitHub Pages) → Run workflow**.
4. La app queda en `https://TU-USUARIO.github.io/app-control-hoteles/`.

Desde ahora, cada cambio que se suba a `main` se publica solo: la carpeta `web/` actualiza la app y la carpeta `worker/` actualiza la API (primero corre las pruebas; si fallan, no publica).

## 7. Primer ingreso

1. Abre la app y escribe el correo de `OWNER_EMAIL`. Te llega el código.
2. Al entrar, acepta **Activar huella o Face ID**.
3. En **Ajustes → Avisos**, toca **Activar avisos** y luego **Enviar aviso de prueba**.
4. En **Ajustes → Hoteles**, revisa la hora de salida (11:00) y el precio por noche de cada hotel.
5. En **Usuarios**, agrega a tu personal con su correo y sus roles por hotel.

### Instalar en los teléfonos del personal

- **iPhone (Safari):** abrir la dirección → botón Compartir → **Agregar a pantalla de inicio**. Abrirla desde el ícono y activar avisos ahí. En iPhone los avisos solo funcionan con la app instalada (iOS 16.4 o más nuevo).
- **Android (Chrome):** abrir la dirección → **Instalar app** (aparece un botón en la app o en el menú ⋮).

## Costos

Con dos hoteles y unas 10 personas, todo cabe en los planes gratuitos: GitHub Pages y Actions, Cloudflare Workers (100 000 peticiones al día), D1 (5 GB), R2 (10 GB) y Resend (3 000 correos al mes, 100 al día).

## Problemas comunes

| Síntoma | Solución |
|---|---|
| La app dice "Sin conexión con el servidor" | Revisa la variable `API_URL` y que la API responda en `/api/health`. |
| No llega el código | Revisa `RESEND_API_KEY`, `MAIL_FROM` y que el dominio esté verificado en Resend. Mira la carpeta de spam. |
| "Origen no permitido" al activar la huella | `PAGES_ORIGIN` debe ser exactamente `https://TU-USUARIO.github.io`. |
| No llegan avisos en iPhone | La app debe estar instalada en la pantalla de inicio y los avisos activados desde ahí. |
| Error de permisos en Actions | El token de Cloudflare necesita *Workers Scripts: Edit* y *D1: Edit*. |

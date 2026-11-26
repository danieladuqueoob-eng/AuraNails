# Guía de configuración y despliegue de AuraNails

## Paso 1: crear Supabase y configurar la base de datos

1. Entra en [supabase.com](https://supabase.com), crea una cuenta y un proyecto gratuito. Guarda la contraseña de la base de datos en un lugar seguro; la app no la necesita.
2. En el proyecto abre **Authentication → Providers → Email** y desactiva **Confirm email** para que el registro cree la sesión inmediatamente. El formulario crea la fila de manicurista en ese momento.
3. Abre **SQL Editor → New query**, copia todo el contenido de `supabase/schema.sql` y ejecútalo. El script crea las tablas, restricciones, índices, RLS y la función pública que revela únicamente los intervalos ocupados.
4. En **Project Settings → API** copia:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / publishable key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. No uses la `service_role` key en esta app ni en el navegador. No es una de las cuatro variables requeridas y nunca debe publicarse.

Las políticas permiten consultar manicuristas y servicios activos; las solicitudes públicas solo pueden insertarse y las manicuristas solo pueden consultar y administrar sus propios datos. Las solicitudes se validan también en PostgreSQL para evitar citas fuera de horario o solapadas.

## Paso 2: preparar Gmail para enviar confirmaciones

1. Inicia sesión en la cuenta Gmail que enviará los mensajes.
2. En **Cuenta de Google → Seguridad**, activa la **Verificación en 2 pasos**.
3. Abre **Contraseñas de aplicaciones** en la configuración de seguridad, crea una contraseña para AuraNails y copia la clave de 16 caracteres. Si Google no muestra la opción, revisa los requisitos de elegibilidad de la cuenta; no uses tu contraseña normal de Gmail.
4. Anota el correo completo como `GMAIL_USER` y la contraseña de aplicación como `GMAIL_APP_PASSWORD`. No publiques ni compartas esa contraseña.

## Paso 3: configurar y probar en local

1. En la raíz del proyecto copia `.env.example` como `.env.local` (PowerShell: `Copy-Item .env.example .env.local`).
2. Sustituye los cuatro valores de ejemplo por los dos valores de Supabase y las dos credenciales de Gmail:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon-publica
   GMAIL_USER=tu-correo@gmail.com
   GMAIL_APP_PASSWORD=tu-contrasena-de-aplicacion-sin-espacios
   ```

3. Instala dependencias con `npm install` y ejecuta `npm run dev`. Abre `http://localhost:3000`.
4. Comprueba el flujo completo:
   - Registra una manicurista con horas válidas, desde `/registro`.
   - Inicia sesión en `/login`, crea un servicio en `/panel`.
   - En una ventana privada, solicita una cita en `/`; confirma que el intervalo desaparece de la disponibilidad.
   - Vuelve al panel, pulsa **Confirmar y Notificar** y comprueba la bandeja de entrada de la clienta. Prueba también **Rechazar**.
5. Si el registro informa que no pudo guardar el perfil, confirma que **Confirm email** está desactivado y que ejecutaste `supabase/schema.sql` en el proyecto correcto.

La copia `.env.local` que se entrega contiene valores de ejemplo, no credenciales funcionales: reemplázalos antes de probar. No compartas ese archivo. `.gitignore` excluye `.env*`, con una excepción deliberada para que `.env.example` sí pueda versionarse.

## Paso 4: publicar el código en GitHub sin secretos

El inicializador de Next.js puede haber creado ya el repositorio Git local. En PowerShell, desde la raíz:

1. Revisa `git status --short` y comprueba que `.env.local` **no** aparezca. No fuerces su inclusión con `git add -f`.
2. Si el repositorio todavía no está inicializado, ejecuta `git init`.
3. Crea en GitHub un repositorio vacío, sin README ni licencia generados por GitHub, y copia su URL HTTPS o SSH.
4. Guarda el código y crea la rama principal:

   ```powershell
   git add .
   git status --short
   git commit -m "Initial AuraNails application"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/TU-REPOSITORIO.git
   git push -u origin main
   ```

   Si ya existe un remoto, revísalo con `git remote -v` y actualízalo con `git remote set-url origin ...` en vez de añadir un segundo `origin`.
5. Antes del push, confirma nuevamente que `.env.local` y cualquier contraseña o clave real no estén en el área preparada (`git diff --cached --name-only`).

## Paso 5: desplegar gratis en Vercel

1. Entra en [vercel.com](https://vercel.com), inicia sesión con GitHub e importa el repositorio AuraNails.
2. Conserva los valores predeterminados de Next.js. En **Settings → Environment Variables**, agrega las cuatro variables (sin comillas ni espacios alrededor del signo igual):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GMAIL_USER`
   - `GMAIL_APP_PASSWORD`
   
   Asígnalas al menos a **Production** y **Preview**; agrega **Development** si también conectarás Vercel CLI. Usa los valores reales, no los de `.env.example`.
3. Pulsa **Deploy**. Cada push a `main` inicia un nuevo despliegue. Si cambias una variable, inicia un redeploy para que se aplique.
4. En Supabase, abre **Authentication → URL Configuration** y establece como **Site URL** el dominio de Vercel. Agrega también los dominios de producción y preview necesarios a **Redirect URLs**.
5. Abre el dominio desplegado y repite el flujo de reserva y confirmación de correo. Revisa **Vercel → Deployments → Functions/Logs** si la ruta de correo responde con error; no incluyas secretos en los reportes.

Las capas gratuitas de Supabase, Gmail y Vercel dependen de sus límites y condiciones vigentes. Gmail puede aplicar límites de envío; para un uso de alto volumen se necesita un proveedor transaccional adecuado.

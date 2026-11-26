# AuraNails

Aplicación para descubrir manicuristas, reservar citas sin crear una cuenta y administrar servicios y solicitudes desde un panel privado.

## Requisitos

- Node.js 20.9 o posterior y npm.
- Un proyecto Supabase gratuito.
- Una cuenta Gmail con contraseña de aplicación para enviar confirmaciones.

## Desarrollo local

1. Sigue [GUIA_DESPLIEGUE.md](./GUIA_DESPLIEGUE.md) para crear el proyecto Supabase y configurar Gmail.
2. Copia `.env.example` a `.env.local` y reemplaza los cuatro valores de ejemplo por credenciales reales. `.env.local` está excluido de Git.
3. Ejecuta `npm install` si acabas de clonar el repositorio.
4. Ejecuta `npm run dev` y abre `http://localhost:3000`.

La guía explica cómo ejecutar el esquema SQL, registrar manicuristas y publicar la aplicación en GitHub y Vercel. La tabla de citas protege los datos de las clientas con RLS; la disponibilidad pública se entrega mediante una función que solo devuelve intervalos ocupados.

## Comandos

- `npm run dev`: servidor local.
- `npm run lint`: ESLint.
- `npm run build`: compilación de producción.

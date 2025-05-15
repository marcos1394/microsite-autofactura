// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/**/*.{js,jsx,ts,tsx}", // Muy importante para que escanee tus componentes React
      "./public/index.html"        // Opcional, si quieres que escanee tu index.html público
    ],
    theme: {
      extend: {
        // Aquí puedes añadir tus colores personalizados si quieres,
        // aunque ya los manejas dinámicamente con `branding.primaryColor` etc.
        // colors: {
        //   'primary': 'var(--color-primary)', // Ejemplo si usaras CSS variables
        //   'secondary': 'var(--color-secondary)',
        // }
      },
    },
    plugins: [],
  }
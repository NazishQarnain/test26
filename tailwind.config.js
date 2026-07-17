/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  // IMPORTANT: this app has no separate templates — every screen is built by
  // JS functions writing Tailwind classes into template-literal HTML strings
  // (see home.js, chat.js, profile.js, etc). Tailwind's CLI only generates CSS
  // for classes it can *see* as literal text in these files, so every .js file
  // must be listed here. If you add a new .js file to the project, add it below
  // (or just use the '*.js' glob, which already covers the whole root folder).
  content: [
    './index.html',
    './*.js',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      colors: {
        nova: {
          50: '#fff7ed',
          100: '#ffedd5',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
        },
      },
    },
  },
  plugins: [],
};

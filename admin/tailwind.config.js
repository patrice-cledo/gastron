/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A5B3D',
          dark: '#0F3522',
          light: '#2D8B5C',
        },
      },
    },
  },
  plugins: [],
};

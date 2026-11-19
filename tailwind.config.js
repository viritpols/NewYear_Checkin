/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        cream: {
          50: '#FFFDF8',
          100: '#FBF6EA',
          200: '#F4EAD3',
          300: '#E9DBBB',
        },
        brass: {
          200: '#F1E2B5',
          300: '#E6CF94',
          400: '#D4B46A',
          500: '#B8954A',
          600: '#9A7A36',
          700: '#7A5F28',
          800: '#5C4720',
        },
        copper: {
          300: '#E2A07A',
          400: '#CD7F52',
          500: '#B8693D',
          600: '#9A5530',
          700: '#7A4226',
        },
        patina: {
          50: '#EEF6F1',
          100: '#D8EBE1',
          200: '#B4D8C6',
          300: '#8CC3A9',
          400: '#6BAA8E',
          500: '#4E8F74',
          600: '#3D735D',
          700: '#2F5A49',
          800: '#234437',
          900: '#183027',
        },
        ink: '#2E2B24',
      },
      // ธีมปีใหม่ 2027: ทองเหลือง / ทองแดง / สนิมทองแดง (copper oxide) / ขาวนวล
      fontFamily: {
        'display': ['var(--font-cinzel)', 'var(--font-noto-serif-thai)', 'serif'], // หัวเรื่องอังกฤษ (Thai fallback อัตโนมัติ)
        'serif-thai': ['var(--font-noto-serif-thai)', 'serif'], // หัวเรื่องภาษาไทย
        'anuphan': ['var(--font-anuphan)', 'sans-serif'],
        'ibm-plex-sans-thai-looped': ['var(--font-ibm-plex-sans-thai-looped)', 'sans-serif'],
        'ibm-plex-sans-thai': ['var(--font-ibm-plex-sans-thai)', 'sans-serif'],
        'kanit': ['var(--font-kanit)', 'sans-serif'],
        'maitree': ['var(--font-maitree)', 'sans-serif'],
        'mali': ['var(--font-mali)', 'sans-serif'],
        'mitr': ['var(--font-mitr)', 'sans-serif'],
        'sans': ['var(--font-kanit)', 'sans-serif'], // ตั้งค่า default เป็น Kanit
      },
    },
  },
  plugins: [],
}


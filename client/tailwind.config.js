/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        metallic: {
          900: '#1a1d23',
          800: '#22262e',
          700: '#2d323b',
          600: '#3a3f4a',
          500: '#4a4f5a',
        },
        beginner: '#3B82F6',
        intermediate: '#22C55E',
        advanced: '#EF4444',
      },
      backgroundImage: {
        'metallic-gradient':
          'linear-gradient(145deg, #2d323b 0%, #1a1d23 100%)',
        'card-metallic':
          'linear-gradient(160deg, #2d323b 0%, #1a1d23 50%, #15181d 100%)',
        'metallic-shine':
          'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.03) 100%)',
      },
    },
  },
  plugins: [],
}

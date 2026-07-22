/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        board: {
          bg: "#050a14",
          row: "#1A3254",
          alt: "#102341",
          header: "#BFEFD5",
          ink: "#f5f3ec",
          dim: "#a9b6d4",
          amber: "#f5c542",
          red: "#e64545",
          green: "#3fc77a",
        },
      },
      fontFamily: {
        display: ["'Bebas Neue'", "'Arial Narrow'", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};

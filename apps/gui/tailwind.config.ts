import type { Config } from "tailwindcss"

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        body: ["Work Sans", "sans-serif"],
        display: ["Fraunces", "serif"],
      },
      colors: {
        ink: "#1b1a19",
        paper: "#f6f2eb",
        moss: "#315a4d",
        fog: "#e7e1d7",
        ember: "#f39a3f",
        ocean: "#1e3a50",
      },
      boxShadow: {
        panel: "0 20px 50px rgba(24, 33, 24, 0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config

import type { Config } from "tailwindcss"

const cssVar = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        body: ["Work Sans", "sans-serif"],
        display: ["Fraunces", "serif"],
      },
      colors: {
        ink: cssVar("ink"),
        paper: cssVar("paper"),
        fog: cssVar("fog"),
        slate: cssVar("slate"),
        cobalt: cssVar("cobalt"),
        "cobalt-600": cssVar("cobalt-600"),

        moss: cssVar("moss"),
        ember: cssVar("ember"),
        danger: cssVar("danger"),

        text1: cssVar("text-1"),
        text2: cssVar("text-2"),
        text3: cssVar("text-3"),

        canvas: cssVar("canvas"),
        surface1: cssVar("surface-1"),
        surface2: cssVar("surface-2"),
        surface3: cssVar("surface-3"),

        border1: cssVar("border-1"),
        border2: cssVar("border-2"),
      },
      boxShadow: {
        panel: "var(--shadow-panel)",
        popover: "var(--shadow-popover)",
        pressed: "var(--shadow-pressed)",
      },
      borderRadius: {
        panel: "var(--radius-xl)",
        control: "var(--radius-lg)",
        "control-sm": "var(--radius-md)",
      },
      transitionTimingFunction: {
        "ease-out": "var(--ease-out)",
      },
      transitionDuration: {
        fast: "var(--motion-fast)",
        ui: "var(--motion-ui)",
        medium: "var(--motion-medium)",
      },
    },
  },
  plugins: [],
} satisfies Config

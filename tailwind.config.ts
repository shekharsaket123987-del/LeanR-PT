import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          black: "#000000",
          charcoal: "#111111",
          charcoal2: "#1A1A1A",
          yellow: "#F5D90A",
          yellow2: "#FFE94D",
        },
        surface: {
          DEFAULT: "#060606",
          elevated: "#0C0C0C",
          soft: "#111111",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        soft: "0 4px 24px rgba(0,0,0,0.06)",
        card: "0 2px 12px rgba(0,0,0,0.05)",
        glow: "0 0 60px -10px rgba(245,217,10,0.35)",
        "glow-lg": "0 0 40px -8px rgba(245,217,10,0.6)",
        glass: "rgba(255,255,255,0.12) 0 1px inset, rgba(0,0,0,0.25) 0 0 0 1px, rgba(0,0,0,0.8) 0 25px 70px -20px",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;

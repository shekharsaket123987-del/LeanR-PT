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
        bg: {
          DEFAULT: "#060606",
          elevated: "#0c0c0c",
          soft: "#141414",
        },
        muted: {
          DEFAULT: "#9a9a95",
          2: "#6f6f6b",
        },
        yellow: {
          DEFAULT: "#F5D90A",
          bright: "#FFE94D",
          dim: "#B8A400",
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
        soft: "0 4px 24px rgba(0,0,0,0.4)",
        card: "0 2px 12px rgba(0,0,0,0.35)",
        glow: "0 0 40px rgba(245,217,10,0.3)",
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

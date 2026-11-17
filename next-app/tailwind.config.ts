import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Arial Black", "sans-serif"],
        body: ["var(--font-body)", "Geneva", "sans-serif"],
      },
      colors: {
        ink: "var(--ink)",
        lime: "var(--lime)",
        coral: "var(--coral)",
        ice: "var(--ice)",
        mist: "var(--mist)",
        mute: "var(--mute)",
        panel: "var(--panel)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(28px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        floaty: {
          "0%, 100%": { transform: "translateY(0) rotate(-2deg)" },
          "50%": { transform: "translateY(-14px) rotate(2deg)" },
        },
        shutter: {
          "0%, 100%": { opacity: "0.35", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.08)" },
        },
        cascade: {
          "0%": { opacity: "0", transform: "translateY(40px) rotate(-1deg)" },
          "100%": { opacity: "1", transform: "translateY(0) rotate(0deg)" },
        },
      },
      animation: {
        rise: "rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        floaty: "floaty 5.5s ease-in-out infinite",
        shutter: "shutter 2.4s ease-in-out infinite",
        cascade: "cascade 0.65s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;

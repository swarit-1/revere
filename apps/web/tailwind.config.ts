import type { Config } from "tailwindcss";

// Design tokens locked in docs/plans/session-6-briefing-ui.md.
// T-23 ships the colors + font-family references; T-25 fills in the spacing
// scale + next/font wiring + per-token usage rules.

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1a1a17",
        cream: "#faf7f0",
        vermilion: "#c8331f",
        district: "#5a6b5a",
        whisper: "#e8e3d6",
      },
      fontFamily: {
        // T-25 swaps to next/font CSS variables. Fallback chains here cover
        // the gap until those land.
        serif: ['"Source Serif 4"', '"Source Serif Pro"', "Georgia", "serif"],
        body: ['"Public Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"SF Mono"', "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

// Design tokens locked in docs/plans/session-6-briefing-ui.md.
// Vermilion is rationed: 3 uses per screen ceiling — cover-header
// numerals, link underlines, primary CTA. No other surface should pull
// it; every appearance is a deliberate accent.

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
        serif: ["var(--font-serif)", '"Source Serif 4"', "Georgia", "serif"],
        body: ["var(--font-body)", '"Public Sans"', "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", '"JetBrains Mono"', "Menlo", "monospace"],
      },
      // 8px base scale, generous editorial extremes for cover-header negative space.
      spacing: {
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "5": "20px",
        "6": "24px",
        "7": "28px",
        "8": "32px",
        "10": "40px",
        "12": "48px",
        "16": "64px",
        "20": "80px",
        "24": "96px",
        "32": "128px",
      },
      // Source Serif Display sizes — 28/32 are the briefing headline; 36/48
      // are the cover header. Body is 16/24 with optical-tracking-friendly 1.55.
      fontSize: {
        "label": ["11px", { lineHeight: "16px", letterSpacing: "0.08em" }],
        "metadata": ["13px", { lineHeight: "20px", letterSpacing: "0.04em" }],
        "body-sm": ["14px", { lineHeight: "1.55" }],
        "body": ["16px", { lineHeight: "1.55" }],
        "body-lg": ["18px", { lineHeight: "1.55" }],
        "headline-sm": ["22px", { lineHeight: "1.18" }],
        "headline": ["28px", { lineHeight: "1.15" }],
        "headline-lg": ["36px", { lineHeight: "1.1" }],
        "cover": ["44px", { lineHeight: "1.05" }],
      },
      letterSpacing: {
        "tighter": "-0.03em",
      },
    },
  },
  plugins: [],
};

export default config;

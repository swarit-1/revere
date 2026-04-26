import type { Config } from "tailwindcss";

// Design tokens locked in docs/plans/session-6-briefing-ui.md.
// Vermilion is rationed: 3 uses per screen ceiling — cover-header
// numerals, link underlines, primary CTA. No other surface should pull
// it; every appearance is a deliberate accent.
//
// Session 9 motion pass extends with keyframes for cinematic reveals
// (hook quote, briefing list stagger, modal entrances) and an
// "ink-grad" / "lantern" gradient pair for atmospheric backgrounds.

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1a1a17",
        cream: "#faf7f0",
        vermilion: "#c8331f",
        "vermilion-deep": "#9d2516",
        district: "#5a6b5a",
        whisper: "#e8e3d6",
        // Slightly darker ink for hook backgrounds — pure black is too sterile.
        midnight: "#0e0e0c",
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
        "display": ["clamp(48px, 9vw, 112px)", { lineHeight: "0.96", letterSpacing: "-0.04em" }],
      },
      letterSpacing: {
        "tighter": "-0.03em",
      },
      backgroundImage: {
        // Lantern halo for the hook page — a warm vermilion glow under
        // an off-axis "moon."
        "lantern":
          "radial-gradient(ellipse at 78% 30%, rgba(200, 51, 31, 0.18) 0%, rgba(14, 14, 12, 0) 55%), radial-gradient(ellipse at 14% 76%, rgba(255, 226, 185, 0.06) 0%, rgba(14, 14, 12, 0) 50%)",
        // Cream gradient with a single warm corner — applied behind the
        // home page hero.
        "dawn":
          "radial-gradient(circle at 88% -10%, rgba(200, 51, 31, 0.08) 0%, rgba(250, 247, 240, 0) 45%), radial-gradient(circle at -10% 110%, rgba(90, 107, 90, 0.10) 0%, rgba(250, 247, 240, 0) 50%)",
      },
      keyframes: {
        // Soft fade-in. Used as the foundation everywhere.
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        // Editorial fade-up: 12px translation feels like a gentle settle.
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-up-lg": {
          "0%": { opacity: "0", transform: "translateY(28px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-down": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        // Modal scale-fade. 0.96 → 1 is the smallest scale that still
        // reads as "settling in."
        "modal-in": {
          "0%": { opacity: "0", transform: "scale(0.96) translateY(8px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "backdrop-in": {
          "0%": { opacity: "0", backdropFilter: "blur(0)" },
          "100%": { opacity: "1", backdropFilter: "blur(8px)" },
        },
        // The hook quote types in line by line — actually each word reveals
        // through a clip-path mask.
        "word-reveal": {
          "0%": { opacity: "0", transform: "translateY(0.3em)", filter: "blur(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)", filter: "blur(0)" },
        },
        // Subtle living glow on the lantern.
        "lantern-pulse": {
          "0%, 100%": { opacity: "0.85" },
          "50%": { opacity: "1" },
        },
        // Long horizontal rule that draws across.
        "draw-rule": {
          "0%": { transform: "scaleX(0)", transformOrigin: "left center" },
          "100%": { transform: "scaleX(1)", transformOrigin: "left center" },
        },
        "draw-underline": {
          "0%": { transform: "scaleX(0)", transformOrigin: "left center" },
          "100%": { transform: "scaleX(1)", transformOrigin: "left center" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        "marquee-slow": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "ride-sweep": {
          "0%": { transform: "translateX(-110%)", opacity: "0" },
          "20%": { opacity: "1" },
          "85%": { opacity: "1" },
          "100%": { transform: "translateX(110%)", opacity: "0" },
        },
      },
      animation: {
        "fade-in": "fade-in 700ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        "fade-up": "fade-up 600ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        "fade-up-lg": "fade-up-lg 800ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        "fade-down": "fade-down 500ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        "slide-in-left": "slide-in-left 700ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        "slide-in-right": "slide-in-right 700ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        "modal-in": "modal-in 320ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        "backdrop-in": "backdrop-in 220ms ease-out both",
        "word-reveal": "word-reveal 700ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        "lantern-pulse": "lantern-pulse 6s ease-in-out infinite",
        "draw-rule": "draw-rule 1.4s cubic-bezier(0.22, 0.61, 0.36, 1) both",
        "draw-underline": "draw-underline 600ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        shimmer: "shimmer 1.6s linear infinite",
        "marquee-slow": "marquee-slow 60s linear infinite",
        "blink-cursor": "blink 1.05s steps(1) infinite",
        "ride-sweep": "ride-sweep 3.5s cubic-bezier(0.4, 0, 0.6, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;

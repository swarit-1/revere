// next/font/google loaders for the editorial typography pair locked in
// docs/plans/session-6-briefing-ui.md. Banned defaults (Inter, Roboto,
// Space Grotesk, system-ui) never reach this file.

import { Source_Serif_4, Public_Sans, JetBrains_Mono } from "next/font/google";

export const fontSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

export const fontBody = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-body",
  display: "swap",
});

export const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mono",
  display: "swap",
});

export const fontVariables = `${fontSerif.variable} ${fontBody.variable} ${fontMono.variable}`;

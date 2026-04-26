import type { ReactNode } from "react";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata = {
  title: "Revere",
  description: "Your personal civic chief of staff.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="bg-cream font-body text-ink antialiased">{children}</body>
    </html>
  );
}

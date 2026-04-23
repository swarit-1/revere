import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Revere",
  description: "Your personal civic chief of staff.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

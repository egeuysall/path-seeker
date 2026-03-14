import type { Metadata } from "next";
import { Geist, Lora } from "next/font/google";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PathSeeker",
  description: "Voice and text route planning with AI extraction, transcription, and Google route optimization.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${lora.variable}`}>
      <body className="antialiased" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
        <style>{`
          h1, h2, h3, h4, h5, h6 {
            font-family: var(--font-lora), Georgia, serif;
          }
        `}</style>
        {children}
      </body>
    </html>
  );
}

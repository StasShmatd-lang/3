import type { CSSProperties } from "react";
import type { Metadata } from "next";
import "./globals.css";

// Fonts load in the guest's browser from Google Fonts.
// (next/font/google downloaded them during the build and sometimes broke the deploy.)
const FONTS_CSS =
  "https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Unbounded:wght@500;700;800&display=swap";

const fontVars = {
  "--font-display": '"Unbounded"',
  "--font-body": '"Onest"',
} as CSSProperties;

export const metadata: Metadata = {
  title: "Фото-охота",
  description: "Корпоративный интерактив: 5 миссий, модерация и галерея зала",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={FONTS_CSS} />
      </head>
      <body className="font-body antialiased" style={fontVars}>
        <div className="noise" aria-hidden />
        <div className="stage">{children}</div>
      </body>
    </html>
  );
}

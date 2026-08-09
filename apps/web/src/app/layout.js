export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import { Geist, Geist_Mono } from "next/font/google";
import "@openscroll/design-tokens/tokens.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "OpenScroll — Epic A Foundation",
  description: "A calm, account-free foundation for exploring open knowledge and culture.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

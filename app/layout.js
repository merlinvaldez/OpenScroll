import { Analytics } from '@vercel/analytics/next';
import "@openscroll/design-tokens/tokens.css";
import "../apps/web/src/app/globals.css";

export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
export const metadata = { title: "OpenScroll", description: "Explore open knowledge, one choice at a time." };

export default function RootLayout({ children }) {
  return <html lang="en" dir="ltr" suppressHydrationWarning><body>{children}<Analytics /></body></html>;
}

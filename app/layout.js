export const metadata = {
  title: "OpenScroll",
  description: "Explore open knowledge, one choice at a time.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Little House Flower · Client Demo",
  description: "Private demonstration of the Little House Flower storefront and studio.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { APP_NAME, COMPANY, TAGLINE } from "@/lib/brand";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: `${APP_NAME}: ${TAGLINE}`,
  description: `${APP_NAME} by ${COMPANY}: qualify commercial solar and storage opportunities, or look up what clean energy could be worth on your own building. Free map and database views over 92,000 buildings of public energy data.`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}

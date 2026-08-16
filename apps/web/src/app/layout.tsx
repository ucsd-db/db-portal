import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto" });

export const metadata: Metadata = { title: "Team Portal", description: "Dragon boat team portal" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={roboto.variable}>
      <body className="antialiased" style={{ fontFamily: "var(--font-roboto), Roboto, Arial, sans-serif" }}>{children}</body>
    </html>
  );
}

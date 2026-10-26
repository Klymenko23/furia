import type { Metadata, Viewport } from "next";
import { Golos_Text, JetBrains_Mono, Unbounded } from "next/font/google";
import "./globals.css";
import { themeInitScript } from "@/lib/theme";

const body = Golos_Text({ subsets: ["latin", "cyrillic"], variable: "--font-body", weight: ["400", "500", "600", "700"] });
const display = Unbounded({ subsets: ["latin", "cyrillic"], variable: "--font-display", weight: ["500", "700", "800"] });
const mono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-mono", weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "Furia",
  description: "Автопарк, водії, документи й витрати перевізника",
  appleWebApp: { capable: true, title: "Furia", statusBarStyle: "default" },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f1ee" },
    { media: "(prefers-color-scheme: dark)", color: "#141210" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={`${body.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

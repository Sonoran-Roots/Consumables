import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import AppShell from "@/components/app-shell";
import "./globals.css";

const jarsSans = Archivo({
  variable: "--font-jars-sans",
  subsets: ["latin"],
});

const jarsMono = JetBrains_Mono({
  variable: "--font-jars-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JARS Inventory",
  description: "Consumable inventory tracking across sites and books",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jarsSans.variable} ${jarsMono.variable} h-full antialiased`}
    >
      <body className="flex h-full bg-white text-black">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

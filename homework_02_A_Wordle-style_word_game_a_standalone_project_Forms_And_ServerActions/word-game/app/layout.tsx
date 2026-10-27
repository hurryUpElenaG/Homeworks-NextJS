import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Word Game — Five Letters",
  description:
    "A Wordle-style game. Guess the five-letter word in six attempts.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground flex min-h-screen flex-col antialiased">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-10">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {
  NorthStarBar,
  NorthStarBarSkeleton,
} from "@/components/shell/north-star-bar";
import { BottomNav } from "@/components/shell/bottom-nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Basecamp",
  description: "Trail readiness and mountain training coach.",
};

export const viewport: Viewport = {
  themeColor: "#0a0b0d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Suspense fallback={<NorthStarBarSkeleton />}>
          <NorthStarBar />
        </Suspense>
        <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-5 pb-24">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}

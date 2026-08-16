import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {
  NorthStarBar,
  NorthStarBarSkeleton,
} from "@/components/shell/north-star-bar";
import { BottomNav } from "@/components/shell/bottom-nav";
import { InstallPrompt } from "@/components/shell/install-prompt";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Basecamp — trail readiness",
  description:
    "Personalized trail readiness for any hike you're planning. Basecamp uses your recent training data to tell you what any trail will feel like for you, right now.",
  applicationName: "Basecamp",
  appleWebApp: {
    capable: true,
    title: "Basecamp",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0d",
  width: "device-width",
  initialScale: 1,
  // Allow the app to draw under the iOS notch / bottom home indicator so
  // the shell can respect safe-area insets manually.
  viewportFit: "cover",
  // Casual users will rotate their phones sometimes; but the app is
  // designed for portrait — no landscape optimizations yet.
  userScalable: true,
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
        <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-5 pb-28">
          {children}
        </main>
        <InstallPrompt />
        <BottomNav />
      </body>
    </html>
  );
}

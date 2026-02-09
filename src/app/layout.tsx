import type { Metadata } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers";
import { NativeAppBridge } from "@/components/NativeAppBridge";
import { Agentation } from "agentation";

// Force dynamic rendering for all pages
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Agathon",
    template: "%s | Agathon",
  },
  description: "The AI-powered learning companion that helps you understand, not just answer. Draw problems, get hints, and learn by doing.",
  keywords: ["AI tutor", "learning", "education", "math help", "homework help", "study assistant", "whiteboard"],
  authors: [{ name: "Agathon" }],
  creator: "Agathon",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://agathon.app"),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Agathon",
    title: "Agathon - AI Learning Companion",
    description: "The AI-powered learning companion that helps you understand, not just answer. Draw problems, get hints, and learn by doing.",
    images: [
      {
        url: "/logo/agathonwide.png",
        width: 1200,
        height: 630,
        alt: "Agathon - AI Learning Companion",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Agathon - AI Learning Companion",
    description: "The AI-powered learning companion that helps you understand, not just answer.",
    images: ["/logo/agathonwide.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Agathon",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cormorantGaramond.variable} antialiased`}
        suppressHydrationWarning
      >
        <NativeAppBridge />
        <AppProviders>
          {children}
        </AppProviders>
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  );
}

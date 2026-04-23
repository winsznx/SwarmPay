import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SwarmPay | High-Fidelity Autonomous Agent Settlement",
  description: "The settlement layer for the autonomous agent economy. 0.0006 gas swaps, instant nanopayments, and high-fidelity compute marketplaces on the Arc Network.",
  openGraph: {
    title: "SwarmPay | Autonomous Agent Settlement",
    description: "Instant nanopayments for the agent economy on Arc Network.",
    url: "https://swarmpay.arc",
    siteName: "SwarmPay",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SwarmPay Mission Control",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SwarmPay | Autonomous Agent Settlement",
    description: "The economic backbone of the agent swarm.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

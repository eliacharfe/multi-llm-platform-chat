// apps/web/src/app/layout.tsx

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "prismjs/themes/prism-tomorrow.css";
import "@/lib/prism";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Multi-LLM Platform",
    template: "%s | Multi-LLM Platform",
  },
  description:
    "A powerful multi-provider AI chat platform. Chat with OpenAI, Claude, Gemini, Groq, DeepSeek and more — in one unified streaming interface.",
  keywords: [
    "LLM",
    "AI Chat",
    "OpenAI",
    "Claude",
    "Gemini",
    "Groq",
    "DeepSeek",
    "Multi Model AI",
    "Streaming AI",
    "AI Platform",
  ],
  authors: [{ name: "Eliachar Feig" }],
  creator: "Eliachar Feig",
  metadataBase: new URL("https://multi-llm-platform-premium.vercel.app"),
  openGraph: {
    title: "Multi-LLM Platform",
    description:
      "Chat with multiple AI models in one powerful streaming interface.",
    url: "https://multi-llm-platform-premium.vercel.app",
    siteName: "Multi-LLM Platform",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Multi-LLM Platform",
    description:
      "A unified AI chat interface for OpenAI, Claude, Gemini, Groq and more.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
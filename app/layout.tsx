import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Suspense } from "react"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

export const metadata: Metadata = {
  title: "WebGrade - Website Performance Analysis",
  description:
    "Analyze your website's performance, accessibility, SEO, and security with comprehensive reports powered by Google Lighthouse.",
  keywords: [
    "website grader",
    "website analyzer",
    "performance analysis",
    "SEO audit",
    "accessibility checker",
    "lighthouse report",
    "website speed test",
    "core web vitals",
  ],
  icons: {
    icon: "/placeholder-logo.svg",
    apple: "/placeholder-logo.png",
  },
  authors: [{ name: "Dhibi chames eddine", url: "https://chames.youssef.tn" }],
  metadataBase: new URL("https://webgrade.pages.dev"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://webgrade.pages.dev",
    siteName: "WebGrade",
    title: "WebGrade - Grade & Improve Any Website",
    description:
      "Get a comprehensive grade for any website with actionable recommendations to improve performance, accessibility, SEO, and security.",
    images: [
      {
        url: "/placeholder-logo.png",
        width: 1200,
        height: 630,
        alt: "WebGrade - Website Performance Analysis",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WebGrade - Grade & Improve Any Website",
    description:
      "Analyze your website's performance, accessibility, SEO, and security with comprehensive reports powered by Google Lighthouse.",
    images: ["/placeholder-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={null}>
          {children}
        </Suspense>
        <Toaster />
      </body>
    </html>
  )
}

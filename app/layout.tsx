import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Suspense } from "react"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

export const metadata: Metadata = {
  title: "WebGrade — Website intelligence, without the noise",
  description:
    "Measure website performance, accessibility, search, HTTP security, and agent readiness with clear evidence and actionable next steps.",
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
    icon: "/webgrade-mark.svg",
    apple: "/apple-touch-icon.png",
  },
  authors: [{ name: "Chames Eddine Dhibi", url: "https://chames.tn" }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://webgrade.chames.tn"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://webgrade.chames.tn",
    siteName: "WebGrade",
    title: "WebGrade — See what your website is telling the world",
    description:
      "A focused website audit for speed, access, search, security, and agent readiness.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "The WebGrade home page, ready to check a website",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WebGrade — See what your website is telling the world",
    description:
      "A focused website audit for speed, access, search, security, and agent readiness.",
    images: ["/og-image.jpg"],
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
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={null}>
          {children}
        </Suspense>
        <Toaster />
      </body>
    </html>
  )
}

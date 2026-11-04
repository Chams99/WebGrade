import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Suspense } from "react"
import { Toaster } from "@/components/ui/toaster"
import { developer, developerPerson } from "@/lib/developer"
import "./globals.css"

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": "https://webgrade.chames.tn/#app",
      name: "WebGrade",
      url: "https://webgrade.chames.tn/",
      description:
        "Measure website performance, accessibility, search, HTTP security, and agent readiness with clear evidence and actionable next steps.",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript",
      inLanguage: "en",
      creator: { "@id": developerPerson["@id"] },
    },
    developerPerson,
  ],
}

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
  authors: [{ name: developer.name, url: developer.portfolio }],
  creator: developer.name,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://webgrade.chames.tn"),
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </body>
    </html>
  )
}

import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Suspense } from "react"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "WebGrade - Website Performance Analysis",
  description:
    "Analyze your website's performance, accessibility, SEO, and security with comprehensive reports powered by Google Lighthouse.",
  icons: {
    icon: "/placeholder-logo.svg",
    apple: "/placeholder-logo.png",
  },
  authors: [{ name: "Dhibi chames eddine", url: "https://chames.youssef.tn" }],
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
      <body className={`font-sans ${inter.variable}`}>
        <Suspense fallback={null}>
          {children}
        </Suspense>
      </body>
    </html>
  )
}

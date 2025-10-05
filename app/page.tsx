"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Gauge, Shield, Zap, Search, TrendingUp, CheckCircle2, Smartphone, Monitor } from "lucide-react"
import { useRouter } from "next/navigation"
import { ScanHistory } from "@/components/scan-history"

export default function HomePage() {
  const [url, setUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const router = useRouter()

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!url) return

    setIsAnalyzing(true)

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })

      const data = await response.json()

      if (data.error) {
        alert(data.message || "Failed to analyze website. Please try again.")
        return
      }

      if (data.success) {
        // Store results in localStorage and navigate to results page
        localStorage.setItem("latest-scan-result", JSON.stringify(data))
        router.push("/results")
      }
    } catch (error) {
      console.error("Error analyzing website:", error)
      alert("Failed to analyze website. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <span className="text-lg sm:text-xl font-semibold">WebGrade</span>
          </div>
          <nav className="hidden sm:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              How it Works
            </a>
          </nav>
          <div className="sm:hidden flex items-center gap-2">
            <a href="#features" className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1">
              Features
            </a>
            <a href="#how-it-works" className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1">
              How it Works
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-6">
            <Zap className="h-4 w-4" />
            <span className="flex items-center gap-1.5">
              Powered by Google Lighthouse •
              <Smartphone className="h-3.5 w-3.5" />
              Mobile +
              <Monitor className="h-3.5 w-3.5" />
              Desktop
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-6 text-balance leading-tight">
            Grade & Improve Any Website
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground mb-8 sm:mb-12 text-pretty max-w-2xl mx-auto px-4">
            Get a comprehensive grade for any website with actionable recommendations to improve performance, accessibility,
            SEO, and security. Perfect for developers, agencies, and business owners.
          </p>

          {/* URL Input Form */}
          <form onSubmit={handleAnalyze} className="max-w-2xl mx-auto px-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 h-12 sm:h-14 text-base sm:text-lg bg-card border-border"
                required
              />
              <Button type="submit" size="lg" className="h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg" disabled={isAnalyzing}>
                {isAnalyzing ? (
                  <>
                    <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Search className="h-5 w-5 mr-2" />
                    Analyze
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-3 text-center px-4">
              Enter any website URL to get a detailed grade and improvement roadmap
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-4 text-xs text-muted-foreground px-4">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                No signup required
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                Instant results
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                Step-by-step fixes
              </span>
            </div>
          </form>
        </div>
      </section>

      {/* Use Cases */}
      <section className="container mx-auto px-4 py-12 sm:py-20 bg-accent/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4 px-4">Who is this for?</h2>
          <p className="text-center text-muted-foreground mb-8 sm:mb-12 text-base sm:text-lg px-4">
            Whether you're building, auditing, or optimizing, WebGrade gives you the insights you need
          </p>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            <Card className="p-6 bg-card border-border">
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Web Developers</h3>
              <p className="text-muted-foreground mb-4">
                Get detailed technical recommendations to optimize your websites and deliver better user experiences.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Debug performance bottlenecks</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Fix accessibility issues</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Track improvements over time</span>
                </li>
              </ul>
            </Card>

            <Card className="p-6 bg-card border-border">
              <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Agencies & Consultants</h3>
              <p className="text-muted-foreground mb-4">
                Audit client websites, generate professional reports, and demonstrate measurable improvements.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Grade competitor websites</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Export professional reports</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Show ROI to clients</span>
                </li>
              </ul>
            </Card>

            <Card className="p-6 bg-card border-border">
              <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Business Owners</h3>
              <p className="text-muted-foreground mb-4">
                Understand your website's health and get clear, actionable steps to improve your online presence.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>No technical knowledge needed</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Improve SEO rankings</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Boost conversions</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="container mx-auto px-4 py-12 sm:py-20 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4 px-4">What you'll get</h2>
          <p className="text-center text-muted-foreground mb-8 sm:mb-12 text-base sm:text-lg px-4">
            More than just scores - get actionable guidance to improve your website
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <Card className="p-6 bg-card border-border hover:border-primary/50 transition-colors">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Performance Analysis</h3>
              <p className="text-muted-foreground">
                Comprehensive performance metrics including Core Web Vitals, load times, and speed optimization recommendations
                with step-by-step fixes.
              </p>
            </Card>

            <Card className="p-6 bg-card border-border hover:border-primary/50 transition-colors">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Accessibility Audit</h3>
              <p className="text-muted-foreground">
                WCAG compliance checks with detailed guidance on fixing issues to make your site accessible to everyone,
                including users with disabilities.
              </p>
            </Card>

            <Card className="p-6 bg-card border-border hover:border-primary/50 transition-colors">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">SEO Optimization</h3>
              <p className="text-muted-foreground">
                Technical SEO analysis with specific recommendations for meta tags, structured data, mobile-friendliness,
                and search engine visibility.
              </p>
            </Card>

            <Card className="p-6 bg-card border-border hover:border-primary/50 transition-colors">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Security Checks</h3>
              <p className="text-muted-foreground">
                SSL/TLS certificate validation, HTTPS enforcement, and security best practices to protect your users and
                build trust.
              </p>
            </Card>

            <Card className="p-6 bg-card border-border hover:border-primary/50 transition-colors">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Gauge className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Best Practices Review</h3>
              <p className="text-muted-foreground">
                Industry-standard web development practices covering code quality, browser compatibility, and modern web
                standards.
              </p>
            </Card>

            <Card className="p-6 bg-card border-border hover:border-primary/50 transition-colors">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Actionable Roadmap</h3>
              <p className="text-muted-foreground">
                Prioritized issues with step-by-step instructions, estimated impact scores, and links to detailed
                documentation for every fix.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Scan History */}
      <section className="container mx-auto px-4 py-12 sm:py-20 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <ScanHistory />
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="container mx-auto px-4 py-12 sm:py-20 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4 px-4">How it works</h2>
          <p className="text-center text-muted-foreground mb-8 sm:mb-12 text-base sm:text-lg px-4">
            Simple, fast, and comprehensive website analysis
          </p>

          <div className="space-y-6 sm:space-y-8 px-4">
            <div className="flex gap-4 sm:gap-6">
              <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base sm:text-lg">
                1
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2">Enter your URL</h3>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Simply paste any website URL into the analyzer. We support all public websites.
                </p>
              </div>
            </div>

            <div className="flex gap-4 sm:gap-6">
              <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base sm:text-lg">
                2
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2">We analyze your site</h3>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Our system runs comprehensive tests on both mobile and desktop using Google Lighthouse, checking
                  performance, accessibility, SEO, and security across both platforms.
                </p>
              </div>
            </div>

            <div className="flex gap-4 sm:gap-6">
              <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base sm:text-lg">
                3
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2">Get your improvement roadmap</h3>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Receive detailed grades, prioritized issues, and step-by-step instructions to fix each problem. Track
                  potential score improvements as you implement changes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-12 sm:mt-20">
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 text-center">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <span className="font-semibold text-sm sm:text-base">WebGrade</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              <p className="text-xs sm:text-sm text-muted-foreground">Powered by Google PageSpeed Insights</p>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Created by{" "}
                <a 
                  href="https://chames.youssef.tn" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Dhibi chames eddine
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

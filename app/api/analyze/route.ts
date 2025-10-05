import { type NextRequest, NextResponse } from "next/server"

// Configure route for Edge Runtime (required for Cloudflare Pages)
export const runtime = 'edge'

// Simple in-memory cache to avoid repeated API calls for the same URL
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Request queue to avoid overwhelming the API
const requestQueue = new Map<string, Promise<any>>()

// Single API key
const API_KEY = process.env.PAGESPEED_API_KEY || ""

// Use a simple fallback: if direct request fails, try with different User-Agent
const USER_AGENTS = [
  "Mozilla/5.0 (compatible; WebGrade/1.0)",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
]

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 })
    }

    // Run analysis and return results directly
    const analysisResult = await analyzeWebsite(url)

    return NextResponse.json(analysisResult)
  } catch (error) {
    console.error("Error in analyze route:", error)
    return NextResponse.json(
      { 
        error: "Failed to analyze website",
        message: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    )
  }
}

async function analyzeWebsite(url: string) {
  try {
    // Run mobile, desktop, and SSL checks in parallel
    const [mobileResults, desktopResults, sslResults] = await Promise.all([
      runLighthouseCheck(url, 'mobile'), 
      runLighthouseCheck(url, 'desktop'),
      runSSLCheck(url)
    ])

    // Return complete results with both mobile and desktop
    return {
      success: true,
      url,
      analyzedAt: new Date().toISOString(),
      mobile: {
        scan: {
          url,
          created_at: new Date().toISOString(),
          performance_score: mobileResults.performance,
          accessibility_score: mobileResults.accessibility,
          best_practices_score: mobileResults.bestPractices,
          seo_score: mobileResults.seo,
          ssl_valid: sslResults.valid,
          ssl_issuer: sslResults.issuer,
          ssl_expires_at: sslResults.expiresAt,
          page_title: mobileResults.pageTitle,
          page_description: mobileResults.pageDescription,
          load_time_ms: mobileResults.loadTime,
          page_size_kb: mobileResults.pageSize,
          status: 'completed',
          error_message: null,
          screenshot: mobileResults.screenshot,
        },
        details: {
          first_contentful_paint: mobileResults.metrics.fcp,
          largest_contentful_paint: mobileResults.metrics.lcp,
          total_blocking_time: mobileResults.metrics.tbt,
          cumulative_layout_shift: mobileResults.metrics.cls,
          speed_index: mobileResults.metrics.speedIndex,
          performance_issues: mobileResults.performanceIssues,
          accessibility_issues: mobileResults.accessibilityIssues,
          best_practices_issues: mobileResults.bestPracticesIssues,
          seo_issues: mobileResults.seoIssues,
          lighthouse_report: mobileResults.fullReport,
          screenshot_thumbnails: mobileResults.screenshotThumbnails,
        }
      },
      desktop: {
        scan: {
          url,
          created_at: new Date().toISOString(),
          performance_score: desktopResults.performance,
          accessibility_score: desktopResults.accessibility,
          best_practices_score: desktopResults.bestPractices,
          seo_score: desktopResults.seo,
          ssl_valid: sslResults.valid,
          ssl_issuer: sslResults.issuer,
          ssl_expires_at: sslResults.expiresAt,
          page_title: desktopResults.pageTitle,
          page_description: desktopResults.pageDescription,
          load_time_ms: desktopResults.loadTime,
          page_size_kb: desktopResults.pageSize,
          status: 'completed',
          error_message: null,
          screenshot: desktopResults.screenshot,
        },
        details: {
          first_contentful_paint: desktopResults.metrics.fcp,
          largest_contentful_paint: desktopResults.metrics.lcp,
          total_blocking_time: desktopResults.metrics.tbt,
          cumulative_layout_shift: desktopResults.metrics.cls,
          speed_index: desktopResults.metrics.speedIndex,
          performance_issues: desktopResults.performanceIssues,
          accessibility_issues: desktopResults.accessibilityIssues,
          best_practices_issues: desktopResults.bestPracticesIssues,
          seo_issues: desktopResults.seoIssues,
          lighthouse_report: desktopResults.fullReport,
          screenshot_thumbnails: desktopResults.screenshotThumbnails,
        }
      },
      // Keep backward compatibility - default to mobile
      scan: {
        url,
        created_at: new Date().toISOString(),
        performance_score: mobileResults.performance,
        accessibility_score: mobileResults.accessibility,
        best_practices_score: mobileResults.bestPractices,
        seo_score: mobileResults.seo,
        ssl_valid: sslResults.valid,
        ssl_issuer: sslResults.issuer,
        ssl_expires_at: sslResults.expiresAt,
        page_title: mobileResults.pageTitle,
        page_description: mobileResults.pageDescription,
        load_time_ms: mobileResults.loadTime,
        page_size_kb: mobileResults.pageSize,
        status: 'completed',
        error_message: null,
      },
      details: {
        first_contentful_paint: mobileResults.metrics.fcp,
        largest_contentful_paint: mobileResults.metrics.lcp,
        total_blocking_time: mobileResults.metrics.tbt,
        cumulative_layout_shift: mobileResults.metrics.cls,
        speed_index: mobileResults.metrics.speedIndex,
        performance_issues: mobileResults.performanceIssues,
        accessibility_issues: mobileResults.accessibilityIssues,
        best_practices_issues: mobileResults.bestPracticesIssues,
        seo_issues: mobileResults.seoIssues,
        lighthouse_report: mobileResults.fullReport,
      }
    }
  } catch (error) {
    console.error("Error analyzing website:", error)
    throw error
  }
}

async function runLighthouseCheck(url: string, strategy: 'mobile' | 'desktop' = 'mobile'): Promise<any> {
  const cacheKey = `${url}-${strategy}`
  
  // Check cache first
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Using cached result for ${url} (${strategy})`)
    return cached.data
  }

  // Check if there's already a request in progress for this URL+strategy
  if (requestQueue.has(cacheKey)) {
    console.log(`Request already in progress for ${url} (${strategy}), waiting...`)
    return await requestQueue.get(cacheKey)
  }

  // Create a new request promise and add it to the queue
  const requestPromise = makeLighthouseRequest(url, strategy)
  requestQueue.set(cacheKey, requestPromise)

  try {
    const result = await requestPromise
    return result
  } finally {
    // Clean up the queue
    requestQueue.delete(cacheKey)
  }
}

async function makeLighthouseRequest(url: string, strategy: 'mobile' | 'desktop'): Promise<any> {
  const cacheKey = `${url}-${strategy}`
  
  const baseApiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
    url,
  )}&category=performance&category=accessibility&category=best-practices&category=seo&strategy=${strategy}${
    API_KEY ? `&key=${API_KEY}` : ""
  }`

  // Try different User-Agents to avoid rate limiting
  for (let i = 0; i < USER_AGENTS.length; i++) {
    const userAgent = USER_AGENTS[i]

    try {
      console.log(`Trying User-Agent ${i + 1}/${USER_AGENTS.length} for ${url} (${strategy})`)
      
      const response = await fetch(baseApiUrl, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      })

      if (response.ok) {
        const data = await response.json()
        const result = processLighthouseData(data, url)
        
        // Cache the result
        cache.set(cacheKey, { data: result, timestamp: Date.now() })
        
        return result
      } else if (response.status === 429) {
        console.log(`Rate limit hit with User-Agent ${i + 1}, trying next...`)
        continue // Try next User-Agent
      } else if (response.status === 403) {
        throw new Error(`API quota exceeded. Please try again later.`)
      } else {
        console.log(`Error with User-Agent ${i + 1}: ${response.status} ${response.statusText}`)
        continue // Try next User-Agent
      }
    } catch (error) {
      console.log(`Error with User-Agent ${i + 1}:`, error)
      if (i === USER_AGENTS.length - 1) {
        throw error // Last User-Agent failed, throw error
      }
      continue // Try next User-Agent
    }
  }

  throw new Error(`All User-Agents exhausted. Please try again later.`)
}

function processLighthouseData(data: any, url: string) {
  const { lighthouseResult } = data

  // Extract scores (0-100)
  const categories = lighthouseResult.categories
  const performance = Math.round((categories.performance?.score || 0) * 100)
  const accessibility = Math.round((categories.accessibility?.score || 0) * 100)
  const bestPractices = Math.round((categories["best-practices"]?.score || 0) * 100)
  const seo = Math.round((categories.seo?.score || 0) * 100)

  // Extract metrics
  const audits = lighthouseResult.audits
  const metrics = {
    fcp: audits["first-contentful-paint"]?.numericValue || 0,
    lcp: audits["largest-contentful-paint"]?.numericValue || 0,
    tbt: audits["total-blocking-time"]?.numericValue || 0,
    cls: audits["cumulative-layout-shift"]?.numericValue || 0,
    speedIndex: audits["speed-index"]?.numericValue || 0,
  }

  // Extract screenshots
  const finalScreenshot = audits["final-screenshot"]?.details?.data || null
  const screenshotThumbnails = audits["screenshot-thumbnails"]?.details?.items || []

  // Extract issues for ALL categories
  const performanceIssues = extractIssues(lighthouseResult, "performance")
  const accessibilityIssues = extractIssues(lighthouseResult, "accessibility")
  const bestPracticesIssues = extractIssues(lighthouseResult, "best-practices")
  const seoIssues = extractIssues(lighthouseResult, "seo")

  return {
    performance,
    accessibility,
    bestPractices,
    seo,
    metrics,
    performanceIssues,
    accessibilityIssues,
    bestPracticesIssues,
    seoIssues,
    pageTitle: lighthouseResult.finalUrl || url,
    pageDescription: "",
    loadTime: Math.round(audits["interactive"]?.numericValue || 0),
    pageSize: Math.round((audits["total-byte-weight"]?.numericValue || 0) / 1024),
    screenshot: finalScreenshot,
    screenshotThumbnails: screenshotThumbnails,
    fullReport: lighthouseResult,
  }
}

function extractIssues(lighthouseResult: any, category: string) {
  const issues: any[] = []
  const categoryData = lighthouseResult.categories[category]

  if (!categoryData || !categoryData.auditRefs) {
    return issues
  }

  for (const auditRef of categoryData.auditRefs) {
    const audit = lighthouseResult.audits[auditRef.id]

    // Skip audits that are purely informational or diagnostics
    if (!audit || audit.score === null) {
      continue
    }

    // Skip diagnostic audits (informative, notApplicable, manual)
    if (audit.scoreDisplayMode === 'notApplicable' || 
        audit.scoreDisplayMode === 'informative' || 
        audit.scoreDisplayMode === 'manual') {
      continue
    }

    // Skip audits with zero weight (these don't affect the score)
    if (!auditRef.weight || auditRef.weight === 0) {  
      continue
    }

    // Include all audits that aren't perfect, with weight information
    if (audit.score < 1) {
      // Determine severity based on score
      let severity: 'critical' | 'high' | 'medium' | 'low' | 'info' = 'info'
      if (audit.score === 0) {
        severity = 'critical'
      } else if (audit.score < 0.5) {
        severity = 'high'
      } else if (audit.score < 0.75) {
        severity = 'medium'
      } else if (audit.score < 0.9) {
        severity = 'low'
      }

      issues.push({
        id: auditRef.id,
        title: audit.title,
        description: audit.description,
        score: audit.score,
        scoreDisplayValue: Math.round(audit.score * 100) + '%',
        displayValue: audit.displayValue,
        severity: severity,
        weight: auditRef.weight || 0,
        // Include numeric value for metrics
        numericValue: audit.numericValue,
        numericUnit: audit.numericUnit,
      })
    }
  }

  // Sort by severity (critical first) then by weight (more important audits first)
  issues.sort((a, b) => {
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
    const severityDiff = (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4)
    if (severityDiff !== 0) return severityDiff
    return (b.weight || 0) - (a.weight || 0)
  })

  return issues
}

async function runSSLCheck(url: string) {
  try {
    const urlObj = new URL(url)

    // Only check SSL for HTTPS URLs
    if (urlObj.protocol !== "https:") {
      return {
        valid: false,
        issuer: null,
        expiresAt: null,
        error: "Not an HTTPS URL",
      }
    }

    // Make a simple fetch to check if SSL is valid
    const response = await fetch(url, { method: "HEAD" })

    // If we get here, SSL is valid (fetch would fail on invalid SSL)
    return {
      valid: response.ok,
      issuer: "Valid Certificate",
      expiresAt: null, // We can't easily get expiry date from browser fetch
    }
  } catch (error) {
    return {
      valid: false,
      issuer: null,
      expiresAt: null,
      error: error instanceof Error ? error.message : "SSL check failed",
    }
  }
}

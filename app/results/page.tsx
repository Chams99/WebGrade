"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Gauge,
  ArrowLeft,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Shield,
  Zap,
  TrendingUp,
  Search,
  Info,
  Target,
  BookOpen,
  Lightbulb,
  Smartphone,
  Monitor,
  ArrowUpDown,
  Timer,
  Image as ImageIcon,
} from "lucide-react"
import Link from "next/link"
import { Recommendations } from "@/components/recommendations"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface DeviceData {
  scan: {
    url: string
    created_at: string
    performance_score: number
    accessibility_score: number
    best_practices_score: number
    seo_score: number
    ssl_valid: boolean
    ssl_issuer: string
    ssl_expires_at: string | null
    page_title: string
    page_description: string
    load_time_ms: number
    page_size_kb: number
    status: string
    error_message: string | null
    screenshot?: string | null
  }
  details: {
    first_contentful_paint: number
    largest_contentful_paint: number
    total_blocking_time: number
    cumulative_layout_shift: number
    speed_index: number
    performance_issues: any[]
    accessibility_issues: any[]
    best_practices_issues: any[]
    seo_issues: any[]
    lighthouse_report: any
  }
}

interface ScanData {
  mobile: DeviceData
  desktop: DeviceData
  scan: DeviceData["scan"]
  details: DeviceData["details"]
}

export default function ResultsPage() {
  const router = useRouter()
  const [data, setData] = useState<ScanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deviceView, setDeviceView] = useState<'mobile' | 'desktop'>('mobile')

  useEffect(() => {
    try {
      // Read results from localStorage
      const storedData = localStorage.getItem("latest-scan-result")
      
      if (!storedData) {
        setError("No scan results found. Please run a new analysis.")
        setLoading(false)
        return
      }

      const parsedData = JSON.parse(storedData)
      setData(parsedData)
      
      // Save to history
      saveToHistory(parsedData)
    } catch (err) {
      setError("Failed to load results. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [])
  
  const saveToHistory = (scanData: any) => {
    try {
      const history = localStorage.getItem("scan-history")
      const existing = history ? JSON.parse(history) : []

      // Handle both new (mobile/desktop) and old (single scan) formats
      const hasDualDevice = scanData.mobile && scanData.desktop
      const mainScan = scanData.scan || scanData.mobile?.scan || scanData.desktop?.scan
      
      if (!mainScan) {
        console.warn("No scan data found to save to history")
        return
      }

      let newScan: any = {
        url: mainScan.url,
        analyzedAt: mainScan.created_at,
      }

      if (hasDualDevice) {
        // New format with both mobile and desktop
        newScan.mobile = {
          performance_score: scanData.mobile.scan.performance_score,
          accessibility_score: scanData.mobile.scan.accessibility_score,
          best_practices_score: scanData.mobile.scan.best_practices_score,
          seo_score: scanData.mobile.scan.seo_score,
        }
        newScan.desktop = {
          performance_score: scanData.desktop.scan.performance_score,
          accessibility_score: scanData.desktop.scan.accessibility_score,
          best_practices_score: scanData.desktop.scan.best_practices_score,
          seo_score: scanData.desktop.scan.seo_score,
        }
        // Backward compatibility - default to mobile
        newScan.performance_score = scanData.mobile.scan.performance_score
        newScan.accessibility_score = scanData.mobile.scan.accessibility_score
        newScan.best_practices_score = scanData.mobile.scan.best_practices_score
        newScan.seo_score = scanData.mobile.scan.seo_score
      } else {
        // Old format with single scan
        newScan.performance_score = mainScan.performance_score
        newScan.accessibility_score = mainScan.accessibility_score
        newScan.best_practices_score = mainScan.best_practices_score
        newScan.seo_score = mainScan.seo_score
      }

      // Check if this exact scan already exists (same URL and timestamp)
      const alreadyExists = existing.some(
        (scan: any) => scan.url === newScan.url && scan.analyzedAt === newScan.analyzedAt
      )

      if (!alreadyExists) {
        // Keep only the last 20 scans
        const updated = [newScan, ...existing].slice(0, 20)
        localStorage.setItem("scan-history", JSON.stringify(updated))
      }
    } catch (error) {
      console.error("Failed to save to history:", error)
    }
  }

  const handleExportPDF = () => {
    if (!data) return
    
    // Store data temporarily for PDF export
    localStorage.setItem("pdf-export-data", JSON.stringify(data))
    window.open("/api/export-pdf", "_blank")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Failed to load results</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => router.push("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  // Get current device data based on selection
  // Handle both new (mobile/desktop) and old (single scan) formats
  const hasDualDevice = !!(data.mobile && data.desktop)
  
  let currentData: DeviceData
  let comparisonData: DeviceData | null = null
  
  if (hasDualDevice) {
    currentData = deviceView === 'mobile' ? data.mobile : data.desktop
    comparisonData = deviceView === 'mobile' ? data.desktop : data.mobile
  } else {
    // Old format - use main scan/details
    currentData = { scan: data.scan, details: data.details }
  }
  
  const { scan, details } = currentData
  
  const getScoreDiff = (current: number, comparison: number) => {
    const diff = current - comparison
    if (diff === 0) return null
    return {
      diff: Math.abs(diff),
      better: diff > 0
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600"
    if (score >= 50) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 90) return "bg-green-600"
    if (score >= 50) return "bg-yellow-600"
    return "bg-red-600"
  }

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Good"
    if (score >= 50) return "Needs Improvement"
    return "Poor"
  }

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatSize = (kb: number) => {
    if (kb < 1024) return `${Math.round(kb)}KB`
    return `${(kb / 1024).toFixed(2)}MB`
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Gauge className="h-6 w-6 text-primary" />
              <span className="text-xl font-semibold">WebGrade</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* URL and Metadata */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 break-all">{scan.url}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{new Date(scan.created_at).toLocaleString()}</span>
            </div>
            {scan.ssl_valid ? (
              <Badge variant="outline" className="gap-1">
                <Shield className="h-3 w-3 text-green-600" />
                SSL Valid
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Shield className="h-3 w-3 text-red-600" />
                SSL Invalid
              </Badge>
            )}
          </div>
        </div>

        {/* Device Switcher */}
        {hasDualDevice && (
          <Card className="p-4 mb-8 bg-card border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-semibold">Device View:</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={deviceView === 'mobile' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDeviceView('mobile')}
                  className="gap-2"
                >
                  <Smartphone className="h-4 w-4" />
                  Mobile
                </Button>
                <Button
                  variant={deviceView === 'desktop' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDeviceView('desktop')}
                  className="gap-2"
                >
                  <Monitor className="h-4 w-4" />
                  Desktop
                </Button>
              </div>
            </div>
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                {deviceView === 'mobile' ? (
                  <>
                    <Smartphone className="h-3.5 w-3.5 text-blue-600" />
                    <span>Viewing mobile analysis - Tests your site on simulated mobile devices with slower networks</span>
                  </>
                ) : (
                  <>
                    <Monitor className="h-3.5 w-3.5 text-blue-600" />
                    <span>Viewing desktop analysis - Tests your site on desktop browsers with faster networks</span>
                  </>
                )}
              </p>
            </div>
          </Card>
        )}

        {/* Screenshot and Load Time Section */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Screenshot Preview */}
          {scan.screenshot && (
            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-2 mb-4">
                <ImageIcon className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Site Preview</h3>
                <Badge variant="outline" className="ml-auto">
                  {deviceView === 'mobile' ? (
                    <>
                      <Smartphone className="h-3 w-3 mr-1" />
                      Mobile
                    </>
                  ) : (
                    <>
                      <Monitor className="h-3 w-3 mr-1" />
                      Desktop
                    </>
                  )}
                </Badge>
              </div>
              <div className="relative rounded-lg overflow-hidden border border-border bg-muted">
                <img
                  src={scan.screenshot}
                  alt={`Screenshot of ${scan.url}`}
                  className="w-full h-auto max-h-[400px] object-contain"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Screenshot captured during analysis
              </p>
            </Card>
          )}

          {/* Load Time Display */}
          <Card className="p-6 bg-card border-border">
            <div className="flex items-center gap-2 mb-4">
              <Timer className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Load Time Performance</h3>
            </div>
            
            {/* Main Load Time */}
            <div className="mb-6">
              <div className="text-sm text-muted-foreground mb-2">Total Interactive Time</div>
              <div className="flex items-end gap-2">
                <div className={`text-6xl font-bold ${
                  scan.load_time_ms < 3000 ? 'text-green-600' :
                  scan.load_time_ms < 5000 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {(scan.load_time_ms / 1000).toFixed(2)}
                </div>
                <div className="text-2xl text-muted-foreground mb-2">seconds</div>
              </div>
              <div className="mt-2">
                {scan.load_time_ms < 3000 ? (
                  <Badge className="bg-green-600 text-white">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Fast
                  </Badge>
                ) : scan.load_time_ms < 5000 ? (
                  <Badge className="bg-yellow-600 text-white">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Moderate
                  </Badge>
                ) : (
                  <Badge className="bg-red-600 text-white">
                    <XCircle className="h-3 w-3 mr-1" />
                    Slow
                  </Badge>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div>
                <div className="text-xs text-muted-foreground mb-1">First Paint</div>
                <div className="text-lg font-bold">{formatTime(details.first_contentful_paint)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Page Size</div>
                <div className="text-lg font-bold">{formatSize(scan.page_size_kb)}</div>
              </div>
            </div>

            {/* Performance Tip */}
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-muted-foreground">
                <strong>Target:</strong> Interactive time under 3 seconds for optimal user experience
              </p>
            </div>
          </Card>
        </div>

        {/* Score Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Performance</h3>
              </div>
              <Badge variant="outline" className={getScoreColor(scan.performance_score)}>
                {getScoreLabel(scan.performance_score)}
              </Badge>
            </div>
            <div className="flex items-end gap-3">
              <div className={`text-5xl font-bold ${getScoreColor(scan.performance_score)}`}>
                {scan.performance_score}
              </div>
              <div className="text-muted-foreground mb-2">/100</div>
              {comparisonData && (() => {
                const diff = getScoreDiff(scan.performance_score, comparisonData.scan.performance_score)
                if (diff) {
                  return (
                    <div className={`flex items-center gap-1 text-sm mb-2 ${diff.better ? 'text-green-600' : 'text-red-600'}`}>
                      <ArrowUpDown className="h-3 w-3" />
                      {diff.better ? '+' : '-'}{diff.diff}
                    </div>
                  )
                }
              })()}
            </div>
            <Progress value={scan.performance_score} className="mt-4" />
          </Card>

          <Card className="p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Accessibility</h3>
              </div>
              <Badge variant="outline" className={getScoreColor(scan.accessibility_score)}>
                {getScoreLabel(scan.accessibility_score)}
              </Badge>
            </div>
            <div className="flex items-end gap-3">
              <div className={`text-5xl font-bold ${getScoreColor(scan.accessibility_score)}`}>
                {scan.accessibility_score}
              </div>
              <div className="text-muted-foreground mb-2">/100</div>
              {comparisonData && (() => {
                const diff = getScoreDiff(scan.accessibility_score, comparisonData.scan.accessibility_score)
                if (diff) {
                  return (
                    <div className={`flex items-center gap-1 text-sm mb-2 ${diff.better ? 'text-green-600' : 'text-red-600'}`}>
                      <ArrowUpDown className="h-3 w-3" />
                      {diff.better ? '+' : '-'}{diff.diff}
                    </div>
                  )
                }
              })()}
            </div>
            <Progress value={scan.accessibility_score} className="mt-4" />
          </Card>

          <Card className="p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Best Practices</h3>
              </div>
              <Badge variant="outline" className={getScoreColor(scan.best_practices_score)}>
                {getScoreLabel(scan.best_practices_score)}
              </Badge>
            </div>
            <div className="flex items-end gap-3">
              <div className={`text-5xl font-bold ${getScoreColor(scan.best_practices_score)}`}>
                {scan.best_practices_score}
              </div>
              <div className="text-muted-foreground mb-2">/100</div>
              {comparisonData && (() => {
                const diff = getScoreDiff(scan.best_practices_score, comparisonData.scan.best_practices_score)
                if (diff) {
                  return (
                    <div className={`flex items-center gap-1 text-sm mb-2 ${diff.better ? 'text-green-600' : 'text-red-600'}`}>
                      <ArrowUpDown className="h-3 w-3" />
                      {diff.better ? '+' : '-'}{diff.diff}
                    </div>
                  )
                }
              })()}
            </div>
            <Progress value={scan.best_practices_score} className="mt-4" />
          </Card>

          <Card className="p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">SEO</h3>
              </div>
              <Badge variant="outline" className={getScoreColor(scan.seo_score)}>
                {getScoreLabel(scan.seo_score)}
              </Badge>
            </div>
            <div className="flex items-end gap-3">
              <div className={`text-5xl font-bold ${getScoreColor(scan.seo_score)}`}>{scan.seo_score}</div>
              <div className="text-muted-foreground mb-2">/100</div>
              {comparisonData && (() => {
                const diff = getScoreDiff(scan.seo_score, comparisonData.scan.seo_score)
                if (diff) {
                  return (
                    <div className={`flex items-center gap-1 text-sm mb-2 ${diff.better ? 'text-green-600' : 'text-red-600'}`}>
                      <ArrowUpDown className="h-3 w-3" />
                      {diff.better ? '+' : '-'}{diff.diff}
                    </div>
                  )
                }
              })()}
            </div>
            <Progress value={scan.seo_score} className="mt-4" />
          </Card>
        </div>

        {/* Core Web Vitals */}
        <TooltipProvider>
          <Card className="p-6 mb-8 bg-card border-border">
            <div className="flex items-center gap-2 mb-6">
              <h2 className="text-2xl font-bold">Core Web Vitals</h2>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Core Web Vitals are essential metrics for measuring user experience on the web</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <span>First Contentful Paint</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Time until the first text or image appears. Good: &lt;1.8s, Needs improvement: &lt;3s</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className={`text-2xl font-bold ${
                  details.first_contentful_paint < 1800 ? "text-green-600" :
                  details.first_contentful_paint < 3000 ? "text-yellow-600" : "text-red-600"
                }`}>
                  {formatTime(details.first_contentful_paint)}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <span>Largest Contentful Paint</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Time until the largest element appears. Good: &lt;2.5s, Needs improvement: &lt;4s</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className={`text-2xl font-bold ${
                  details.largest_contentful_paint < 2500 ? "text-green-600" :
                  details.largest_contentful_paint < 4000 ? "text-yellow-600" : "text-red-600"
                }`}>
                  {formatTime(details.largest_contentful_paint)}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <span>Total Blocking Time</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Time the page is blocked from responding to user input. Good: &lt;200ms, Needs improvement: &lt;600ms</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className={`text-2xl font-bold ${
                  details.total_blocking_time < 200 ? "text-green-600" :
                  details.total_blocking_time < 600 ? "text-yellow-600" : "text-red-600"
                }`}>
                  {formatTime(details.total_blocking_time)}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <span>Cumulative Layout Shift</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Visual stability - how much elements shift during load. Good: &lt;0.1, Needs improvement: &lt;0.25</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className={`text-2xl font-bold ${
                  details.cumulative_layout_shift < 0.1 ? "text-green-600" :
                  details.cumulative_layout_shift < 0.25 ? "text-yellow-600" : "text-red-600"
                }`}>
                  {details.cumulative_layout_shift.toFixed(3)}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <span>Speed Index</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>How quickly content is visually displayed. Good: &lt;3.4s, Needs improvement: &lt;5.8s</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className={`text-2xl font-bold ${
                  details.speed_index < 3400 ? "text-green-600" :
                  details.speed_index < 5800 ? "text-yellow-600" : "text-red-600"
                }`}>
                  {formatTime(details.speed_index)}
                </div>
              </div>
            </div>
          </Card>
        </TooltipProvider>

        {/* Page Metrics */}
        <Card className="p-6 mb-8 bg-card border-border">
          <h2 className="text-2xl font-bold mb-6">Page Metrics</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-muted-foreground mb-2">Total Load Time</div>
              <div className="text-2xl font-bold">{formatTime(scan.load_time_ms)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-2">Page Size</div>
              <div className="text-2xl font-bold">{formatSize(scan.page_size_kb)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-2">SSL Certificate</div>
              <div className="flex items-center gap-2">
                {scan.ssl_valid ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-lg font-semibold">Valid</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="text-lg font-semibold">Invalid</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Improvement Roadmap */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Target className="h-7 w-7 text-primary" />
            <h2 className="text-3xl font-bold">Your Improvement Roadmap</h2>
          </div>
          <p className="text-muted-foreground mb-6">
            Follow these actionable recommendations to improve your website's performance, accessibility, SEO, and best
            practices. Each issue includes step-by-step instructions and estimated score impact.
          </p>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="performance">
                Performance
                {details.performance_issues?.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {details.performance_issues.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="accessibility">
                Accessibility
                {details.accessibility_issues?.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {details.accessibility_issues.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="seo">
                SEO
                {details.seo_issues?.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {details.seo_issues.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="best-practices">
                Best Practices
                {details.best_practices_issues?.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {details.best_practices_issues.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <Card className="p-6 bg-card border-border">
                <h3 className="text-xl font-bold mb-4">Quick Summary</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Total Issues Found
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Performance</span>
                        <Badge variant={details.performance_issues?.length > 0 ? "destructive" : "outline"}>
                          {details.performance_issues?.length || 0} issues
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Accessibility</span>
                        <Badge variant={details.accessibility_issues?.length > 0 ? "destructive" : "outline"}>
                          {details.accessibility_issues?.length || 0} issues
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">SEO</span>
                        <Badge variant={details.seo_issues?.length > 0 ? "destructive" : "outline"}>
                          {details.seo_issues?.length || 0} issues
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Best Practices</span>
                        <Badge variant={details.best_practices_issues?.length > 0 ? "destructive" : "outline"}>
                          {details.best_practices_issues?.length || 0} issues
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      Recommended Action Plan
                    </h4>
                    <ol className="space-y-2 text-sm">
                      <li className="flex gap-2">
                        <span className="flex-shrink-0 font-semibold text-primary">1.</span>
                        <span>Review all critical and high-priority issues in each category</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="flex-shrink-0 font-semibold text-primary">2.</span>
                        <span>Start with the category that has the lowest score</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="flex-shrink-0 font-semibold text-primary">3.</span>
                        <span>Implement fixes one at a time and test thoroughly</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="flex-shrink-0 font-semibold text-primary">4.</span>
                        <span>Re-run analysis after each major change to track progress</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="flex-shrink-0 font-semibold text-primary">5.</span>
                        <span>Continue iterating until all scores are above 90</span>
                      </li>
                    </ol>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-primary/10 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold mb-1">Pro Tip</h4>
                      <p className="text-sm text-muted-foreground">
                        Track your progress by saving this report and running new analyses weekly. Small, consistent
                        improvements lead to significant long-term gains in user experience and search rankings.
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="performance" className="mt-6">
              <Recommendations
                category="performance"
                issues={details.performance_issues || []}
                currentScore={scan.performance_score}
              />
            </TabsContent>

            <TabsContent value="accessibility" className="mt-6">
              <Recommendations
                category="accessibility"
                issues={details.accessibility_issues || []}
                currentScore={scan.accessibility_score}
              />
            </TabsContent>

            <TabsContent value="seo" className="mt-6">
              <Recommendations category="seo" issues={details.seo_issues || []} currentScore={scan.seo_score} />
            </TabsContent>

            <TabsContent value="best-practices" className="mt-6">
              <Recommendations
                category="best-practices"
                issues={details.best_practices_issues || []}
                currentScore={scan.best_practices_score}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* CTA */}
        <div className="text-center py-8">
          <Button size="lg" onClick={() => router.push("/")}>
            <Search className="h-5 w-5 mr-2" />
            Analyze Another Website
          </Button>
        </div>
      </div>
    </div>
  )
}

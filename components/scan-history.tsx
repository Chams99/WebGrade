"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { History, TrendingUp, TrendingDown, Minus, ExternalLink, Trash2, Smartphone, Monitor } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface HistoricalScan {
  url: string
  analyzedAt: string
  mobile?: {
    performance_score: number
    accessibility_score: number
    best_practices_score: number
    seo_score: number
  }
  desktop?: {
    performance_score: number
    accessibility_score: number
    best_practices_score: number
    seo_score: number
  }
  // Backward compatibility
  performance_score: number
  accessibility_score: number
  best_practices_score: number
  seo_score: number
}

/**
 * Scan History Component
 * Displays historical website scans stored in localStorage to track improvements over time.
 * Allows users to view trends, compare results, and manage their scan history.
 */
export function ScanHistory() {
  const router = useRouter()
  const [scans, setScans] = useState<HistoricalScan[]>([])

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = () => {
    try {
      const history = localStorage.getItem("scan-history")
      if (history) {
        const parsed = JSON.parse(history)
        // Sort by date, newest first
        const sorted = parsed.sort(
          (a: HistoricalScan, b: HistoricalScan) =>
            new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime()
        )
        setScans(sorted)
      }
    } catch (error) {
      console.error("Failed to load history:", error)
    }
  }

  const saveToHistory = (scanData: any) => {
    try {
      const history = localStorage.getItem("scan-history")
      const existing = history ? JSON.parse(history) : []

      const newScan: HistoricalScan = {
        url: scanData.scan.url,
        analyzedAt: scanData.scan.created_at,
        performance_score: scanData.scan.performance_score,
        accessibility_score: scanData.scan.accessibility_score,
        best_practices_score: scanData.scan.best_practices_score,
        seo_score: scanData.scan.seo_score,
      }

      // Keep only the last 20 scans
      const updated = [newScan, ...existing].slice(0, 20)
      localStorage.setItem("scan-history", JSON.stringify(updated))
      loadHistory()
    } catch (error) {
      console.error("Failed to save to history:", error)
    }
  }

  const clearHistory = () => {
    if (confirm("Are you sure you want to clear all scan history?")) {
      localStorage.removeItem("scan-history")
      setScans([])
    }
  }

  const deleteScan = (index: number) => {
    try {
      const updated = scans.filter((_, i) => i !== index)
      localStorage.setItem("scan-history", JSON.stringify(updated))
      setScans(updated)
    } catch (error) {
      console.error("Failed to delete scan:", error)
    }
  }

  const getScoreChange = (url: string, currentScore: number, category: keyof HistoricalScan) => {
    // Find previous scan for the same URL
    const urlScans = scans.filter((s) => s.url === url)
    if (urlScans.length < 2) return null

    const currentIndex = urlScans.findIndex((s) => s[category] === currentScore)
    if (currentIndex === -1 || currentIndex === urlScans.length - 1) return null

    const previousScore = urlScans[currentIndex + 1][category] as number
    const change = currentScore - previousScore

    return {
      change,
      trend: change > 0 ? "up" : change < 0 ? "down" : "same",
    }
  }

  const getAverageScore = (scan: HistoricalScan, device: 'mobile' | 'desktop' = 'mobile') => {
    const data = device === 'mobile' && scan.mobile ? scan.mobile : 
                 device === 'desktop' && scan.desktop ? scan.desktop :
                 scan
    return Math.round(
      (data.performance_score + data.accessibility_score + data.best_practices_score + data.seo_score) / 4
    )
  }
  
  const getDeviceScores = (scan: HistoricalScan, device: 'mobile' | 'desktop') => {
    if (device === 'mobile' && scan.mobile) return scan.mobile
    if (device === 'desktop' && scan.desktop) return scan.desktop
    // Fallback to main scores (backward compatibility)
    return {
      performance_score: scan.performance_score,
      accessibility_score: scan.accessibility_score,
      best_practices_score: scan.best_practices_score,
      seo_score: scan.seo_score,
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600"
    if (score >= 50) return "text-yellow-600"
    return "text-red-600"
  }

  if (scans.length === 0) {
    return null
  }

  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-bold">Recent Scans</h3>
          <Badge variant="outline">{scans.length}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={clearHistory}>
          <Trash2 className="h-4 w-4 mr-2" />
          Clear History
        </Button>
      </div>

      <div className="space-y-3">
        {scans.slice(0, 5).map((scan, index) => {
          const hasBothDevices = !!(scan.mobile && scan.desktop)
          const mobileScores = getDeviceScores(scan, 'mobile')
          const desktopScores = getDeviceScores(scan, 'desktop')
          const mobileAverage = getAverageScore(scan, 'mobile')
          const desktopAverage = getAverageScore(scan, 'desktop')
          const groupedByUrl = scans.filter((s) => s.url === scan.url)
          const isLatestForUrl = groupedByUrl[0].analyzedAt === scan.analyzedAt

          return (
            <div
              key={`${scan.url}-${scan.analyzedAt}`}
              className="flex items-center justify-between p-4 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <a
                    href={scan.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium truncate hover:underline flex items-center gap-1"
                  >
                    {scan.url}
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                  {isLatestForUrl && groupedByUrl.length > 1 && (
                    <Badge variant="outline" className="text-xs">
                      Latest
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    {new Date(scan.analyzedAt).toLocaleDateString()} at{" "}
                    {new Date(scan.analyzedAt).toLocaleTimeString()}
                  </span>
                  {groupedByUrl.length > 1 && (
                    <Badge variant="secondary" className="text-xs">
                      {groupedByUrl.length} scans
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-6">
                {hasBothDevices ? (
                  // Show both mobile and desktop
                  <div className="flex gap-6">
                    <div>
                      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <Smartphone className="h-3 w-3" />
                        Mobile
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="text-center">
                          <div className={`text-sm font-bold ${getScoreColor(mobileScores.performance_score)}`}>
                            {mobileScores.performance_score}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className={`text-sm font-bold ${getScoreColor(mobileScores.accessibility_score)}`}>
                            {mobileScores.accessibility_score}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className={`text-sm font-bold ${getScoreColor(mobileScores.best_practices_score)}`}>
                            {mobileScores.best_practices_score}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className={`text-sm font-bold ${getScoreColor(mobileScores.seo_score)}`}>
                            {mobileScores.seo_score}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <Monitor className="h-3 w-3" />
                        Desktop
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="text-center">
                          <div className={`text-sm font-bold ${getScoreColor(desktopScores.performance_score)}`}>
                            {desktopScores.performance_score}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className={`text-sm font-bold ${getScoreColor(desktopScores.accessibility_score)}`}>
                            {desktopScores.accessibility_score}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className={`text-sm font-bold ${getScoreColor(desktopScores.best_practices_score)}`}>
                            {desktopScores.best_practices_score}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className={`text-sm font-bold ${getScoreColor(desktopScores.seo_score)}`}>
                            {desktopScores.seo_score}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-center min-w-[60px]">
                      <div className="text-xs text-muted-foreground mb-1">Avg</div>
                      <div className={`text-lg font-bold ${getScoreColor(mobileAverage)}`}>{mobileAverage}</div>
                      <div className={`text-lg font-bold ${getScoreColor(desktopAverage)}`}>{desktopAverage}</div>
                    </div>
                  </div>
                ) : (
                  // Legacy format - single device
                  <>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">Perf</div>
                        <div className={`text-lg font-bold ${getScoreColor(scan.performance_score)}`}>
                          {scan.performance_score}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">A11y</div>
                        <div className={`text-lg font-bold ${getScoreColor(scan.accessibility_score)}`}>
                          {scan.accessibility_score}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">BP</div>
                        <div className={`text-lg font-bold ${getScoreColor(scan.best_practices_score)}`}>
                          {scan.best_practices_score}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground mb-1">SEO</div>
                        <div className={`text-lg font-bold ${getScoreColor(scan.seo_score)}`}>{scan.seo_score}</div>
                      </div>
                    </div>
                    <div className="text-center min-w-[60px]">
                      <div className="text-xs text-muted-foreground mb-1">Avg</div>
                      <div className={`text-2xl font-bold ${getScoreColor(mobileAverage)}`}>{mobileAverage}</div>
                    </div>
                  </>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteScan(index)}
                  className="opacity-60 hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {scans.length > 5 && (
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Showing 5 of {scans.length} scans. History is stored locally in your browser.
          </p>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <TrendingUp className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold mb-1 text-sm">Track Your Progress</h4>
            <p className="text-xs text-muted-foreground">
              Run analyses regularly to track improvements over time. Scan history is stored locally in your browser and
              limited to the last 20 scans.
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}

// Export the saveToHistory function so it can be used by the results page
export { type HistoricalScan }

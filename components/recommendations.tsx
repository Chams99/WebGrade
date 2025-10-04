"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { AlertTriangle, TrendingUp, CheckCircle2, ExternalLink, Lightbulb } from "lucide-react"

interface Issue {
  id: string
  title: string
  description: string
  score: number
  scoreDisplayValue?: string
  displayValue?: string
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info'
  weight?: number
  numericValue?: number
  numericUnit?: string
}

interface RecommendationsProps {
  category: "performance" | "accessibility" | "best-practices" | "seo"
  issues: Issue[]
  currentScore: number
}

/**
 * Recommendations Component
 * Provides actionable guidance for improving website quality across different categories.
 * Includes priority levels, impact estimates, and step-by-step instructions.
 */
export function Recommendations({ category, issues, currentScore }: RecommendationsProps) {
  const getCategoryInfo = () => {
    switch (category) {
      case "performance":
        return {
          title: "Performance Improvements",
          icon: <TrendingUp className="h-5 w-5" />,
          color: "text-blue-600",
          bgColor: "bg-blue-600",
        }
      case "accessibility":
        return {
          title: "Accessibility Improvements",
          icon: <CheckCircle2 className="h-5 w-5" />,
          color: "text-green-600",
          bgColor: "bg-green-600",
        }
      case "best-practices":
        return {
          title: "Best Practices Improvements",
          icon: <Lightbulb className="h-5 w-5" />,
          color: "text-purple-600",
          bgColor: "bg-purple-600",
        }
      case "seo":
        return {
          title: "SEO Improvements",
          icon: <CheckCircle2 className="h-5 w-5" />,
          color: "text-orange-600",
          bgColor: "bg-orange-600",
        }
    }
  }

  const getIssuePriority = (issue: Issue): "critical" | "high" | "medium" | "low" => {
    // Use severity from API if available, otherwise calculate from score
    if (issue.severity && issue.severity !== 'info') {
      return issue.severity
    }
    const score = issue.score
    if (score === 0) return "critical"
    if (score < 0.5) return "high"
    if (score < 0.75) return "medium"
    return "low"
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>
      case "high":
        return <Badge className="bg-orange-600 text-white">High Priority</Badge>
      case "medium":
        return <Badge className="bg-yellow-600 text-white">Medium Priority</Badge>
      case "low":
        return <Badge variant="outline">Low Priority</Badge>
    }
  }

  const getEstimatedImpact = (issue: Issue): number => {
    const priority = getIssuePriority(issue)
    const weight = issue.weight || 1
    
    // Base impact on priority
    let baseImpact = 1
    switch (priority) {
      case "critical":
        baseImpact = 15
        break
      case "high":
        baseImpact = 8
        break
      case "medium":
        baseImpact = 4
        break
      case "low":
        baseImpact = 2
        break
    }
    
    // Multiply by weight factor (normalized)
    // Lighthouse weights typically range from 0-10, normalize to 0.5-1.5 multiplier
    const weightMultiplier = 0.5 + (weight / 10) * 1.0
    return Math.round(baseImpact * weightMultiplier)
  }

  const getActionableSteps = (issueId: string): string[] => {
    // Map common Lighthouse audit IDs to actionable steps
    const stepsMap: Record<string, string[]> = {
      // Performance
      "render-blocking-resources": [
        "Identify CSS and JavaScript files that are blocking the first paint",
        "Inline critical CSS directly in the HTML <head>",
        "Defer non-critical CSS using media queries or JavaScript",
        "Add 'async' or 'defer' attributes to script tags",
        "Consider using webpack or Vite to optimize your bundle",
      ],
      "unused-css-rules": [
        "Use Chrome DevTools Coverage tab to identify unused CSS",
        "Remove unused CSS rules from your stylesheets",
        "Consider using PurgeCSS or similar tools to automatically remove unused styles",
        "Split CSS files by page or component to load only what's needed",
      ],
      "unused-javascript": [
        "Analyze your JavaScript bundles using webpack-bundle-analyzer",
        "Remove unused dependencies from package.json",
        "Implement code splitting to load JavaScript on demand",
        "Use tree-shaking to eliminate dead code",
        "Consider lazy loading components and routes",
      ],
      "largest-contentful-paint-element": [
        "Optimize the largest image or text block on your page",
        "Use modern image formats (WebP, AVIF) with fallbacks",
        "Implement responsive images with srcset attribute",
        "Preload critical resources using <link rel='preload'>",
        "Ensure text remains visible during webfont load",
      ],
      "total-byte-weight": [
        "Compress images using tools like ImageOptim or Squoosh",
        "Enable gzip or Brotli compression on your server",
        "Minify CSS, JavaScript, and HTML files",
        "Remove unnecessary fonts and optimize font loading",
        "Use a CDN to serve static assets",
      ],
      "uses-optimized-images": [
        "Convert images to WebP or AVIF format",
        "Resize images to the exact dimensions needed",
        "Use image compression tools (TinyPNG, ImageOptim)",
        "Implement lazy loading for below-the-fold images",
        "Consider using an image CDN like Cloudinary or imgix",
      ],
      "offscreen-images": [
        "Add loading='lazy' attribute to images below the fold",
        "Implement Intersection Observer API for custom lazy loading",
        "Ensure critical above-the-fold images load eagerly",
        "Use placeholder images or blur-up technique for better UX",
      ],
      "unminified-css": [
        "Minify CSS files using cssnano or similar tools",
        "Configure your build tool (webpack, Vite) to minify in production",
        "Remove comments and whitespace from production CSS",
      ],
      "unminified-javascript": [
        "Minify JavaScript using Terser or similar tools",
        "Enable minification in your build configuration",
        "Remove console.log statements and debugging code from production",
      ],
      "uses-text-compression": [
        "Enable gzip compression in your web server (Apache, Nginx)",
        "Consider Brotli compression for even better results",
        "Ensure compression is enabled for text-based resources (HTML, CSS, JS, JSON)",
        "Configure your CDN to compress assets",
      ],
      "efficient-animated-content": [
        "Replace GIFs with video formats (MP4, WebM)",
        "Use CSS animations instead of JavaScript when possible",
        "Optimize animation performance using transform and opacity",
        "Reduce animation duration and complexity",
      ],
      "duplicated-javascript": [
        "Identify duplicate code in your bundles",
        "Extract common dependencies into shared chunks",
        "Configure webpack splitChunks optimization",
        "Use a monorepo structure to share code between projects",
      ],
      "legacy-javascript": [
        "Use modern JavaScript syntax (ES6+)",
        "Remove polyfills for features now widely supported",
        "Update your babel configuration to target modern browsers",
        "Use 'module/nomodule' pattern to serve modern code to modern browsers",
      ],

      // Accessibility
      "image-alt": [
        "Add descriptive alt text to all <img> elements",
        "Use empty alt='' for decorative images",
        "Describe the content and function of the image",
        "Keep alt text concise (under 125 characters)",
        "Test with screen readers to ensure alt text is helpful",
      ],
      "link-name": [
        "Ensure all links have descriptive text or aria-label",
        "Avoid generic link text like 'click here' or 'read more'",
        "Add aria-label to icon-only links",
        "Make link purpose clear from the text alone",
      ],
      "button-name": [
        "Add descriptive text or aria-label to all buttons",
        "Ensure icon buttons have accessible names",
        "Use button element instead of div/span for clickable elements",
        "Make button purpose clear to screen reader users",
      ],
      "color-contrast": [
        "Ensure text has sufficient contrast ratio with background (4.5:1 for normal text)",
        "Use tools like WebAIM Color Contrast Checker",
        "Increase font weight or size if using low-contrast colors",
        "Test in different lighting conditions and color blindness simulators",
      ],
      "heading-order": [
        "Use heading tags (h1-h6) in logical order",
        "Start with h1 for the main page title",
        "Don't skip heading levels (e.g., h2 to h4)",
        "Use only one h1 per page",
        "Structure content hierarchically",
      ],
      "label": [
        "Associate <label> elements with form inputs using 'for' attribute",
        "Ensure every form input has a visible label",
        "Use aria-label for inputs without visible labels",
        "Group related inputs with <fieldset> and <legend>",
      ],
      "valid-lang": [
        "Add lang attribute to <html> element (e.g., <html lang='en'>)",
        "Use correct language codes (ISO 639-1)",
        "Add lang attribute to elements in different languages",
      ],
      "aria-roles": [
        "Use valid ARIA roles from the ARIA specification",
        "Don't override native HTML semantics with ARIA",
        "Test ARIA roles with screen readers",
        "Use semantic HTML elements when possible instead of ARIA",
      ],
      "tabindex": [
        "Avoid positive tabindex values (use 0 or -1)",
        "Ensure logical tab order through HTML structure",
        "Make interactive elements keyboard accessible",
        "Test keyboard navigation throughout the site",
      ],

      // SEO
      "document-title": [
        "Add a unique, descriptive <title> tag to every page",
        "Keep titles between 50-60 characters for optimal display",
        "Include target keywords naturally in the title",
        "Format: Primary Keyword - Secondary Keyword | Brand Name",
      ],
      "meta-description": [
        "Add a unique meta description to every page",
        "Keep descriptions between 150-160 characters",
        "Include target keywords naturally",
        "Write compelling copy that encourages clicks",
        "Make each description unique across pages",
      ],
      "link-text": [
        "Use descriptive anchor text for links",
        "Avoid generic text like 'click here' or 'learn more'",
        "Include relevant keywords in link text",
        "Make link purpose clear from the text alone",
      ],
      "hreflang": [
        "Add hreflang tags for multi-language sites",
        "Use correct language and region codes",
        "Implement bidirectional hreflang links",
        "Include self-referential hreflang tag",
      ],
      "canonical": [
        "Add canonical tags to avoid duplicate content issues",
        "Point to the preferred version of similar pages",
        "Ensure canonical URLs are absolute",
        "Self-referencing canonical tags are good practice",
      ],
      "robots-txt": [
        "Create a robots.txt file in your site root",
        "Allow search engines to crawl important content",
        "Disallow admin areas and duplicate content",
        "Include a reference to your sitemap.xml",
      ],
      "structured-data": [
        "Implement Schema.org structured data",
        "Use JSON-LD format for structured data",
        "Add relevant schema types (Article, Product, Organization, etc.)",
        "Test with Google's Rich Results Test",
      ],
      "viewport": [
        "Add viewport meta tag: <meta name='viewport' content='width=device-width, initial-scale=1'>",
        "Ensure site is mobile-responsive",
        "Test on various device sizes",
        "Avoid fixed-width layouts",
      ],
      "font-size": [
        "Use font sizes of at least 16px for body text",
        "Ensure text is legible on mobile devices",
        "Use relative units (rem, em) instead of fixed pixels",
        "Test readability on small screens",
      ],

      // Best Practices
      "uses-https": [
        "Obtain an SSL/TLS certificate (free with Let's Encrypt)",
        "Configure your web server to use HTTPS",
        "Redirect all HTTP traffic to HTTPS",
        "Update all internal links to use HTTPS",
        "Enable HSTS (HTTP Strict Transport Security)",
      ],
      "is-on-https": [
        "Ensure all resources load over HTTPS",
        "Update mixed content (HTTP resources on HTTPS page)",
        "Check third-party scripts and resources",
        "Configure CDN to serve content over HTTPS",
      ],
      "geolocation-on-start": [
        "Request geolocation only when needed for a feature",
        "Explain why you need location access",
        "Provide fallback options if location is denied",
        "Don't request location immediately on page load",
      ],
      "notification-on-start": [
        "Don't request notification permission on page load",
        "Wait for user action before requesting permission",
        "Explain the benefit of enabling notifications",
        "Respect user's decision if permission is denied",
      ],
      "errors-in-console": [
        "Open browser DevTools Console and fix reported errors",
        "Check for JavaScript errors and exceptions",
        "Fix broken links and missing resources",
        "Test thoroughly across different browsers",
      ],
      "image-aspect-ratio": [
        "Ensure displayed image aspect ratio matches natural ratio",
        "Set both width and height attributes on images",
        "Use object-fit CSS property when needed",
        "Avoid distorting images with incorrect dimensions",
      ],
      "csp-xss": [
        "Implement Content Security Policy headers",
        "Restrict script sources to trusted domains",
        "Use nonces or hashes for inline scripts",
        "Test CSP with report-only mode first",
      ],
      "password-inputs-can-be-pasted-into": [
        "Allow pasting into password fields",
        "Don't disable paste event on password inputs",
        "Support password managers",
        "Remove paste restrictions for better UX",
      ],
    }

    return (
      stepsMap[issueId] || [
        "Review the Lighthouse documentation for this specific issue",
        "Analyze the detailed audit information in the full report",
        "Implement recommended fixes based on best practices",
        "Test changes in a staging environment before deploying",
        "Re-run the analysis to verify improvements",
      ]
    )
  }

  const getLearnMoreUrl = (issueId: string): string => {
    return `https://developer.chrome.com/docs/lighthouse/${category}/${issueId}/`
  }

  const categoryInfo = getCategoryInfo()

  // Sort issues by priority and weight
  const sortedIssues = [...issues].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    const aPriority = getIssuePriority(a)
    const bPriority = getIssuePriority(b)
    const priorityDiff = priorityOrder[aPriority] - priorityOrder[bPriority]
    if (priorityDiff !== 0) return priorityDiff
    // If same priority, sort by weight (higher weight = more important)
    return (b.weight || 0) - (a.weight || 0)
  })

  // Calculate potential score improvement
  const potentialImprovement = sortedIssues.reduce((acc, issue) => {
    return acc + getEstimatedImpact(issue)
  }, 0)

  const projectedScore = Math.min(100, currentScore + potentialImprovement)

  if (sortedIssues.length === 0) {
    return (
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-3 mb-4">
          <div className={`${categoryInfo.color}`}>{categoryInfo.icon}</div>
          <h2 className="text-2xl font-bold">{categoryInfo.title}</h2>
        </div>
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-5 w-5" />
          <p className="font-semibold">Great job! No issues found in this category.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`${categoryInfo.color}`}>{categoryInfo.icon}</div>
          <h2 className="text-2xl font-bold">{categoryInfo.title}</h2>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Potential Score Improvement</div>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold">{currentScore}</div>
            <TrendingUp className="h-4 w-4 text-green-600" />
            <div className="text-2xl font-bold text-green-600">{projectedScore}</div>
          </div>
        </div>
      </div>

      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold mb-1">Fix Issues by Priority</h3>
            <p className="text-sm text-muted-foreground">
              Focus on critical and high-priority issues first for maximum impact. Each fix brings you closer to a
              perfect score!
            </p>
          </div>
        </div>
      </div>

      <Accordion type="single" collapsible className="space-y-3">
        {sortedIssues.map((issue, index) => {
          const priority = getIssuePriority(issue)
          const impact = getEstimatedImpact(issue)
          const steps = getActionableSteps(issue.id)
          const learnMoreUrl = getLearnMoreUrl(issue.id)

          return (
            <AccordionItem
              key={issue.id}
              value={`issue-${index}`}
              className="border rounded-lg px-4 bg-card hover:bg-accent/50 transition-colors"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-start gap-3 flex-1 text-left">
                  <AlertTriangle className={`h-5 w-5 flex-shrink-0 mt-1 ${
                    priority === "critical" ? "text-red-600" :
                    priority === "high" ? "text-orange-600" :
                    priority === "medium" ? "text-yellow-600" :
                    "text-gray-600"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold">{issue.title}</h3>
                      {getPriorityBadge(priority)}
                      {issue.scoreDisplayValue && (
                        <Badge variant="outline" className="gap-1">
                          Score: {issue.scoreDisplayValue}
                        </Badge>
                      )}
                      <Badge variant="outline" className="gap-1">
                        <TrendingUp className="h-3 w-3" />
                        +{impact} points
                      </Badge>
                    </div>
                    {issue.displayValue && (
                      <p className="text-sm text-muted-foreground">Current: {issue.displayValue}</p>
                    )}
                    {issue.weight && issue.weight > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Impact weight: {(issue.weight * 10).toFixed(0)}% of category score
                      </p>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-2">
                <div className="space-y-4 ml-8">
                  <div>
                    <h4 className="font-semibold mb-2 text-sm uppercase text-muted-foreground">Description</h4>
                    <p className="text-sm">{issue.description}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 text-sm uppercase text-muted-foreground">
                      How to Fix This
                    </h4>
                    <ol className="space-y-2">
                      {steps.map((step, stepIndex) => (
                        <li key={stepIndex} className="flex gap-3 text-sm">
                          <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary font-semibold text-xs">
                            {stepIndex + 1}
                          </span>
                          <span className="flex-1 pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div>
                    <a
                      href={learnMoreUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Learn more in Lighthouse documentation
                    </a>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>

      <div className="mt-6 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold mb-1">Next Steps</h3>
            <p className="text-sm text-muted-foreground">
              After implementing these fixes, run another analysis to track your progress. Focus on one or two high-priority
              issues at a time for manageable improvements.
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}

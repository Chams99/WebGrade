import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    // The PDF HTML will be generated client-side using data from localStorage
    // This endpoint returns an HTML page that reads from localStorage and formats for PDF
    
    const pdfHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>WebGrade Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      padding: 40px;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .header {
      border-bottom: 3px solid #1f2937;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    
    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .header .url {
      font-size: 18px;
      color: #6b7280;
      word-break: break-all;
    }
    
    .header .meta {
      font-size: 14px;
      color: #9ca3af;
      margin-top: 10px;
    }
    
    .scores-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 40px;
    }
    
    .score-card {
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    
    .score-card h3 {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .score-card .score {
      font-size: 48px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    
    .score-card .label {
      font-size: 12px;
      padding: 4px 12px;
      border-radius: 12px;
      display: inline-block;
      color: white;
      font-weight: 600;
    }
    
    .section {
      margin-bottom: 40px;
      page-break-inside: avoid;
    }
    
    .section h2 {
      font-size: 24px;
      margin-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 10px;
    }
    
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }
    
    .metric {
      padding: 15px;
      background: #f9fafb;
      border-radius: 6px;
    }
    
    .metric .label {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .metric .value {
      font-size: 24px;
      font-weight: bold;
      color: #1f2937;
    }
    
    .vitals-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 15px;
    }
    
    .issues {
      margin-top: 20px;
    }
    
    .issue {
      border-left: 4px solid #ca8a04;
      padding: 15px;
      margin-bottom: 15px;
      background: #fefce8;
      page-break-inside: avoid;
    }
    
    .issue h4 {
      font-size: 16px;
      margin-bottom: 8px;
      color: #1f2937;
    }
    
    .issue p {
      font-size: 14px;
      color: #6b7280;
      line-height: 1.5;
    }
    
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
    }
    
    @media print {
      body {
        padding: 20px;
      }
      
      .section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div id="content">
    <p style="text-align: center; padding: 40px;">Loading report data...</p>
  </div>

  <script>
    // Read data from localStorage
    const data = JSON.parse(localStorage.getItem('pdf-export-data') || '{}');
    
    if (!data.scan) {
      document.getElementById('content').innerHTML = '<p style="text-align: center; padding: 40px; color: red;">No report data found. Please try exporting again.</p>';
    } else {
      const scan = data.scan;
      const details = data.details;
      
      const getScoreColor = (score) => {
        if (score >= 90) return "#16a34a";
        if (score >= 50) return "#ca8a04";
        return "#dc2626";
      };
      
      const getScoreLabel = (score) => {
        if (score >= 90) return "Good";
        if (score >= 50) return "Needs Improvement";
        return "Poor";
      };
      
      const formatTime = (ms) => {
        if (ms < 1000) return Math.round(ms) + "ms";
        return (ms / 1000).toFixed(2) + "s";
      };
      
      const formatSize = (kb) => {
        if (kb < 1024) return Math.round(kb) + "KB";
        return (kb / 1024).toFixed(2) + "MB";
      };
      
      const renderIssues = (issues, title) => {
        if (!issues || issues.length === 0) return '';
        
        return \`
          <div class="section">
            <h2>\${title}</h2>
            <div class="issues">
              \${issues.slice(0, 10).map(issue => \`
                <div class="issue">
                  <h4>\${issue.title}</h4>
                  <p>\${issue.description}</p>
                  \${issue.displayValue ? \`<p><strong>Value:</strong> \${issue.displayValue}</p>\` : ''}
                </div>
              \`).join('')}
            </div>
          </div>
        \`;
      };
      
      document.getElementById('content').innerHTML = \`
        <div class="header">
          <h1>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/>
              <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>
              <path d="M12 2v4"/>
              <path d="M12 18v4"/>
            </svg>
            WebGrade Report
          </h1>
          <div class="url">\${scan.url}</div>
          <div class="meta">
            Generated on \${new Date(scan.created_at).toLocaleString()} | 
            SSL: \${scan.ssl_valid ? "Valid" : "Invalid"}
          </div>
        </div>

        <div class="scores-grid">
          <div class="score-card">
            <h3>Performance</h3>
            <div class="score" style="color: \${getScoreColor(scan.performance_score)}">\${scan.performance_score}</div>
            <span class="label" style="background-color: \${getScoreColor(scan.performance_score)}">
              \${getScoreLabel(scan.performance_score)}
            </span>
          </div>
          
          <div class="score-card">
            <h3>Accessibility</h3>
            <div class="score" style="color: \${getScoreColor(scan.accessibility_score)}">\${scan.accessibility_score}</div>
            <span class="label" style="background-color: \${getScoreColor(scan.accessibility_score)}">
              \${getScoreLabel(scan.accessibility_score)}
            </span>
          </div>
          
          <div class="score-card">
            <h3>Best Practices</h3>
            <div class="score" style="color: \${getScoreColor(scan.best_practices_score)}">\${scan.best_practices_score}</div>
            <span class="label" style="background-color: \${getScoreColor(scan.best_practices_score)}">
              \${getScoreLabel(scan.best_practices_score)}
            </span>
          </div>
          
          <div class="score-card">
            <h3>SEO</h3>
            <div class="score" style="color: \${getScoreColor(scan.seo_score)}">\${scan.seo_score}</div>
            <span class="label" style="background-color: \${getScoreColor(scan.seo_score)}">
              \${getScoreLabel(scan.seo_score)}
            </span>
          </div>
        </div>

        <div class="section">
          <h2>Core Web Vitals</h2>
          <div class="vitals-grid">
            <div class="metric">
              <div class="label">First Contentful Paint</div>
              <div class="value">\${formatTime(details.first_contentful_paint)}</div>
            </div>
            <div class="metric">
              <div class="label">Largest Contentful Paint</div>
              <div class="value">\${formatTime(details.largest_contentful_paint)}</div>
            </div>
            <div class="metric">
              <div class="label">Total Blocking Time</div>
              <div class="value">\${formatTime(details.total_blocking_time)}</div>
            </div>
            <div class="metric">
              <div class="label">Cumulative Layout Shift</div>
              <div class="value">\${details.cumulative_layout_shift.toFixed(3)}</div>
            </div>
            <div class="metric">
              <div class="label">Speed Index</div>
              <div class="value">\${formatTime(details.speed_index)}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Page Metrics</h2>
          <div class="metrics-grid">
            <div class="metric">
              <div class="label">Total Load Time</div>
              <div class="value">\${formatTime(scan.load_time_ms)}</div>
            </div>
            <div class="metric">
              <div class="label">Page Size</div>
              <div class="value">\${formatSize(scan.page_size_kb)}</div>
            </div>
            <div class="metric">
              <div class="label">SSL Certificate</div>
              <div class="value">\${scan.ssl_valid ? "✓ Valid" : "✗ Invalid"}</div>
            </div>
          </div>
        </div>

        \${renderIssues(details.accessibility_issues, 'Accessibility Issues')}
        \${renderIssues(details.best_practices_issues, 'Best Practices Issues')}
        \${renderIssues(details.seo_issues, 'SEO Issues')}

        <div class="footer">
          <p>Generated by WebGrade - Powered by Google PageSpeed Insights API</p>
          <p>\${new Date().toLocaleDateString()}</p>
        </div>
      \`;
      
      // Auto-trigger print dialog
      setTimeout(() => window.print(), 500);
    }
  </script>
</body>
</html>
    `

    return new NextResponse(pdfHtml, {
      headers: {
        "Content-Type": "text/html",
      },
    })
  } catch (error) {
    console.error("Error generating PDF:", error)
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 })
  }
}

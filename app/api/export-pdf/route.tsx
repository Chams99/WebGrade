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
    
    if (!data.scan && !data.mobile && !data.desktop) {
      document.getElementById('content').innerHTML = '<p style="text-align: center; padding: 40px; color: red;">No report data found. Please try exporting again.</p>';
    } else {
      // Support both old format (data.scan) and new dual-device format (data.mobile/desktop)
      const hasDualDevice = data.mobile && data.desktop;
      const selectedDevice = data.selectedDevice || 'mobile';
      
      let scan, details;
      
      if (hasDualDevice) {
        // Use selected device data
        if (selectedDevice === 'desktop' && data.desktop) {
          scan = data.desktop.scan;
          details = data.desktop.details;
        } else {
          scan = data.mobile.scan;
          details = data.mobile.details;
        }
      } else {
        // Fallback to old format
        scan = data.scan;
        details = data.details;
      }
      
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
      
      const getIssuePriority = (issue) => {
        if (issue.severity && issue.severity !== 'info') {
          return issue.severity;
        }
        const score = issue.score;
        if (score === 0) return "critical";
        if (score < 0.5) return "high";
        if (score < 0.75) return "medium";
        return "low";
      };
      
      const getPriorityColor = (priority) => {
        switch (priority) {
          case "critical": return "#dc2626";
          case "high": return "#ea580c";
          case "medium": return "#ca8a04";
          case "low": return "#6b7280";
          default: return "#6b7280";
        }
      };
      
      const getPriorityLabel = (priority) => {
        switch (priority) {
          case "critical": return "Critical";
          case "high": return "High Priority";
          case "medium": return "Medium Priority";
          case "low": return "Low Priority";
          default: return "Low";
        }
      };
      
      const getEstimatedImpact = (issue) => {
        const priority = getIssuePriority(issue);
        const weight = issue.weight || 1;
        
        let baseImpact = 1;
        switch (priority) {
          case "critical": baseImpact = 15; break;
          case "high": baseImpact = 8; break;
          case "medium": baseImpact = 4; break;
          case "low": baseImpact = 2; break;
        }
        
        const weightMultiplier = 0.5 + (weight / 10) * 1.0;
        return Math.round(baseImpact * weightMultiplier);
      };
      
      const renderIssues = (issues, title) => {
        if (!issues || issues.length === 0) return '';
        
        // Sort by priority and weight
        const sortedIssues = [...issues].sort((a, b) => {
          const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          const aPriority = getIssuePriority(a);
          const bPriority = getIssuePriority(b);
          const priorityDiff = priorityOrder[aPriority] - priorityOrder[bPriority];
          if (priorityDiff !== 0) return priorityDiff;
          return (b.weight || 0) - (a.weight || 0);
        });
        
        return \`
          <div class="section">
            <h2>\${title}</h2>
            <div class="issues">
              \${sortedIssues.slice(0, 10).map(issue => {
                const priority = getIssuePriority(issue);
                const impact = getEstimatedImpact(issue);
                const color = getPriorityColor(priority);
                const label = getPriorityLabel(priority);
                
                return \`
                  <div class="issue" style="border-left-color: \${color}">
                    <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px;">
                      <h4 style="flex: 1; margin: 0;">\${issue.title}</h4>
                      <span style="background: \${color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap;">
                        \${label}
                      </span>
                    </div>
                    <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; font-size: 12px;">
                      \${issue.scoreDisplayValue ? \`
                        <span style="background: #f3f4f6; padding: 2px 8px; border-radius: 4px; color: #374151;">
                          Score: \${issue.scoreDisplayValue}
                        </span>
                      \` : ''}
                      <span style="background: #dcfce7; padding: 2px 8px; border-radius: 4px; color: #166534;">
                        +\${impact} points
                      </span>
                      \${issue.weight && issue.weight > 0 ? \`
                        <span style="color: #9ca3af;">
                          Impact: \${(issue.weight * 10).toFixed(0)}% of category
                        </span>
                      \` : ''}
                    </div>
                    <p style="margin-bottom: 8px;">\${issue.description}</p>
                    \${issue.displayValue ? \`<p style="font-size: 13px;"><strong>Current Value:</strong> \${issue.displayValue}</p>\` : ''}
                  </div>
                \`;
              }).join('')}
            </div>
          </div>
        \`;
      };
      
      const deviceIcon = hasDualDevice ? (selectedDevice === 'desktop' ? '💻' : '📱') : '';
      const deviceLabel = hasDualDevice ? (selectedDevice === 'desktop' ? 'Desktop' : 'Mobile') : '';
      
      document.getElementById('content').innerHTML = \`
        <div class="header">
          <h1>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/>
              <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>
              <path d="M12 2v4"/>
              <path d="M12 18v4"/>
            </svg>
            WebGrade Report \${deviceIcon ? deviceIcon + ' ' + deviceLabel : ''}
          </h1>
          <div class="url">\${scan.url}</div>
          <div class="meta">
            Generated on \${new Date(scan.created_at).toLocaleString()} | 
            SSL: \${scan.ssl_valid ? "Valid" : "Invalid"}
            \${hasDualDevice ? \` | Device: \${deviceLabel} Analysis\` : ''}
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

        \${renderIssues(details.performance_issues, 'Performance Issues')}
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

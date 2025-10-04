# WebGrade - Website Performance Analyzer

A modern, stateless website analysis tool powered by Google PageSpeed Insights API. Get comprehensive insights into your website's performance, accessibility, SEO, and security.

![WebGrade Screenshot](https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat&logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38bdf8?style=flat&logo=tailwindcss)

## ✨ Features

- 🚀 **Performance Analysis** - Measure load times, Core Web Vitals, and speed metrics
- ♿ **Accessibility Checks** - Identify WCAG compliance issues
- 🔍 **SEO Optimization** - Get actionable SEO recommendations
- 🔒 **Security Audits** - Check SSL certificates and security best practices
- 📊 **Core Web Vitals** - Track FCP, LCP, TBT, CLS, and Speed Index
- 📄 **PDF Export** - Generate professional reports
- 🎨 **Modern UI** - Clean, responsive design with dark mode aesthetics
- ⚡ **No Database Required** - Fully stateless, simple deployment

## 🏗️ Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** TailwindCSS 4
- **UI Components:** Radix UI
- **Icons:** Lucide React
- **API:** Google PageSpeed Insights API

## 📋 Prerequisites

- Node.js 18+ installed
- pnpm (recommended) or npm
- (Optional) Google PageSpeed Insights API key

## 🚀 Quick Start

### 1. Clone the repository

\`\`\`bash
git clone <your-repo-url>
cd websiteGrader
\`\`\`

### 2. Install dependencies

\`\`\`bash
pnpm install
# or
npm install
\`\`\`

### 3. Set up environment variables (Optional)

\`\`\`bash
cp .env.example .env.local
\`\`\`

Edit `.env.local` and add your Google PageSpeed API key (optional but recommended for higher rate limits):

\`\`\`env
PAGESPEED_API_KEY=your_api_key_here
\`\`\`

**Getting an API Key:**
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the PageSpeed Insights API
4. Create credentials (API Key)
5. Copy the key to your `.env.local` file

**Note:** The API works without a key but has strict rate limits. An API key is recommended for production use.

### 4. Run the development server

\`\`\`bash
pnpm dev
# or
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📦 Build for Production

\`\`\`bash
pnpm build
pnpm start
\`\`\`

## 🎯 How It Works

1. **Enter URL** - User inputs any website URL
2. **Analysis** - App calls Google PageSpeed Insights API to run Lighthouse audits
3. **Results** - Display comprehensive scores and metrics
4. **Export** - Generate PDF reports for sharing

## 📊 What Gets Analyzed

### Performance Metrics
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Total Blocking Time (TBT)
- Cumulative Layout Shift (CLS)
- Speed Index
- Total load time
- Page size

### Quality Scores (0-100)
- Performance
- Accessibility
- Best Practices
- SEO

### Security
- SSL/TLS certificate validation
- HTTPS enforcement

### Issues Detection
- Accessibility violations
- Best practices violations
- SEO improvements

## 🗂️ Project Structure

\`\`\`
websiteGrader/
├── app/
│   ├── api/
│   │   ├── analyze/          # Main analysis endpoint
│   │   └── export-pdf/       # PDF generation endpoint
│   ├── results/              # Results display page
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Landing page
├── components/
│   ├── ui/                   # Reusable UI components
│   └── theme-provider.tsx    # Theme configuration
├── lib/
│   └── utils.ts              # Utility functions
├── public/                   # Static assets
└── README.md
\`\`\`

## 🔧 Configuration

### API Rate Limits

**Without API Key:**
- 25 queries per 100 seconds per IP

**With API Key:**
- 25,000 queries per day (default quota)
- Can request quota increase

### Customization

You can customize the analysis categories by modifying the API call in `app/api/analyze/route.ts`:

\`\`\`typescript
const apiUrl = \`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=\${encodeURIComponent(url)}&category=performance&category=accessibility&category=best-practices&category=seo&strategy=mobile\`
\`\`\`

Change `strategy=mobile` to `strategy=desktop` for desktop analysis.

## 🎨 Styling

The app uses TailwindCSS 4 with a custom design system. Colors and themes can be customized in:
- `app/globals.css` - CSS variables and theme colors
- `tailwind.config.js` - Tailwind configuration

## 📱 Responsive Design

The interface is fully responsive and works on:
- 📱 Mobile devices (320px+)
- 📱 Tablets (768px+)
- 💻 Desktops (1024px+)

## 🚀 Deployment

### Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Push your code to GitHub
2. Import project to Vercel
3. Add `PAGESPEED_API_KEY` environment variable (optional)
4. Deploy!

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- Render
- AWS Amplify
- Self-hosted with Node.js

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🔗 Resources

- [Google PageSpeed Insights API](https://developers.google.com/speed/docs/insights/v5/get-started)
- [Next.js Documentation](https://nextjs.org/docs)
- [Lighthouse Scoring Guide](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring/)
- [Core Web Vitals](https://web.dev/vitals/)

## 💡 Tips

- **Analysis Time:** Typically takes 15-30 seconds per website
- **Best Results:** Test on production URLs (not localhost)
- **Mobile vs Desktop:** Mobile scores are typically lower due to network simulation
- **Repeat Tests:** Scores may vary slightly between runs due to network conditions

## 🐛 Troubleshooting

### "Failed to analyze website"
- Check if the URL is publicly accessible
- Verify the website is not blocking the Lighthouse bot
- Ensure your API key (if used) is valid

### PDF Export not working
- Make sure popups are not blocked in your browser
- Check browser console for any errors

### Rate Limit Errors
- Add a Google PageSpeed API key to increase rate limits
- Wait a few minutes before retrying

---

Built with ❤️ using Next.js and Google PageSpeed Insights

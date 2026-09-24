import Link from "next/link"

export function WebGradeBrand({ href = "/" }: { href?: string }) {
  return <Link href={href} className="brand" aria-label="WebGrade home">
    <span className="brand-symbol" aria-hidden="true">
      <svg viewBox="0 0 32 32" focusable="false">
        <path d="M5.5 11 10 23 16 12.2 22 23 26.5 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.5 7.5h12.5" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity=".7" />
        <circle cx="24.5" cy="7.5" r="1.8" fill="currentColor" />
      </svg>
    </span>
    <span className="brand-wordmark">WebGrade</span>
  </Link>
}

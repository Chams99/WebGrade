"use client"

import { useEffect, useState } from "react"

const sections = [
  ["analyze", "Analyze", "Start an audit"],
  ["status", "Run status", "Read progress"],
  ["health", "Health", "Check infrastructure"],
  ["capabilities", "Capabilities", "See available features"],
  ["errors", "Errors", "Handle responses"],
] as const

export function DocsRail() {
  const [active, setActive] = useState<(typeof sections)[number][0]>("analyze")

  useEffect(() => {
    const validIds = new Set(sections.map(([id]) => id))
    const setFromHash = () => {
      const id = window.location.hash.slice(1)
      if (validIds.has(id as (typeof sections)[number][0])) setActive(id as (typeof sections)[number][0])
    }
    setFromHash()

    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      const id = visible[0]?.target.id
      if (id && validIds.has(id as (typeof sections)[number][0])) setActive(id as (typeof sections)[number][0])
    }, { rootMargin: "-18% 0px -62% 0px", threshold: [0, 0.2, 0.6] })

    sections.forEach(([id]) => { const element = document.getElementById(id); if (element) observer.observe(element) })
    window.addEventListener("hashchange", setFromHash)
    return () => { observer.disconnect(); window.removeEventListener("hashchange", setFromHash) }
  }, [])

  return <aside className="docs-rail"><span className="docs-rail-kicker">API REFERENCE</span><span className="docs-rail-title">On this page</span><nav aria-label="Documentation contents">{sections.map(([id, label, description], index) => <a className={active === id ? "active" : undefined} aria-current={active === id ? "location" : undefined} href={`#${id}`} key={id} onClick={() => setActive(id)}><span className="docs-index">{String(index + 1).padStart(2, "0")}</span><span><strong>{label}</strong><small>{description}</small></span></a>)}</nav></aside>
}

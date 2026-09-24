"use client"

import Link from "next/link"
import { Menu, Pause, Play, X } from "lucide-react"
import { HealthStatus } from "@/components/webgrade/health-status"
import { WebGradeBrand } from "@/components/webgrade/brand"
import { useEffect, useState } from "react"

type ActivePage = "home" | "about" | "docs" | "workspace"

export function PrimaryNav({ active, showMotion = false }: { active?: ActivePage; showMotion?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [motionPaused, setMotionPaused] = useState(false)

  useEffect(() => { setMotionPaused(localStorage.getItem("webgrade-motion-paused") === "1") }, [])

  function toggleMotion() {
    const next = !motionPaused
    setMotionPaused(next)
    localStorage.setItem("webgrade-motion-paused", next ? "1" : "0")
    window.dispatchEvent(new CustomEvent("webgrade-motion-change", { detail: next }))
  }

  const links = [
    ["home", "/", "Home"],
    ["about", "/about", "About"],
    ["docs", "/docs", "API Docs"],
  ] as const

  return <header className="app-nav landing-nav">
    <WebGradeBrand />
    <nav className="desktop-nav" aria-label="Primary navigation">{links.map(([key, href, label]) => <Link className={active === key ? "active" : undefined} key={key} href={href}>{label}</Link>)}<Link className={active === "workspace" ? "active secondary-nav-link" : "secondary-nav-link"} href="/workspace">Workspace</Link></nav>
    <div className="nav-actions"><HealthStatus />{showMotion && <button className="motion-control" type="button" onClick={toggleMotion} aria-pressed={motionPaused} aria-label={motionPaused ? "Resume background motion" : "Pause background motion"}>{motionPaused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}<span className="motion-label">{motionPaused ? "Play" : "Pause"}</span></button>}<button type="button" className="menu-toggle" aria-expanded={menuOpen} aria-controls="mobile-nav" onClick={() => setMenuOpen((current) => !current)} aria-label={menuOpen ? "Close navigation" : "Open navigation"}>{menuOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}</button></div>
    {menuOpen && <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile navigation">{links.map(([key, href, label]) => <Link className={active === key ? "active" : undefined} key={key} href={href} onClick={() => setMenuOpen(false)}>{label}</Link>)}<Link className={active === "workspace" ? "active" : undefined} href="/workspace" onClick={() => setMenuOpen(false)}>Workspace</Link></nav>}
  </header>
}

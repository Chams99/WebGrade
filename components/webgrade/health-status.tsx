"use client"

import { useEffect, useState } from "react"

type HealthState = "checking" | "ready" | "online" | "limited" | "unavailable"

function readHealth(data: { status?: string; database?: string; worker?: string }): HealthState {
  if (data.status !== "ok") return "unavailable"
  if (data.database === "not_configured") return "ready"
  if (data.database === "ok" && data.worker === "ok") return "online"
  return "limited"
}

const labels: Record<HealthState, string> = {
  checking: "Checking",
  ready: "Ready",
  online: "Online",
  limited: "Limited",
  unavailable: "Unavailable",
}

export function HealthStatus() {
  const [state, setState] = useState<HealthState>("checking")

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const check = async () => {
      try {
        const response = await fetch("/api/health", { cache: "no-store", signal: controller.signal })
        const data = await response.json().catch(() => ({}))
        if (active) setState(readHealth(data))
      } catch {
        if (active && !controller.signal.aborted) setState("unavailable")
      }
    }
    void check()
    const timer = window.setInterval(check, 30_000)
    return () => { active = false; controller.abort(); window.clearInterval(timer) }
  }, [])

  return <span className={`online-status health-${state}`} title="Application infrastructure status" aria-live="polite"><span className="online-dot" aria-hidden="true" />{labels[state]}</span>
}

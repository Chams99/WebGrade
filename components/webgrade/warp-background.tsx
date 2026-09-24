"use client"

import dynamic from "next/dynamic"
import { Component, type ErrorInfo, type ReactNode, useEffect, useRef, useState } from "react"

const WarpCanvas = dynamic(() => import("@paper-design/shaders-react").then((mod) => mod.Warp), { ssr: false })

class ShaderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* The fallback remains intentionally quiet. */ }
  render() { return this.state.failed ? null : this.props.children }
}

export function WarpBackground({ paused = false }: { paused?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  // The hero is in view on first paint. Starting active avoids a blank/static
  // frame while IntersectionObserver delivers its first observation.
  const [visible, setVisible] = useState(true)
  const [documentVisible, setDocumentVisible] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updateMotion = () => setReducedMotion(media.matches)
    updateMotion()
    setDocumentVisible(!document.hidden)
    media.addEventListener("change", updateMotion)
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "0px" })
    observer.observe(host)
    const onVisibility = () => setDocumentVisible(!document.hidden)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      media.removeEventListener("change", updateMotion)
      observer.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  const canRenderShader = visible && documentVisible && !reducedMotion && !failed
  const active = canRenderShader && !paused
  return <div ref={hostRef} className="warp-background" data-active={active ? "true" : "false"} aria-hidden="true">
    <div className="warp-fallback" />
    {canRenderShader && <ShaderBoundary><WarpCanvas width="100%" height="100%" speed={paused ? 0 : 0.56} colors={["#0b3342", "#0ca5c8", "#6240b0", "#081521"]} proportion={0.45} softness={0.82} distortion={0.3} swirl={0.8} swirlIterations={4} shape="edge" shapeScale={0.16} minPixelRatio={1} maxPixelCount={900000} onError={() => setFailed(true)} /></ShaderBoundary>}
    <div className="warp-readability" />
  </div>
}

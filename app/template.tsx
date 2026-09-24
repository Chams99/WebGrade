import type { ReactNode } from "react"

/**
 * App Router templates remount for each route segment navigation. Keeping the
 * transition here gives the public pages one consistent handoff while links
 * remain native Next.js client-side navigation.
 */
export default function RouteTemplate({ children }: { children: ReactNode }) {
  return <div className="route-transition">{children}</div>
}

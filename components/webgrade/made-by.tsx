import { ArrowUpRight, MessageCircle, Phone } from "lucide-react"
import { developer } from "@/lib/developer"

/** A quiet note at the end of a page: who built WebGrade, and how to reach him. */
export function MadeBy({ className = "" }: { className?: string }) {
  return (
    <aside className={`made-by ${className}`} aria-labelledby="made-by-title">
      <div>
        <h2 id="made-by-title">Need a website or a tool like this one?</h2>
        <p>
          WebGrade is designed and built by{" "}
          <a href={developer.portfolioHref} rel="author">
            {developer.name}
          </a>
          , {developer.role}.
        </p>
      </div>
      <ul>
        <li>
          <a href={developer.phoneHref}>
            <Phone size={14} aria-hidden="true" />
            {developer.phone}
          </a>
        </li>
        <li>
          <a href={developer.whatsappHref}>
            <MessageCircle size={14} aria-hidden="true" />
            WhatsApp
          </a>
        </li>
        <li>
          <a href={developer.portfolioHref}>
            chames.tn
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </li>
      </ul>
    </aside>
  )
}

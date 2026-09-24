import { PrimaryNav } from "@/components/webgrade/primary-nav"

export function PublicHeader({ active }: { active?: "about" | "docs" }) {
  return <PrimaryNav active={active} />
}

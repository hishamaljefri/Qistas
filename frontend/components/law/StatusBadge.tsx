import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { text } from "@/lib/text";
import type { ProvisionStatus } from "@/lib/types";

const tones: Record<ProvisionStatus, BadgeTone> = { in_force: "success", repealed: "danger", merged: "warning" };

/** سارية / ملغاة / مدمجة. Hidden for in-force articles unless `always` is set (the article page). */
export function StatusBadge({ status, always = false }: { status: ProvisionStatus; always?: boolean }) {
  if (status === "in_force" && !always) return null;
  return <Badge tone={tones[status]}>{text.status[status]}</Badge>;
}

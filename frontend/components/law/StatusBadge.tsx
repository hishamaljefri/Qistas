import { Badge } from "@/components/ui/Badge";
import { text } from "@/lib/text";
import type { ProvisionStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: ProvisionStatus }) {
  if (status === "in_force") return null;
  return <Badge tone="danger">{text.status[status]}</Badge>;
}

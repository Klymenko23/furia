"use client";

import { stageLabel } from "@/lib/constants";
import type { Stage } from "@/lib/types";

export function StageBadge({ stage }: { stage: Stage }) {
  const cls = stage === "paid" ? "done" : stage === "cancelled" ? "off" : ["invoiced", "originals", "awaiting"].includes(stage) ? "money" : "";
  return <span className={`badge stage ${cls}`}>{stageLabel(stage)}</span>;
}

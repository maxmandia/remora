import type { GenerationJobStatus } from "./dto.ts";

export const terminalGenerationJobStatuses = [
  "succeeded",
  "failed",
  "cancelled",
  "expired",
  "final_cost_calculation_failure",
] as const satisfies readonly GenerationJobStatus[];

export type TerminalGenerationJobStatus =
  (typeof terminalGenerationJobStatuses)[number];

export function isTerminalGenerationJobStatus(
  status: GenerationJobStatus,
): status is TerminalGenerationJobStatus {
  return (
    terminalGenerationJobStatuses as readonly GenerationJobStatus[]
  ).includes(status);
}

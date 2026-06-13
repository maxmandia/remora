import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../lib/trpc.ts";
import { GenerationSubmissionRow } from "./generation-submission-row.tsx";

type GenerationResultsProps = {
  threadId: string;
};

export function GenerationResults({ threadId }: GenerationResultsProps) {
  const trpc = useTRPC();
  const { data: submissions = [] } = useQuery(
    trpc.generation.listSubmissionsFromThread.queryOptions({ threadId }),
  );

  if (submissions.length === 0) return null;

  return (
    <section
      aria-label="Generation results"
      className="relative z-[3] mx-auto flex w-[min(60rem,calc(100%_-_3rem))] flex-col gap-3 pt-[clamp(2rem,9vh,5rem)] pb-56"
    >
      {submissions.map((submission) => (
        <GenerationSubmissionRow key={submission.id} submission={submission} />
      ))}
    </section>
  );
}

import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@remora/app/auth";
import { useTRPC } from "@remora/app/trpc";

import { defaultVideoGenerationModelId } from "../lib/generation/generation-model-defaults.ts";

const modelStaleTimeMs = 5 * 60 * 1000;

export function useGenerationModelSelection(
  preferredModelId = defaultVideoGenerationModelId,
) {
  const { status } = useAuth();
  const trpc = useTRPC();
  const [selectedModel, setSelectedModel] =
    useState<PublishedGenerationModelSummary | null>(null);
  const {
    data: models = [],
    error,
    isPending,
    refetch,
  } = useQuery(
    trpc.model.listPublished.queryOptions(undefined, {
      enabled: status !== "loading",
      staleTime: modelStaleTimeMs,
    }),
  );

  useEffect(() => {
    if (selectedModel || models.length === 0) {
      return;
    }

    setSelectedModel(
      models.find((model) => model.id === preferredModelId) ?? models[0],
    );
  }, [models, preferredModelId, selectedModel]);

  const retry = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    error,
    isPending: status !== "loading" && isPending,
    models,
    retry,
    selectedModel,
    setSelectedModel,
  };
}

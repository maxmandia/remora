import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";

import { useTRPC } from "./trpc-provider.ts";

import type {
  RealtimeClient,
  RealtimeClientEvent,
  RealtimeClientEventType,
} from "@remora/realtime";
import type { QueryClient } from "@tanstack/react-query";

type RealtimeInvalidationContext = {
  queryClient: QueryClient;
  trpc: ReturnType<typeof useTRPC>;
};

export function RealtimeQueryInvalidationProvider({
  children,
  client,
  enabled,
}: {
  children: ReactNode;
  client: RealtimeClient;
  enabled: boolean;
}) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const hasConnectedRef = useRef(false);
  const missedEventsPossibleRef = useRef(false);

  useEffect(() => {
    const unsubscribeEvent = client.onEvent((event) => {
      invalidateRealtimeEvent(event, {
        queryClient,
        trpc,
      });
    });
    const unsubscribeConnectionChange = client.onConnectionChange(
      (nextStatus) => {
        if (nextStatus === "connected") {
          if (hasConnectedRef.current && missedEventsPossibleRef.current) {
            for (const handler of Object.values(realtimeInvalidationHandlers)) {
              handler.invalidateAfterReconnect({ queryClient, trpc });
            }
          }

          hasConnectedRef.current = true;
          missedEventsPossibleRef.current = false;
          return;
        }

        if (hasConnectedRef.current) {
          missedEventsPossibleRef.current = true;
        }
      },
    );

    return () => {
      unsubscribeEvent();
      unsubscribeConnectionChange();
    };
  }, [client, queryClient, trpc]);

  useEffect(() => {
    if (enabled) {
      void client.connect();
      return () => {
        void client.disconnect();
      };
    }

    hasConnectedRef.current = false;
    missedEventsPossibleRef.current = false;
    void client.disconnect();
  }, [client, enabled]);

  return children;
}

type RealtimeInvalidationHandlers = {
  [Type in RealtimeClientEventType]: {
    invalidateEvent: (
      event: Extract<RealtimeClientEvent, { type: Type }>,
      context: RealtimeInvalidationContext,
    ) => void;
    invalidateAfterReconnect: (context: RealtimeInvalidationContext) => void;
  };
};

const realtimeInvalidationHandlers: RealtimeInvalidationHandlers = {
  "credits.balance.updated": {
    invalidateEvent(_event, { queryClient, trpc }) {
      void queryClient.invalidateQueries(trpc.credits.getBalance.queryFilter());
    },
    invalidateAfterReconnect({ queryClient, trpc }) {
      void queryClient.invalidateQueries(trpc.credits.getBalance.queryFilter());
    },
  },
  "generation.job.succeeded": {
    invalidateEvent(event, { queryClient, trpc }) {
      void queryClient.invalidateQueries({
        queryKey: trpc.generation.listSubmissionsFromThread.queryKey({
          threadId: event.payload.threadId,
        }),
      });
    },
    invalidateAfterReconnect({ queryClient, trpc }) {
      void queryClient.invalidateQueries({
        queryKey: trpc.generation.listSubmissionsFromThread.pathKey(),
      });
    },
  },
  "generation.job.failed": {
    invalidateEvent(event, { queryClient, trpc }) {
      void queryClient.invalidateQueries({
        queryKey: trpc.generation.listSubmissionsFromThread.queryKey({
          threadId: event.payload.threadId,
        }),
      });
    },
    // The success handler already invalidates this shared query path once.
    invalidateAfterReconnect() {},
  },
  "generation.thread.name.updated": {
    invalidateEvent(_event, { queryClient, trpc }) {
      void queryClient.invalidateQueries(
        trpc.generationThread.listWithoutProject.queryFilter(),
      );
      void queryClient.invalidateQueries(
        trpc.project.listProjects.queryFilter(),
      );
    },
    invalidateAfterReconnect({ queryClient, trpc }) {
      void queryClient.invalidateQueries(
        trpc.generationThread.listWithoutProject.queryFilter(),
      );
      void queryClient.invalidateQueries(
        trpc.project.listProjects.queryFilter(),
      );
    },
  },
};

function invalidateRealtimeEvent(
  event: RealtimeClientEvent,
  context: RealtimeInvalidationContext,
) {
  switch (event.type) {
    case "credits.balance.updated":
      realtimeInvalidationHandlers[event.type].invalidateEvent(event, context);
      return;
    case "generation.job.succeeded":
      realtimeInvalidationHandlers[event.type].invalidateEvent(event, context);
      return;
    case "generation.job.failed":
      realtimeInvalidationHandlers[event.type].invalidateEvent(event, context);
      return;
    case "generation.thread.name.updated":
      realtimeInvalidationHandlers[event.type].invalidateEvent(event, context);
      return;
    default:
      assertUnhandledRealtimeEvent(event);
  }
}

function assertUnhandledRealtimeEvent(event: never): never {
  throw new Error(`Unhandled realtime event: ${JSON.stringify(event)}`);
}

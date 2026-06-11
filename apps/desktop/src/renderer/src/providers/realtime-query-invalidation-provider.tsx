import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";

import { realtimeBridge } from "../lib/realtime-bridge.ts";
import { useTRPC } from "../lib/trpc.ts";
import { useAuth } from "./auth-provider.tsx";

import type {
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
}: {
  children: ReactNode;
}) {
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const hasConnectedRef = useRef(false);
  const missedEventsPossibleRef = useRef(false);

  useEffect(() => {
    const unsubscribeEvent = realtimeBridge.onEvent((event) => {
      realtimeInvalidationHandlers[event.type].invalidateEvent(event, {
        queryClient,
        trpc,
      });
    });
    const unsubscribeConnectionChange = realtimeBridge.onConnectionChange(
      (nextStatus) => {
        if (nextStatus === "connected") {
          if (hasConnectedRef.current && missedEventsPossibleRef.current) {
            // When the connection changes go through all of our handlers and call each handler's `invalidateAfterReconnect` method
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
  }, [queryClient, trpc]);

  useEffect(() => {
    if (status === "signed-in") {
      void realtimeBridge.connect();
      return () => {
        void realtimeBridge.disconnect();
      };
    }

    hasConnectedRef.current = false;
    missedEventsPossibleRef.current = false;
    void realtimeBridge.disconnect();
  }, [status]);

  return children;
}

// Type safe mapping that forces us to handle invalidation for new events and re-connections
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
  "generation.job.succeeded": {
    invalidateEvent(event, { queryClient, trpc }) {
      void queryClient.invalidateQueries({
        queryKey: trpc.generation.listGenerationsFromThread.queryKey({
          threadId: event.payload.threadId,
        }),
      });
    },
    invalidateAfterReconnect({ queryClient, trpc }) {
      void queryClient.invalidateQueries({
        queryKey: trpc.generation.listGenerationsFromThread.pathKey(),
      });
    },
  },
};

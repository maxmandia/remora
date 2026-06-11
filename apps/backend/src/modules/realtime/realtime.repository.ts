import {
  parseRealtimeInternalEvent,
  serializeRealtimeInternalEvent,
} from "./realtime.utils.ts";
import {
  realtimeNotificationChannel,
  type RealtimeInternalEvent,
} from "./realtime.types.ts";

type RealtimeNotificationSubscription = {
  unlisten: () => Promise<void>;
};

type RealtimeNotificationClient = {
  notify: (channel: string, payload: string) => Promise<unknown>;
  listen: (
    channel: string,
    onNotify: (payload: string) => void,
  ) => Promise<RealtimeNotificationSubscription>;
};

export type RealtimeEventSubscription = {
  close: () => Promise<void>;
};

export class RealtimeRepository {
  constructor(private client?: RealtimeNotificationClient) {}

  async publishInternalEvent(event: RealtimeInternalEvent) {
    const client = await this.getClient();

    await client.notify(
      realtimeNotificationChannel,
      serializeRealtimeInternalEvent(event),
    );
  }

  async listenToInternalEvents(
    onEvent: (event: RealtimeInternalEvent) => void,
  ): Promise<RealtimeEventSubscription> {
    const client = await this.getClient();
    const subscription = await client.listen(
      realtimeNotificationChannel,
      (payload) => {
        const event = parseRealtimeInternalEvent(payload);

        if (event) {
          onEvent(event);
        }
      },
    );

    return {
      close: () => subscription.unlisten(),
    };
  }

  private async getClient() {
    if (!this.client) {
      const { postgresClient } = await import("../../db/client.ts");

      this.client = postgresClient;
    }

    return this.client;
  }
}

export const realtimeRepository = new RealtimeRepository();

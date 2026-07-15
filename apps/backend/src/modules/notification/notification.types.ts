export type AccountSignedUpNotification = {
  email: string;
  name: string | null;
  occurredAt: Date;
  userId: string;
};

export interface NotificationPublisher {
  notifyAccountSignedUp(input: AccountSignedUpNotification): void;
}

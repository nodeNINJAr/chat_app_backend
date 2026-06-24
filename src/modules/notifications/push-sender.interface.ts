export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushSender {
  send(
    pushToken: string,
    platform: 'ios' | 'android' | 'web',
    payload: PushPayload,
  ): Promise<void>;
}

export const PUSH_SENDER = 'PUSH_SENDER';

export interface ChannelMessage {
  content: string;
  senderId: string;
  channel: "web" | "sms" | "email";
  metadata?: Record<string, unknown>;
}

export interface ChannelAdapter {
  receiveMessage(raw: unknown): ChannelMessage;
  sendMessage(to: string, content: string): Promise<void>;
}

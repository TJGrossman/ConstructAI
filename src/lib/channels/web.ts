import { ChannelAdapter, ChannelMessage } from "./types";

export class WebChannelAdapter implements ChannelAdapter {
  receiveMessage(raw: unknown): ChannelMessage {
    const data = raw as { content: string; senderId: string };
    return {
      content: data.content,
      senderId: data.senderId,
      channel: "web",
    };
  }

  async sendMessage(_to: string, _content: string): Promise<void> {
    // Web messages are returned via HTTP response, no push needed
  }
}

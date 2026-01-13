
/**
 * In a real production app, this would be a WebSocket / Socket.io server.
 * For this demo, we use BroadcastChannel to allow two tabs in the same browser
 * to find each other and establish a WebRTC connection.
 */

type SignalingMessage = {
  type: 'offer' | 'answer' | 'candidate' | 'discovery' | 'found';
  from: string;
  to?: string;
  payload?: any;
};

export class SignalingService {
  private channel: BroadcastChannel;
  private onMessageCallback: (msg: SignalingMessage) => void;
  public userId: string;

  constructor(userId: string, onMessage: (msg: SignalingMessage) => void) {
    this.userId = userId;
    this.channel = new BroadcastChannel('anon_chat_signaling');
    this.onMessageCallback = onMessage;
    this.channel.onmessage = (event) => {
      const msg = event.data as SignalingMessage;
      if (msg.to === this.userId || !msg.to) {
        if (msg.from !== this.userId) {
          this.onMessageCallback(msg);
        }
      }
    };
  }

  send(msg: Omit<SignalingMessage, 'from'>) {
    this.channel.postMessage({ ...msg, from: this.userId });
  }

  close() {
    this.channel.close();
  }
}

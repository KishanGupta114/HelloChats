
import Peer from 'peerjs';

export type SignalingMessage = {
  type: 'chat' | 'system' | 'ai_response';
  from: string;
  text: string;
  timestamp: number;
};

export class SignalingService {
  public peer: Peer;
  public userId: string;
  private connection: any = null;
  private onMessageCallback: (msg: SignalingMessage) => void;
  private onPeerConnectedCallback: (peerId: string, metadata: any) => void;

  constructor(
    userId: string, 
    onMessage: (msg: SignalingMessage) => void,
    onPeerConnected: (peerId: string, metadata: any) => void
  ) {
    this.userId = userId;
    this.onMessageCallback = onMessage;
    this.onPeerConnectedCallback = onPeerConnected;

    // Initialize PeerJS with a random ID or the provided userId
    this.peer = new Peer(this.userId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    this.peer.on('connection', (conn) => {
      this.connection = conn;
      this.setupConnectionListeners(conn);
      this.onPeerConnectedCallback(conn.peer, conn.metadata);
    });
  }

  private setupConnectionListeners(conn: any) {
    conn.on('data', (data: any) => {
      this.onMessageCallback(data as SignalingMessage);
    });
    conn.on('close', () => {
      this.connection = null;
    });
  }

  connectToPeer(peerId: string, metadata: any) {
    const conn = this.peer.connect(peerId, { metadata });
    this.connection = conn;
    this.setupConnectionListeners(conn);
  }

  send(text: string) {
    if (this.connection && this.connection.open) {
      const msg: SignalingMessage = {
        type: 'chat',
        from: this.userId,
        text,
        timestamp: Date.now()
      };
      this.connection.send(msg);
      return msg;
    }
    return null;
  }

  close() {
    this.peer.destroy();
  }
}

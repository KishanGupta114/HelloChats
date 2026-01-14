
import Peer from 'peerjs';

export type SignalingMessage = {
  type: 'chat' | 'system';
  from: string;
  text: string;
  timestamp: number;
};

export class SignalingService {
  public peer: Peer | null = null;
  public userId: string;
  public connection: any = null;
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
    this.initPeer(userId);
  }

  private initPeer(id: string) {
    if (this.peer) this.peer.destroy();
    
    this.peer = new Peer(id, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    this.peer.on('connection', (conn) => {
      if (this.connection) {
        conn.close(); // Only 1-on-1
        return;
      }
      this.connection = conn;
      this.setupConnectionListeners(conn);
      this.onPeerConnectedCallback(conn.peer, conn.metadata);
    });

    this.peer.on('error', (err) => {
      console.warn('Peer error:', err.type);
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

  async connectToPeer(peerId: string, metadata: any): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.peer || this.peer.destroyed) return resolve(false);

      const conn = this.peer.connect(peerId, { metadata, serialization: 'json' });
      
      const timeout = setTimeout(() => {
        conn.close();
        resolve(false);
      }, 2500);

      conn.on('open', () => {
        clearTimeout(timeout);
        this.connection = conn;
        this.setupConnectionListeners(conn);
        this.onPeerConnectedCallback(peerId, metadata);
        resolve(true);
      });

      conn.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
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
    if (this.connection) this.connection.close();
    if (this.peer) this.peer.destroy();
  }
}

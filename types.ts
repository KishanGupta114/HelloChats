
export enum View {
  LANDING = 'LANDING',
  SEARCHING = 'SEARCHING',
  CHAT = 'CHAT',
  ADMIN = 'ADMIN'
}

export interface User {
  id: string;
  username: string;
  interests: string[];
  language: string;
  region: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  type: 'text' | 'system' | 'media';
  status?: 'sent' | 'read';
  mediaUrl?: string;
}

export interface MatchSession {
  peerId: string;
  startTime: number;
  status: 'active' | 'ended' | 'reporting';
}

export interface AnalyticsData {
  sessions: number;
  activeUsers: number;
  reportCount: number;
  safetyScore: number;
}

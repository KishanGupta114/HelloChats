
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Message } from '../types';
import { SignalingService, SignalingMessage } from '../services/signaling';
import { geminiService } from '../services/gemini';
import { generateId, formatTimestamp } from '../utils';

interface Props {
  user: User;
  onExit: () => void;
}

const SLOT_COUNT = 10;

const ChatRoom: React.FC<Props> = ({ user, onExit }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<'searching' | 'connected' | 'disconnected'>('searching');
  const [searchMode, setSearchMode] = useState<'Interest' | 'Global'>('Interest');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [peerData, setPeerData] = useState<any>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const signalingRef = useRef<SignalingService | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addSystemMessage = (text: string) => {
    setMessages(prev => [...prev, {
      id: generateId(),
      senderId: 'system',
      text,
      timestamp: Date.now(),
      type: 'system'
    }]);
  };

  const handleIncomingCall = useCallback((call: any) => {
    if (localStreamRef.current) {
      call.answer(localStreamRef.current);
      call.on('stream', (remoteStream: MediaStream) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      });
    }
  }, []);

  const startMatching = useCallback(async () => {
    try {
      // 1. Setup Media
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // 2. Interest Match Attempt
      const interest = user.interests[0]?.toLowerCase() || 'global';
      
      // We generate a temp ID to scan others
      const scannerId = `scanner-${generateId()}`;
      const sig = new SignalingService(
        scannerId,
        (msg) => setMessages(prev => [...prev, { id: generateId(), senderId: msg.from, text: msg.text, timestamp: msg.timestamp, type: 'text' }]),
        (peerId, metadata) => {
          setStatus('connected');
          setPeerData(metadata);
        }
      );
      signalingRef.current = sig;

      const tryConnectToPool = async (poolName: string) => {
        for (let i = 1; i <= SLOT_COUNT; i++) {
          const targetId = `anonchat-${poolName}-slot-${i}`;
          console.log(`Searching: ${targetId}`);
          const success = await sig.connectToPeer(targetId, { username: user.username, interests: user.interests });
          if (success) {
            // Found a host! Call them.
            const call = sig.peer?.call(targetId, localStreamRef.current!);
            call?.on('stream', (remoteStream) => {
              if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
            });
            return true;
          }
        }
        return false;
      };

      // Try Interest first
      let matched = await tryConnectToPool(interest);
      
      if (!matched && interest !== 'global') {
        setSearchMode('Global');
        matched = await tryConnectToPool('global');
      }

      if (!matched) {
        // 3. No one to call? BECOME THE HOST.
        // Try to occupy a slot 1-10 in the global pool
        sig.close(); // Close scanner
        
        let hostId = '';
        for (let i = 1; i <= SLOT_COUNT; i++) {
          const potId = `anonchat-global-slot-${i}`;
          // In a real app, PeerJS would throw an error if ID is taken.
          // We'll try to become this ID.
          hostId = potId;
          break; // For this demo, we assume first available or just pick one
        }

        // Final Host Identity
        signalingRef.current = new SignalingService(
          `anonchat-global-slot-${Math.floor(Math.random() * SLOT_COUNT) + 1}`,
          (msg) => setMessages(prev => [...prev, { id: generateId(), senderId: msg.from, text: msg.text, timestamp: msg.timestamp, type: 'text' }]),
          (peerId, metadata) => {
            setStatus('connected');
            setPeerData(metadata);
            addSystemMessage('Stranger joined your room!');
          }
        );

        signalingRef.current.peer?.on('call', handleIncomingCall);
        addSystemMessage('Waiting for someone to join...');
      }

    } catch (err) {
      addSystemMessage('Camera/Mic permission denied.');
    }
  }, [user.username, user.interests, handleIncomingCall]);

  useEffect(() => {
    startMatching();
    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      signalingRef.current?.close();
    };
  }, [startMatching]);

  const sendMessage = async () => {
    if (!inputText.trim() || status !== 'connected') return;
    const text = inputText;
    setInputText('');

    const newMsg: Message = { id: generateId(), senderId: user.id, text, timestamp: Date.now(), type: 'text' };
    setMessages(prev => [...prev, newMsg]);
    signalingRef.current?.send(text);
    
    // Safety
    const safety = await geminiService.scanText(text);
    if (!safety.isSafe) addSystemMessage('Warning: Keep it friendly.');
  };

  return (
    <div className="h-full w-full flex flex-col md:flex-row bg-slate-950 overflow-hidden">
      <div className="h-[45vh] md:h-full md:flex-1 relative flex flex-col bg-black">
        <div className="flex-1 grid grid-cols-2 gap-[1px] bg-slate-800">
          <div className="relative bg-slate-900 flex items-center justify-center overflow-hidden">
            {status === 'searching' ? (
              <div className="text-center space-y-4">
                <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto"></div>
                <div className="space-y-1">
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-[0.2em] animate-pulse">Searching {searchMode}</p>
                  <p className="text-[8px] text-slate-500 uppercase tracking-widest">Finding humans...</p>
                </div>
              </div>
            ) : (
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            )}
            <div className="absolute bottom-3 left-3 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[9px] font-bold text-white border border-white/10">
              {status === 'connected' ? (peerData?.username || 'Stranger') : 'Searching...'}
            </div>
          </div>

          <div className="relative bg-slate-900 flex items-center justify-center overflow-hidden">
            <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover scale-x-[-1] ${isVideoOff ? 'hidden' : ''}`} />
            {isVideoOff && <div className="text-slate-700 text-[10px] font-bold">CAMERA OFF</div>}
            <div className="absolute bottom-3 right-3 px-3 py-1 rounded-lg bg-indigo-600/60 backdrop-blur-md text-[9px] font-bold text-white border border-white/10">
              You
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-30">
          <button onClick={() => setIsMuted(!isMuted)} className={`w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/10 transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-sm`}></i>
          </button>
          <button onClick={() => window.location.reload()} className="h-10 px-6 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded-xl shadow-xl shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95">
            SKIP <i className="fa-solid fa-forward"></i>
          </button>
          <button onClick={() => setIsVideoOff(!isVideoOff)} className={`w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/10 transition-all ${isVideoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            <i className={`fa-solid ${isVideoOff ? 'fa-video-slash' : 'fa-video'} text-sm`}></i>
          </button>
        </div>
      </div>

      <div className="flex-1 md:w-[420px] flex flex-col bg-slate-950 border-l border-white/5">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.senderId === 'system' ? 'items-center' : msg.senderId === user.id ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm ${
                msg.senderId === 'system' ? 'bg-slate-900/50 text-slate-500 text-[10px] font-bold border border-slate-800' :
                msg.senderId === user.id ? 'bg-indigo-600 text-white rounded-br-none' : 
                'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-slate-900/50 border-t border-white/5 safe-bottom">
          <div className="flex items-center gap-2 bg-black/40 border border-slate-800 rounded-xl p-1 focus-within:border-indigo-500/50 transition-colors">
            <input 
              type="text" 
              placeholder={status === 'connected' ? "Say hello..." : "Waiting for match..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              disabled={status !== 'connected'}
              className="flex-1 bg-transparent border-none outline-none text-sm px-3 py-2 text-white placeholder:text-slate-600 disabled:opacity-30"
            />
            <button onClick={sendMessage} disabled={!inputText.trim() || status !== 'connected'} className="w-9 h-9 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-lg flex items-center justify-center transition-all">
              <i className="fa-solid fa-arrow-up text-xs"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;


import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Message } from '../types';
import { SignalingService, SignalingMessage } from '../services/signaling';
import { geminiService } from '../services/gemini';
import { generateId, formatTimestamp } from '../utils';

interface Props {
  user: User;
  onExit: () => void;
}

const GLOBAL_SLOTS = 20; // Expanded slots for better discovery
const INTEREST_SLOTS = 10;

const ChatRoom: React.FC<Props> = ({ user, onExit }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<'searching' | 'connected' | 'disconnected'>('searching');
  const [searchPool, setSearchPool] = useState<string>('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [peerData, setPeerData] = useState<any>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const signalingRef = useRef<SignalingService | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const isMatchingRef = useRef(false);

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
      setStatus('connected');
    }
  }, []);

  const cleanCurrentSession = useCallback(() => {
    signalingRef.current?.close();
    signalingRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setMessages([]);
    setStatus('searching');
    setPeerData(null);
  }, []);

  const startMatching = useCallback(async () => {
    if (isMatchingRef.current) return;
    isMatchingRef.current = true;
    
    cleanCurrentSession();
    
    try {
      // Setup Media if not already active
      if (!localStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }

      const interest = user.interests[0]?.toLowerCase();
      const pools = interest ? [interest, 'global'] : ['global'];
      
      let matched = false;

      for (const pool of pools) {
        if (matched) break;
        setSearchPool(pool.toUpperCase());
        
        // 1. Try to call existing slots
        const slots = pool === 'global' ? GLOBAL_SLOTS : INTEREST_SLOTS;
        // Shuffle slots for better distribution
        const slotIndices = Array.from({length: slots}, (_, i) => i + 1).sort(() => Math.random() - 0.5);

        const tempScannerId = `scanner-${generateId()}`;
        const scanner = new SignalingService(
          tempScannerId,
          (msg) => setMessages(prev => [...prev, { id: generateId(), senderId: msg.from, text: msg.text, timestamp: msg.timestamp, type: 'text' }]),
          (peerId, metadata) => {
            setPeerData(metadata);
            setStatus('connected');
            addSystemMessage('Matched with a human!');
          }
        );

        for (const slot of slotIndices) {
          const targetId = `v5-pool-${pool}-slot-${slot}`;
          const success = await scanner.connectToPeer(targetId, { username: user.username, interests: user.interests });
          if (success) {
            signalingRef.current = scanner;
            const call = scanner.peer?.call(targetId, localStreamRef.current!);
            call?.on('stream', (remoteStream) => {
              if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
            });
            matched = true;
            break;
          }
        }

        if (!matched) scanner.close();
      }

      if (!matched) {
        // 2. Become a host in Global pool if no interest match was found
        const randomSlot = Math.floor(Math.random() * GLOBAL_SLOTS) + 1;
        const hostId = `v5-pool-global-slot-${randomSlot}`;
        
        const host = new SignalingService(
          hostId,
          (msg) => setMessages(prev => [...prev, { id: generateId(), senderId: msg.from, text: msg.text, timestamp: msg.timestamp, type: 'text' }]),
          (peerId, metadata) => {
            setPeerData(metadata);
            setStatus('connected');
            addSystemMessage('Stranger connected to you!');
          },
          () => {
             // ID Taken callback: Someone else is hosting this slot! 
             // Restart and we'll probably catch them in the "scanner" phase next loop.
             isMatchingRef.current = false;
             setTimeout(startMatching, 500);
          }
        );

        signalingRef.current = host;
        host.peer?.on('call', handleIncomingCall);
        setSearchPool('GLOBAL WAITING');
        addSystemMessage('You are now live. Waiting for someone to join...');
      }

    } catch (err) {
      addSystemMessage('Camera/Mic access is required.');
    } finally {
      isMatchingRef.current = false;
    }
  }, [user.username, user.interests, handleIncomingCall, cleanCurrentSession]);

  useEffect(() => {
    startMatching();
    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      signalingRef.current?.close();
    };
  }, []);

  const handleNext = () => {
    startMatching();
  };

  const sendMessage = async () => {
    if (!inputText.trim() || status !== 'connected') return;
    const text = inputText;
    setInputText('');

    const newMsg: Message = { id: generateId(), senderId: user.id, text, timestamp: Date.now(), type: 'text' };
    setMessages(prev => [...prev, newMsg]);
    signalingRef.current?.send(text);
    
    // Safety check in background
    geminiService.scanText(text).then(safety => {
      if (!safety.isSafe) addSystemMessage('Warning: Your message was flagged for safety.');
    });
  };

  return (
    <div className="h-full w-full flex flex-col md:flex-row bg-slate-950 overflow-hidden">
      <div className="h-[45vh] md:h-full md:flex-1 relative flex flex-col bg-black">
        <div className="flex-1 grid grid-cols-2 gap-[1px] bg-slate-800">
          <div className="relative bg-slate-900 flex items-center justify-center overflow-hidden">
            {status === 'searching' ? (
              <div className="text-center space-y-4">
                <div className="w-12 h-12 border-2 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin mx-auto"></div>
                <div className="space-y-1">
                  <p className="text-[10px] text-indigo-400 font-black tracking-[0.3em] uppercase animate-pulse">{searchPool}</p>
                  <p className="text-[8px] text-slate-500 uppercase tracking-widest">Looking for humans...</p>
                </div>
              </div>
            ) : (
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            )}
            <div className="absolute top-4 left-4 flex items-center gap-2">
               <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
               <span className="text-[8px] font-black uppercase text-white/50 tracking-widest">{status}</span>
            </div>
            <div className="absolute bottom-3 left-3 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[9px] font-bold text-white border border-white/10">
              {status === 'connected' ? (peerData?.username || 'Stranger') : 'System'}
            </div>
          </div>

          <div className="relative bg-slate-900 flex items-center justify-center overflow-hidden">
            <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover scale-x-[-1] ${isVideoOff ? 'hidden' : ''}`} />
            {isVideoOff && <div className="text-slate-800 text-[10px] font-black tracking-widest">CAMERA INACTIVE</div>}
            <div className="absolute bottom-3 right-3 px-3 py-1 rounded-lg bg-indigo-600/60 backdrop-blur-md text-[9px] font-bold text-white border border-white/10">
              You
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 z-40">
          <button 
            onClick={() => setIsMuted(!isMuted)} 
            className={`w-11 h-11 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/10 transition-all ${isMuted ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-sm`}></i>
          </button>
          
          <button 
            onClick={handleNext} 
            className="h-11 px-8 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black rounded-2xl shadow-2xl shadow-indigo-600/40 flex items-center gap-3 transition-all active:scale-95 group"
          >
            NEXT STRANGER
            <i className="fa-solid fa-angles-right text-[10px] group-hover:translate-x-1 transition-transform"></i>
          </button>
          
          <button 
            onClick={() => setIsVideoOff(!isVideoOff)} 
            className={`w-11 h-11 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/10 transition-all ${isVideoOff ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            <i className={`fa-solid ${isVideoOff ? 'fa-video-slash' : 'fa-video'} text-sm`}></i>
          </button>
        </div>
      </div>

      <div className="flex-1 md:w-[440px] flex flex-col bg-slate-950 border-l border-white/5 relative">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {messages.length === 0 && status === 'connected' && (
            <div className="flex flex-col items-center justify-center h-full opacity-20 pointer-events-none">
              <i className="fa-solid fa-comments text-4xl mb-2"></i>
              <span className="text-[10px] font-black uppercase tracking-widest">Chat is empty</span>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.senderId === 'system' ? 'items-center' : msg.senderId === user.id ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm animate-in fade-in slide-in-from-bottom-1 ${
                msg.senderId === 'system' ? 'bg-slate-900/50 text-slate-500 text-[9px] font-black uppercase tracking-tighter border border-slate-800' :
                msg.senderId === user.id ? 'bg-indigo-600 text-white rounded-br-none shadow-lg shadow-indigo-600/10' : 
                'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700 shadow-lg'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-slate-900/40 border-t border-white/5 safe-bottom">
          <div className="flex items-center gap-2 bg-black/40 border border-slate-800 rounded-2xl p-1.5 focus-within:border-indigo-500/50 transition-all">
            <input 
              type="text" 
              placeholder={status === 'connected' ? "Type your message..." : "Waiting for human match..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              disabled={status !== 'connected'}
              className="flex-1 bg-transparent border-none outline-none text-sm px-3 py-1.5 text-white placeholder:text-slate-700 disabled:opacity-20"
            />
            <button 
              onClick={sendMessage} 
              disabled={!inputText.trim() || status !== 'connected'} 
              className="w-10 h-10 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl flex items-center justify-center transition-all active:scale-90"
            >
              <i className="fa-solid fa-paper-plane text-xs"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;

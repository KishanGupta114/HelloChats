
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Message } from '../types';
import { SignalingService, SignalingMessage } from '../services/signaling';
import { geminiService } from '../services/gemini';
import { generateId, formatTimestamp } from '../utils';

interface Props {
  user: User;
  onExit: () => void;
}

const ChatRoom: React.FC<Props> = ({ user, onExit }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<'searching' | 'connected' | 'disconnected'>('searching');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const [iceBreakers, setIceBreakers] = useState<string[]>([]);
  const [peerData, setPeerData] = useState<any>(null);
  const [isAiPartner, setIsAiPartner] = useState(false);

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

  const startAiMatch = useCallback(async () => {
    if (status !== 'searching') return;
    setIsAiPartner(true);
    setStatus('connected');
    setPeerData({ username: 'Stranger (AI)', interests: user.interests });
    addSystemMessage('Matched with a verified stranger.');
    const breakers = await geminiService.getIceBreakers(user.interests);
    setIceBreakers(breakers);
  }, [status, user.interests]);

  useEffect(() => {
    let searchTimeout: number;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        signalingRef.current = new SignalingService(
          user.id,
          (msg) => {
            setMessages(prev => [...prev, {
              id: generateId(),
              senderId: msg.from,
              text: msg.text,
              timestamp: msg.timestamp,
              type: 'text'
            }]);
          },
          (peerId, metadata) => {
            setStatus('connected');
            setPeerData(metadata);
            addSystemMessage(`Connected to ${metadata.username}`);
          }
        );

        signalingRef.current.peer.on('call', handleIncomingCall);

        // Fallback to AI if no real peer is found in 15 seconds
        searchTimeout = window.setTimeout(startAiMatch, 15000);

      } catch (err) {
        addSystemMessage('Camera/Mic access is required for video chat.');
      }
    };

    init();

    return () => {
      clearTimeout(searchTimeout);
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      signalingRef.current?.close();
    };
  }, [user.id, handleIncomingCall, startAiMatch]);

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');

    const newMsg: Message = {
      id: generateId(),
      senderId: user.id,
      text,
      timestamp: Date.now(),
      type: 'text'
    };

    setMessages(prev => [...prev, newMsg]);

    if (isAiPartner) {
      // Simulate AI typing delay
      setTimeout(async () => {
        const history = messages.map(m => ({ role: m.senderId === user.id ? 'user' : 'model', text: m.text }));
        const aiResponse = await geminiService.getAIResponse(history, user.interests);
        setMessages(prev => [...prev, {
          id: generateId(),
          senderId: 'stranger',
          text: aiResponse,
          timestamp: Date.now(),
          type: 'text'
        }]);
      }, 1500 + Math.random() * 2000);
    } else {
      signalingRef.current?.send(text);
    }

    // Safety scan
    const safety = await geminiService.scanText(text);
    if (!safety.isSafe) addSystemMessage(`Safety Warning: ${safety.reason || 'Unsafe content'}`);
  };

  const handleNext = () => {
    window.location.reload(); // Simplest way to reset the PeerJS state for a new search
  };

  return (
    <div className="h-full w-full flex flex-col md:flex-row bg-slate-950 overflow-hidden">
      <div className="h-[35vh] md:h-full md:flex-1 relative flex flex-col bg-black border-b md:border-b-0 md:border-r border-slate-800">
        <div className="flex-1 grid grid-cols-2 gap-[1px]">
          <div className="relative bg-slate-900 flex items-center justify-center overflow-hidden">
            {status === 'searching' ? (
              <div className="flex flex-col items-center gap-4 animate-pulse">
                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Finding Match...</span>
              </div>
            ) : (
              <video ref={remoteVideoRef} autoPlay playsInline className={`w-full h-full object-cover ${isBlurred ? 'blur-3xl scale-110' : ''}`} />
            )}
            <div className="absolute bottom-3 left-3 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-bold text-white border border-white/10">
              {status === 'connected' ? (peerData?.username || 'Stranger') : 'Lobby'}
            </div>
            {isAiPartner && status === 'connected' && (
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-indigo-500/80 text-[8px] font-bold text-white uppercase tracking-widest">
                AI Match
              </div>
            )}
          </div>

          <div className="relative bg-slate-900 flex items-center justify-center overflow-hidden">
            <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover scale-x-[-1] ${isVideoOff ? 'hidden' : ''}`} />
            {isVideoOff && <div className="text-slate-700 text-xs font-bold uppercase">Camera Off</div>}
            <div className="absolute bottom-3 right-3 px-3 py-1 rounded-lg bg-indigo-600/60 backdrop-blur-md text-[10px] font-bold text-white border border-white/10">
              You
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-30">
          <button onClick={() => setIsMuted(!isMuted)} className={`w-12 h-12 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/10 transition-all ${isMuted ? 'bg-red-500 text-white shadow-xl shadow-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
          </button>
          <button onClick={handleNext} className="h-12 px-8 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-2xl shadow-2xl shadow-indigo-600/40 transition-all active:scale-95 flex items-center gap-2">
            NEXT <i className="fa-solid fa-forward"></i>
          </button>
          <button onClick={() => setIsVideoOff(!isVideoOff)} className={`w-12 h-12 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/10 transition-all ${isVideoOff ? 'bg-red-500 text-white shadow-xl shadow-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            <i className={`fa-solid ${isVideoOff ? 'fa-video-slash' : 'fa-video'}`}></i>
          </button>
        </div>
      </div>

      <div className="flex-1 md:w-[400px] flex flex-col bg-slate-950/80 backdrop-blur-md">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.senderId === 'system' ? 'items-center' : msg.senderId === user.id ? 'items-end' : 'items-start'}`}>
              {msg.senderId === 'system' ? (
                <div className="bg-slate-900/50 text-slate-500 text-[9px] px-3 py-1.5 rounded-full border border-slate-800 font-bold uppercase tracking-widest my-2">
                  {msg.text}
                </div>
              ) : (
                <div className="max-w-[85%] animate-in fade-in slide-in-from-bottom-2">
                  <div className={`px-4 py-2.5 rounded-2xl text-sm ${msg.senderId === user.id ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'}`}>
                    {msg.text}
                  </div>
                  <div className="text-[8px] text-slate-600 mt-1 px-1">{formatTimestamp(msg.timestamp)}</div>
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {status === 'connected' && iceBreakers.length > 0 && (
          <div className="p-3 border-t border-white/5 bg-slate-900/30 overflow-x-auto no-scrollbar flex gap-2">
            {iceBreakers.map((q, i) => (
              <button key={i} onClick={() => { setInputText(q); }} className="flex-shrink-0 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-[10px] px-4 py-2 rounded-xl border border-indigo-500/20 transition-all whitespace-nowrap">
                {q}
              </button>
            ))}
          </div>
        )}

        <div className="p-4 bg-slate-900/50 border-t border-white/5 safe-bottom">
          <div className="flex items-center gap-2 bg-black/40 border border-slate-700 rounded-2xl p-1.5 ring-offset-slate-950 focus-within:ring-2 ring-indigo-500/50">
            <input 
              type="text" 
              placeholder={status === 'connected' ? "Type a message..." : "Waiting for match..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              disabled={status !== 'connected'}
              className="flex-1 bg-transparent border-none outline-none text-sm px-3 text-white disabled:opacity-30"
            />
            <button onClick={sendMessage} disabled={!inputText.trim() || status !== 'connected'} className="w-10 h-10 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl flex items-center justify-center transition-all">
              <i className="fa-solid fa-paper-plane text-xs"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;

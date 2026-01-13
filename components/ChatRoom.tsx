
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Message } from '../types';
import { SignalingService } from '../services/signaling';
import { geminiService } from '../services/gemini';
import { generateId, formatTimestamp, sleep } from '../utils';

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

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const signalingRef = useRef<SignalingService | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const safetyScannerInterval = useRef<number | null>(null);

  const scrollToBottom = () => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const disconnect = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (safetyScannerInterval.current) {
      clearInterval(safetyScannerInterval.current);
    }
    setPeerData(null);
    setStatus('disconnected');
    setMessages(prev => [...prev, {
      id: generateId(),
      senderId: 'system',
      text: 'Partner disconnected.',
      timestamp: Date.now(),
      type: 'system'
    }]);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        signalingRef.current = new SignalingService(user.id, async (msg) => {
          if (msg.type === 'discovery') {
            signalingRef.current?.send({ type: 'found', to: msg.from, payload: { interests: user.interests, username: user.username } });
          } else if (msg.type === 'found' && status === 'searching') {
            setPeerData(msg.payload);
            startConnection(msg.from, stream, true);
          } else if (msg.type === 'offer') {
            setPeerData(msg.payload);
            startConnection(msg.from, stream, false, msg.payload.offer);
          } else if (msg.type === 'answer') {
            if (pcRef.current) {
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.payload));
            }
          } else if (msg.type === 'candidate') {
            if (pcRef.current) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.payload));
            }
          }
        });

        const searchLoop = setInterval(() => {
          if (status === 'searching') {
            signalingRef.current?.send({ type: 'discovery' });
          } else {
            clearInterval(searchLoop);
          }
        }, 3000);

        return () => {
          clearInterval(searchLoop);
          stream.getTracks().forEach(t => t.stop());
          if (signalingRef.current) signalingRef.current.close();
        };
      } catch (err) {
        console.error("Permission denied", err);
        setMessages([{
          id: 'err',
          senderId: 'system',
          text: 'Permissions required for Video Chat.',
          timestamp: Date.now(),
          type: 'system'
        }]);
      }
    };

    init();
  }, [user.id, user.interests, user.username, status]);

  const startConnection = async (peerId: string, stream: MediaStream, isInitiator: boolean, offer?: any) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    pcRef.current = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signalingRef.current?.send({ type: 'candidate', to: peerId, payload: event.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setStatus('connected');
        geminiService.getIceBreakers(user.interests).then(setIceBreakers);
        startSafetyScanner();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        disconnect();
      }
    };

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      signalingRef.current?.send({ 
        type: 'offer', 
        to: peerId, 
        payload: { 
          offer: { type: offer.type, sdp: offer.sdp }, 
          username: user.username, 
          interests: user.interests 
        } 
      });
    } else {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      signalingRef.current?.send({ 
        type: 'answer', 
        to: peerId, 
        payload: { type: answer.type, sdp: answer.sdp } 
      });
    }
  };

  const startSafetyScanner = () => {
    safetyScannerInterval.current = window.setInterval(async () => {
      if (!remoteVideoRef.current || isVideoOff) return;
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 120;
      const ctx = canvas.getContext('2d');
      if (ctx && remoteVideoRef.current) {
        ctx.drawImage(remoteVideoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        const safetyResult = await geminiService.scanFrame(dataUrl);
        if (safetyResult.blurRequired) {
          setIsBlurred(true);
          setMessages(prev => [...prev, {
            id: generateId(),
            senderId: 'system',
            text: 'AI MODERATION: Video blurred.',
            timestamp: Date.now(),
            type: 'system'
          }]);
        }
      }
    }, 20000);
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');

    const msg: Message = {
      id: generateId(),
      senderId: user.id,
      text: text,
      timestamp: Date.now(),
      type: 'text'
    };
    setMessages(prev => [...prev, msg]);
    signalingRef.current?.send({ type: 'found', to: 'ALL', payload: { chat: msg } });

    const safety = await geminiService.scanText(text);
    if (!safety.isSafe) {
      setMessages(prev => [...prev, {
        id: generateId(),
        senderId: 'system',
        text: `Message flagged: ${safety.reason || 'unsafe'}.`,
        timestamp: Date.now(),
        type: 'system'
      }]);
    }
  };

  const handleNext = () => {
    disconnect();
    setStatus('searching');
    setMessages([]);
    setPeerData(null);
  };

  return (
    <div className="h-full w-full flex flex-col md:flex-row bg-slate-950 overflow-hidden">
      {/* Video Section - Compact on mobile, sidebar on desktop */}
      <div className="h-[28vh] md:h-full md:flex-1 relative flex flex-col bg-black border-b md:border-b-0 md:border-r border-slate-800 shrink-0">
        <div className="flex-1 grid grid-cols-2 gap-[1px]">
          {/* Remote Feed */}
          <div className="relative bg-slate-900 flex items-center justify-center overflow-hidden">
            {status === 'searching' ? (
              <div className="flex flex-col items-center gap-2 p-4 text-center">
                <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Searching...</span>
              </div>
            ) : (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover transition-all duration-700 ${isBlurred ? 'blur-2xl' : ''}`}
              />
            )}
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[9px] font-bold text-white border border-white/10 uppercase tracking-tighter">
              {status === 'connected' ? (peerData?.username || 'Stranger') : 'Searching'}
            </div>
            {isBlurred && (
              <button 
                onClick={() => setIsBlurred(false)}
                className="absolute inset-0 z-10 bg-black/40 flex flex-col items-center justify-center text-center p-2"
              >
                <i className="fa-solid fa-eye-slash text-xl text-indigo-400 mb-1"></i>
                <span className="text-[8px] font-bold text-white uppercase tracking-widest">Sensitive Content</span>
                <span className="text-[8px] text-indigo-300 mt-1 underline">Show</span>
              </button>
            )}
          </div>

          {/* Local Feed */}
          <div className="relative bg-slate-900 flex items-center justify-center overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : 'scale-x-[-1]'}`}
            />
            {isVideoOff && (
              <div className="flex flex-col items-center gap-1 text-slate-600">
                <i className="fa-solid fa-video-slash text-sm"></i>
                <span className="text-[8px] font-bold uppercase">Off</span>
              </div>
            )}
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-indigo-600/60 backdrop-blur-md text-[9px] font-bold text-white border border-white/10 uppercase tracking-tighter">
              You
            </div>
          </div>
        </div>

        {/* Video Overlay Controls - Hidden on desktop (placed differently) */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20 md:hidden">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-lg border border-white/10 ${isMuted ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-white/10 text-white'}`}
          >
            <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'} text-sm`}></i>
          </button>
          <button 
            onClick={() => setIsVideoOff(!isVideoOff)}
            className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-lg border border-white/10 ${isVideoOff ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-white/10 text-white'}`}
          >
            <i className={`fa-solid ${isVideoOff ? 'fa-video-slash' : 'fa-video'} text-sm`}></i>
          </button>
          <button 
            onClick={handleNext}
            className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-full shadow-lg shadow-indigo-600/20 active:scale-95 transition-transform"
          >
            NEXT
          </button>
        </div>
      </div>

      {/* Chat Area - Expands on mobile */}
      <div className="flex-1 md:w-96 glass flex flex-col min-h-0 bg-slate-950/50">
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
          {messages.length === 0 && status === 'connected' && (
            <div className="text-center py-10 space-y-2 opacity-50">
              <i className="fa-solid fa-comments text-3xl text-slate-700"></i>
              <p className="text-xs text-slate-500">Say hi to your match!</p>
            </div>
          )}
          
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex flex-col ${msg.senderId === 'system' ? 'items-center' : msg.senderId === user.id ? 'items-end' : 'items-start'}`}
            >
              {msg.senderId === 'system' ? (
                <div className="bg-slate-900/40 text-slate-500 text-[9px] px-3 py-1 rounded-full border border-slate-800 font-bold uppercase tracking-tighter">
                  {msg.text}
                </div>
              ) : (
                <div className="max-w-[80%] space-y-1">
                  <div className={`px-4 py-2 rounded-2xl text-sm ${
                    msg.senderId === user.id 
                      ? 'bg-indigo-600 text-white rounded-br-none shadow-lg shadow-indigo-600/10' 
                      : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700 shadow-sm'
                  }`}>
                    {msg.text}
                  </div>
                  <div className={`text-[8px] text-slate-500 px-1 ${msg.senderId === user.id ? 'text-right' : 'text-left'}`}>
                    {formatTimestamp(msg.timestamp)}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} className="h-2 w-full" />
        </div>

        {/* AI Ice Breakers - Improved Mobile Scroll */}
        {status === 'connected' && iceBreakers.length > 0 && (
          <div className="p-2 md:p-3 bg-slate-900/60 border-t border-slate-800/50">
             <div className="flex items-center gap-2 mb-2 px-1">
                <i className="fa-solid fa-wand-magic-sparkles text-indigo-400 text-[10px]"></i>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">AI Starters</span>
             </div>
             <div className="flex overflow-x-auto gap-2 no-scrollbar pb-1">
                {iceBreakers.map((q, i) => (
                  <button 
                    key={i}
                    onClick={() => { setInputText(q); sendMessage(); }}
                    className="flex-shrink-0 text-left text-[10px] bg-indigo-500/5 hover:bg-indigo-500/15 text-indigo-300/80 px-3 py-1.5 rounded-full border border-indigo-500/20 transition-all whitespace-nowrap active:scale-95"
                  >
                    {q}
                  </button>
                ))}
             </div>
          </div>
        )}

        {/* Desktop Controls (hidden on mobile) */}
        <div className="hidden md:flex p-3 gap-2 border-t border-slate-800">
           <button onClick={() => setIsMuted(!isMuted)} className={`flex-1 py-2 rounded-lg border border-slate-800 text-xs font-bold transition-colors ${isMuted ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'text-slate-400 hover:bg-slate-800'}`}>
             {isMuted ? 'UNMUTE' : 'MUTE'}
           </button>
           <button onClick={() => setIsVideoOff(!isVideoOff)} className={`flex-1 py-2 rounded-lg border border-slate-800 text-xs font-bold transition-colors ${isVideoOff ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'text-slate-400 hover:bg-slate-800'}`}>
             {isVideoOff ? 'CAM ON' : 'CAM OFF'}
           </button>
           <button onClick={handleNext} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-colors">
             NEXT
           </button>
        </div>

        {/* Chat Input */}
        <div className="p-3 md:p-4 bg-slate-900/90 border-t border-slate-800 safe-bottom">
          <div className="flex items-center gap-2 bg-black border border-slate-700/50 rounded-2xl p-1.5 focus-within:ring-2 ring-indigo-500/50 ring-offset-2 ring-offset-slate-950 transition-all">
            <input 
              type="text" 
              placeholder="Send message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              disabled={status !== 'connected'}
              className="flex-1 bg-transparent border-none outline-none text-sm py-1.5 px-3 text-slate-200 placeholder-slate-600 disabled:opacity-50"
            />
            <button 
              onClick={sendMessage}
              disabled={status !== 'connected' || !inputText.trim()}
              className="w-9 h-9 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800/50 disabled:text-slate-700 text-white rounded-xl flex items-center justify-center transition-all active:scale-90"
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

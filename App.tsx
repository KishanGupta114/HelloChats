
import React, { useState, useEffect } from 'react';
import { View, User } from './types';
import Landing from './components/Landing';
import ChatRoom from './components/ChatRoom';
import AdminDashboard from './components/AdminDashboard';
import { generateId } from './utils';

const App: React.FC = () => {
  const [view, setView] = useState<View>(View.LANDING);
  const [user, setUser] = useState<User | null>(null);

  const handleStartChat = (interests: string[]) => {
    const newUser: User = {
      id: generateId(),
      username: `Anon-${Math.floor(Math.random() * 9000) + 1000}`,
      interests: interests,
      language: 'English',
      region: 'Global'
    };
    setUser(newUser);
    setView(View.CHAT);
  };

  const handleAdminAccess = () => {
    setView(View.ADMIN);
  };

  const navigateHome = () => {
    setView(View.LANDING);
    // Optionally clear user or keep session
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 flex flex-col font-sans">
      {/* Header - Fixed height */}
      <header className="h-16 flex-shrink-0 flex items-center justify-between px-4 md:px-8 glass z-[100] border-b border-white/5">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={navigateHome}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-xl shadow-indigo-600/20 group-hover:scale-110 transition-transform">
            <i className="fa-solid fa-comment-dots text-white text-xl"></i>
          </div>
          <h1 className="text-xl font-black tracking-tighter bg-gradient-to-br from-white via-slate-200 to-slate-400 bg-clip-text text-transparent hidden sm:block">
            AnonChat <span className="text-indigo-500">Pro</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-3 md:gap-4">
          <button 
            onClick={handleAdminAccess}
            className="text-slate-400 hover:text-white transition-all text-[10px] md:text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-xl bg-slate-800/40 border border-white/5 hover:bg-slate-800"
          >
            <i className="fa-solid fa-shield-halved md:mr-2"></i>
            <span className="hidden md:inline">Console</span>
          </button>
          
          {user && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-600/10 border border-indigo-500/20 shadow-inner">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
              <span className="text-xs font-bold text-indigo-300 truncate max-w-[80px] md:max-w-none">{user.username}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area - Each view manages its own scroll container */}
      <main className="flex-1 relative overflow-hidden bg-slate-950">
        {view === View.LANDING && (
          <Landing onStart={handleStartChat} />
        )}

        {view === View.CHAT && user && (
          <ChatRoom user={user} onExit={navigateHome} />
        )}

        {view === View.ADMIN && (
          <AdminDashboard onClose={navigateHome} />
        )}
      </main>

      {/* Footer / Status Bar - Compact */}
      <footer className="h-8 flex-shrink-0 glass border-t border-white/5 flex items-center justify-between px-6 text-[8px] md:text-[9px] text-slate-500 uppercase tracking-widest z-[100] font-bold">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><i className="fa-solid fa-lock text-emerald-500"></i> Encrypted</span>
          <span className="hidden sm:inline flex items-center gap-1"><i className="fa-solid fa-server"></i> Node: Global-01</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-indigo-500">AI Shield Active</span>
          <span className="hidden sm:inline">18+ ONLY</span>
        </div>
      </footer>
    </div>
  );
};

export default App;

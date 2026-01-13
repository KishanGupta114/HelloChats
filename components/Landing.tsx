
import React, { useState } from 'react';

interface Props {
  onStart: (interests: string[]) => void;
}

const PRESET_INTERESTS = ['Gaming', 'Music', 'Tech', 'Anime', 'Art', 'Sports', 'Cooking', 'Travel', 'Movies', 'AI'];

const Landing: React.FC<Props> = ({ onStart }) => {
  const [interests, setInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter(i => i !== interest));
    } else {
      setInterests([...interests, interest]);
    }
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInterest.trim() && !interests.includes(customInterest.trim())) {
      setInterests([...interests, customInterest.trim()]);
      setCustomInterest('');
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-[radial-gradient(circle_at_50%_50%,rgba(17,24,39,1)_0%,rgba(2,6,23,1)_100%)]">
      <div className="min-h-full flex flex-col items-center justify-center p-4 md:p-12">
        <div className="max-w-3xl w-full space-y-8 md:space-y-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="space-y-4">
            <h2 className="text-4xl md:text-7xl font-extrabold tracking-tight leading-tight">
              Meet Anyone. <br />
              <span className="text-indigo-500">Stay Safe.</span>
            </h2>
            <p className="text-sm md:text-lg text-slate-400 max-w-xl mx-auto px-4">
              The world's most secure anonymous chat. Connect instantly based on your interests. AI-powered safety, WebRTC video, and zero logs.
            </p>
          </div>

          <div className="glass rounded-2xl md:rounded-3xl p-5 md:p-10 space-y-6 shadow-2xl shadow-indigo-500/10 mx-2">
            <div className="space-y-4">
              <h3 className="text-[10px] md:text-sm font-semibold text-slate-300 uppercase tracking-widest flex items-center justify-center gap-2">
                <i className="fa-solid fa-hashtag text-indigo-500"></i>
                Interests
              </h3>
              <div className="flex flex-wrap justify-center gap-2 md:gap-3 max-h-40 md:max-h-none overflow-y-auto p-1">
                {PRESET_INTERESTS.map(interest => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-medium transition-all border ${
                      interests.includes(interest)
                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/30'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>

              <form onSubmit={handleAddCustom} className="flex gap-2 max-w-sm mx-auto">
                <input
                  type="text"
                  placeholder="Add your own..."
                  value={customInterest}
                  onChange={(e) => setCustomInterest(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
                <button className="bg-slate-800 hover:bg-slate-700 p-2 rounded-xl transition-colors">
                  <i className="fa-solid fa-plus text-sm"></i>
                </button>
              </form>
            </div>

            <div className="pt-2 md:pt-4">
              <button
                onClick={() => onStart(interests)}
                className="group relative inline-flex w-full md:w-auto items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-8 md:px-12 rounded-xl md:rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-indigo-600/20"
              >
                <i className="fa-solid fa-bolt text-indigo-300 animate-pulse"></i>
                Start Chatting
                <i className="fa-solid fa-arrow-right opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all"></i>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 text-left px-2 md:px-0 pb-10">
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 flex md:flex-col items-center md:items-start gap-4 md:gap-0">
              <i className="fa-solid fa-lock text-emerald-500 md:mb-2 text-xl md:text-base"></i>
              <div>
                <h4 className="font-bold text-white text-sm mb-1">E2E Encrypted</h4>
                <p className="text-[10px] md:text-xs text-slate-500">Your conversations are private and encrypted. We never see your messages.</p>
              </div>
            </div>
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 flex md:flex-col items-center md:items-start gap-4 md:gap-0">
              <i className="fa-solid fa-robot text-indigo-500 md:mb-2 text-xl md:text-base"></i>
              <div>
                <h4 className="font-bold text-white text-sm mb-1">AI Moderated</h4>
                <p className="text-[10px] md:text-xs text-slate-500">Gemini scans for harmful content in real-time to keep everyone safe.</p>
              </div>
            </div>
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 flex md:flex-col items-center md:items-start gap-4 md:gap-0">
              <i className="fa-solid fa-ghost text-purple-500 md:mb-2 text-xl md:text-base"></i>
              <div>
                <h4 className="font-bold text-white text-sm mb-1">Fully Anonymous</h4>
                <p className="text-[10px] md:text-xs text-slate-500">No email, no profile, no footprint. Just you and a new friend.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;


import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const MOCK_TRAFFIC = [
  { name: '00:00', users: 1200, reports: 12 },
  { name: '04:00', users: 800, reports: 5 },
  { name: '08:00', users: 2100, reports: 24 },
  { name: '12:00', users: 4500, reports: 88 },
  { name: '16:00', users: 6200, reports: 112 },
  { name: '20:00', users: 8900, reports: 145 },
];

const AdminDashboard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="absolute inset-0 bg-slate-950 overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto p-4 md:p-10 space-y-8 pb-24">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md py-2">
          <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-bold">Admin <span className="text-indigo-500">Control Center</span></h2>
            <p className="text-slate-500 text-xs md:text-sm">Real-time platform monitoring and moderation oversight.</p>
          </div>
          <button 
            onClick={onClose}
            className="self-start md:self-center px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-sm transition-all active:scale-95"
          >
            Exit Dashboard
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[
            { label: 'Active Sessions', val: '12,482', icon: 'fa-users', color: 'text-indigo-500', trend: '+12%' },
            { label: 'Safety Score', val: '98.2%', icon: 'fa-shield-heart', color: 'text-emerald-500', trend: '+0.5%' },
            { label: 'Avg Match Time', val: '1.4s', icon: 'fa-clock', color: 'text-amber-500', trend: '-0.2s' },
            { label: 'Auto-Bans (24h)', val: '412', icon: 'fa-gavel', color: 'text-rose-500', trend: '+42' },
          ].map((stat, i) => (
            <div key={i} className="glass p-5 md:p-6 rounded-2xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-800/50 flex items-center justify-center ${stat.color} border border-white/5`}>
                  <i className={`fa-solid ${stat.icon} text-lg md:text-xl`}></i>
                </div>
                <span className="text-[10px] md:text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">{stat.trend}</span>
              </div>
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{stat.label}</p>
                <h4 className="text-xl md:text-2xl font-black">{stat.val}</h4>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass p-5 md:p-6 rounded-2xl h-[350px] md:h-[400px] flex flex-col shadow-xl">
            <h3 className="text-sm md:text-lg font-bold mb-6 flex items-center gap-2">
              <i className="fa-solid fa-chart-line text-indigo-500"></i>
              Platform Traffic
            </h3>
            <div className="flex-1 min-h-0 w-full relative">
              <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <LineChart data={MOCK_TRAFFIC} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#fff' }}
                    cursor={{ stroke: '#6366f1', strokeWidth: 2 }}
                  />
                  <Line type="monotone" dataKey="users" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#0f172a' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass p-5 md:p-6 rounded-2xl h-[350px] md:h-[400px] flex flex-col shadow-xl">
            <h3 className="text-sm md:text-lg font-bold mb-6 flex items-center gap-2">
              <i className="fa-solid fa-flag text-rose-500"></i>
              Safety Reports
            </h3>
            <div className="flex-1 min-h-0 w-full relative">
              <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <BarChart data={MOCK_TRAFFIC} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#fff' }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Bar dataKey="reports" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Active Flagged Sessions Table */}
        <div className="glass rounded-2xl overflow-hidden shadow-2xl border border-white/5">
          <div className="p-5 md:p-6 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm md:text-lg font-bold flex items-center gap-2">
              <i className="fa-solid fa-bolt-lightning text-amber-500"></i>
              Suspicious Activity Queue
            </h3>
            <button className="text-indigo-400 hover:text-indigo-300 text-[10px] md:text-sm font-bold uppercase tracking-widest">Live View</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-slate-900/50 text-[10px] text-slate-500 uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Session ID</th>
                  <th className="px-6 py-4">Trigger</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { id: 'sess_92812', trigger: 'AI Nudity Check', status: 'Blurred', color: 'text-amber-500' },
                  { id: 'sess_92815', trigger: 'Aggressive Hate Speech', status: 'Terminated', color: 'text-rose-500' },
                  { id: 'sess_92819', trigger: 'User Report: Harassment', status: 'Pending Review', color: 'text-sky-500' },
                  { id: 'sess_92824', trigger: 'Spam Detection', status: 'Warning Issued', color: 'text-amber-400' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 text-xs md:text-sm font-mono text-slate-400">#{row.id}</td>
                    <td className="px-6 py-4 text-xs md:text-sm text-slate-200">{row.trigger}</td>
                    <td className={`px-6 py-4 text-[10px] md:text-xs font-black uppercase tracking-wider ${row.color}`}>{row.status}</td>
                    <td className="px-6 py-4">
                      <button className="text-[10px] bg-slate-800 hover:bg-slate-700 group-hover:bg-indigo-600 px-3 py-1.5 rounded-lg font-bold transition-all text-white">Inspect</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

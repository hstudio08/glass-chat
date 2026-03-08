import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smile, Lock, MapPin, Heart, Edit3, Image as ImageIcon } from 'lucide-react';

export default function UserProfileStatus({ isOpen, onClose, user }) {
  const [activeStatus, setActiveStatus] = useState('online');
  const [statusText, setStatusText] = useState("");

  if (!isOpen) return null;

  // Mock data matching Image 3's Right Panel
  const profileDetails = {
    name: user?.name || "Sarah Jenkins",
    status: "Online",
    about: "Sarah Jenkins is a lovely illustrative bio confirming hospital communities, and other nuances. Passionate about reading and sharing stories.",
    interests: ["Art", "Hiking", "Book Club"],
    sharedMedia: [
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=200&q=80",
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=200&q=80",
      "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=200&q=80",
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=200&q=80",
      "https://images.unsplash.com/photo-1470071131384-001b85755536?auto=format&fit=crop&w=200&q=80",
      "https://images.unsplash.com/photo-1426604966848-d7adac402bff?auto=format&fit=crop&w=200&q=80"
    ],
    commonGroups: [
      { name: "Travelers", icon: "🏔️" },
      { name: "Cozy Readers", icon: "📚" }
    ]
  };

  const statusOptions = [
    { id: 'online', label: 'Online', color: 'bg-[#5ba574]', glow: 'shadow-[0_0_15px_rgba(91,165,116,0.6)]' },
    { id: 'away', label: 'Away', color: 'bg-yellow-400', glow: 'shadow-[0_0_15px_rgba(250,204,21,0.6)]' },
    { id: 'dnd', label: 'Do Not Disturb', color: 'bg-red-500', glow: 'shadow-[0_0_15px_rgba(239,68,68,0.6)]' },
    { id: 'offline', label: 'Offline', color: 'bg-gray-400', glow: 'shadow-[0_0_15px_rgba(156,163,175,0.6)]' },
  ];

  const recentStatuses = [
    { text: "Just finished a great book!", user: "Sarah Jenkins", img: "https://i.pravatar.cc/150?img=47" },
    { text: "Enjoying the sunshine!", user: "Sarah Jenkins", img: "https://i.pravatar.cc/150?img=47" },
    { text: "Looking for new recipes.", user: "Lucas", img: "https://i.pravatar.cc/150?img=11" }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8">
        
        {/* Deep Blur Background Overlay */}
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#4a3a3a]/40 backdrop-blur-md"
        />

        {/* MASSIVE MODAL CONTAINER (Flex Layout matching Image 3) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-[1300px] h-[85vh] flex flex-col lg:flex-row gap-6 relative z-10"
        >
          
          {/* Close Button Floating Outside */}
          <button onClick={onClose} className="absolute -top-4 -right-4 lg:-top-6 lg:-right-6 p-3 bg-white/40 hover:bg-white/70 backdrop-blur-xl border border-white/60 rounded-full text-[#4a3a3a] transition-all z-30 shadow-xl">
            <X size={24} />
          </button>

          {/* ========================================================= */}
          {/* 👈 LEFT SIDE: STATUS UPDATER (Matches Image 3 Center-Left) */}
          {/* ========================================================= */}
          <div className="flex-[3] bg-white/20 backdrop-blur-3xl border border-white/50 shadow-[0_20px_60px_rgba(74,58,58,0.15)] rounded-[2.5rem] flex flex-col relative overflow-hidden">
            
            {/* The Giant Frosted Inner Container */}
            <div className="absolute inset-6 bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[2rem] shadow-inner flex flex-col p-8">
              
              {/* Top Row: Mini Profile Card & Status Pills */}
              <div className="flex flex-col xl:flex-row gap-8 items-start mb-8">
                
                {/* Mini Profile Card */}
                <div className="bg-white/40 backdrop-blur-xl border border-white/70 rounded-[1.5rem] p-6 flex flex-col items-center justify-center w-full xl:w-[240px] shadow-sm shrink-0">
                  <div className="relative mb-4">
                    <img src="https://i.pravatar.cc/150?img=47" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md" alt="Avatar"/>
                    <div className="absolute bottom-1 right-1 w-5 h-5 bg-[#5ba574] border-2 border-white rounded-full"></div>
                  </div>
                  <h2 className="text-xl font-extrabold text-[#4a3a3a] text-center">{profileDetails.name}</h2>
                  <button className="mt-4 bg-white/60 hover:bg-white border border-white/80 px-5 py-2 rounded-full text-sm font-bold text-[#4a3a3a] transition-all shadow-sm">View Profile</button>
                </div>

                {/* Status Selection Pills */}
                <div className="flex-1 w-full">
                  <div className="flex flex-wrap gap-4 mb-6">
                    {statusOptions.map((status) => (
                      <button 
                        key={status.id} onClick={() => setActiveStatus(status.id)}
                        className={`flex items-center gap-3 px-5 py-3 rounded-full font-bold transition-all border
                          ${activeStatus === status.id ? 'bg-white/80 border-white text-[#4a3a3a] shadow-md' : 'bg-white/30 border-white/50 text-[#4a3a3a]/70 hover:bg-white/50'}`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full ${status.color} ${activeStatus === status.id ? status.glow : ''}`}></div>
                        {status.label}
                      </button>
                    ))}
                  </div>

                  {/* Giant Status Input Box */}
                  <div className="relative w-full bg-white/40 border border-white/70 rounded-3xl p-1 shadow-inner focus-within:bg-white/60 transition-all h-[140px] flex flex-col">
                    <textarea 
                      value={statusText} onChange={(e) => setStatusText(e.target.value)}
                      placeholder="Type your loving status message..."
                      className="flex-1 bg-transparent w-full p-4 text-[#4a3a3a] font-semibold text-[16px] placeholder-[#4a3a3a]/50 outline-none resize-none"
                    />
                    <div className="flex justify-end gap-3 p-3">
                      <Smile className="text-[#4a3a3a]/50 hover:text-[#a76f6f] cursor-pointer" size={22} />
                      <Lock className="text-[#4a3a3a]/50 hover:text-[#a76f6f] cursor-pointer" size={22} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Recent Statuses */}
              <div className="flex-1 flex flex-col justify-end mb-6">
                <h3 className="text-lg font-extrabold text-[#4a3a3a] mb-4">Recent Statuses</h3>
                <div className="flex flex-wrap gap-4">
                  {recentStatuses.map((stat, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white/50 backdrop-blur-md border border-white/70 px-4 py-2.5 rounded-full shadow-sm cursor-pointer hover:bg-white/70 transition-all">
                      <img src={stat.img} className="w-7 h-7 rounded-full border border-white" alt="mini"/>
                      <span className="text-[14px] font-bold text-[#4a3a3a]">{stat.text}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 bg-[#fdf2f0]/80 backdrop-blur-md border border-white/70 px-5 py-2.5 rounded-full shadow-sm cursor-pointer hover:bg-white transition-all">
                    <span className="text-lg">🧘‍♀️</span>
                    <span className="text-[14px] font-extrabold text-[#4a3a3a]">Mindfulness</span>
                  </div>
                </div>
              </div>

              {/* THE CRYSTALLINE BUTTON (Matches Image 3 Bottom Center) */}
              <div className="flex justify-center mt-auto mb-4 relative z-20">
                {/* Glowing light behind button */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[60px] bg-[#fdf2f0] blur-[40px] rounded-full z-0 opacity-80 pointer-events-none"></div>
                
                <button 
                  className="crystal-button relative z-10 px-12 py-4 rounded-full flex items-center gap-3 text-[#4a3a3a] hover:scale-105 transition-transform"
                  disabled={!statusText.trim()}
                >
                  <span className="text-[19px] font-extrabold tracking-wide drop-shadow-sm">Update Status</span>
                  <Heart size={20} className="text-[#a76f6f] fill-white/50" />
                </button>
              </div>

            </div>
          </div>

          {/* ========================================================= */}
          {/* 👉 RIGHT SIDE: FULL PROFILE PANEL (Matches Image 3 Far Right) */}
          {/* ========================================================= */}
          <div className="flex-[2] bg-[#fdf2f0]/90 backdrop-blur-3xl border border-white/80 shadow-[0_20px_60px_rgba(74,58,58,0.2)] rounded-[2.5rem] p-8 flex flex-col overflow-y-auto custom-scrollbar relative">
            
            {/* Header / Avatar */}
            <div className="flex flex-col items-center mb-8 pt-4">
              <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-[#a76f6f] to-[#fdf2f0] p-1 shadow-lg mb-4">
                <div className="w-full h-full rounded-full border-4 border-white overflow-hidden relative">
                  <img src="https://i.pravatar.cc/150?img=47" className="w-full h-full object-cover" alt="Profile" />
                </div>
              </div>
              <h2 className="text-3xl font-extrabold text-[#4a3a3a]">{profileDetails.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#5ba574]"></span>
                <span className="text-[15px] font-bold text-[#5ba574]">{profileDetails.status}</span>
              </div>
            </div>

            {/* About Me */}
            <div className="mb-8">
              <h3 className="text-sm font-extrabold text-[#4a3a3a] uppercase tracking-widest mb-3">About Me</h3>
              <p className="text-[15px] font-medium text-[#4a3a3a]/80 leading-relaxed bg-white/40 p-4 rounded-2xl border border-white/50 shadow-inner">
                {profileDetails.about}
              </p>
            </div>

            {/* Interests */}
            <div className="mb-8">
              <h3 className="text-sm font-extrabold text-[#4a3a3a] uppercase tracking-widest mb-3">Interests</h3>
              <div className="flex flex-wrap gap-2">
                {profileDetails.interests.map((interest, i) => (
                  <span key={i} className="bg-white/60 border border-white/80 px-4 py-1.5 rounded-full text-[13px] font-extrabold text-[#4a3a3a] shadow-sm">
                    {interest}
                  </span>
                ))}
              </div>
            </div>

            {/* Shared Media Gallery */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-extrabold text-[#4a3a3a] uppercase tracking-widest">Shared Media Gallery</h3>
                <span className="text-[#a76f6f] text-xs font-bold cursor-pointer hover:underline">View All</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {profileDetails.sharedMedia.map((url, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden border border-white/60 shadow-sm group cursor-pointer">
                    <img src={url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={`gallery-${i}`} />
                  </div>
                ))}
              </div>
            </div>

            {/* Common Groups */}
            <div className="mt-auto pb-4">
              <h3 className="text-sm font-extrabold text-[#4a3a3a] uppercase tracking-widest mb-3">Common Groups</h3>
              <div className="flex flex-wrap gap-3">
                {profileDetails.commonGroups.map((group, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white/50 border border-white/80 px-4 py-2 rounded-xl shadow-sm hover:bg-white/80 transition-colors cursor-pointer">
                    <span className="text-lg">{group.icon}</span>
                    <span className="text-[14px] font-extrabold text-[#4a3a3a]">{group.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating Action Button Bottom */}
            <button className="w-full mt-6 bg-gradient-to-r from-[#a76f6f] to-[#c67b7b] hover:shadow-[0_8px_25px_rgba(167,111,111,0.5)] text-white font-extrabold py-4 rounded-full shadow-[0_4px_15px_rgba(167,111,111,0.3)] transition-all transform hover:-translate-y-0.5">
              View Full Profile
            </button>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
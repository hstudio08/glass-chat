import React, { useState } from 'react';
import { Search, MapPin, Users, Heart, MessageSquare, Calendar, Compass, Image as ImageIcon, Shield, Mic } from 'lucide-react';

export default function ExploreDashboard() {
  const [activeTab, setActiveTab] = useState('explore'); // explore, features, communities

  // Mock data matching Image 4
  const featuredCards = [
    { id: 1, title: "High-quality images", desc: "Share vibrant moments without compression limits.", img: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80", likes: 124 },
    { id: 2, title: "Global Events", desc: "Connect with communities happening near you.", img: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=600&q=80", likes: 89 },
    { id: 3, title: "Community Meetup", desc: "23 members joining today locally.", img: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=600&q=80", likes: 256 },
    { id: 4, title: "Tech Talk 2026", desc: "189 members discussing the future of AI.", img: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=600&q=80", likes: 412 },
  ];

  return (
    <div className="flex w-full h-full relative bg-white/5">
      
      {/* 👈 LEFT EXPLORE MENU (Inner Sidebar) */}
      <div className="hidden lg:flex w-[260px] flex-col border-r border-white/30 bg-white/10 p-6 shrink-0">
        <h2 className="text-xl font-extrabold text-chatly-dark mb-6">Explore</h2>
        
        <div className="flex flex-col gap-2">
          <button 
            onClick={() => setActiveTab('explore')}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${activeTab === 'explore' ? 'bg-white/60 shadow-sm border border-white/80 text-chatly-dark' : 'text-chatly-dark/70 hover:bg-white/30 border border-transparent'}`}
          >
            <Compass size={18} /> Discover
          </button>
          <button 
            onClick={() => setActiveTab('features')}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${activeTab === 'features' ? 'bg-white/60 shadow-sm border border-white/80 text-chatly-dark' : 'text-chatly-dark/70 hover:bg-white/30 border border-transparent'}`}
          >
            <Shield size={18} /> Features
          </button>
          <button 
            onClick={() => setActiveTab('communities')}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all ${activeTab === 'communities' ? 'bg-white/60 shadow-sm border border-white/80 text-chatly-dark' : 'text-chatly-dark/70 hover:bg-white/30 border border-transparent'}`}
          >
            <Users size={18} /> Communities
          </button>
        </div>

        <h3 className="text-sm font-extrabold text-chatly-dark/50 uppercase tracking-widest mt-10 mb-4 px-2">Trending Groups</h3>
        <div className="flex flex-col gap-2">
          {['Photography', 'Travelers', 'Cozy Readers', 'Mindfulness'].map((group, idx) => (
            <button key={idx} className="flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold text-chatly-dark/80 hover:bg-white/30 transition-all text-left">
              <div className="w-8 h-8 rounded-full bg-white/50 border border-white/80 flex items-center justify-center shadow-sm">
                {['📷', '✈️', '📚', '🧘‍♀️'][idx]}
              </div>
              {group}
            </button>
          ))}
        </div>
      </div>

      {/* 👉 MAIN EXPLORE CONTENT */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Top Search & Filter Bar */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/30 shrink-0">
          <div className="flex-1 max-w-[400px]">
            <div className="flex items-center w-full bg-white/50 border border-white/80 rounded-full px-5 py-2.5 focus-within:bg-white/70 focus-within:border-chatly-maroon transition-all shadow-sm">
              <Search className="text-chatly-maroon shrink-0" size={18} />
              <input 
                type="text" 
                placeholder="Search events, features, or users..." 
                className="flex-1 bg-transparent border-none outline-none ml-3 text-chatly-dark placeholder-chatly-dark/50 font-semibold text-[15px]" 
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button className="px-5 py-2.5 bg-white/40 hover:bg-white/60 border border-white/60 rounded-full font-bold text-chatly-dark transition-all shadow-sm">All</button>
             <button className="px-5 py-2.5 bg-white/40 hover:bg-white/60 border border-white/60 rounded-full font-bold text-chatly-dark transition-all shadow-sm">Nearby</button>
             <button className="px-5 py-2.5 bg-white/40 hover:bg-white/60 border border-white/60 rounded-full font-bold text-chatly-dark transition-all shadow-sm">Global</button>
          </div>
        </div>

        {/* Scrollable Content Grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-extrabold text-chatly-dark">Featured Spotlights</h2>
            <button className="text-chatly-maroon font-bold hover:underline">View All</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-12">
            {featuredCards.map((card) => (
              <div key={card.id} className="bg-white/40 backdrop-blur-md border border-white/70 rounded-3xl overflow-hidden shadow-[0_8px_25px_rgba(74,58,58,0.06)] hover:shadow-[0_12px_35px_rgba(74,58,58,0.1)] transition-all group cursor-pointer flex flex-col">
                <div className="h-48 w-full overflow-hidden relative">
                  <img src={card.img} alt={card.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                    <Heart size={14} className="text-chatly-maroon fill-chatly-maroon" />
                    <span className="text-xs font-bold text-chatly-dark">{card.likes}</span>
                  </div>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-[17px] font-extrabold text-chatly-dark mb-2">{card.title}</h3>
                  <p className="text-[14px] font-medium text-chatly-dark/70 mb-4 flex-1">{card.desc}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-chatly-dark/10">
                    <div className="flex items-center gap-2 text-chatly-dark/60 text-sm font-bold">
                      <MapPin size={16} /> Global
                    </div>
                    <button className="text-chatly-maroon font-bold text-sm bg-white/50 px-4 py-1.5 rounded-full hover:bg-white transition-colors">Join</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Features Highlights (As seen in Image 4 center) */}
          <h2 className="text-2xl font-extrabold text-chatly-dark mb-6">Chatly Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
            
            <div className="bg-gradient-to-br from-white/60 to-white/30 backdrop-blur-xl border border-white/80 rounded-3xl p-8 flex items-start gap-6 shadow-sm">
              <div className="w-14 h-14 shrink-0 rounded-full bg-chatly-peach text-chatly-maroon flex items-center justify-center border border-white shadow-inner">
                <Mic size={26} />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-chatly-dark mb-2">Voice Messages</h3>
                <p className="text-sm font-medium text-chatly-dark/70 leading-relaxed">Leave voice messages perfectly transcribed for when typing just isn't fast enough. Crystal clear audio globally.</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white/60 to-white/30 backdrop-blur-xl border border-white/80 rounded-3xl p-8 flex items-start gap-6 shadow-sm">
              <div className="w-14 h-14 shrink-0 rounded-full bg-chatly-peach text-chatly-maroon flex items-center justify-center border border-white shadow-inner">
                <Shield size={26} />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-chatly-dark mb-2">End-to-End Encryption</h3>
                <p className="text-sm font-medium text-chatly-dark/70 leading-relaxed">Military-grade encryption ensures your conversations, media, and files stay strictly between you and your recipient.</p>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { 
  Facebook, Instagram, Youtube, ChevronDown, Heart, 
  MessageCircle, Phone, PhoneOff, Lock, ArrowLeft, Settings as SettingsIcon, Ban
} from 'lucide-react';

import Login from '../pages/Login';
import LeftSidebar from '../components/Sidebar/LeftSidebar';
import ChatArea from '../components/ChatArea/ChatArea';
import AdminDashboard from '../components/Admin/AdminDashboard';
import SettingsView from '../components/Settings/SettingsView'; 
import VideoCallUI from '../components/Call/VideoCallUI';

export default function AppLayout() {
  const { currentUser, userProfile, myPhoneNumber, setMyPhoneNumber, activeRoom, setActiveRoom } = useApp();

  const [mainView, setMainView] = useState('chat'); 
  const [showVideoCall, setShowVideoCall] = useState(false);

  // 1. Enforce Login
  if (!myPhoneNumber) return <Login onLogin={setMyPhoneNumber} />;

  const handleLogout = async () => {
    await signOut(auth);
    setMyPhoneNumber(null);
  };

  // 2. 🚨 BANNED USER INTERCEPTION SCREEN 🚨
  if (userProfile?.isBlocked) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-red-50 text-chatly-dark relative overflow-hidden">
        <div className="absolute top-[10%] w-96 h-96 bg-red-200/50 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="w-24 h-24 rounded-full bg-red-100 border-4 border-red-200 flex items-center justify-center text-red-600 mb-6 shadow-xl z-10">
          <Ban size={48} />
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold mb-3 z-10 text-center">Account Suspended</h1>
        <p className="font-bold text-chatly-dark/60 mb-8 max-w-md text-center px-4 z-10">
          Your account has been permanently restricted by an administrator due to a violation of our terms of service.
        </p>
        <button onClick={handleLogout} className="px-8 py-3.5 bg-chatly-dark text-white rounded-full font-extrabold shadow-lg transition-transform hover:-translate-y-1 z-10">
          Sign Out
        </button>
      </div>
    );
  }

  // 3. Admin Route
  if (window.location.pathname === '/admin') {
    if (currentUser?.email !== 'hstudio.webdev@gmail.com') {
      return (
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-chatly-peach text-chatly-dark">
          <Lock size={64} className="text-chatly-maroon mb-4" />
          <h1 className="text-3xl font-extrabold mb-2">Access Denied</h1>
          <button onClick={() => window.location.href = '/'} className="px-8 py-3 bg-chatly-maroon text-white rounded-full font-bold shadow-lg mt-4">Return to Chatly</button>
        </div>
      );
    }
    return (
      <div className="h-[100dvh] w-full bg-chatly-peach relative overflow-hidden flex flex-col">
        <div className="p-4 z-20">
          <button onClick={() => window.location.href = '/'} className="flex items-center gap-2 font-bold bg-white/50 px-4 py-2 rounded-full w-max shadow-sm border border-white/60"><ArrowLeft size={18} /> Back</button>
        </div>
        <AdminDashboard />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col relative text-chatly-dark overflow-hidden bg-gradient-to-br from-[#fdf2f0] via-[#f4d9d0] to-[#dbe4f0] md:p-4 lg:p-8">
      
      <div className="absolute top-[5%] left-[10%] w-72 h-72 bg-white/60 rounded-full blur-[80px] pointer-events-none hidden md:block"></div>
      <div className="absolute bottom-[10%] right-[10%] w-96 h-96 bg-chatly-rose/20 rounded-full blur-[100px] pointer-events-none hidden md:block"></div>

      {/* DESKTOP TOP NAVIGATION BAR */}
      <nav className="hidden md:flex w-full max-w-[1500px] mx-auto justify-between items-center py-2 mb-4 z-20 shrink-0">
        <div onClick={() => setMainView('chat')} className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
          <h1 className="text-3xl font-extrabold tracking-tight text-chatly-dark">CHATLY</h1>
          <span className="text-chatly-maroon text-xl drop-shadow-sm">♥</span>
        </div>
        
        <div className="flex items-center bg-white/40 backdrop-blur-md border border-white/60 shadow-sm rounded-full px-2 py-1.5">
          <button onClick={() => setMainView('chat')} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold transition-all ${mainView === 'chat' ? 'bg-white shadow-sm text-chatly-maroon' : 'text-chatly-dark/70 hover:bg-white/50'}`}><MessageCircle size={18} /> Chats</button>
          <button onClick={() => setMainView('calls')} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold transition-all ${mainView === 'calls' ? 'bg-white shadow-sm text-chatly-maroon' : 'text-chatly-dark/70 hover:bg-white/50'}`}><Phone size={18} /> Calls</button>
          <button onClick={() => setMainView('settings')} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold transition-all ${mainView === 'settings' ? 'bg-white shadow-sm text-chatly-maroon' : 'text-chatly-dark/70 hover:bg-white/50'}`}><SettingsIcon size={18} /> Settings</button>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-chatly-maroon to-chatly-rose text-white flex items-center justify-center text-lg font-bold shadow-sm">
            {typeof myPhoneNumber === 'string' ? myPhoneNumber.substring(0,1).toUpperCase() : 'U'}
          </div>
          <button onClick={handleLogout} className="bg-gradient-to-r from-chatly-maroon to-chatly-rose text-white px-6 py-2.5 rounded-full text-base font-bold shadow-md hover:-translate-y-0.5 transition-transform">Sign Out</button>
        </div>
      </nav>

      {/* MOBILE HEADER */}
      {!activeRoom && mainView !== 'settings' && (
        <header className="md:hidden flex justify-between items-center px-5 py-4 bg-white/40 backdrop-blur-md border-b border-white/30 z-20 shrink-0 shadow-sm pt-[max(env(safe-area-inset-top),16px)]">
          <div className="flex items-center gap-1.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-chatly-dark">CHATLY</h1><span className="text-chatly-maroon text-xl drop-shadow-sm">♥</span>
          </div>
        </header>
      )}

      {/* MAIN APP CONTAINER */}
      <main className="w-full max-w-[1500px] mx-auto flex-1 flex md:rounded-[2.5rem] overflow-hidden md:glass-panel md:shadow-2xl z-10 relative bg-white/30 md:bg-transparent backdrop-blur-md md:backdrop-blur-none border-t border-white/40 md:border-none">
        
        {mainView === 'chat' && (
          <>
            <div className={`w-full md:w-[340px] lg:w-[380px] h-full flex-none flex flex-col border-r border-white/40 bg-white/10 transition-all ${activeRoom ? 'hidden md:flex' : 'flex'}`}>
              <LeftSidebar /> 
            </div>
            <div className={`flex-1 flex flex-col h-full min-w-0 relative bg-white/20 md:bg-transparent ${!activeRoom ? 'hidden md:flex' : 'flex'}`}>
              {activeRoom ? (
                <ChatArea onOpenVideo={() => setShowVideoCall(true)} onBack={() => setActiveRoom(null)} />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center hidden md:flex">
                  <div className="w-28 h-28 rounded-full bg-white/40 backdrop-blur-md border border-white/60 shadow-xl mb-8 flex items-center justify-center animate-pulse z-10"><Heart fill="#a76f6f" stroke="none" size={48} /></div>
                  <h2 className="text-3xl font-extrabold text-chatly-dark mb-3 z-10">Chatly for Web</h2>
                </div>
              )}
            </div>
          </>
        )}

        {mainView === 'calls' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 w-full h-full">
            <div className="w-24 h-24 rounded-full bg-white/40 backdrop-blur-md border border-white/60 shadow-xl mb-6 flex items-center justify-center text-chatly-maroon"><PhoneOff size={40} /></div>
            <h2 className="text-2xl font-extrabold text-chatly-dark mb-2">No Recent Calls</h2>
            <button onClick={() => setMainView('chat')} className="mt-8 bg-gradient-to-r from-chatly-maroon to-chatly-rose text-white px-8 py-3 rounded-full font-bold shadow-lg">Go to Chats</button>
          </div>
        )}

        {/* SETTINGS FULL PAGE VIEW */}
        {mainView === 'settings' && (
          <SettingsView onBack={() => setMainView('chat')} />
        )}

      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      {(!activeRoom || mainView !== 'chat') && (
        <div className="md:hidden w-full bg-white/90 backdrop-blur-2xl border-t border-white/40 flex justify-around items-center pt-3 pb-[max(env(safe-area-inset-bottom),12px)] px-2 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <button onClick={() => setMainView('chat')} className={`flex flex-col items-center gap-1.5 w-16 transition-colors ${mainView === 'chat' ? 'text-chatly-maroon' : 'text-chatly-dark/50'}`}>
            <MessageCircle size={24} className={mainView === 'chat' ? 'fill-chatly-maroon/10' : ''} />
            <span className="text-[10px] font-extrabold tracking-wide">Chats</span>
          </button>
          <button onClick={() => setMainView('calls')} className={`flex flex-col items-center gap-1.5 w-16 transition-colors ${mainView === 'calls' ? 'text-chatly-maroon' : 'text-chatly-dark/50'}`}>
            <Phone size={24} className={mainView === 'calls' ? 'fill-chatly-maroon/10' : ''} />
            <span className="text-[10px] font-extrabold tracking-wide">Calls</span>
          </button>
          <button onClick={() => setMainView('settings')} className={`flex flex-col items-center gap-1.5 w-16 transition-colors ${mainView === 'settings' ? 'text-chatly-maroon' : 'text-chatly-dark/50'}`}>
            <SettingsIcon size={24} className={mainView === 'settings' ? 'fill-chatly-maroon/10' : ''} />
            <span className="text-[10px] font-extrabold tracking-wide">Settings</span>
          </button>
        </div>
      )}

      {showVideoCall && <VideoCallUI onEndCall={() => setShowVideoCall(false)} />}
    </div>
  );
}
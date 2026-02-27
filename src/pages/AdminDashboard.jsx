import { useState, useEffect, useRef } from 'react';
import { auth, db, googleProvider } from '../services/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { Send, LogOut, Plus, Trash2, Ban, CheckCircle, Clock, ShieldHalf, Activity, MessageSquare, KeyRound, Settings, Ghost, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ADMIN_EMAIL = "hstudio.webdev@gmail.com";

export default function AdminDashboard() {
  const [adminUser, setAdminUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Navigation & Settings State
  const [activeTab, setActiveTab] = useState('chats'); // 'chats', 'ids', 'settings'
  const [ghostMode, setGhostMode] = useState(false); // Admin Stealth Mode
  
  // Database State
  const [accessCodes, setAccessCodes] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [activeChatDoc, setActiveChatDoc] = useState(null); // Tracks User Online/Typing status
  
  // ID Generation State
  const [newCodeId, setNewCodeId] = useState("");
  const [expiryHours, setExpiryHours] = useState("0"); 
  
  const messagesEndRef = useRef(null);
  const audioRef = useRef(typeof Audio !== "undefined" ? new Audio('/pop.mp3') : null);
  const previousMessageCount = useRef(0);
  const isWindowFocused = useRef(true);

  // --- Core Listeners ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email === ADMIN_EMAIL) setAdminUser(user);
      else if (user) signOut(auth);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleFocus = () => { isWindowFocused.current = true; document.title = "Admin HQ | GlassChat"; };
    const handleBlur = () => isWindowFocused.current = false;
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    return () => { window.removeEventListener('focus', handleFocus); window.removeEventListener('blur', handleBlur); };
  }, []);

  useEffect(() => {
    if (!adminUser) return;
    const q = query(collection(db, 'access_codes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAccessCodes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [adminUser]);

  // --- Active Chat Listeners ---
  useEffect(() => {
    if (!activeChatId) return;
    
    const q = query(collection(db, 'chats', activeChatId, 'messages'), orderBy('timestamp', 'asc'));
    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(fetchedMessages);
      
      if (previousMessageCount.current !== 0 && fetchedMessages.length > previousMessageCount.current) {
        const lastMessage = fetchedMessages[fetchedMessages.length - 1];
        if (lastMessage && lastMessage.sender === 'user') {
          audioRef.current?.play().catch(() => {});
          if (!isWindowFocused.current) document.title = "💬 New Message!";
        }
      }
      previousMessageCount.current = fetchedMessages.length;
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    // Listen to the main chat document for User Online Status & Typing
    const unsubscribeDoc = onSnapshot(doc(db, 'chats', activeChatId), (docSnap) => {
      if (docSnap.exists()) setActiveChatDoc(docSnap.data());
    });

    return () => { unsubscribeMessages(); unsubscribeDoc(); previousMessageCount.current = 0; };
  }, [activeChatId]);

  // --- Update Admin Online Status (Respecting Ghost Mode) ---
  useEffect(() => {
    if (!activeChatId) return;
    const setOnlineStatus = async () => {
      if (ghostMode) {
        // If ghost mode is ON, wipe our online presence
        await setDoc(doc(db, 'chats', activeChatId), { adminOnline: false, adminTyping: false }, { merge: true }).catch(()=>{});
      } else {
        // If ghost mode is OFF, show we are online
        await setDoc(doc(db, 'chats', activeChatId), { adminOnline: true }, { merge: true }).catch(()=>{});
      }
    };
    setOnlineStatus();

    // When we leave the chat or close the tab, mark offline (if not already ghosted)
    return () => {
      if (!ghostMode && activeChatId) {
        setDoc(doc(db, 'chats', activeChatId), { adminOnline: false, adminLastSeen: serverTimestamp() }, { merge: true }).catch(()=>{});
      }
    };
  }, [activeChatId, ghostMode]);

  // --- Handlers ---
  const handleCreateCode = async (e) => {
    e.preventDefault();
    if (!newCodeId.trim()) return;
    let expiresAt = null;
    if (parseInt(expiryHours) > 0) expiresAt = Date.now() + (parseInt(expiryHours) * 60 * 60 * 1000);
    
    await setDoc(doc(db, 'access_codes', newCodeId), { type: expiresAt ? "temporary" : "permanent", status: "active", createdAt: Date.now(), expiresAt: expiresAt });
    await setDoc(doc(db, 'chats', newCodeId), { userTyping: false, adminTyping: false, userOnline: false }, { merge: true });
    setNewCodeId("");
  };

  const cleanupExpiredIDs = async () => {
    const now = Date.now();
    for (const code of accessCodes) {
      if (code.expiresAt && code.expiresAt < now) {
        await deleteDoc(doc(db, 'access_codes', code.id));
        if (activeChatId === code.id) setActiveChatId(null);
      }
    }
  };

  const deleteCode = async (id) => {
    if(window.confirm(`Permanently delete chat ID: ${id}?`)) {
      await deleteDoc(doc(db, 'access_codes', id));
      if (activeChatId === id) setActiveChatId(null);
    }
  };

  const toggleBlockStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "active" ? "blocked" : "active";
    await updateDoc(doc(db, 'access_codes', id), { status: newStatus });
    if (activeChatId === id && newStatus === "blocked") setActiveChatId(null);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatId) return;
    
    const text = newMessage;
    setNewMessage("");
    
    try {
      if(!ghostMode) setDoc(doc(db, 'chats', activeChatId), { adminTyping: false }, { merge: true }).catch(() => {});
      await addDoc(collection(db, 'chats', activeChatId, 'messages'), { text, sender: "admin", timestamp: serverTimestamp() });
    } catch (error) { console.error("Message Error:", error); }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (activeChatId && !ghostMode) {
      setDoc(doc(db, 'chats', activeChatId), { adminTyping: e.target.value.length > 0 }, { merge: true }).catch(() => {});
    }
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return "Never";
    const date = timestamp.toDate();
    const now = new Date();
    const diffMins = Math.floor((now - date) / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins/60)}h ago`;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
  };

  // --- Render Login ---
  if (authLoading) return <div className="flex h-screen items-center justify-center text-white bg-[#0a0f1a]">Loading Core...</div>;

  if (!adminUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-4 bg-[#0a0f1a] relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full mix-blend-screen filter blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full mix-blend-screen filter blur-[100px] animate-pulse delay-1000"></div>
        
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel w-full max-w-md p-10 flex flex-col items-center bg-white/5 border border-white/10 backdrop-blur-2xl z-10 shadow-2xl rounded-3xl">
          <ShieldHalf size={64} className="text-blue-500 mb-6 drop-shadow-lg" />
          <h1 className="text-3xl font-extrabold text-white mb-2 tracking-wide">Command Center</h1>
          <p className="text-gray-400 mb-8 text-center font-medium">Encrypted admin gateway.</p>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => signInWithPopup(auth, googleProvider)} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-2xl shadow-[0_0_30px_rgba(37,99,235,0.3)] transition-all tracking-wide">
            Authenticate Identity
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // --- Render Dashboard ---
  return (
    <div className="flex h-screen w-full bg-[#0a0f1a] font-sans selection:bg-blue-500/30 text-white overflow-hidden relative">
      
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-600/5 rounded-full filter blur-[120px]"></div>
        <div className="absolute bottom-[0%] -right-[10%] w-[40%] h-[50%] bg-indigo-600/5 rounded-full filter blur-[120px]"></div>
      </div>

      {/* 1. Left Navigation Dock */}
      <div className="w-20 sm:w-24 h-full bg-white/5 border-r border-white/10 flex flex-col items-center py-8 z-20 backdrop-blur-xl">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg flex items-center justify-center mb-10">
          <Activity size={24} className="text-white" />
        </div>
        
        <div className="flex flex-col gap-6 w-full px-4">
          <NavButton icon={<MessageSquare size={22}/>} label="Chats" active={activeTab === 'chats'} onClick={() => setActiveTab('chats')} />
          <NavButton icon={<KeyRound size={22}/>} label="IDs" active={activeTab === 'ids'} onClick={() => setActiveTab('ids')} />
          <NavButton icon={<Settings size={22}/>} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </div>

        <div className="mt-auto px-4 w-full">
          <button onClick={() => signOut(auth)} className="w-full p-3 flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-2xl transition-all group">
            <LogOut size={22} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-bold">EXIT</span>
          </button>
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div className="flex-1 flex overflow-hidden z-10 p-4 gap-4">
        <AnimatePresence mode="wait">
          
          {/* --- TAB: CHATS --- */}
          {activeTab === 'chats' && (
            <motion.div key="chats" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex w-full h-full gap-4">
              
              {/* Active Chats List */}
              <div className="w-1/3 max-w-sm flex flex-col bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-2xl shadow-2xl">
                <div className="p-6 border-b border-white/10 bg-black/20">
                  <h2 className="font-extrabold tracking-wide text-lg">Active Sessions</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                  {accessCodes.filter(c => c.status === 'active').map(code => (
                    <div key={code.id} onClick={() => setActiveChatId(code.id)} className={`p-4 rounded-2xl border cursor-pointer transition-all ${activeChatId === code.id ? 'bg-blue-600/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'bg-black/20 border-white/5 hover:bg-white/10'}`}>
                      <div className="font-bold tracking-wider font-mono text-sm">{code.id}</div>
                    </div>
                  ))}
                  {accessCodes.filter(c => c.status === 'active').length === 0 && (
                    <p className="text-gray-500 text-sm text-center mt-10">No active IDs available.</p>
                  )}
                </div>
              </div>

              {/* Chat Window */}
              <div className="flex-1 flex flex-col bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-2xl shadow-2xl relative">
                {activeChatId ? (
                  <>
                    <div className="h-20 border-b border-white/10 bg-black/20 flex items-center px-8 gap-5 z-10">
                      {/* User Online Status Indicator */}
                      <div className="relative">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-white/10 border border-white/20`}>
                          <MessageSquare size={20} className="text-gray-300"/>
                        </div>
                        {activeChatDoc?.userOnline && (
                          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-[#0f172a] rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
                        )}
                      </div>
                      
                      <div className="flex flex-col">
                        <h3 className="font-bold text-lg tracking-wide text-white">{activeChatId}</h3>
                        <p className={`text-xs font-semibold ${activeChatDoc?.userOnline ? 'text-emerald-400' : 'text-gray-400'}`}>
                          {activeChatDoc?.userOnline ? "Online right now" : `Last seen: ${formatLastSeen(activeChatDoc?.userLastSeen)}`}
                        </p>
                      </div>

                      {/* Ghost Mode Indicator */}
                      {ghostMode && (
                        <div className="ml-auto flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full text-amber-400">
                          <Ghost size={14} /> <span className="text-xs font-bold uppercase tracking-wider">Stealth Mode</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                      {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`px-6 py-4 max-w-[75%] text-[15px] leading-relaxed shadow-lg border ${msg.sender === 'admin' ? 'bg-gradient-to-br from-blue-600 to-indigo-600 border-blue-500/50 text-white rounded-3xl rounded-tr-sm' : 'bg-white/10 border-white/5 text-gray-200 rounded-3xl rounded-tl-sm backdrop-blur-md'}`}>
                            {msg.text}
                          </div>
                        </div>
                      ))}
                      {activeChatDoc?.userTyping && (
                        <div className="flex justify-start">
                          <div className="px-6 py-5 bg-white/5 text-gray-400 rounded-3xl rounded-tl-sm border border-white/5 flex gap-1.5 items-center">
                            <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                            <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                            <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    <div className="p-6 border-t border-white/10 bg-black/20 z-10">
                      <form onSubmit={handleSendMessage} className="flex gap-4 max-w-5xl mx-auto relative">
                        <input type="text" value={newMessage} onChange={handleTyping} placeholder={ghostMode ? "Type silently..." : "Transmit message..."} className="flex-1 bg-white/5 border border-white/10 rounded-2xl pl-6 pr-16 py-4 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all text-white placeholder-gray-500 shadow-inner font-medium"/>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="submit" disabled={!newMessage.trim()} className={`absolute right-2 top-2 bottom-2 aspect-square disabled:opacity-0 text-white rounded-xl transition-all flex items-center justify-center shadow-lg ${ghostMode ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'}`}>
                          <Send size={20} className="ml-1" />
                        </motion.button>
                      </form>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-6 opacity-50">
                    <MessageSquare size={80} strokeWidth={1} />
                    <p className="text-xl font-light tracking-wide">Select an active session to begin.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* --- TAB: ID MANAGEMENT --- */}
          {activeTab === 'ids' && (
            <motion.div key="ids" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full h-full flex flex-col bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-2xl shadow-2xl p-8">
              <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-6">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-wide">Access Management</h2>
                  <p className="text-gray-400 text-sm mt-1">Generate and control secure access vectors.</p>
                </div>
                <button onClick={cleanupExpiredIDs} className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-xl transition-all font-bold text-sm">
                  <Clock size={18}/> Clean Expired
                </button>
              </div>

              {/* ID Generator */}
              <div className="bg-black/20 border border-white/10 p-6 rounded-2xl mb-8">
                <form onSubmit={handleCreateCode} className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Custom ID Vector</label>
                    <input type="text" value={newCodeId} onChange={(e) => setNewCodeId(e.target.value)} placeholder="e.g., SECURE-01" className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-blue-500/50 transition-colors font-mono uppercase"/>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Expiration Window</label>
                    <select value={expiryHours} onChange={(e) => setExpiryHours(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white outline-none cursor-pointer hover:border-white/20 transition-colors appearance-none">
                      <option value="0">∞ Permanent Access</option>
                      <option value="1">⏱ 1 Hour Window</option>
                      <option value="12">⏱ 12 Hour Window</option>
                      <option value="24">⏱ 24 Hour Window</option>
                    </select>
                  </div>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={!newCodeId.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-8 py-4 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all h-[58px]">
                    <Plus size={20}/> Generate
                  </motion.button>
                </form>
              </div>

              {/* ID List Grid */}
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {accessCodes.map(code => {
                      const isExpired = code.expiresAt && code.expiresAt < Date.now();
                      return (
                        <motion.div key={code.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className={`p-5 rounded-2xl border flex flex-col justify-between h-40 transition-all group ${isExpired ? 'bg-black/40 border-white/5 opacity-50 grayscale' : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'}`}>
                          <div className="flex justify-between items-start">
                            <span className="font-bold tracking-wider font-mono text-lg text-white truncate">{code.id}</span>
                            <span className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full font-bold ${code.type === 'permanent' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                              {isExpired ? 'EXPIRED' : code.type}
                            </span>
                          </div>
                          <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity mt-auto">
                            <button onClick={() => toggleBlockStatus(code.id, code.status)} className={`flex-1 py-2.5 rounded-xl flex justify-center items-center text-xs font-bold transition-all ${code.status === 'active' ? 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                              {code.status === 'active' ? <Ban size={14} className="mr-1.5"/> : <CheckCircle size={14} className="mr-1.5"/>}
                              {code.status === 'active' ? 'BLOCK' : 'UNBLOCK'}
                            </button>
                            <button onClick={() => deleteCode(code.id)} className="flex-1 py-2.5 rounded-xl flex justify-center items-center text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all">
                              <Trash2 size={14} className="mr-1.5"/> DELETE
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {/* --- TAB: SETTINGS --- */}
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full h-full flex flex-col bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-2xl shadow-2xl p-8">
              <div className="mb-8 border-b border-white/10 pb-6">
                <h2 className="text-2xl font-extrabold tracking-wide">System Settings</h2>
                <p className="text-gray-400 text-sm mt-1">Configure your administrative footprint.</p>
              </div>

              <div className="max-w-2xl">
                {/* Ghost Mode Toggle */}
                <div className="bg-black/20 border border-white/10 p-6 rounded-2xl flex items-center justify-between">
                  <div className="flex gap-4 items-center">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-colors ${ghostMode ? 'bg-amber-500/20 text-amber-400 shadow-amber-500/20' : 'bg-white/10 text-gray-400'}`}>
                      <Ghost size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Incognito / Ghost Mode</h3>
                      <p className="text-sm text-gray-400 mt-1 max-w-sm">When active, users will not see your "Online" status, last seen timestamp, or typing indicators.</p>
                    </div>
                  </div>
                  
                  {/* Custom Toggle Switch */}
                  <button onClick={() => setGhostMode(!ghostMode)} className={`relative w-16 h-8 rounded-full transition-colors duration-300 focus:outline-none ${ghostMode ? 'bg-amber-500' : 'bg-gray-700'}`}>
                    <motion.div animate={{ x: ghostMode ? 32 : 4 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className="absolute top-1 left-0 w-6 h-6 bg-white rounded-full shadow-md" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

// Helper component for Sidebar Nav
function NavButton({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`w-full p-3 flex flex-col items-center justify-center gap-1.5 rounded-2xl transition-all duration-300 relative group ${active ? 'text-white bg-white/10 shadow-inner' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
      {icon}
      <span className="text-[10px] font-bold tracking-wider">{label}</span>
      {active && (
        <motion.div layoutId="activeTab" className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
      )}
    </button>
  );
}
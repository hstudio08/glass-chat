import { useState, useEffect, useRef } from 'react';
import { auth, db, googleProvider } from '../services/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { Send, LogOut, Plus, Trash2, Ban, CheckCircle, Clock, ShieldHalf, Activity, MessageSquare, KeyRound, Settings, Ghost, Edit2, X, Eraser, Sun, Moon, Download, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ADMIN_EMAIL = "hstudio.webdev@gmail.com";

// Pre-defined quick replies for fast customer support
const QUICK_REPLIES = [
  "👋 Hello! How can I help you today?",
  "🔒 This is a secure, end-to-end encrypted channel.",
  "⏳ Please give me one moment to look into that for you.",
  "✅ Your request has been successfully processed."
];

export default function AdminDashboard() {
  // Core Auth
  const [adminUser, setAdminUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // UI & Theme State
  const [activeTab, setActiveTab] = useState('chats'); 
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  
  // Database & Feature State
  const [accessCodes, setAccessCodes] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [activeChatDoc, setActiveChatDoc] = useState(null); 
  const [ghostMode, setGhostMode] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState(null);
  
  const [newCodeId, setNewCodeId] = useState("");
  const [expiryHours, setExpiryHours] = useState("0"); 
  
  const messagesEndRef = useRef(null);
  const audioRef = useRef(typeof Audio !== "undefined" ? new Audio('/pop.mp3') : null);
  const previousMessageCount = useRef(0);
  const isWindowFocused = useRef(true);

  // --- Theme Variables ---
  const themeBg = isDarkMode ? "bg-[#0a0f1a]" : "bg-slate-100";
  const themeText = isDarkMode ? "text-white" : "text-slate-800";
  const panelBg = isDarkMode ? "bg-white/5 border-white/10 backdrop-blur-2xl" : "bg-white border-slate-200 shadow-xl";
  const inputBg = isDarkMode ? "bg-white/5 border-white/10 text-white placeholder-gray-500" : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white";

  // --- Listeners ---
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

    const unsubscribeDoc = onSnapshot(doc(db, 'chats', activeChatId), (docSnap) => {
      if (docSnap.exists()) setActiveChatDoc(docSnap.data());
    });

    return () => { unsubscribeMessages(); unsubscribeDoc(); previousMessageCount.current = 0; };
  }, [activeChatId]);

  useEffect(() => {
    if (!activeChatId) return;
    const setOnlineStatus = async () => {
      if (ghostMode) await setDoc(doc(db, 'chats', activeChatId), { adminOnline: false, adminTyping: false }, { merge: true }).catch(()=>{});
      else await setDoc(doc(db, 'chats', activeChatId), { adminOnline: true }, { merge: true }).catch(()=>{});
    };
    setOnlineStatus();
    return () => {
      if (!ghostMode && activeChatId) setDoc(doc(db, 'chats', activeChatId), { adminOnline: false, adminLastSeen: serverTimestamp() }, { merge: true }).catch(()=>{});
    };
  }, [activeChatId, ghostMode]);

  // --- ID Handlers ---
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

  // --- Message Handlers ---
  const handleSendMessage = async (e, overrideText = null) => {
    if (e) e.preventDefault();
    const textToSend = overrideText || newMessage;
    if (!textToSend.trim() || !activeChatId) return;
    
    if (editingMsgId) {
      try {
        await updateDoc(doc(db, 'chats', activeChatId, 'messages', editingMsgId), { text: textToSend, isEdited: true });
        setEditingMsgId(null); setNewMessage("");
      } catch (error) { console.error("Edit Error:", error); }
      return;
    }

    setNewMessage("");
    setShowQuickReplies(false);
    try {
      if(!ghostMode) setDoc(doc(db, 'chats', activeChatId), { adminTyping: false }, { merge: true }).catch(() => {});
      await addDoc(collection(db, 'chats', activeChatId, 'messages'), { text: textToSend, sender: "admin", timestamp: serverTimestamp() });
    } catch (error) { console.error("Message Error:", error); }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (activeChatId && !ghostMode) {
      setDoc(doc(db, 'chats', activeChatId), { adminTyping: e.target.value.length > 0 }, { merge: true }).catch(() => {});
    }
  };

  const deleteMessage = async (msgId) => {
    if (window.confirm("Delete this message?")) await deleteDoc(doc(db, 'chats', activeChatId, 'messages', msgId));
  };

  const clearEntireChatHistory = async () => {
    if (window.confirm("NUKE PROTOCOL: Permanently delete ALL messages?")) {
      messages.forEach(async (msg) => await deleteDoc(doc(db, 'chats', activeChatId, 'messages', msg.id)));
    }
  };

  const exportChatHistory = () => {
    if (!messages.length) return alert("No messages to export.");
    const content = messages.map(m => {
      const time = m.timestamp ? new Date(m.timestamp.toDate()).toLocaleString() : "Unknown Time";
      return `[${time}] ${m.sender.toUpperCase()}: ${m.text}`;
    }).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `GlassChat_Transcript_${activeChatId}.txt`; a.click();
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return "Never";
    const date = timestamp.toDate();
    const diffMins = Math.floor((new Date() - date) / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins/60)}h ago`;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
  };

  // --- Animation Variants ---
  const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const popItem = { hidden: { opacity: 0, y: 10, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 400, damping: 25 } } };

  // --- Render Login ---
  if (authLoading) return <div className="flex h-screen items-center justify-center text-white bg-[#0a0f1a]">Loading Core Engine...</div>;

  if (!adminUser) {
    return (
      <div className={`flex h-screen w-full items-center justify-center p-4 transition-colors duration-500 ${themeBg} relative overflow-hidden`}>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full mix-blend-multiply filter blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full mix-blend-multiply filter blur-[100px] animate-pulse delay-1000"></div>
        
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className={`w-full max-w-md p-10 flex flex-col items-center rounded-3xl z-10 transition-colors duration-500 ${panelBg}`}>
          <ShieldHalf size={64} className="text-blue-500 mb-6 drop-shadow-lg" />
          <h1 className={`text-3xl font-extrabold mb-2 tracking-wide ${themeText}`}>Command Center</h1>
          <p className="text-gray-500 mb-8 text-center font-medium">Encrypted administrative gateway.</p>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => signInWithPopup(auth, googleProvider)} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all">
            Authenticate Identity
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // --- Render Dashboard ---
  return (
    <div className={`flex h-screen w-full font-sans selection:bg-blue-500/30 overflow-hidden relative transition-colors duration-500 ${themeBg} ${themeText}`}>
      
      {/* 1. Sidebar Dock */}
      <div className={`w-20 sm:w-24 h-full flex flex-col items-center py-6 z-20 transition-colors duration-500 ${isDarkMode ? 'bg-white/5 border-r border-white/10' : 'bg-white border-r border-slate-200 shadow-xl'}`}>
        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg flex items-center justify-center mb-8">
          <Activity size={24} className="text-white" />
        </div>
        
        <div className="flex flex-col gap-4 w-full px-4">
          <NavButton icon={<MessageSquare size={22}/>} label="Chats" active={activeTab === 'chats'} onClick={() => setActiveTab('chats')} isDarkMode={isDarkMode}/>
          <NavButton icon={<KeyRound size={22}/>} label="IDs" active={activeTab === 'ids'} onClick={() => setActiveTab('ids')} isDarkMode={isDarkMode}/>
          <NavButton icon={<Settings size={22}/>} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} isDarkMode={isDarkMode}/>
        </div>

        <div className="mt-auto px-4 w-full flex flex-col gap-4">
          {/* Theme Toggle */}
          <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-full p-3 flex flex-col items-center justify-center rounded-2xl transition-all ${isDarkMode ? 'text-yellow-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100 hover:text-blue-600'}`}>
            {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
          </button>
          
          <button onClick={() => signOut(auth)} className={`w-full p-3 flex flex-col items-center justify-center gap-1 rounded-2xl transition-all group ${isDarkMode ? 'text-gray-500 hover:text-red-400 hover:bg-white/5' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}>
            <LogOut size={22} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-bold tracking-widest">EXIT</span>
          </button>
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div className="flex-1 flex overflow-hidden z-10 p-4 sm:p-6 gap-6">
        <AnimatePresence mode="wait">
          
          {/* --- TAB: CHATS --- */}
          {activeTab === 'chats' && (
            <motion.div key="chats" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="flex w-full h-full gap-6">
              
              {/* Active Chats List */}
              <div className={`w-1/3 max-w-sm flex flex-col rounded-3xl overflow-hidden transition-colors duration-500 ${panelBg}`}>
                <div className={`p-6 border-b flex justify-between items-center ${isDarkMode ? 'border-white/10 bg-black/20' : 'border-slate-100 bg-slate-50'}`}>
                  <h2 className="font-extrabold tracking-wide text-lg">Active Sessions</h2>
                  <div className="px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-xs font-bold">{accessCodes.filter(c=>c.status==='active').length}</div>
                </div>
                <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {accessCodes.filter(c => c.status === 'active').map(code => (
                    <motion.div variants={popItem} key={code.id} onClick={() => setActiveChatId(code.id)} className={`p-4 rounded-2xl border cursor-pointer transition-all ${activeChatId === code.id ? (isDarkMode ? 'bg-blue-600/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'bg-blue-50 border-blue-500 shadow-md text-blue-700') : (isDarkMode ? 'bg-black/20 border-white/5 hover:bg-white/10' : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm')}`}>
                      <div className="font-bold tracking-wider font-mono text-sm">{code.id}</div>
                    </motion.div>
                  ))}
                  {accessCodes.filter(c => c.status === 'active').length === 0 && <p className="text-gray-400 text-sm text-center mt-10">No active IDs available.</p>}
                </motion.div>
              </div>

              {/* Chat Window */}
              <div className={`flex-1 flex flex-col rounded-3xl overflow-hidden relative transition-colors duration-500 ${panelBg}`}>
                {activeChatId ? (
                  <>
                    <div className={`h-20 border-b flex items-center px-8 gap-5 z-20 justify-between ${isDarkMode ? 'border-white/10 bg-black/20' : 'border-slate-100 bg-slate-50'}`}>
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-white/10 border-white/20' : 'bg-white shadow-sm border-slate-200'}`}><MessageSquare size={20} className={isDarkMode ? "text-gray-300" : "text-blue-600"}/></div>
                          {activeChatDoc?.userOnline && <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-[#0f172a] rounded-full shadow-sm"></span>}
                        </div>
                        <div className="flex flex-col">
                          <h3 className="font-bold text-lg tracking-wide">{activeChatId}</h3>
                          <p className={`text-xs font-semibold ${activeChatDoc?.userOnline ? 'text-emerald-500' : 'text-gray-500'}`}>{activeChatDoc?.userOnline ? "Online right now" : `Last seen: ${formatLastSeen(activeChatDoc?.userLastSeen)}`}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {ghostMode && <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full text-amber-500"><Ghost size={14} /> <span className="text-xs font-bold uppercase tracking-wider">Stealth</span></div>}
                        <button onClick={exportChatHistory} title="Export Chat" className={`p-2.5 rounded-xl transition-all ${isDarkMode ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20' : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200'}`}><Download size={18} /></button>
                        <button onClick={clearEntireChatHistory} title="Nuke Chat" className={`p-2.5 rounded-xl transition-all ${isDarkMode ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20' : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'}`}><Eraser size={18} /></button>
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                      {messages.map((msg) => {
                        const isAdmin = msg.sender === 'admin';
                        return (
                          <motion.div initial={{ opacity: 0, y: 15, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} key={msg.id} layout className={`flex ${isAdmin ? 'justify-end' : 'justify-start'} group relative`}>
                            <div className={`relative px-6 py-4 max-w-[75%] text-[15px] leading-relaxed shadow-sm border ${isAdmin ? 'bg-gradient-to-br from-blue-600 to-indigo-600 border-blue-500/50 text-white rounded-3xl rounded-tr-sm' : (isDarkMode ? 'bg-white/10 border-white/5 text-gray-200 rounded-3xl rounded-tl-sm' : 'bg-white border-slate-200 text-slate-800 rounded-3xl rounded-tl-sm')}`}>
                              {msg.text}
                              {msg.isEdited && <div className={`text-[10px] mt-1.5 italic text-right ${isAdmin ? 'text-white/70' : 'text-gray-400'}`}>Edited</div>}
                            </div>
                            {isAdmin && (
                              <div className="absolute top-1/2 -translate-y-1/2 -left-20 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                <button onClick={() => {setEditingMsgId(msg.id); setNewMessage(msg.text);}} className={`p-2 rounded-lg transition-all ${isDarkMode ? 'bg-white/10 hover:bg-blue-500/30 text-blue-300' : 'bg-white shadow-sm hover:bg-blue-50 text-blue-600'}`}><Edit2 size={14}/></button>
                                <button onClick={() => deleteMessage(msg.id)} className={`p-2 rounded-lg transition-all ${isDarkMode ? 'bg-white/10 hover:bg-red-500/30 text-red-300' : 'bg-white shadow-sm hover:bg-red-50 text-red-600'}`}><Trash2 size={14}/></button>
                              </div>
                            )}
                          </motion.div>
                        )
                      })}
                      {activeChatDoc?.userTyping && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                          <div className={`px-6 py-5 rounded-3xl rounded-tl-sm border flex gap-1.5 items-center ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}><div className={`w-1.5 h-1.5 rounded-full animate-bounce ${isDarkMode ? 'bg-gray-400' : 'bg-blue-500'}`}/><div className={`w-1.5 h-1.5 rounded-full animate-bounce ${isDarkMode ? 'bg-gray-400' : 'bg-blue-500'}`} style={{animationDelay:'0.1s'}}/><div className={`w-1.5 h-1.5 rounded-full animate-bounce ${isDarkMode ? 'bg-gray-400' : 'bg-blue-500'}`} style={{animationDelay:'0.2s'}}/></div>
                        </motion.div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Replies & Input */}
                    <div className={`p-6 border-t z-10 transition-colors duration-500 ${isDarkMode ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-white'}`}>
                      <AnimatePresence>
                        {showQuickReplies && (
                          <motion.div initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 10, height: 0 }} className="flex flex-wrap gap-2 mb-4 max-w-5xl mx-auto overflow-hidden">
                            {QUICK_REPLIES.map((reply, i) => (
                              <button key={i} onClick={() => handleSendMessage(null, reply)} className={`text-xs font-semibold px-4 py-2 rounded-full transition-all border ${isDarkMode ? 'bg-blue-500/10 border-blue-500/20 text-blue-300 hover:bg-blue-500/30' : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'}`}>{reply}</button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      <form onSubmit={(e) => handleSendMessage(e)} className="flex gap-3 max-w-5xl mx-auto relative items-center">
                        <button type="button" onClick={() => setShowQuickReplies(!showQuickReplies)} className={`p-3.5 rounded-2xl transition-all shadow-sm ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-yellow-400' : 'bg-yellow-50 hover:bg-yellow-100 text-yellow-600 border border-yellow-200'}`} title="Quick Replies"><Zap size={20}/></button>
                        
                        {editingMsgId && <button type="button" onClick={() => {setEditingMsgId(null); setNewMessage("");}} className="px-4 bg-gray-500 text-white rounded-2xl shadow-md"><X size={20}/></button>}
                        
                        <input type="text" value={newMessage} onChange={handleTyping} placeholder={editingMsgId ? "Edit your message..." : (ghostMode ? "Type silently..." : "Transmit message...")} className={`flex-1 rounded-2xl pl-6 pr-16 py-4 transition-all shadow-inner font-medium focus:outline-none focus:ring-4 ${inputBg} ${editingMsgId ? 'ring-amber-500/30' : 'focus:ring-blue-500/20'}`}/>
                        
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="submit" disabled={!newMessage.trim()} className={`absolute right-2 top-2 bottom-2 px-5 disabled:opacity-0 text-white rounded-xl transition-all shadow-lg flex items-center ${editingMsgId || ghostMode ? 'bg-amber-500 hover:bg-amber-400' : 'bg-blue-600 hover:bg-blue-500'}`}>
                          {editingMsgId ? <span className="text-sm font-bold">Save</span> : <Send size={20} className="ml-0.5" />}
                        </motion.button>
                      </form>
                    </div>
                  </>
                ) : (
                   <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-6 opacity-60"><MessageSquare size={80} strokeWidth={1} /><p className="text-xl font-medium tracking-wide">Select an active session to begin.</p></div>
                )}
              </div>
            </motion.div>
          )}

          {/* --- TAB: ID MANAGEMENT --- */}
          {activeTab === 'ids' && (
            <motion.div key="ids" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`w-full h-full flex flex-col rounded-3xl overflow-hidden p-8 transition-colors duration-500 ${panelBg}`}>
              <div className={`flex justify-between items-center mb-8 border-b pb-6 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <div>
                  <h2 className="text-3xl font-extrabold tracking-wide">Access Vectors</h2>
                  <p className="text-gray-400 font-medium mt-1">Generate and control secure client invitations.</p>
                </div>
                <button onClick={cleanupExpiredIDs} className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all font-bold shadow-sm ${isDarkMode ? 'bg-white/5 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200'}`}>
                  <Clock size={18}/> Clean Expired
                </button>
              </div>

              {/* ID Generator */}
              <div className={`p-6 rounded-2xl mb-8 border shadow-sm ${isDarkMode ? 'bg-black/20 border-white/10' : 'bg-white border-slate-200'}`}>
                <form onSubmit={handleCreateCode} className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Custom ID</label>
                    <input type="text" value={newCodeId} onChange={(e) => setNewCodeId(e.target.value)} placeholder="e.g., SECURE-01" className={`w-full rounded-xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all font-mono uppercase font-bold shadow-inner ${inputBg}`}/>
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Expiration Window</label>
                    <select value={expiryHours} onChange={(e) => setExpiryHours(e.target.value)} className={`w-full rounded-xl px-5 py-4 outline-none cursor-pointer transition-all font-medium appearance-none shadow-inner ${inputBg}`}>
                      <option value="1">⏱ 1 Hour</option>
                      <option value="2">⏱ 2 Hours</option>
                      <option value="3">⏱ 3 Hours</option>
                      <option value="4">⏱ 4 Hours</option>
                      <option value="5">⏱ 5 Hours</option>
                      <option value="6">⏱ 6 Hours</option>
                      <option value="12">⏱ 12 Hours</option>
                      <option value="24">⏱ 24 Hours</option>
                      <option value="0">∞ Permanent</option>
                    </select>
                  </div>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={!newCodeId.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-8 py-4 rounded-xl font-bold flex items-center gap-2 shadow-lg h-[58px]">
                    <Plus size={20}/> Generate
                  </motion.button>
                </form>
              </div>

              {/* ID List Grid */}
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <AnimatePresence>
                    {accessCodes.map(code => {
                      const isExpired = code.expiresAt && code.expiresAt < Date.now();
                      return (
                        <motion.div variants={popItem} key={code.id} layout exit={{ opacity: 0, scale: 0.8 }} className={`p-5 rounded-2xl border flex flex-col justify-between h-40 transition-all group ${isExpired ? (isDarkMode ? 'bg-black/40 border-white/5 opacity-50 grayscale' : 'bg-slate-100 border-slate-200 opacity-60 grayscale') : (isDarkMode ? 'bg-white/5 border-white/10 hover:border-white/20' : 'bg-white border-slate-200 shadow-sm hover:shadow-md')}`}>
                          <div className="flex justify-between items-start">
                            <span className="font-bold tracking-wider font-mono text-lg truncate">{code.id}</span>
                            <span className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full font-bold ${code.type === 'permanent' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                              {isExpired ? 'EXPIRED' : code.type}
                            </span>
                          </div>
                          <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity mt-auto">
                            <button onClick={() => toggleBlockStatus(code.id, code.status)} className={`flex-1 py-2.5 rounded-xl flex justify-center items-center text-xs font-bold transition-all border ${code.status === 'active' ? 'bg-orange-500/10 text-orange-500 border-orange-500/30 hover:bg-orange-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20'}`}>
                              {code.status === 'active' ? <Ban size={14} className="mr-1.5"/> : <CheckCircle size={14} className="mr-1.5"/>}
                              {code.status === 'active' ? 'BLOCK' : 'UNBLOCK'}
                            </button>
                            <button onClick={() => deleteCode(code.id)} className="flex-1 py-2.5 rounded-xl flex justify-center items-center text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 transition-all">
                              <Trash2 size={14} className="mr-1.5"/> DELETE
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* --- TAB: SETTINGS --- */}
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`w-full h-full flex flex-col rounded-3xl overflow-hidden p-8 transition-colors duration-500 ${panelBg}`}>
              <div className={`mb-8 border-b pb-6 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <h2 className="text-3xl font-extrabold tracking-wide">System Configuration</h2>
                <p className="text-gray-400 font-medium mt-1">Manage your administrative footprint.</p>
              </div>

              <div className="max-w-2xl space-y-6">
                {/* Ghost Mode Toggle */}
                <div className={`border p-6 rounded-2xl flex items-center justify-between shadow-sm transition-colors duration-500 ${isDarkMode ? 'bg-black/20 border-white/10' : 'bg-white border-slate-200'}`}>
                  <div className="flex gap-5 items-center">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md transition-colors ${ghostMode ? 'bg-amber-500/20 text-amber-500' : (isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-slate-100 text-slate-400')}`}>
                      <Ghost size={28} />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold">Incognito / Ghost Mode</h3>
                      <p className="text-sm text-gray-500 mt-1 font-medium">When active, users will not see your "Online" status, last seen timestamp, or typing indicators.</p>
                    </div>
                  </div>
                  <button onClick={() => setGhostMode(!ghostMode)} className={`relative w-16 h-8 rounded-full transition-colors duration-300 focus:outline-none shadow-inner ${ghostMode ? 'bg-amber-500' : 'bg-gray-400'}`}>
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

// Sidebar Nav Button Component
function NavButton({ icon, label, active, onClick, isDarkMode }) {
  return (
    <button onClick={onClick} className={`w-full p-3.5 flex flex-col items-center justify-center gap-1.5 rounded-2xl transition-all duration-300 relative group ${active ? (isDarkMode ? 'text-white bg-white/10 shadow-inner' : 'text-blue-600 bg-blue-50 shadow-inner') : (isDarkMode ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-50')}`}>
      {icon}
      <span className="text-[10px] font-extrabold tracking-widest">{label}</span>
      {active && <motion.div layoutId="activeTab" className="absolute left-0 top-1/4 bottom-1/4 w-1.5 bg-blue-500 rounded-r-full shadow-sm" />}
    </button>
  );
}
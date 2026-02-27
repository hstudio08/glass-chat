import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { Send, LogOut, ShieldCheck, AlertCircle, Lock, Sun, Moon, WifiOff, ChevronDown, CheckCheck } from 'lucide-react';
import { db } from '../services/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import Login from './Login';

export default function UserChat() {
  // Core State
  const [chatId, setChatId] = useState(null); 
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  
  // UX & Feature State
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [connectionError, setConnectionError] = useState("");

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const previousMessageCount = useRef(0);
  const audioRef = useRef(typeof Audio !== "undefined" ? new Audio('/pop.mp3') : null);

  // --- Theme Variables ---
  const themeBg = isDarkMode ? "bg-[#0a0f1a]" : "bg-slate-50";
  const panelBg = isDarkMode ? "bg-white/5 border-white/10 backdrop-blur-3xl" : "bg-white/60 border-white/60 backdrop-blur-3xl shadow-2xl";
  const textPrimary = isDarkMode ? "text-white" : "text-slate-900";
  const inputBg = isDarkMode ? "bg-white/5 border-white/10 text-white placeholder-gray-500" : "bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white shadow-sm";

  // 1. Network & Privacy Listeners
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    const handleKeyDown = (e) => {
      if (e.key === 'PrintScreen' || (e.ctrlKey && e.key === 'p')) {
        setPrivacyMode(true);
        navigator.clipboard.writeText("Screenshots disabled for secure session.");
        setTimeout(() => setPrivacyMode(false), 3000);
      }
    };
    
    const handleBlur = () => setPrivacyMode(true);
    const handleFocus = () => setPrivacyMode(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('keyup', handleKeyDown);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keyup', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // 2. Fetch Messages & Track Admin
  useEffect(() => {
    if (!chatId) return;
    setConnectionError("");
    
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(fetchedMessages);
      
      // Play sound if admin sends a new message
      if (previousMessageCount.current !== 0 && fetchedMessages.length > previousMessageCount.current) {
        const lastMessage = fetchedMessages[fetchedMessages.length - 1];
        if (lastMessage && lastMessage.sender === 'admin') {
          audioRef.current?.play().catch(() => {});
        }
      }
      previousMessageCount.current = fetchedMessages.length;
      
      // Auto-scroll if near bottom
      setTimeout(() => scrollToBottom('smooth'), 100);
    }, () => setConnectionError("Secure connection lost."));

    const unsubscribeTyping = onSnapshot(doc(db, 'chats', chatId), (docSnap) => {
      if (docSnap.exists()) setIsAdminTyping(docSnap.data().adminTyping || false);
    });

    return () => { unsubscribe(); unsubscribeTyping(); previousMessageCount.current = 0; };
  }, [chatId]);

  // 3. User Online Presence
  useEffect(() => {
    if (!chatId) return;
    const setOnline = () => setDoc(doc(db, 'chats', chatId), { userOnline: true }, { merge: true }).catch(()=>{});
    const setOffline = () => setDoc(doc(db, 'chats', chatId), { userOnline: false, userLastSeen: serverTimestamp() }, { merge: true }).catch(()=>{});
    
    setOnline();
    const handleVisibility = () => document.visibilityState === 'visible' ? setOnline() : setOffline();
    
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', setOffline);
    
    return () => {
      setOffline(); 
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', setOffline);
    };
  }, [chatId]);

  // --- Handlers ---
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // Show button if we scroll up more than 100px from bottom
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
  };

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleInputFocus = () => { if (chatId) setDoc(doc(db, 'chats', chatId), { userTyping: true }, { merge: true }).catch(() => {}); };
  const handleInputBlur = () => { if (chatId) setDoc(doc(db, 'chats', chatId), { userTyping: false }, { merge: true }).catch(() => {}); };

  const handleSendText = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId || isOffline) return;
    
    const text = newMessage;
    setNewMessage(""); 
    scrollToBottom('auto'); // Snap to bottom instantly on send
    
    try {
      setDoc(doc(db, 'chats', chatId), { userTyping: false }, { merge: true }).catch(() => {});
      await addDoc(collection(db, 'chats', chatId, 'messages'), { text: text, sender: "user", timestamp: serverTimestamp() });
    } catch (error) { alert("Message failed to send."); }
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    if (chatId) setDoc(doc(db, 'chats', chatId), { userTyping: false }, { merge: true }).catch(() => {});
    setTimeout(() => { setChatId(null); setMessages([]); setIsLoggingOut(false); }, 600); 
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "Sending...";
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(timestamp.toDate());
  };

  // --- Render ---
  if (!chatId) return <Login onLogin={setChatId} />;

  return (
    <div className={`flex h-[100dvh] w-full items-center justify-center p-0 sm:p-8 relative overflow-hidden select-none transition-colors duration-700 ${themeBg}`}>
      
      {/* Animated Ambient Background (Hidden on Mobile for Performance) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 hidden sm:block">
        <div className={`absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full mix-blend-multiply filter blur-[120px] animate-blob ${isDarkMode ? 'bg-blue-600/20' : 'bg-blue-300/40'}`}></div>
        <div className={`absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full mix-blend-multiply filter blur-[120px] animate-blob animation-delay-2000 ${isDarkMode ? 'bg-indigo-600/20' : 'bg-purple-300/40'}`}></div>
      </div>

      <AnimatePresence>
        {!isLoggingOut && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 30 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`flex flex-col w-full h-[100dvh] sm:h-full sm:max-h-[85vh] sm:max-w-3xl relative z-10 sm:rounded-3xl rounded-none overflow-hidden transition-colors duration-500 ${panelBg}`}
          >
            {/* 🛑 Offline Overlay */}
            <AnimatePresence>
              {isOffline && (
                <motion.div initial={{ opacity: 0, backdropFilter: "blur(0px)" }} animate={{ opacity: 1, backdropFilter: "blur(20px)" }} exit={{ opacity: 0, backdropFilter: "blur(0px)" }} className="absolute inset-0 bg-black/60 z-[60] flex flex-col items-center justify-center text-white">
                  <WifiOff size={64} className="text-red-400 mb-4 animate-pulse" />
                  <h2 className="text-2xl font-extrabold tracking-widest uppercase text-red-400">Connection Lost</h2>
                  <p className="text-gray-300 mt-2 font-medium">Waiting for network...</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 🛡️ Privacy Shield Overlay */}
            <AnimatePresence>
              {privacyMode && !isOffline && (
                <motion.div initial={{ opacity: 0, backdropFilter: "blur(0px)" }} animate={{ opacity: 1, backdropFilter: "blur(40px)" }} exit={{ opacity: 0, backdropFilter: "blur(0px)" }} className="absolute inset-0 bg-black/80 z-[55] flex flex-col items-center justify-center text-white">
                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}><Lock size={64} className="text-blue-400 mb-6 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]" /></motion.div>
                  <h2 className="text-3xl font-extrabold tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Session Locked</h2>
                  <p className="text-gray-300 mt-3 font-medium text-lg">Tap anywhere to resume.</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header */}
            <div className={`h-20 sm:h-24 border-b flex items-center justify-between px-6 sm:px-8 z-20 pt-safe transition-colors duration-500 ${isDarkMode ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-white/80'}`}>
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg shadow-blue-500/30">
                  <ShieldCheck className="text-white" size={24} />
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-[#0f172a] rounded-full animate-pulse"></span>
                </div>
                <div>
                  <h3 className={`font-extrabold text-lg sm:text-xl tracking-tight ${textPrimary}`}>Support Team</h3>
                  <p className="text-xs sm:text-sm font-semibold text-blue-500 flex items-center gap-1.5 mt-0.5"><Lock size={12}/> Encrypted Connection</p>
                </div>
              </div>
              <div className="flex gap-2 sm:gap-3 items-center">
                <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-3 rounded-2xl transition-all shadow-sm border ${isDarkMode ? 'bg-white/10 border-white/10 text-yellow-400 hover:bg-white/20' : 'bg-white border-slate-200 text-slate-400 hover:text-blue-500 hover:bg-slate-50'}`}>
                  {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                <button onClick={handleLogout} className={`p-3 rounded-2xl transition-all shadow-sm border ${isDarkMode ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' : 'bg-white border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50'}`}>
                  <LogOut size={20} />
                </button>
              </div>
            </div>

            {/* Connection Error Banner */}
            <AnimatePresence>
              {connectionError && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-red-500 text-white text-sm font-bold px-6 py-2.5 flex items-center justify-center gap-2 shadow-inner">
                  <AlertCircle size={16} /> {connectionError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages Area */}
            <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 custom-scrollbar z-10 relative">
              <AnimatePresence>
                {messages.length === 0 ? (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full text-center gap-4">
                    <div className={`p-6 rounded-full ${isDarkMode ? 'bg-white/5 text-blue-500' : 'bg-blue-50 text-blue-500'}`}><ShieldCheck size={48} /></div>
                    <div>
                      <h4 className={`text-lg font-bold ${textPrimary}`}>Secure Channel Open</h4>
                      <p className="text-sm text-gray-400 font-medium mt-1">Messages are end-to-end encrypted.</p>
                    </div>
                  </motion.div>
                ) : (
                  messages.map((msg) => {
                    const isUser = msg.sender === 'user';
                    return (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} layout className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className={`relative px-5 py-3.5 sm:px-6 sm:py-4 max-w-[85%] sm:max-w-[75%] shadow-sm border ${isUser ? 'bg-gradient-to-br from-blue-600 to-indigo-600 border-blue-500/50 text-white rounded-3xl rounded-tr-sm' : (isDarkMode ? 'bg-white/10 border-white/5 text-gray-200 rounded-3xl rounded-tl-sm backdrop-blur-md' : 'bg-white border-slate-200 text-slate-800 rounded-3xl rounded-tl-sm shadow-md')}`}>
                          <p className="text-[15px] sm:text-[16px] leading-relaxed break-words">{msg.text}</p>
                          <div className={`text-[10px] font-bold mt-2 flex items-center gap-1.5 ${isUser ? 'justify-end text-blue-200' : 'justify-start text-gray-400'}`}>
                            {msg.isEdited && <span className="italic opacity-80">(edited)</span>}
                            {formatTime(msg.timestamp)}
                            {isUser && <CheckCheck size={14} className="opacity-80" />}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })
                )}
                
                {/* Support Typing Indicator */}
                {isAdminTyping && (
                  <motion.div initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex justify-start">
                    <div className={`px-5 py-4 rounded-3xl rounded-tl-sm border flex items-center gap-2 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Support typing</span>
                      <div className="flex gap-1 ml-1"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"/><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:'0.1s'}}/><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:'0.2s'}}/></div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} className="h-2" />
            </div>

            {/* Smart Scroll-to-Bottom Button */}
            <AnimatePresence>
              {showScrollButton && (
                <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} onClick={() => scrollToBottom()} className="absolute bottom-24 sm:bottom-28 right-6 p-3 bg-white text-blue-600 rounded-full shadow-[0_4px_15px_rgba(0,0,0,0.15)] z-30 hover:bg-slate-50 transition-colors">
                  <ChevronDown size={20} strokeWidth={3} />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Input Form (PB-SAFE for iOS) */}
            <div className={`p-4 sm:p-6 border-t z-20 pb-safe transition-colors duration-500 ${isDarkMode ? 'bg-black/20 border-white/10' : 'bg-slate-50/90 backdrop-blur-xl border-slate-200'}`}>
              <form onSubmit={handleSendText} className="flex gap-3 max-w-4xl mx-auto relative items-center">
                <input 
                  type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onFocus={handleInputFocus} onBlur={handleInputBlur} placeholder="Type a secure message..." disabled={isOffline}
                  className={`flex-1 rounded-full pl-6 pr-16 py-3.5 sm:py-4 focus:outline-none transition-all font-medium text-[16px] disabled:opacity-50 ${inputBg} ${isDarkMode ? 'focus:ring-2 focus:ring-blue-500/40' : 'focus:ring-4 focus:ring-blue-500/20 focus:border-blue-300'}`}
                />
                <div className="absolute right-1.5">
                  <motion.button whileTap={{ scale: 0.9 }} type="submit" disabled={!newMessage.trim() || isOffline} className="bg-gradient-to-tr from-blue-600 to-indigo-600 disabled:opacity-0 text-white p-2.5 sm:p-3 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <Send size={18} className="ml-0.5" />
                  </motion.button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
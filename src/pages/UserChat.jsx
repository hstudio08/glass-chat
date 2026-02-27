import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { Send, LogOut, ShieldCheck, AlertCircle, Lock } from 'lucide-react';
import { db } from '../services/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import Login from './Login';

export default function UserChat() {
  const [chatId, setChatId] = useState(null); 
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  
  // Privacy & UX State
  const [privacyMode, setPrivacyMode] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const messagesEndRef = useRef(null);

  // 1. Anti-Screenshot & Privacy Shield Logic
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Deterrent for PrintScreen or Ctrl+P
      if (e.key === 'PrintScreen' || (e.ctrlKey && e.key === 'p')) {
        setPrivacyMode(true);
        navigator.clipboard.writeText("Screenshots are disabled for this secure session.");
        setTimeout(() => setPrivacyMode(false), 3000);
      }
    };
    
    // Blackout screen when window loses focus (switches tabs, minimizes)
    const handleBlur = () => setPrivacyMode(true);
    const handleFocus = () => setPrivacyMode(false);

    window.addEventListener('keyup', handleKeyDown);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('keyup', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // 2. Fetch Messages & Admin Typing
  useEffect(() => {
    if (!chatId) return;
    
    setConnectionError("");
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      // Smooth auto-scroll
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }, () => setConnectionError("Lost connection to secure server."));

    const unsubscribeTyping = onSnapshot(doc(db, 'chats', chatId), (docSnap) => {
      if (docSnap.exists()) setIsAdminTyping(docSnap.data().adminTyping || false);
    });

    return () => { unsubscribe(); unsubscribeTyping(); };
  }, [chatId]);
  // 3. User Presence Tracker (Sends status to Admin)
  useEffect(() => {
    if (!chatId) return;

    // Mark as online when tab is open and focused
    const setOnline = () => setDoc(doc(db, 'chats', chatId), { userOnline: true }, { merge: true }).catch(()=>{});
    
    // Mark as offline and stamp time when they leave/minimize
    const setOffline = () => setDoc(doc(db, 'chats', chatId), { userOnline: false, userLastSeen: serverTimestamp() }, { merge: true }).catch(()=>{});

    // Initial load
    setOnline();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') setOnline();
      else setOffline();
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', setOffline);

    return () => {
      setOffline(); // Set offline if component unmounts
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', setOffline);
    };
  }, [chatId]);

  // 3. Optimized Typing Status (Saves thousands of database writes!)
  const handleInputFocus = () => {
    if (chatId) setDoc(doc(db, 'chats', chatId), { userTyping: true }, { merge: true }).catch(() => {});
  };

  const handleInputBlur = () => {
    if (chatId) setDoc(doc(db, 'chats', chatId), { userTyping: false }, { merge: true }).catch(() => {});
  };

  const handleSendText = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId) return;
    
    const text = newMessage;
    setNewMessage(""); 
    
    try {
      // Turn off typing indicator in background
      setDoc(doc(db, 'chats', chatId), { userTyping: false }, { merge: true }).catch(() => {});
      
      // Send actual message
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: text, 
        sender: "user", 
        timestamp: serverTimestamp()
      });
    } catch (error) {
      alert("Message failed to send. Please check your connection.");
    }
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    // Tell the admin we stopped typing before leaving
    if (chatId) setDoc(doc(db, 'chats', chatId), { userTyping: false }, { merge: true }).catch(() => {});
    
    // Wait for fade-out animation before clearing state
    setTimeout(() => {
      setChatId(null);
      setMessages([]);
      setIsLoggingOut(false);
    }, 600); 
  };

  // Helper to format timestamps (e.g., "10:42 AM")
  const formatTime = (timestamp) => {
    if (!timestamp) return "Sending...";
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
  };

  // --- Render ---
  if (!chatId) return <Login onLogin={setChatId} />;

  return (
    <div className="flex h-screen w-full items-center justify-center p-4 sm:p-8 relative overflow-hidden select-none bg-gray-50">
      
      {/* Premium Animated Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-400/30 rounded-full mix-blend-multiply filter blur-[120px] animate-blob"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-400/30 rounded-full mix-blend-multiply filter blur-[120px] animate-blob animation-delay-2000"></div>
      </div>

      <AnimatePresence>
        {!isLoggingOut && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 30 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="glass-panel flex flex-col w-full max-w-3xl h-full max-h-[85vh] overflow-hidden relative z-10 shadow-2xl border border-white/60 bg-white/40 backdrop-blur-2xl rounded-3xl"
          >
            {/* 🛡️ PRIVACY SHIELD OVERLAY 🛡️ */}
            <AnimatePresence>
              {privacyMode && (
                <motion.div 
                  initial={{ opacity: 0, backdropFilter: "blur(0px)" }} animate={{ opacity: 1, backdropFilter: "blur(40px)" }} exit={{ opacity: 0, backdropFilter: "blur(0px)" }} transition={{ duration: 0.2 }}
                  className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center text-white"
                >
                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                    <Lock size={64} className="text-blue-400 mb-6 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]" />
                  </motion.div>
                  <h2 className="text-3xl font-extrabold tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Session Locked</h2>
                  <p className="text-gray-300 mt-3 font-medium text-lg">Tap anywhere to resume secure connection.</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header */}
            <div className="h-24 border-b border-white/40 bg-white/50 flex items-center justify-between px-8 z-20">
              <div className="flex items-center gap-5">
                <div className="relative flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg shadow-blue-500/30">
                  <ShieldCheck className="text-white" size={28} />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse shadow-sm"></span>
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-xl tracking-tight">Support Team</h3>
                  <p className="text-sm font-semibold text-blue-600 flex items-center gap-1.5 mt-0.5">
                    <Lock size={12}/> End-to-End Encrypted
                  </p>
                </div>
              </div>
              <motion.button whileHover={{ scale: 1.05, backgroundColor: "rgba(239, 68, 68, 0.1)" }} whileTap={{ scale: 0.95 }} onClick={handleLogout} title="Disconnect Securely" className="text-gray-500 hover:text-red-500 transition-colors p-3.5 rounded-2xl bg-white/60 shadow-sm border border-white/50">
                <LogOut size={22} />
              </motion.button>
            </div>

            {/* Connection Error Banner */}
            <AnimatePresence>
              {connectionError && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-red-500/90 text-white text-sm font-semibold px-6 py-2.5 flex items-center justify-center gap-2 backdrop-blur-md shadow-inner">
                  <AlertCircle size={16} /> {connectionError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar z-10 bg-gradient-to-b from-white/10 to-transparent">
              <AnimatePresence>
                {messages.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
                    <ShieldCheck size={56} className="opacity-20 text-blue-600" />
                    <p className="font-semibold tracking-wide">Secure channel open. Say hello!</p>
                  </motion.div>
                ) : (
                  messages.map((msg) => {
                    const isUser = msg.sender === 'user';
                    return (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 15, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} layout className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className={`relative px-6 py-4 max-w-[85%] sm:max-w-[75%] shadow-md backdrop-blur-md border ${isUser ? 'bg-gradient-to-br from-blue-600 to-indigo-600 border-blue-500/50 text-white rounded-3xl rounded-tr-sm' : 'bg-white/90 border-white/60 text-gray-800 rounded-3xl rounded-tl-sm'}`}>
                          <p className="text-[16px] leading-relaxed break-words">{msg.text}</p>
                          
                          {/* Sleek Timestamp */}
                          <div className={`text-[10px] font-medium mt-1.5 flex ${isUser ? 'justify-end text-blue-200' : 'justify-start text-gray-400'}`}>
                            {formatTime(msg.timestamp)}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })
                )}
                
                {/* Support Typing Indicator */}
                {isAdminTyping && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="flex justify-start">
                    <div className="bg-white/90 border border-white/60 px-6 py-4 rounded-3xl rounded-tl-sm shadow-md flex items-center gap-3">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Support is typing</span>
                      <div className="flex gap-1.5 mt-0.5">
                        <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                        <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                        <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Floating Input Form Area */}
            <div className="p-6 bg-white/50 backdrop-blur-2xl border-t border-white/60 z-20">
              <form onSubmit={handleSendText} className="flex gap-3 max-w-4xl mx-auto relative items-center">
                <input 
                  type="text" value={newMessage} 
                  onChange={(e) => setNewMessage(e.target.value)}
                  onFocus={handleInputFocus} 
                  onBlur={handleInputBlur}
                  placeholder="Type your message..." 
                  className="flex-1 bg-white/80 border border-white/60 rounded-full pl-7 pr-16 py-4 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all text-gray-800 placeholder-gray-400 shadow-inner font-medium text-[16px]"
                />
                <div className="absolute right-2">
                  <motion.button 
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="submit" disabled={!newMessage.trim()}
                    className="bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-0 text-white p-3.5 rounded-full transition-all flex items-center justify-center shadow-lg shadow-blue-500/40"
                  >
                    <Send size={20} className="ml-0.5" />
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
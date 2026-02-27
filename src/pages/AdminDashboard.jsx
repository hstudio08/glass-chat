import { useState, useEffect, useRef } from 'react';
import { auth, db, googleProvider } from '../services/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { Send, LogOut, Plus, Trash2, Ban, CheckCircle, Clock, ShieldHalf, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ADMIN_EMAIL = "hstudio.webdev@gmail.com";

export default function AdminDashboard() {
  const [adminUser, setAdminUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [accessCodes, setAccessCodes] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isUserTyping, setIsUserTyping] = useState(false);
  
  const [newCodeId, setNewCodeId] = useState("");
  const [expiryHours, setExpiryHours] = useState("0"); 
  
  const messagesEndRef = useRef(null);
  const audioRef = useRef(typeof Audio !== "undefined" ? new Audio('/pop.mp3') : null);
  const previousMessageCount = useRef(0);
  const isWindowFocused = useRef(true);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email === ADMIN_EMAIL) setAdminUser(user);
      else if (user) signOut(auth);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Tab Focus Listener (For Audio/Visual Alerts)
  useEffect(() => {
    const handleFocus = () => { isWindowFocused.current = true; document.title = "Admin HQ | GlassChat"; };
    const handleBlur = () => isWindowFocused.current = false;
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    return () => { window.removeEventListener('focus', handleFocus); window.removeEventListener('blur', handleBlur); };
  }, []);

  // 3. Fetch Access Codes
  useEffect(() => {
    if (!adminUser) return;
    const q = query(collection(db, 'access_codes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAccessCodes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Access Codes Error:", error));
    return () => unsubscribe();
  }, [adminUser]);

  // 4. Active Chat & Typing Listener (CRASH-PROOFED)
  useEffect(() => {
    if (!activeChatId) return;
    
    // Fetch Messages
    const q = query(collection(db, 'chats', activeChatId, 'messages'), orderBy('timestamp', 'asc'));
    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(fetchedMessages);
      
      // Play sound if new message from user
      if (previousMessageCount.current !== 0 && fetchedMessages.length > previousMessageCount.current) {
        const lastMessage = fetchedMessages[fetchedMessages.length - 1];
        if (lastMessage && lastMessage.sender === 'user') {
          audioRef.current?.play().catch(() => {});
          if (!isWindowFocused.current) document.title = "💬 New Message!";
        }
      }
      previousMessageCount.current = fetchedMessages.length;
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }, (error) => console.error("Messages Error:", error));

    // Listen for User Typing
    const unsubscribeTyping = onSnapshot(doc(db, 'chats', activeChatId), (docSnap) => {
      if (docSnap.exists()) setIsUserTyping(docSnap.data().userTyping || false);
    }, (error) => console.error("Typing Error:", error));

    return () => { 
      unsubscribeMessages(); 
      unsubscribeTyping(); 
      previousMessageCount.current = 0; 
    };
  }, [activeChatId]);

  // --- Handlers ---

  const handleCreateCode = async (e) => {
    e.preventDefault();
    if (!newCodeId.trim()) return;
    let expiresAt = null;
    if (parseInt(expiryHours) > 0) expiresAt = Date.now() + (parseInt(expiryHours) * 60 * 60 * 1000);
    
    await setDoc(doc(db, 'access_codes', newCodeId), { type: expiresAt ? "temporary" : "permanent", status: "active", createdAt: Date.now(), expiresAt: expiresAt });
    await setDoc(doc(db, 'chats', newCodeId), { userTyping: false, adminTyping: false }, { merge: true });
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

  // The newly fixed, crash-proof Message Sender
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatId) return;
    
    const text = newMessage;
    setNewMessage("");
    
    try {
      // Background typing stop
      setDoc(doc(db, 'chats', activeChatId), { adminTyping: false }, { merge: true }).catch(() => {});
      
      // Send actual message
      await addDoc(collection(db, 'chats', activeChatId, 'messages'), { 
        text: text, 
        sender: "admin", 
        timestamp: serverTimestamp() 
      });
    } catch (error) {
      console.error("Message Sending Error:", error);
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (activeChatId) {
      setDoc(doc(db, 'chats', activeChatId), { adminTyping: e.target.value.length > 0 }, { merge: true }).catch(() => {});
    }
  };

  // --- Render ---
  if (authLoading) return <div className="flex h-screen items-center justify-center text-white bg-[#0f172a]">Loading Terminal...</div>;

  if (!adminUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-4 bg-[#0f172a] relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-pulse delay-1000"></div>
        
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel w-full max-w-md p-10 flex flex-col items-center bg-white/5 border border-white/10 backdrop-blur-2xl z-10">
          <ShieldHalf size={64} className="text-blue-500 mb-6" />
          <h1 className="text-3xl font-extrabold text-white mb-2">Admin Terminal</h1>
          <p className="text-gray-400 mb-8 text-center">Restricted Access. Authentication required.</p>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => signInWithPopup(auth, googleProvider)} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all">
            Authenticate System
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full p-4 gap-4 bg-[#0f172a] font-sans selection:bg-blue-500/30 text-white overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full filter blur-[120px]"></div>
        <div className="absolute bottom-[0%] -right-[10%] w-[40%] h-[50%] bg-indigo-600/10 rounded-full filter blur-[120px]"></div>
      </div>

      {/* Sidebar */}
      <motion.div initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="w-1/3 max-w-sm flex flex-col bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-2xl z-10 shadow-2xl">
        <div className="p-6 border-b border-white/10 bg-black/20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Activity className="text-blue-400" size={24} />
            <h2 className="font-extrabold tracking-wide text-lg">System Core</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={cleanupExpiredIDs} title="Clean Expired" className="p-2 bg-white/5 hover:bg-yellow-500/20 text-yellow-400 rounded-lg transition-all"><Clock size={18}/></button>
            <button onClick={() => signOut(auth)} title="Sign Out" className="p-2 bg-white/5 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"><LogOut size={18}/></button>
          </div>
        </div>

        <div className="p-5 border-b border-white/10 bg-white/5">
          <form onSubmit={handleCreateCode} className="flex flex-col gap-3">
            <input type="text" value={newCodeId} onChange={(e) => setNewCodeId(e.target.value)} placeholder="Create ID (e.g., VIP-01)" className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors font-mono text-sm uppercase"/>
            <div className="flex gap-2">
              <select value={expiryHours} onChange={(e) => setExpiryHours(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-gray-300 text-sm flex-1 outline-none cursor-pointer hover:border-white/20 transition-colors">
                <option value="0">∞ Permanent</option>
                <option value="1">⏱ 1 Hour</option>
                <option value="12">⏱ 12 Hours</option>
                <option value="24">⏱ 24 Hours</option>
              </select>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="submit" disabled={!newCodeId.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 rounded-xl font-bold flex items-center shadow-lg transition-all"><Plus size={20}/></motion.button>
            </div>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          <AnimatePresence>
            {accessCodes.map(code => {
              const isExpired = code.expiresAt && code.expiresAt < Date.now();
              const isActive = activeChatId === code.id;
              return (
                <motion.div 
                  key={code.id}
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }} animate={{ opacity: 1, height: 'auto', marginBottom: 12 }} exit={{ opacity: 0, height: 0, marginBottom: 0, scale: 0.9 }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all duration-300 group ${isActive ? 'bg-blue-600/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'bg-black/20 border-white/5 hover:bg-white/5'} ${isExpired ? 'opacity-40 grayscale' : ''}`} 
                  onClick={() => setActiveChatId(code.id)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="font-bold tracking-wider font-mono text-sm truncate">{code.id}</span>
                    <span className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full font-bold ${code.type === 'permanent' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {isExpired ? 'EXPIRED' : code.type}
                    </span>
                  </div>
                  <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); toggleBlockStatus(code.id, code.status); }} className={`flex-1 py-2 rounded-xl flex justify-center items-center text-xs font-bold transition-all ${code.status === 'active' ? 'bg-orange-500/20 hover:bg-orange-500/40 text-orange-400' : 'bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400'}`}>
                      {code.status === 'active' ? <Ban size={14} className="mr-1.5"/> : <CheckCircle size={14} className="mr-1.5"/>}
                      {code.status === 'active' ? 'BLOCK' : 'UNBLOCK'}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteCode(code.id); }} className="flex-1 py-2 rounded-xl flex justify-center items-center text-xs font-bold bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-all">
                      <Trash2 size={14} className="mr-1.5"/> DELETE
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Main Chat */}
      <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex-1 flex flex-col bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-2xl z-10 shadow-2xl relative">
        {activeChatId ? (
          <>
            <div className="h-20 border-b border-white/10 bg-black/20 flex items-center px-8 gap-4 shadow-sm z-10">
              <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.8)]"></div>
              <div>
                <h3 className="font-bold text-lg tracking-wide">Secure Link: <span className="text-blue-400 font-mono">{activeChatId}</span></h3>
                <p className="text-xs text-gray-400">Monitoring connection...</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
              <AnimatePresence>
                {messages.map((msg) => (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 15, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} layout className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`px-6 py-4 max-w-[75%] text-[15px] leading-relaxed shadow-lg border ${msg.sender === 'admin' ? 'bg-blue-600 border-blue-500 text-white rounded-2xl rounded-tr-sm' : 'bg-white/10 border-white/5 text-gray-200 rounded-2xl rounded-tl-sm backdrop-blur-md'}`}>
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
                
                {isUserTyping && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="flex justify-start">
                    <div className="px-6 py-5 bg-white/5 text-gray-400 rounded-2xl rounded-tl-sm backdrop-blur-md border border-white/5 flex gap-1.5 items-center shadow-lg">
                      <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-2 h-2 bg-gray-400 rounded-full" />
                      <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-2 h-2 bg-gray-400 rounded-full" />
                      <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-2 h-2 bg-gray-400 rounded-full" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            <div className="p-6 border-t border-white/10 bg-black/20 z-10">
              <form onSubmit={handleSendMessage} className="flex gap-4 max-w-5xl mx-auto relative">
                <input type="text" value={newMessage} onChange={handleTyping} placeholder="Transmit secure message..." className="flex-1 bg-white/5 border border-white/10 rounded-2xl pl-6 pr-16 py-4 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all text-white placeholder-gray-500 shadow-inner font-medium"/>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="submit" disabled={!newMessage.trim()} className="absolute right-2 top-2 bottom-2 aspect-square bg-blue-600 hover:bg-blue-500 disabled:opacity-0 text-white rounded-xl transition-all flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Send size={20} className="ml-1" />
                </motion.button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-6 opacity-50">
            <ShieldHalf size={80} strokeWidth={1} />
            <p className="text-xl font-light tracking-wide">Awaiting secure channel selection.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
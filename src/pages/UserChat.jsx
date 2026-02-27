import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { Send, LogOut, ShieldCheck, AlertCircle } from 'lucide-react';
import { db } from '../services/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import Login from './Login';

export default function UserChat() {
  const [chatId, setChatId] = useState(null); 
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const messagesEndRef = useRef(null);

  // 1. Fetch Messages Listener (Crash-Proofed)
  useEffect(() => {
    if (!chatId) return;
    
    setConnectionError("");
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }, (error) => {
      console.error("Messages Listener Error:", error);
      setConnectionError("Lost connection to secure server.");
    });

    return () => unsubscribe();
  }, [chatId]);

  // 2. Typing Status Listener (Crash-Proofed)
  useEffect(() => {
    if (!chatId) return;

    const unsubscribeTyping = onSnapshot(doc(db, 'chats', chatId), (docSnap) => {
      if (docSnap.exists()) setIsAdminTyping(docSnap.data().adminTyping || false);
    }, (error) => {
      console.error("Typing Listener Error:", error);
    });

    return () => unsubscribeTyping();
  }, [chatId]);

  // --- Handlers ---

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId) return;
    
    const text = newMessage;
    setNewMessage(""); // Clear instantly for snappy UI
    
    try {
      // Fire-and-forget typing status (No await, no crashing if it fails)
      setDoc(doc(db, 'chats', chatId), { userTyping: false }, { merge: true }).catch(() => {});
      
      // Send the actual message
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: text, 
        sender: "user", 
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Message failed to send. Please check your connection.");
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (chatId) {
      // Update typing status in background
      setDoc(doc(db, 'chats', chatId), { userTyping: e.target.value.length > 0 }, { merge: true }).catch(() => {});
    }
  };

  const handleLogout = () => {
    setChatId(null);
    setMessages([]);
  };

  // --- Render ---

  if (!chatId) return <Login onLogin={setChatId} />;

  return (
    <div className="flex h-screen w-full items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      {/* Animated Background for User Chat */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-300/40 rounded-full mix-blend-multiply filter blur-[100px] animate-blob"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-300/40 rounded-full mix-blend-multiply filter blur-[100px] animate-blob animation-delay-2000"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="glass-panel flex flex-col w-full max-w-3xl h-full max-h-[85vh] overflow-hidden relative z-10"
      >
        {/* Header */}
        <div className="h-20 border-b border-white/30 bg-white/40 backdrop-blur-md flex items-center justify-between px-6 z-20 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full shadow-lg">
              <ShieldCheck className="text-white" size={24} />
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-400 border-2 border-white rounded-full animate-pulse"></span>
            </div>
            <div>
              <h3 className="font-extrabold text-gray-800 text-lg tracking-tight">Support Team</h3>
              <p className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                <ShieldCheck size={12}/> Secure Connection Active
              </p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-gray-500 hover:text-red-500 transition-all bg-white/50 hover:bg-white/80 p-3 rounded-full shadow-sm hover:shadow-md active:scale-95">
            <LogOut size={20} />
          </button>
        </div>

        {/* Connection Error Banner */}
        <AnimatePresence>
          {connectionError && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-red-500/90 text-white text-sm font-semibold px-6 py-2 flex items-center gap-2 backdrop-blur-md">
              <AlertCircle size={16} /> {connectionError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar z-10 bg-white/10">
          <AnimatePresence>
            {messages.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
                <ShieldCheck size={48} className="opacity-30 text-blue-500" />
                <p className="font-medium text-gray-600">Your secure session has started. Say hello!</p>
              </motion.div>
            ) : (
              messages.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 15, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} layout className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`px-6 py-3.5 max-w-[80%] text-[15px] leading-relaxed shadow-md backdrop-blur-md border ${msg.sender === 'user' ? 'bg-blue-600/90 border-blue-500/50 text-white rounded-2xl rounded-tr-sm' : 'bg-white/80 border-white/60 text-gray-800 rounded-2xl rounded-tl-sm'}`}>
                    {msg.text}
                  </div>
                </motion.div>
              ))
            )}
            
            {/* Admin Typing Indicator */}
            {isAdminTyping && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="flex justify-start">
                <div className="bg-white/80 border border-white/60 px-5 py-4 rounded-2xl rounded-tl-sm shadow-md flex gap-1.5 items-center">
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-2 h-2 bg-gray-500 rounded-full" />
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-2 h-2 bg-gray-500 rounded-full" />
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-2 h-2 bg-gray-500 rounded-full" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="p-5 bg-white/40 backdrop-blur-xl border-t border-white/40 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
          <form onSubmit={handleSend} className="flex gap-3 max-w-4xl mx-auto relative">
            <input 
              type="text" value={newMessage} onChange={handleTyping} placeholder="Type your message..." 
              className="flex-1 bg-white/70 border border-white/50 rounded-full pl-6 pr-14 py-4 focus:outline-none focus:ring-4 focus:ring-blue-400/30 transition-all text-gray-800 placeholder-gray-500 shadow-inner font-medium text-[15px]"
            />
            <motion.button 
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="submit" disabled={!newMessage.trim()}
              className="absolute right-2 top-2 bottom-2 aspect-square bg-blue-600 hover:bg-blue-700 disabled:opacity-0 text-white rounded-full transition-all flex items-center justify-center shadow-lg"
            >
              <Send size={18} className="ml-1" />
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
import { useState, useEffect, useRef } from 'react';
import { auth, db, googleProvider } from '../services/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { Send, LogOut, Plus, Trash2, Ban, CheckCircle, Clock } from 'lucide-react';

const ADMIN_EMAIL = "hstudio.webdev@gmail.com";

export default function AdminDashboard() {
  const [adminUser, setAdminUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Dashboard State
  const [accessCodes, setAccessCodes] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  
  // New Code Form State
  const [newCodeId, setNewCodeId] = useState("");
  const [expiryHours, setExpiryHours] = useState("0"); // 0 means permanent
  
  const messagesEndRef = useRef(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email === ADMIN_EMAIL) setAdminUser(user);
      else if (user) signOut(auth);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Access Codes & Auto-Cleanup check
  useEffect(() => {
    if (!adminUser) return;
    const q = query(collection(db, 'access_codes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const codes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccessCodes(codes);
    });
    return () => unsubscribe();
  }, [adminUser]);

  // Active Chat Listener
  useEffect(() => {
    if (!activeChatId) return;
    const q = query(collection(db, 'chats', activeChatId, 'messages'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return () => unsubscribe();
  }, [activeChatId]);

  // --- Admin Powers: Expiry & Cleanup ---

  const handleCreateCode = async (e) => {
    e.preventDefault();
    if (!newCodeId.trim()) return;

    // Calculate exact expiry timestamp if not permanent
    let expiresAt = null;
    if (parseInt(expiryHours) > 0) {
      expiresAt = Date.now() + (parseInt(expiryHours) * 60 * 60 * 1000);
    }

    await setDoc(doc(db, 'access_codes', newCodeId), {
      type: expiresAt ? "temporary" : "permanent",
      status: "active",
      createdAt: Date.now(),
      expiresAt: expiresAt
    });
    setNewCodeId("");
  };

  // The Dashboard actively cleans up expired IDs when you click this button
  const cleanupExpiredIDs = async () => {
    const now = Date.now();
    let deletedCount = 0;
    
    for (const code of accessCodes) {
      if (code.expiresAt && code.expiresAt < now) {
        await deleteDoc(doc(db, 'access_codes', code.id));
        deletedCount++;
        if (activeChatId === code.id) setActiveChatId(null);
      }
    }
    alert(`Cleanup complete. Deleted ${deletedCount} expired IDs.`);
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
    await setDoc(doc(collection(db, 'chats', activeChatId, 'messages')), {
      text,
      sender: "admin",
      timestamp: serverTimestamp()
    });
  };

  if (authLoading) return <div className="flex h-screen items-center justify-center text-white bg-gray-900">Loading Base...</div>;

  if (!adminUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-4 bg-gray-900">
        <button onClick={() => signInWithPopup(auth, googleProvider)} className="bg-blue-600 px-6 py-3 rounded-xl text-white font-bold">
          Admin Login
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full p-4 gap-4 bg-gray-900 font-sans">
      
      {/* Sidebar: Chat Management */}
      <div className="w-1/3 glass-panel flex flex-col bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h2 className="text-white font-bold text-lg">Admin HQ</h2>
          <div className="flex gap-3">
            <button onClick={cleanupExpiredIDs} title="Clean Expired IDs" className="text-yellow-400 hover:text-yellow-300"><Clock size={20}/></button>
            <button onClick={() => signOut(auth)} title="Sign Out" className="text-red-400 hover:text-red-300"><LogOut size={20}/></button>
          </div>
        </div>

        {/* Generate Code Form */}
        <div className="p-4 border-b border-white/10 bg-black/20">
          <form onSubmit={handleCreateCode} className="flex flex-col gap-3">
            <input 
              type="text" value={newCodeId} onChange={(e) => setNewCodeId(e.target.value)}
              placeholder="Assign Custom ID..." 
              className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            />
            <div className="flex gap-2">
              <select 
                value={expiryHours} onChange={(e) => setExpiryHours(e.target.value)}
                className="bg-gray-800 border border-white/20 rounded-lg px-3 py-2 text-white text-sm flex-1 outline-none"
              >
                <option value="0">Permanent</option>
                <option value="1">Expire in 1 Hour</option>
                <option value="12">Expire in 12 Hours</option>
                <option value="24">Expire in 24 Hours</option>
              </select>
              <button type="submit" className="bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700 font-bold flex items-center"><Plus size={20}/></button>
            </div>
          </form>
        </div>

        {/* Active Codes List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {accessCodes.map(code => {
            const isExpired = code.expiresAt && code.expiresAt < Date.now();
            return (
              <div key={code.id} className={`p-4 rounded-xl border cursor-pointer transition-all ${activeChatId === code.id ? 'bg-blue-600/20 border-blue-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'} ${isExpired ? 'opacity-50' : ''}`} onClick={() => setActiveChatId(code.id)}>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-white font-bold truncate">{code.id}</span>
                  <span className={`text-xs px-2 py-1 rounded-md font-semibold ${code.type === 'permanent' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {isExpired ? 'EXPIRED' : code.type.toUpperCase()}
                  </span>
                </div>
                
                <div className="flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); toggleBlockStatus(code.id, code.status); }} className={`flex-1 py-1.5 rounded-lg flex justify-center items-center text-xs font-bold text-white transition-colors ${code.status === 'active' ? 'bg-orange-500/40 hover:bg-orange-500/60' : 'bg-green-500/40 hover:bg-green-500/60'}`}>
                    {code.status === 'active' ? <Ban size={14} className="mr-1"/> : <CheckCircle size={14} className="mr-1"/>}
                    {code.status === 'active' ? 'BLOCK' : 'UNBLOCK'}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); deleteCode(code.id); }} className="flex-1 py-1.5 rounded-lg flex justify-center items-center text-xs font-bold bg-red-500/40 hover:bg-red-500/60 text-white transition-colors">
                    <Trash2 size={14} className="mr-1"/> DELETE
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 glass-panel flex flex-col bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl relative">
        {activeChatId ? (
          <>
            <div className="h-16 border-b border-white/10 bg-white/5 flex items-center px-6 gap-3 shadow-sm z-10">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-[0_0_12px_rgba(74,222,128,0.6)]"></div>
              <h3 className="text-white font-bold text-lg">{activeChatId}</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`px-5 py-3 max-w-[70%] shadow-lg text-sm md:text-base ${msg.sender === 'admin' ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' : 'bg-white/10 text-white rounded-2xl rounded-tl-sm backdrop-blur-md border border-white/10'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-white/10 bg-black/20 z-10">
              <form onSubmit={handleSendMessage} className="flex gap-3 max-w-4xl mx-auto">
                <input 
                  type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Message user..." 
                  className="flex-1 bg-white/5 border border-white/20 rounded-full px-6 py-3 focus:outline-none focus:border-blue-500 transition-all text-white placeholder-gray-500 shadow-inner"
                />
                <button type="submit" disabled={!newMessage.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-3 md:px-6 rounded-full transition-all font-bold flex items-center justify-center shadow-lg">
                  <Send size={20} className="md:hidden" />
                  <span className="hidden md:block">Send</span>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4">
            <Clock size={48} className="opacity-20" />
            <p className="text-lg">Select a chat ID from the panel to begin</p>
          </div>
        )}
      </div>

    </div>
  );
}
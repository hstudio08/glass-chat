import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { Edit, Search, ArrowLeft, Loader2, UserPlus } from 'lucide-react';
import { db } from '../../services/firebase';
import { useApp } from '../../contexts/AppContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function LeftSidebar() {
  const { myPhoneNumber, activeRoom, setActiveRoom } = useApp();
  
  const [chatList, setChatList] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [foundUser, setFoundUser] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // --- 1. FETCH CHATS ---
  useEffect(() => {
    if (!myPhoneNumber) return;
    const q = query(collection(db, 'rooms'), where('participants', 'array-contains', myPhoneNumber));
    const unsubscribeChats = onSnapshot(q, (snapshot) => {
      const chats = snapshot.docs.map(doc => {
        const data = doc.data();
        const otherId = data.participants.find(p => p !== myPhoneNumber);
        return {
          roomId: doc.id,
          otherId: otherId,
          name: data.names?.[myPhoneNumber] || otherId || "Unknown User",
          lastMessage: data.lastMessage || "Say hello!",
          timestamp: data.lastUpdated,
          unread: Math.floor(Math.random() * 3) // Mock unread for UI
        };
      });
      chats.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      setChatList(chats);
    });
    return () => unsubscribeChats();
  }, [myPhoneNumber]);

  // --- 2. SEARCH USER ---
  const handleSearchUser = async (e) => {
    e.preventDefault();
    setSearchError(""); setFoundUser(null);
    if (!searchQuery.trim()) return;

    const term = searchQuery.trim();
    if (term === myPhoneNumber) return setSearchError("You cannot start a chat with yourself.");

    setIsSearching(true);
    try {
      let userDoc = await getDoc(doc(db, 'users', term));
      if (userDoc.exists()) {
        setFoundUser({ id: userDoc.id, ...userDoc.data() });
      } else {
        const emailQuery = query(collection(db, 'users'), where('email', '==', term));
        const querySnapshot = await getDocs(emailQuery);
        if (!querySnapshot.empty) {
          const docData = querySnapshot.docs[0];
          setFoundUser({ id: docData.id, ...docData.data() });
        } else {
          setSearchError("No user found with this Phone or Email.");
        }
      }
    } catch (err) {
      setSearchError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

// --- 3. CREATE CHAT (BULLETPROOF VERSION) ---
  const handleStartChat = async () => {
    if (!foundUser) return;
    setIsAdding(true);
    try {
      // 1. Force strings so Firebase doesn't crash on undefined/null IDs
      const myId = String(myPhoneNumber);
      const targetId = String(foundUser.id);
      
      const roomId = [myId, targetId].sort().join('_');
      
      // 2. Fetch my own name safely
      const myDoc = await getDoc(doc(db, 'users', myId));
      const myName = myDoc.exists() ? (myDoc.data().name || myId) : myId;

      // 3. Ensure NO undefined values are passed to Firestore
      const safeTargetName = foundUser.name || targetId;

      console.log(`Attempting to create room: ${roomId}`);

      await setDoc(doc(db, 'rooms', roomId), {
        participants: [myId, targetId],
        names: { 
          [myId]: safeTargetName, 
          [targetId]: myName 
        },
        lastUpdated: serverTimestamp()
      }, { merge: true });

      setSearchQuery(""); 
      setFoundUser(null); 
      setShowNewChat(false);
      setActiveRoom(roomId);
      
    } catch (err) {
      // 🔥 THIS WILL TELL US EXACTLY WHAT IS WRONG
      console.error("🔥 FIREBASE CRASH REPORT:", err.code, err.message);
      alert(`Database Error: ${err.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col pt-6 pb-4 relative overflow-hidden">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 px-6 shrink-0">
        <h2 className="text-[20px] font-extrabold text-chatly-dark">My Chats</h2>
        <button onClick={() => setShowNewChat(true)} className="text-chatly-dark hover:text-chatly-maroon transition-colors p-1.5 rounded-lg hover:bg-white/40 shadow-sm border border-transparent hover:border-white/60">
          <Edit size={20} />
        </button>
      </div>

      {/* CHAT LIST (Profile Row & Discover Removed!) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 px-4">
        {chatList.length === 0 ? (
          <div className="text-center mt-10 px-4">
            <div className="w-16 h-16 rounded-full bg-white/40 flex items-center justify-center mx-auto mb-4 border border-white/60 shadow-sm">
              <Search className="text-chatly-maroon" size={24} />
            </div>
            <p className="text-chatly-dark font-extrabold text-[15px]">No chats yet.</p>
            <p className="text-chatly-dark/60 text-sm mt-1 font-semibold">Click the edit icon above to find friends.</p>
          </div>
        ) : (
          chatList.map((chat, idx) => (
            <div key={chat.roomId} onClick={() => setActiveRoom(chat.roomId)} 
                 className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border 
                 ${activeRoom === chat.roomId ? 'bg-white/50 border-white/80 shadow-sm' : 'border-transparent hover:bg-white/30'}`}>
              
              <div className="shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-chatly-peach to-chatly-maroon flex items-center justify-center text-white font-bold text-lg shadow-sm border border-white/50">
                {chat.name.charAt(0).toUpperCase()}
              </div>
              
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h4 className="text-[16px] font-extrabold text-chatly-dark truncate">{chat.name}</h4>
                <p className="text-[13px] font-medium text-chatly-dark/70 truncate">{chat.lastMessage}</p>
              </div>

              {chat.unread > 0 && (
                <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold shadow-sm ${idx === 0 ? 'bg-chatly-green text-white w-7 h-7' : 'bg-white/60 text-chatly-dark border border-white/80'}`}>
                  {chat.unread}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* SLIDE-OVER NEW CHAT / SEARCH PANEL */}
      <AnimatePresence>
        {showNewChat && (
          <motion.div 
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "tween", duration: 0.3 }}
            className="absolute inset-0 z-40 bg-white/60 backdrop-blur-2xl border-r border-white/60 shadow-2xl flex flex-col"
          >
            <div className="flex items-center gap-4 p-6 bg-white/40 border-b border-white/60 shadow-sm shrink-0">
              <button onClick={() => { setShowNewChat(false); setFoundUser(null); setSearchQuery(""); setSearchError(""); }} className="p-2 rounded-full hover:bg-white/60 transition-colors text-chatly-dark border border-transparent hover:border-white/80 shadow-sm">
                <ArrowLeft size={22} />
              </button>
              <h2 className="text-[18px] font-extrabold text-chatly-dark">New Connection</h2>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              <form onSubmit={handleSearchUser} className="flex flex-col gap-4">
                <div className="flex items-center w-full bg-white/50 border border-white/80 rounded-full px-4 py-3 focus-within:bg-white/80 focus-within:border-chatly-maroon transition-all shadow-sm">
                  <Search className="text-chatly-maroon shrink-0" size={18} />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search Email or Phone..." className="flex-1 bg-transparent border-none outline-none ml-3 text-chatly-dark placeholder-chatly-dark/50 font-semibold text-[15px]" />
                </div>
                <button type="submit" disabled={isSearching || !searchQuery.trim()} className="w-full bg-gradient-to-r from-chatly-maroon to-chatly-rose hover:from-chatly-dark hover:to-chatly-maroon text-white font-bold py-3.5 rounded-full flex justify-center items-center shadow-md transition-all disabled:opacity-50 transform hover:-translate-y-0.5 disabled:transform-none">
                  {isSearching ? <Loader2 className="animate-spin" size={20} /> : "Find User"}
                </button>
              </form>

              {searchError && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 bg-red-50/80 backdrop-blur-md border border-red-200 text-red-600 text-[14px] font-bold p-4 rounded-2xl text-center shadow-sm">
                  {searchError}
                </motion.div>
              )}

              {foundUser && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 bg-white/50 border border-white/80 rounded-3xl p-6 flex flex-col items-center text-center shadow-lg">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-chatly-peach to-chatly-maroon p-1 shadow-md mb-4">
                    <img src={foundUser.avatar || "https://i.pravatar.cc/150?img=placeholder"} alt="User" className="w-full h-full rounded-full object-cover border-4 border-white" />
                  </div>
                  <h3 className="text-[19px] font-extrabold text-chatly-dark">{foundUser.name || foundUser.id}</h3>
                  <p className="text-[14px] font-semibold text-chatly-dark/60 mb-6">{foundUser.email || foundUser.id}</p>
                  <button onClick={handleStartChat} disabled={isAdding} className="w-full bg-gradient-to-r from-chatly-green to-[#4a8a60] hover:shadow-[0_4px_15px_rgba(91,165,116,0.4)] text-white font-bold py-3.5 rounded-full flex justify-center items-center gap-2 transition-all transform hover:-translate-y-0.5">
                    {isAdding ? <Loader2 className="animate-spin" size={20} /> : <> <UserPlus size={18} /> Connect & Chat </>}
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
import { useState, useEffect, useRef } from 'react';
import { auth, db, googleProvider } from '../services/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { Send, LogOut, Plus, Trash2, Ban, CheckCircle, Clock, ShieldHalf, Activity, MessageSquare, KeyRound, Settings, Ghost, Edit2, X, Eraser, Sun, Moon, Download, ChevronLeft, Copy, Image as ImageIcon, Loader2, Maximize, ChevronDown, Sparkles, Edit3, Check, CheckCheck, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenerativeAI } from '@google/generative-ai';

const ADMIN_EMAIL = "hstudio.webdev@gmail.com";

// ==========================================
// 🚀 API CONFIGURATION
const IMGBB_API_KEY = '250588b8b03b100c08b3df82baaa28a4'; // Free image hosting for attachments
const GEMINI_API_KEY = 'AIzaSyCzWUVmeJ1NE_8D_JmQQrFQv4elA1zS2iA';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// ==========================================

const animTween = { type: "tween", ease: "easeOut", duration: 0.25 };
const fadeUp = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: animTween } };

export default function AdminDashboard() {
  const [adminUser, setAdminUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('chats'); 
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  // AI & Image State
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiReplies, setAiReplies] = useState([]);
  const [showAIReplies, setShowAIReplies] = useState(false);
  
  const [isUploading, setIsUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [compressImage, setCompressImage] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const ignoreBlurRef = useRef(false);
  
  // Database & Feature State
  const [accessCodes, setAccessCodes] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [activeChatDoc, setActiveChatDoc] = useState(null); 
  const [ghostMode, setGhostMode] = useState(false);
  const [hideReceipts, setHideReceipts] = useState(false); 
  const [editingMsgId, setEditingMsgId] = useState(null);
  
  const [newCodeId, setNewCodeId] = useState("");
  const [newCodeName, setNewCodeName] = useState("");
  const [expiryHours, setExpiryHours] = useState("0"); 
  
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioRef = useRef(typeof Audio !== "undefined" ? new Audio('/pop.mp3') : null);
  const previousMessageCount = useRef(0);
  const isWindowFocused = useRef(true);

  // --- Auth & Focus Listeners ---
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
    const handleKeyDown = (e) => { if (e.key === 'Escape' && selectedImage) setSelectedImage(null); };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('keyup', handleKeyDown);
    return () => { 
      window.removeEventListener('focus', handleFocus); window.removeEventListener('blur', handleBlur); window.removeEventListener('keyup', handleKeyDown);
    };
  }, [selectedImage]);

  useEffect(() => {
    if (!adminUser) return;
    const q = query(collection(db, 'access_codes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAccessCodes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [adminUser]);

  // Handle changing active chat
  useEffect(() => {
    setShowAIReplies(false); setAiReplies([]); setPendingImage(null); setPreviewUrl(null);
    if (!activeChatId) return;
    
    const q = query(collection(db, 'chats', activeChatId, 'messages'), orderBy('timestamp', 'asc'));
    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(fetchedMessages);
      if (previousMessageCount.current !== 0 && fetchedMessages.length > previousMessageCount.current) {
        const lastMsg = fetchedMessages[fetchedMessages.length - 1];
        if (lastMsg?.sender === 'user') {
          audioRef.current?.play().catch(() => {});
          if (!isWindowFocused.current) document.title = "💬 New Message!";
          setShowAIReplies(false); 
        }
      }
      previousMessageCount.current = fetchedMessages.length;
      setTimeout(() => scrollToBottom('auto'), 100);
    });

    const unsubscribeDoc = onSnapshot(doc(db, 'chats', activeChatId), (docSnap) => {
      if (docSnap.exists()) setActiveChatDoc(docSnap.data());
    });

    return () => { unsubscribeMessages(); unsubscribeDoc(); previousMessageCount.current = 0; };
  }, [activeChatId]);

  // 🕵️ ADMIN PRESENCE ENGINE
  useEffect(() => {
    if (!activeChatId) return;
    const setOnlineStatus = async () => {
      if (ghostMode) setDoc(doc(db, 'chats', activeChatId), { adminOnline: false, adminTyping: false }, { merge: true }).catch(()=>{});
      else setDoc(doc(db, 'chats', activeChatId), { adminOnline: true }, { merge: true }).catch(()=>{});
    };
    setOnlineStatus();
    return () => {
      if (!ghostMode && activeChatId) setDoc(doc(db, 'chats', activeChatId), { adminOnline: false, adminLastSeen: serverTimestamp() }, { merge: true }).catch(()=>{});
    };
  }, [activeChatId, ghostMode]);

  // 📡 READ RECEIPTS ENGINE 
  useEffect(() => {
    if (!activeChatId || hideReceipts) return;
    const hasFocus = document.hasFocus();
    messages.forEach(msg => {
      if (msg.sender === 'user') {
        if (hasFocus && msg.status !== 'seen') {
          updateDoc(doc(db, 'chats', activeChatId, 'messages', msg.id), { status: 'seen' }).catch(()=>{});
        } else if (!hasFocus && msg.status === 'sent') {
          updateDoc(doc(db, 'chats', activeChatId, 'messages', msg.id), { status: 'delivered' }).catch(()=>{});
        }
      }
    });
  }, [messages, activeChatId, hideReceipts]);

  useEffect(() => {
    const handleFocus = () => {
      if (!activeChatId || hideReceipts) return;
      messages.forEach(msg => {
        if (msg.sender === 'user' && msg.status !== 'seen') updateDoc(doc(db, 'chats', activeChatId, 'messages', msg.id), { status: 'seen' }).catch(()=>{});
      });
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [messages, activeChatId, hideReceipts]);

  // --- Safe Scroll Engine ---
  const scrollToBottom = (behavior = 'smooth') => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: behavior === 'smooth' ? 'smooth' : 'auto'
      });
    }
  };

  const handleScroll = (e) => setShowScrollButton(e.target.scrollHeight - e.target.scrollTop - e.target.clientHeight > 100);

  // ==========================================
  // ✨ CONTEXT-AWARE AI ENGINE
  // ==========================================
  const generateAIQuickReplies = async () => {
    if (showAIReplies && aiReplies.length > 0) { setShowAIReplies(false); return; }
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('PASTE')) return alert("Missing API Key");

    setIsGeneratingAI(true); setShowAIReplies(true); setAiReplies([]);

    try {
      const recentMessages = messages.slice(-3);
      if (recentMessages.length === 0) {
        setAiReplies(["How can I assist you?", "Please send details.", "I'm looking into it."]);
        return setIsGeneratingAI(false);
      }
      const waitingOnClient = recentMessages[recentMessages.length - 1].sender === 'admin';
      const transcript = recentMessages.map(m => `${m.sender === 'admin' ? 'Agent' : 'Client'}:${m.isImage ? '[Img]' : m.text}`).join('|');
      const prompt = `Context:${transcript}|Task:Return JSON array of exactly 3 short professional ${waitingOnClient ? 'follow-ups' : 'support answers'}. Max 4 words each.`;

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite", generationConfig: { responseMimeType: "application/json", maxOutputTokens: 50 } });
      const result = await model.generateContent(prompt);
      const parsedReplies = JSON.parse(result.response.text());
      setAiReplies(Array.isArray(parsedReplies) ? parsedReplies.slice(0,3) : ["Understood.", "I'll check.", "Thank you."]);
    } catch (error) { setAiReplies(["Understood.", "Checking now.", "Thanks."]); } 
    finally { setIsGeneratingAI(false); }
  };

  // --- ID Management ---
  const handleCreateCode = async (e) => {
    e.preventDefault();
    if (!newCodeId.trim()) return;
    let expiresAt = null;
    if (parseInt(expiryHours) > 0) expiresAt = Date.now() + (parseInt(expiryHours) * 60 * 60 * 1000);
    await setDoc(doc(db, 'access_codes', newCodeId), { type: expiresAt ? "temporary" : "permanent", status: "active", createdAt: Date.now(), expiresAt: expiresAt, name: newCodeName.trim() || "" });
    await setDoc(doc(db, 'chats', newCodeId), { userTyping: false, adminTyping: false, userOnline: false }, { merge: true });
    navigator.clipboard.writeText(newCodeId);
    setNewCodeId(""); setNewCodeName("");
  };

  const renameCode = async (codeId, currentName) => {
    const newName = window.prompt("Enter a friendly name for this client/chat:", currentName || "");
    if (newName !== null) await updateDoc(doc(db, 'access_codes', codeId), { name: newName.trim() });
  };

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); alert(`Copied ID to clipboard!`); };

  const cleanupExpiredIDs = async () => {
    const now = Date.now();
    for (const code of accessCodes) {
      if (code.expiresAt && code.expiresAt < now) {
        await deleteDoc(doc(db, 'access_codes', code.id));
        if (activeChatId === code.id) { setActiveChatId(null); setShowMobileChat(false); }
      }
    }
  };

  const deleteCode = async (id) => {
    if(window.confirm(`Permanently delete chat ID: ${id}?`)) {
      await deleteDoc(doc(db, 'access_codes', id));
      if (activeChatId === id) { setActiveChatId(null); setShowMobileChat(false); }
    }
  };

  const toggleBlockStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "active" ? "blocked" : "active";
    await updateDoc(doc(db, 'access_codes', id), { status: newStatus });
    if (activeChatId === id && newStatus === "blocked") { setActiveChatId(null); setShowMobileChat(false); }
  };

  // --- Message Engine ---
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPendingImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    e.target.value = null; 
  };

  const handleSendMessage = async (e, overrideText = null) => {
    if (e) e.preventDefault();
    const textToSend = overrideText || newMessage.trim();

    if (!textToSend && !pendingImage) return; 
    if (!activeChatId || isUploading) return;
    
    if (editingMsgId) {
      updateDoc(doc(db, 'chats', activeChatId, 'messages', editingMsgId), { text: textToSend, isEdited: true }).catch(()=>{});
      setEditingMsgId(null); setNewMessage("");
      if (textareaRef.current) textareaRef.current.style.height = '48px';
      return;
    }

    const currentImg = pendingImage;
    const currentText = textToSend;
    
    setIsUploading(true);
    setNewMessage(""); setPendingImage(null); setPreviewUrl(null); setShowAIReplies(false);
    if (textareaRef.current) textareaRef.current.style.height = '48px';
    scrollToBottom('auto');

    if(!ghostMode) setDoc(doc(db, 'chats', activeChatId), { adminTyping: false }, { merge: true }).catch(() => {});

    try {
      if (currentImg) {
        let base64Image = "";
        if (compressImage) {
          const img = new Image(); img.src = URL.createObjectURL(currentImg);
          await new Promise((resolve) => {
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 1200; 
              const scaleSize = Math.min(MAX_WIDTH / img.width, 1);
              canvas.width = img.width * scaleSize; canvas.height = img.height * scaleSize;
              canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
              base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
              resolve();
            };
          });
        } else {
          const reader = new FileReader();
          await new Promise(resolve => { reader.onload = (event) => { base64Image = event.target.result.split(',')[1]; resolve(); }; reader.readAsDataURL(currentImg); });
        }
        
        const formData = new FormData(); formData.append('image', base64Image);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
        const json = await res.json();
        if (!json.success) throw new Error("Upload Failed");

        await addDoc(collection(db, 'chats', activeChatId, 'messages'), { text: json.data.url, isImage: true, sender: "admin", timestamp: serverTimestamp(), status: "sent" });
      }

      if (currentText) {
        await addDoc(collection(db, 'chats', activeChatId, 'messages'), { text: currentText, isImage: false, sender: "admin", timestamp: serverTimestamp(), status: "sent" });
      }
      scrollToBottom('auto');
    } catch (err) {
      alert("Delivery Failed: ID may be blocked or expired.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (activeChatId && !ghostMode) setDoc(doc(db, 'chats', activeChatId), { adminTyping: e.target.value.length > 0 }, { merge: true }).catch(()=>{});
  };

  const deleteMessage = (msgId) => { if (window.confirm("Delete this message?")) deleteDoc(doc(db, 'chats', activeChatId, 'messages', msgId)).catch(()=>{}); };
  const clearEntireChatHistory = () => { if (window.confirm("NUKE PROTOCOL: Permanently delete ALL messages?")) { messages.forEach(msg => deleteDoc(doc(db, 'chats', activeChatId, 'messages', msg.id)).catch(()=>{})); } };
  
  const exportChatHistory = () => {
    if (!messages.length) return alert("No messages to export.");
    const content = messages.map(m => `[${m.timestamp && typeof m.timestamp.toDate === 'function' ? new Date(m.timestamp.toDate()).toLocaleString() : "Unknown"}] ${m.sender.toUpperCase()}: ${m.isImage ? '[IMAGE]' : m.text}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Transcript_${activeChatId}.txt`; a.click();
  };

  // ✅ 100% CRASH-PROOF TIMESTAMP FORMATTERS
  const formatTime = (ts) => {
    if (!ts || typeof ts.toDate !== 'function') return "Sending...";
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(ts.toDate());
  };

  const formatLastSeen = (ts) => {
    if (!ts || typeof ts.toDate !== 'function') return "Never";
    const date = ts.toDate();
    const diffMins = Math.floor((new Date() - date) / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins/60)}h ago`;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
  };

  const MessageStatusIcon = ({ msg }) => {
    if (!msg.timestamp || typeof msg.timestamp.toDate !== 'function') return <Clock size={12} className="text-white/60 ml-1" />; 
    if (msg.status === 'seen') return <CheckCheck size={14} className="text-sky-300 drop-shadow-sm ml-1" />;
    if (msg.status === 'delivered') return <CheckCheck size={14} className="text-white/80 ml-1" />;
    return <Check size={14} className="text-white/80 ml-1" />; 
  };

  const getDisplayName = (code) => code.name ? code.name : code.id;

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-[#f8f9fa] text-slate-800 font-bold">Loading Engine...</div>;

  if (!adminUser) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center p-4 bg-[#f8f9fa] relative overflow-hidden font-sans text-slate-800">
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-orange-300/20 blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-amber-200/20 blur-[100px]" />
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md p-10 flex flex-col items-center rounded-3xl z-10 bg-white/60 backdrop-blur-xl border border-white/50 shadow-xl">
          <ShieldHalf size={56} className="text-orange-500 mb-6" />
          <h1 className="text-2xl font-bold mb-2 tracking-tight">Command Center</h1>
          <p className="text-slate-500 mb-8 text-sm text-center">Secure administrator login.</p>
          <button onClick={() => signInWithPopup(auth, googleProvider)} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3.5 rounded-xl shadow-md transition-colors">Authenticate</button>
        </motion.div>
      </div>
    );
  }

  return (
    // STRICT ABSOLUTE SHELL
    <div className="fixed inset-0 w-full flex flex-col sm:flex-row bg-[#f8f9fa] overflow-hidden font-sans text-slate-800">
      
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-orange-300/20 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-amber-200/20 blur-[100px]" />
      </div>

      <AnimatePresence>
        {selectedImage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={animTween} className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setSelectedImage(null)}>
            <button className="absolute top-6 right-6 text-white/70 hover:text-white p-2 rounded-full transition-colors z-50"><X size={28}/></button>
            <img src={selectedImage} alt="Fullscreen Attachment" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav Dock */}
      <nav className="order-last sm:order-first flex-none h-[calc(60px+env(safe-area-inset-bottom))] sm:h-full sm:w-[88px] bg-white/70 backdrop-blur-xl border-t sm:border-t-0 sm:border-r border-slate-200/60 flex sm:flex-col items-center justify-around sm:justify-start sm:py-6 z-40 pb-[env(safe-area-inset-bottom)] sm:pb-6">
        <div className="hidden sm:flex w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl shadow-sm items-center justify-center mb-6 text-white">
          <Activity size={24} />
        </div>
        <div className="flex sm:flex-col gap-1 sm:gap-3 w-full px-2 sm:px-4 justify-around sm:justify-start">
          <NavButton icon={<MessageSquare size={22}/>} label="Chats" active={activeTab === 'chats'} onClick={() => {setActiveTab('chats'); setShowMobileChat(false);}} />
          <NavButton icon={<KeyRound size={22}/>} label="IDs" active={activeTab === 'ids'} onClick={() => {setActiveTab('ids'); setShowMobileChat(false);}} />
          <NavButton icon={<Settings size={22}/>} label="Settings" active={activeTab === 'settings'} onClick={() => {setActiveTab('settings'); setShowMobileChat(false);}} />
          <div className="flex sm:hidden">
            <button onClick={() => signOut(auth)} className="p-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors"><LogOut size={22} /></button>
          </div>
        </div>
        <div className="hidden sm:flex mt-auto px-4 w-full flex-col gap-2">
          <button onClick={() => signOut(auth)} className="w-full py-3 flex flex-col items-center gap-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
            <LogOut size={20} /> <span className="text-[10px] font-bold">EXIT</span>
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 flex overflow-hidden z-10 relative">
        <AnimatePresence mode="wait">
          
          {/* --- TAB: CHATS --- */}
          {activeTab === 'chats' && (
            <motion.div key="chats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={animTween} className="flex w-full h-full overflow-hidden">
              
              {/* Sidebar List */}
              <div className={`w-full sm:w-[320px] flex-shrink-0 flex flex-col h-full bg-white/40 backdrop-blur-md border-r border-slate-200/50 ${showMobileChat ? 'hidden sm:flex' : 'flex'}`}>
                <div className="p-5 border-b border-slate-200/50 flex justify-between items-center" style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>
                  <h2 className="font-bold text-lg">Sessions</h2>
                  <div className="px-2.5 py-1 bg-orange-100 text-orange-600 rounded-full text-xs font-bold">{accessCodes.filter(c=>c.status==='active').length}</div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                  {accessCodes.filter(c => c.status === 'active').map(code => {
                    const isActive = activeChatId === code.id;
                    return (
                      <div key={code.id} onClick={() => {setActiveChatId(code.id); setShowMobileChat(true);}} className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex justify-between items-center group ${isActive ? 'bg-orange-500 border-orange-600 shadow-md text-white' : 'bg-white border-slate-200 hover:border-orange-300 shadow-sm text-slate-800'}`}>
                        <div className="flex flex-col overflow-hidden">
                          <span className={`font-bold truncate text-[15px] ${isActive ? 'text-white' : 'text-slate-800'}`}>{getDisplayName(code)}</span>
                          {code.name && <span className={`text-[10px] uppercase tracking-widest mt-0.5 ${isActive ? 'text-orange-200' : 'text-slate-400'}`}>{code.id}</span>}
                        </div>
                        <ChevronLeft size={18} className={`rotate-180 opacity-50 sm:hidden ${isActive ? 'text-white' : ''}`} />
                      </div>
                    )
                  })}
                  {accessCodes.filter(c => c.status === 'active').length === 0 && <p className="text-sm text-center mt-10 text-slate-500">No active sessions.</p>}
                </div>
              </div>

              {/* Chat View */}
              <div className={`flex-1 flex flex-col h-full overflow-hidden relative ${!showMobileChat ? 'hidden sm:flex' : 'flex'}`}>
                {activeChatId ? (
                  <>
                    <header className="flex-none bg-white/60 backdrop-blur-md border-b border-slate-200/60 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-20" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setShowMobileChat(false)} className="sm:hidden p-2 -ml-2 rounded-xl text-orange-500 hover:bg-orange-50"><ChevronLeft size={24} /></button>
                        <div className="relative">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm border border-slate-200 text-orange-500"><MessageSquare size={18} /></div>
                          {activeChatDoc?.userOnline && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full shadow-sm"></span>}
                        </div>
                        <div className="flex flex-col">
                          <h3 className="font-bold text-[16px] tracking-tight">{getDisplayName(accessCodes.find(c=>c.id===activeChatId) || {id: activeChatId})}</h3>
                          <p className={`text-[11px] font-medium ${activeChatDoc?.userOnline ? 'text-emerald-500' : 'text-slate-500'}`}>{activeChatDoc?.userOnline ? "Online now" : `Seen ${formatLastSeen(activeChatDoc?.userLastSeen)}`}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {ghostMode && <div className="hidden sm:flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md text-amber-600"><Ghost size={12} /> <span className="text-[10px] font-bold uppercase tracking-widest">Ghost</span></div>}
                        <button onClick={exportChatHistory} className="p-2 sm:p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-orange-500 shadow-sm"><Download size={18} /></button>
                        <button onClick={clearEntireChatHistory} className="p-2 sm:p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-red-500 shadow-sm"><Eraser size={18} /></button>
                      </div>
                    </header>
                    
                    <main ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center z-10 custom-scrollbar relative">
                      <div className="w-full max-w-4xl flex flex-col gap-4 pb-2">
                        <AnimatePresence mode="popLayout">
                          {messages.map((msg) => {
                            const isAdmin = msg.sender === 'admin';
                            return (
                              <motion.div key={msg.id} layout="position" variants={fadeUp} initial="hidden" animate="visible" className={`flex ${isAdmin ? 'justify-end' : 'justify-start'} group relative`}>
                                <div className={`relative px-4 py-3 sm:px-5 sm:py-3.5 max-w-[85%] sm:max-w-[70%] rounded-2xl shadow-sm border ${isAdmin ? 'bg-orange-500 border-orange-600 text-white rounded-tr-sm' : 'bg-white border-slate-200 text-slate-800 rounded-tl-sm'}`}>
                                  {msg.isImage ? (
                                    <div className="relative group/img cursor-zoom-in rounded-lg overflow-hidden mb-1" onClick={() => setSelectedImage(msg.text)}>
                                      <img src={msg.text} alt="Attachment" className="w-full max-w-[240px] sm:max-w-[320px] object-cover transition-transform duration-300 group-hover/img:scale-105" />
                                      <div className="absolute inset-0 bg-slate-900/0 group-hover/img:bg-slate-900/10 transition-colors flex items-center justify-center"><Maximize className="text-white opacity-0 group-hover/img:opacity-100" size={24} /></div>
                                    </div>
                                  ) : (
                                    <p className="whitespace-pre-wrap break-words text-[15px] sm:text-[16px] leading-relaxed">{msg.text}</p>
                                  )}
                                  <div className={`text-[10px] font-medium mt-1.5 flex items-center gap-0.5 ${isAdmin ? 'justify-end text-orange-100' : 'justify-start text-slate-400'}`}>
                                    {msg.isEdited && <span className="italic mr-1">(edited)</span>}
                                    {formatTime(msg.timestamp)}
                                    {isAdmin && !hideReceipts && <MessageStatusIcon msg={msg} />}
                                    {isAdmin && hideReceipts && <Check size={14} className="text-white/70 ml-1" />}
                                  </div>
                                </div>
                                
                                {isAdmin && !msg.isImage && (
                                  <div className="hidden sm:flex absolute top-1/2 -translate-y-1/2 -left-20 opacity-0 group-hover:opacity-100 transition-opacity gap-1.5">
                                    <button onClick={() => {setEditingMsgId(msg.id); setNewMessage(msg.text);}} className="p-2 rounded-xl bg-white border border-slate-200 shadow-sm hover:text-orange-500 text-slate-400"><Edit2 size={14}/></button>
                                    <button onClick={() => deleteMessage(msg.id)} className="p-2 rounded-xl bg-white border border-slate-200 shadow-sm hover:text-red-500 text-slate-400"><Trash2 size={14}/></button>
                                  </div>
                                )}
                                {isAdmin && msg.isImage && (
                                  <div className="hidden sm:flex absolute top-1/2 -translate-y-1/2 -left-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => deleteMessage(msg.id)} className="p-2 rounded-xl bg-white border border-slate-200 shadow-sm hover:text-red-500 text-slate-400"><Trash2 size={14}/></button>
                                  </div>
                                )}
                              </motion.div>
                            )
                          })}
                          {activeChatDoc?.userTyping && (
                            <motion.div layout="position" variants={fadeUp} initial="hidden" animate="visible" exit="hidden" className="flex justify-start">
                              <div className="px-4 py-3 rounded-2xl rounded-tl-sm border bg-white border-slate-200 shadow-sm flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Client typing</span>
                                <div className="flex gap-1 ml-1"><div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce"/><div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{animationDelay:'0.15s'}}/><div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{animationDelay:'0.3s'}}/></div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <div ref={messagesEndRef} className="h-1" />
                      </div>
                    </main>

                    <AnimatePresence>
                      {showScrollButton && (
                        <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={animTween} onClick={() => scrollToBottom('smooth')} className="absolute bottom-32 right-6 p-3 bg-white text-orange-500 rounded-full shadow-md border border-slate-100 z-30">
                          <ChevronDown size={20} strokeWidth={3} />
                        </motion.button>
                      )}
                    </AnimatePresence>

                    {/* Footer Composer */}
                    <footer className="flex-none bg-white/70 backdrop-blur-lg border-t border-slate-200/60 px-3 sm:px-6 py-3 z-20 flex flex-col items-center">
                      <div className="w-full max-w-4xl flex flex-col gap-2 relative">
                        
                        <AnimatePresence>
                          {showAIReplies && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                              {isGeneratingAI ? (
                                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 text-xs font-semibold">
                                  <Loader2 size={14} className="animate-spin" /> Flash-Lite analyzing...
                                </div>
                              ) : (
                                aiReplies.map((reply, i) => (
                                  <button key={i} onClick={() => handleSendMessage(null, reply)} className="text-[12px] whitespace-nowrap font-medium px-4 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-orange-300 hover:text-orange-600 shadow-sm transition-colors min-h-[36px]">
                                    {reply}
                                  </button>
                                ))
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <form className="flex gap-2 items-end w-full">
                          <div className="flex gap-1 mb-1">
                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
                            <button type="button" onClick={() => { ignoreBlurRef.current = true; fileInputRef.current?.click(); }} disabled={isUploading} className="p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-orange-500 shadow-sm disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors">
                              {isUploading ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20}/>}
                            </button>
                            <button type="button" onClick={generateAIQuickReplies} title="AI Replies" className="p-2.5 sm:p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 shadow-sm min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors">
                              <Sparkles size={20} className={isGeneratingAI ? "animate-pulse" : ""} />
                            </button>
                          </div>

                          <div className="flex-1 relative bg-white border border-slate-200 rounded-2xl shadow-sm focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100 transition-all flex flex-col p-1.5">
                            
                            {/* Inline Image Preview */}
                            {previewUrl && (
                              <div className="relative mb-2 ml-2 mt-2 inline-block w-max">
                                <img src={previewUrl} className="h-20 w-auto rounded-lg border border-slate-200 object-cover shadow-sm" alt="Preview" />
                                <button type="button" onClick={() => { setPendingImage(null); setPreviewUrl(null); }} className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1 hover:bg-red-500 shadow-md transition-colors z-10"><X size={12}/></button>
                                <button type="button" onClick={() => setCompressImage(!compressImage)} className={`absolute bottom-2 left-2 text-[10px] font-bold px-2 py-1 rounded-md border z-10 transition-colors backdrop-blur-md shadow-sm ${compressImage ? 'bg-orange-500/90 text-white border-orange-400' : 'bg-slate-800/80 text-white border-slate-600'}`}>
                                  {compressImage ? '⚡ Fast' : '💎 HQ'}
                                </button>
                              </div>
                            )}

                            {editingMsgId && <button type="button" onClick={() => {setEditingMsgId(null); setNewMessage("");}} className="absolute top-2 left-2 p-1 bg-slate-100 text-slate-500 rounded hover:bg-slate-200 z-10"><X size={14}/></button>}
                            
                            <div className="flex items-end w-full">
                              <textarea 
                                ref={textareaRef} value={newMessage} 
                                onChange={(e) => { setNewMessage(e.target.value); e.target.style.height = '48px'; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`; }}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                                onChangeCapture={handleTyping} placeholder={previewUrl ? "Add a caption (optional)..." : (editingMsgId ? "Edit message..." : "Message...")} rows={1} disabled={isUploading}
                                className={`flex-1 bg-transparent py-2.5 text-[16px] text-slate-800 placeholder-slate-400 focus:outline-none resize-none custom-scrollbar leading-relaxed ${editingMsgId ? 'pl-8' : 'pl-3'} pr-12`}
                                style={{ minHeight: '48px' }}
                              />
                              <div className="absolute right-1.5 bottom-1.5">
                                <motion.button onClick={handleSendMessage} type="button" whileTap={{ scale: 0.95 }} disabled={(!newMessage.trim() && !pendingImage) || isUploading} className={`p-2 rounded-xl text-white shadow-sm disabled:opacity-50 transition-opacity min-h-[36px] min-w-[36px] flex items-center justify-center ${editingMsgId || ghostMode ? 'bg-amber-500' : 'bg-orange-500'}`}>
                                  {isUploading ? <Loader2 size={18} className="animate-spin" /> : (editingMsgId ? <span className="text-xs font-bold px-1">Save</span> : <Send size={18} className="ml-0.5" />)}
                                </motion.button>
                              </div>
                            </div>
                          </div>
                        </form>
                      </div>
                    </footer>
                  </>
                ) : (
                   <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-60 text-slate-500 pt-[env(safe-area-inset-top)]"><MessageSquare size={48} strokeWidth={1.5} /><p className="text-lg font-medium">Select a session.</p></div>
                )}
              </div>
            </motion.div>
          )}

          {/* --- TAB: IDs --- */}
          {activeTab === 'ids' && (
            <motion.div key="ids" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={animTween} className="w-full h-full flex flex-col overflow-hidden p-4 sm:p-8 pt-[calc(1rem+env(safe-area-inset-top))]">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-slate-200/60 pb-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Access Vectors</h2>
                  <p className="text-sm text-slate-500 mt-1">Manage client invitations.</p>
                </div>
                <button onClick={cleanupExpiredIDs} className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm bg-white border border-slate-200 hover:border-orange-300 hover:text-orange-600 shadow-sm transition-colors">
                  <Clock size={16}/> Clean Expired
                </button>
              </div>

              <div className="p-5 rounded-2xl mb-6 bg-white/60 backdrop-blur-md border border-slate-200/60 shadow-sm flex-shrink-0">
                <form onSubmit={handleCreateCode} className="flex flex-col md:flex-row gap-4 md:items-end">
                  <div className="flex-1">
                    <label className="text-[11px] font-bold uppercase tracking-widest mb-1.5 block text-slate-500">Custom ID</label>
                    <input type="text" value={newCodeId} onChange={(e) => setNewCodeId(e.target.value)} placeholder="VIP-01" className="w-full rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-400/50 transition-all font-mono uppercase font-bold border border-slate-200 text-sm bg-white"/>
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] font-bold uppercase tracking-widest mb-1.5 block text-slate-500">Client Name (Optional)</label>
                    <input type="text" value={newCodeName} onChange={(e) => setNewCodeName(e.target.value)} placeholder="John Doe" className="w-full rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-400/50 transition-all font-bold border border-slate-200 text-sm bg-white"/>
                  </div>
                  <div className="w-full md:w-48">
                    <label className="text-[11px] font-bold uppercase tracking-widest mb-1.5 block text-slate-500">Window</label>
                    <select value={expiryHours} onChange={(e) => setExpiryHours(e.target.value)} className="w-full rounded-xl px-4 py-3 outline-none font-medium appearance-none border border-slate-200 text-sm bg-white">
                      <option value="0">∞ Permanent</option>
                      <option value="1">⏱ 1 Hour</option>
                      <option value="24">⏱ 24 Hours</option>
                    </select>
                  </div>
                  <motion.button whileTap={{ scale: 0.95 }} type="submit" disabled={!newCodeId.trim()} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm min-h-[46px]">
                    <Plus size={18}/> Generate
                  </motion.button>
                </form>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {accessCodes.map(code => {
                      const isExpired = code.expiresAt && code.expiresAt < Date.now();
                      const displayName = getDisplayName(code);
                      return (
                        <motion.div key={code.id} layout exit={{ opacity: 0, scale: 0.9 }} transition={animTween} className={`p-4 rounded-2xl border flex flex-col justify-between h-36 transition-colors ${isExpired ? 'bg-slate-50/50 border-slate-200 opacity-60 grayscale' : 'bg-white/60 backdrop-blur-sm border-slate-200 hover:border-orange-300 shadow-sm'}`}>
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col max-w-[70%]">
                              <div className="flex items-center gap-2">
                                <span className="font-bold tracking-tight text-[16px] truncate">{displayName}</span>
                                {!isExpired && (
                                  <button onClick={() => renameCode(code.id, code.name)} className="text-slate-300 hover:text-orange-500 transition-colors"><Edit3 size={14}/></button>
                                )}
                              </div>
                              {code.name && <span className="text-[10px] font-mono uppercase text-slate-400 mt-0.5 truncate">{code.id}</span>}
                            </div>
                            
                            <div className="flex flex-col items-end gap-2">
                              <span className={`text-[9px] uppercase tracking-widest px-2 py-1 rounded-full font-bold border ${code.type === 'permanent' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                {isExpired ? 'EXPIRED' : code.type}
                              </span>
                              {!isExpired && (
                                <button onClick={() => copyToClipboard(code.id)} className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-orange-500 shadow-sm"><Copy size={12}/></button>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 mt-auto">
                            <button onClick={() => toggleBlockStatus(code.id, code.status)} className={`flex-1 py-2 rounded-xl flex justify-center items-center text-[11px] font-bold transition-colors border bg-white shadow-sm ${code.status === 'active' ? 'text-orange-500 border-orange-200 hover:bg-orange-50' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}>
                              {code.status === 'active' ? 'BLOCK' : 'UNBLOCK'}
                            </button>
                            <button onClick={() => deleteCode(code.id)} className="flex-1 py-2 rounded-xl flex justify-center items-center text-[11px] font-bold bg-white border border-red-200 text-red-500 hover:bg-red-50 shadow-sm transition-colors">
                              DELETE
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
            <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={animTween} className="w-full h-full flex flex-col p-4 sm:p-8" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}>
              <div className="mb-6 border-b border-slate-200/60 pb-4">
                <h2 className="text-2xl font-bold tracking-tight">Configuration</h2>
                <p className="text-sm text-slate-500 mt-1">Manage administrative footprint.</p>
              </div>

              <div className="max-w-xl space-y-4">
                <div className="border border-slate-200 p-5 rounded-2xl flex items-center justify-between shadow-sm bg-white/60 backdrop-blur-md">
                  <div className="flex gap-4 items-center">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-colors ${ghostMode ? 'bg-amber-50 text-amber-500 border-amber-200' : 'bg-white text-slate-400 border-slate-200'}`}>
                      <Ghost size={24} />
                    </div>
                    <div>
                      <h3 className="text-[16px] font-bold">Ghost Mode</h3>
                      <p className="text-[12px] mt-0.5 text-slate-500 max-w-[200px] sm:max-w-none">Hide online status & typing indicators from users.</p>
                    </div>
                  </div>
                  <button onClick={() => setGhostMode(!ghostMode)} className={`relative w-14 h-7 rounded-full transition-colors duration-300 shadow-inner flex-shrink-0 border border-slate-200 ${ghostMode ? 'bg-amber-400' : 'bg-slate-200'}`}>
                    <motion.div animate={{ x: ghostMode ? 28 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className="absolute top-[1px] left-0 w-6 h-6 bg-white rounded-full shadow-sm" />
                  </button>
                </div>

                <div className="border border-slate-200 p-5 rounded-2xl flex items-center justify-between shadow-sm bg-white/60 backdrop-blur-md">
                  <div className="flex gap-4 items-center">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-colors ${hideReceipts ? 'bg-amber-50 text-amber-500 border-amber-200' : 'bg-white text-slate-400 border-slate-200'}`}>
                      <EyeOff size={24} />
                    </div>
                    <div>
                      <h3 className="text-[16px] font-bold">Stealth Receipts</h3>
                      <p className="text-[12px] mt-0.5 text-slate-500 max-w-[200px] sm:max-w-none">Do not send Read or Delivered ticks to users.</p>
                    </div>
                  </div>
                  <button onClick={() => setHideReceipts(!hideReceipts)} className={`relative w-14 h-7 rounded-full transition-colors duration-300 shadow-inner flex-shrink-0 border border-slate-200 ${hideReceipts ? 'bg-amber-400' : 'bg-slate-200'}`}>
                    <motion.div animate={{ x: hideReceipts ? 28 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className="absolute top-[1px] left-0 w-6 h-6 bg-white rounded-full shadow-sm" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`p-2.5 sm:p-3.5 flex sm:flex-col flex-row sm:w-full items-center justify-center gap-2 sm:gap-1.5 rounded-xl transition-all duration-200 relative group ${active ? 'text-orange-600 bg-orange-50 shadow-sm border border-orange-100' : 'text-slate-500 hover:text-orange-500 hover:bg-white/50 border border-transparent'}`}>
      {icon}
      <span className={`text-[10px] font-bold tracking-widest ${active ? 'block' : 'hidden sm:block'}`}>{label}</span>
      {active && <motion.div layoutId="activeTab" transition={animTween} className="absolute sm:left-0 sm:top-1/4 sm:bottom-1/4 sm:w-1 sm:h-auto sm:rounded-r-full bottom-0 left-1/4 right-1/4 h-1 w-auto rounded-t-full bg-orange-500" />}
    </button>
  );
}
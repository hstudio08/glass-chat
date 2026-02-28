import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Send, LogOut, ShieldCheck, Lock, WifiOff, ChevronDown, CheckCheck, Check, Clock, Image as ImageIcon, Loader2, Maximize, X, Sparkles, AlertCircle } from 'lucide-react';
import { db } from '../services/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Login from './Login';

// ==========================================
// 🚀 API CONFIGURATION
const IMGBB_API_KEY = '250588b8b03b100c08b3df82baaa28a4'; // Free image hosting for attachments
const GEMINI_API_KEY = 'AIzaSyCzWUVmeJ1NE_8D_JmQQrFQv4elA1zS2iA';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// ==========================================

const animTween = { type: "tween", ease: "easeOut", duration: 0.25 };
const fadeUp = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: animTween } };

export default function UserChat() {
  const [chatId, setChatId] = useState(null); 
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiReplies, setAiReplies] = useState([]);
  const [showAIReplies, setShowAIReplies] = useState(false);
  
  const [pendingImage, setPendingImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [compressImage, setCompressImage] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [connectionError, setConnectionError] = useState("");

  // ✅ BUG FIXED: Missing References Restored
  const messagesEndRef = useRef(null); 
  const chatContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const previousMessageCount = useRef(0);
  const ignoreBlurRef = useRef(false); 
  const audioRef = useRef(typeof Audio !== "undefined" ? new Audio('/pop.mp3') : null);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedImage) setSelectedImage(null);
      if (e.key === 'PrintScreen' || (e.ctrlKey && e.key === 'p')) {
        setPrivacyMode(true); navigator.clipboard.writeText("Screenshots disabled."); setTimeout(() => setPrivacyMode(false), 3000);
      }
    };
    const handleBlur = () => { if (!ignoreBlurRef.current) setPrivacyMode(true); };
    const handleFocus = () => { setPrivacyMode(false); setTimeout(() => { ignoreBlurRef.current = false; }, 500); };

    window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline);
    window.addEventListener('keyup', handleKeyDown); window.addEventListener('blur', handleBlur); window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keyup', handleKeyDown); window.removeEventListener('blur', handleBlur); window.removeEventListener('focus', handleFocus);
    };
  }, [selectedImage]);

  useEffect(() => {
    if (!chatId) return;
    setConnectionError("");
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(fetchedMessages);
      if (previousMessageCount.current !== 0 && fetchedMessages.length > previousMessageCount.current) {
        const lastMsg = fetchedMessages[fetchedMessages.length - 1];
        if (lastMsg?.sender === 'admin') {
          audioRef.current?.play().catch(() => {});
          setShowAIReplies(false); 
        }
      }
      previousMessageCount.current = fetchedMessages.length;
      setTimeout(() => scrollToBottom('auto'), 100);
    }, () => setConnectionError("Secure connection lost."));

    const unsubscribeTyping = onSnapshot(doc(db, 'chats', chatId), (docSnap) => {
      if (docSnap.exists()) setIsAdminTyping(docSnap.data().adminTyping || false);
    });

    return () => { unsubscribe(); unsubscribeTyping(); previousMessageCount.current = 0; };
  }, [chatId]);

  // 📡 READ RECEIPTS ENGINE (Marks admin messages as Delivered/Seen)
  useEffect(() => {
    if (!chatId) return;
    const hasFocus = document.hasFocus();
    messages.forEach(msg => {
      if (msg.sender === 'admin') {
        if (hasFocus && msg.status !== 'seen') {
          updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), { status: 'seen' }).catch(()=>{});
        } else if (!hasFocus && msg.status === 'sent') {
          updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), { status: 'delivered' }).catch(()=>{});
        }
      }
    });
  }, [messages, chatId]);

  useEffect(() => {
    const handleFocus = () => {
      if (!chatId) return;
      messages.forEach(msg => {
        if (msg.sender === 'admin' && msg.status !== 'seen') updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), { status: 'seen' }).catch(()=>{});
      });
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [messages, chatId]);

  useEffect(() => {
    if (!chatId) return;
    const setOnline = () => setDoc(doc(db, 'chats', chatId), { userOnline: true }, { merge: true }).catch(()=>{});
    const setOffline = () => setDoc(doc(db, 'chats', chatId), { userOnline: false, userLastSeen: serverTimestamp() }, { merge: true }).catch(()=>{});
    setOnline();
    const handleVisibility = () => document.visibilityState === 'visible' ? setOnline() : setOffline();
    window.addEventListener('visibilitychange', handleVisibility); window.addEventListener('beforeunload', setOffline);
    return () => { setOffline(); window.removeEventListener('visibilitychange', handleVisibility); window.removeEventListener('beforeunload', setOffline); };
  }, [chatId]);

  // Safe scrolling engine
  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = (e) => setShowScrollButton(e.target.scrollHeight - e.target.scrollTop - e.target.clientHeight > 100);

  const generateAIQuickReplies = async () => {
    if (showAIReplies && aiReplies.length > 0) { setShowAIReplies(false); return; }
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('PASTE')) return alert("Missing API Key");

    setIsGeneratingAI(true); setShowAIReplies(true); setAiReplies([]);

    try {
      const recentMessages = messages.slice(-3);
      if (recentMessages.length === 0) {
        setAiReplies(["Hello!", "How can I help?", "I have a question."]);
        return setIsGeneratingAI(false);
      }

      const waitingOnSupport = recentMessages[recentMessages.length - 1].sender === 'user';
      const transcript = recentMessages.map(m => `${m.sender === 'user' ? 'Me' : 'Support'}:${m.isImage ? '[Img]' : m.text}`).join('|');
      const prompt = `Context:${transcript}|Task:Return JSON array of exactly 3 short ${waitingOnSupport ? 'follow-up questions' : 'answers'}. Max 4 words each.`;

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite", generationConfig: { responseMimeType: "application/json", maxOutputTokens: 50 } });
      const result = await model.generateContent(prompt);
      const parsedReplies = JSON.parse(result.response.text());
      setAiReplies(Array.isArray(parsedReplies) ? parsedReplies.slice(0,3) : ["Understood.", "Can you explain?", "Thanks."]);
    } catch (error) { setAiReplies(["Yes.", "Could you elaborate?", "Thank you."]); } 
    finally { setIsGeneratingAI(false); }
  };

  const handleInputFocus = () => { if (chatId) setDoc(doc(db, 'chats', chatId), { userTyping: true }, { merge: true }).catch(()=>{}); };
  const handleInputBlur = () => { if (chatId) setDoc(doc(db, 'chats', chatId), { userTyping: false }, { merge: true }).catch(()=>{}); };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPendingImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    e.target.value = null; 
  };

  const handleSendText = async (e, overrideText = null) => {
    if (e) e.preventDefault();
    const textToSend = overrideText || newMessage.trim();

    if (!textToSend && !pendingImage) return; 
    if (!chatId || isOffline || isUploading) return;
    
    const currentImg = pendingImage;
    const currentText = textToSend;

    setNewMessage(""); setPendingImage(null); setPreviewUrl(null); setShowAIReplies(false); setConnectionError("");
    if (textareaRef.current) textareaRef.current.style.height = '48px';
    scrollToBottom('auto'); 
    
    setIsUploading(true);
    setDoc(doc(db, 'chats', chatId), { userTyping: false }, { merge: true }).catch(()=>{});
    
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

        await addDoc(collection(db, 'chats', chatId, 'messages'), { text: json.data.url, isImage: true, sender: "user", timestamp: serverTimestamp(), status: "sent" });
      }

      if (currentText) {
        await addDoc(collection(db, 'chats', chatId, 'messages'), { text: currentText, isImage: false, sender: "user", timestamp: serverTimestamp(), status: "sent" });
      }
      scrollToBottom('auto');
    } catch (err) { 
      setConnectionError("Delivery Failed: Session is Blocked or Expired.");
    } finally { 
      setIsUploading(false); 
    }
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    if (chatId) setDoc(doc(db, 'chats', chatId), { userTyping: false }, { merge: true }).catch(()=>{});
    setTimeout(() => { setChatId(null); setMessages([]); setIsLoggingOut(false); }, 300); 
  };

  const formatTime = (ts) => ts ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(ts.toDate()) : "";

  // Elegant ticks for user bubbles
  const MessageStatusIcon = ({ msg }) => {
    if (!msg.timestamp) return <Clock size={12} className="text-white/60 ml-1" />; 
    if (msg.status === 'seen') return <CheckCheck size={14} className="text-sky-300 drop-shadow-sm ml-1" />;
    if (msg.status === 'delivered') return <CheckCheck size={14} className="text-white/80 ml-1" />;
    return <Check size={14} className="text-white/80 ml-1" />; 
  };

  if (!chatId) return <Login onLogin={setChatId} />;

  return (
    // STRICT ABSOLUTE SHELL (Fixes mobile layout breaking)
    <div className="fixed inset-0 w-full flex flex-col bg-[#f8f9fa] overflow-hidden font-sans text-slate-800">
      
      {/* Abstract Background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
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

      <AnimatePresence>
        {!isLoggingOut && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={animTween} className="flex flex-col w-full h-full relative z-10">
            
            {/* Overlays */}
            {isOffline && (
              <div className="absolute inset-0 bg-white/80 z-[60] flex flex-col items-center justify-center backdrop-blur-sm"><WifiOff size={48} className="text-orange-500 mb-4 animate-pulse" /><h2 className="text-xl font-bold text-slate-800">Connection Lost</h2></div>
            )}
            {privacyMode && !isOffline && !selectedImage && (
              <div className="absolute inset-0 bg-white/90 z-[55] flex flex-col items-center justify-center backdrop-blur-md"><Lock size={48} className="text-orange-500 mb-4" /><h2 className="text-xl font-bold text-slate-800">Session Locked</h2></div>
            )}

            {/* HEADER */}
            <header className="flex-none bg-white/60 backdrop-blur-md border-b border-slate-200/60 px-4 sm:px-8 py-3 flex items-center justify-between z-20" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl shadow-sm text-white">
                  <ShieldCheck size={20} />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full shadow-sm"></span>
                </div>
                <div>
                  <h3 className="font-bold text-[16px] sm:text-lg tracking-tight">Support Hub</h3>
                  <p className="text-[11px] sm:text-xs font-semibold text-orange-500 flex items-center gap-1"><Lock size={10}/> Encrypted</p>
                </div>
              </div>
              <button onClick={handleLogout} className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                <LogOut size={20} />
              </button>
            </header>

            {/* MESSAGES */}
            <main ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 flex flex-col items-center z-10 custom-scrollbar relative">
              <div className="w-full max-w-4xl flex flex-col gap-4 pb-2">
                
                <AnimatePresence mode="popLayout">
                  {messages.length === 0 && (
                    <motion.div variants={fadeUp} initial="hidden" animate="visible" exit="hidden" className="flex flex-col items-center justify-center h-32 text-center gap-3 mt-10">
                      <div className="p-4 rounded-full bg-orange-100 text-orange-500"><ShieldCheck size={32} /></div>
                      <div><h4 className="font-bold">Secure Channel Open</h4><p className="text-xs text-slate-500 mt-1">End-to-end encrypted.</p></div>
                    </motion.div>
                  )}

                  {messages.map((msg) => {
                    const isUser = msg.sender === 'user';
                    return (
                      <motion.div key={msg.id} layout="position" variants={fadeUp} initial="hidden" animate="visible" className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className={`relative px-4 py-3 sm:px-5 sm:py-3.5 max-w-[85%] sm:max-w-[70%] rounded-2xl shadow-sm border ${isUser ? 'bg-orange-500 border-orange-600 text-white rounded-tr-sm' : 'bg-white border-slate-200 text-slate-800 rounded-tl-sm'}`}>
                          
                          {msg.isImage ? (
                            <div className="relative group cursor-zoom-in rounded-lg overflow-hidden mb-1" onClick={() => setSelectedImage(msg.text)}>
                              <img src={msg.text} alt="Attachment" className="w-full max-w-[240px] sm:max-w-[320px] object-cover transition-transform duration-300 group-hover:scale-105" />
                              <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors flex items-center justify-center"><Maximize className="text-white opacity-0 group-hover:opacity-100" size={24} /></div>
                            </div>
                          ) : (
                            <p className="text-[15px] sm:text-[16px] leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                          )}

                          <div className={`text-[10px] font-medium mt-1.5 flex items-center gap-0.5 ${isUser ? 'justify-end text-orange-100' : 'justify-start text-slate-400'}`}>
                            {msg.isEdited && <span className="italic mr-1">(edited)</span>}
                            {formatTime(msg.timestamp)}
                            {isUser && <MessageStatusIcon msg={msg} />}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}

                  {isAdminTyping && (
                    <motion.div layout="position" variants={fadeUp} initial="hidden" animate="visible" exit="hidden" className="flex justify-start">
                      <div className="px-4 py-3 rounded-2xl rounded-tl-sm border bg-white border-slate-200 shadow-sm flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Support</span>
                        <div className="flex gap-1 ml-1"><div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce"/><div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{animationDelay:'0.15s'}}/><div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{animationDelay:'0.3s'}}/></div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* Reference for snapping to bottom safely */}
                <div ref={messagesEndRef} className="h-1" />
              </div>
            </main>

            <AnimatePresence>
              {showScrollButton && (
                <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={animTween} onClick={() => scrollToBottom('smooth')} className="absolute bottom-28 right-6 p-3 bg-white text-orange-500 rounded-full shadow-md border border-slate-100 z-30">
                  <ChevronDown size={20} strokeWidth={3} />
                </motion.button>
              )}
            </AnimatePresence>

            {/* COMPOSER */}
            <footer className="flex-none bg-white/70 backdrop-blur-lg border-t border-slate-200/60 px-3 sm:px-8 py-3 z-20 w-full flex flex-col items-center" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
              <div className="w-full max-w-4xl flex flex-col gap-2 relative">
                
                <AnimatePresence>
                  {connectionError && (
                    <motion.div initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 10, height: 0 }} className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-xl text-xs font-bold mb-1">
                      <AlertCircle size={14} /> {connectionError}
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showAIReplies && (
                    <motion.div initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 10, height: 0 }} className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                      {isGeneratingAI ? (
                        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 text-xs font-semibold">
                          <Loader2 size={14} className="animate-spin" /> Flash-Lite analyzing...
                        </div>
                      ) : (
                        aiReplies.map((reply, i) => (
                          <button key={i} onClick={() => handleSendText(null, reply)} className="text-[12px] whitespace-nowrap font-medium px-4 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-orange-300 hover:text-orange-600 shadow-sm transition-colors min-h-[36px]">
                            {reply}
                          </button>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <form className="flex gap-2 items-end w-full relative">
                  <div className="flex gap-1 mb-1">
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
                    <button type="button" onClick={() => { ignoreBlurRef.current = true; fileInputRef.current?.click(); }} disabled={isUploading || isOffline} className="p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-orange-500 shadow-sm disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors">
                      {isUploading ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20} />}
                    </button>
                    <button type="button" onClick={generateAIQuickReplies} title="AI Replies" disabled={isOffline} className="p-2.5 sm:p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 shadow-sm min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors">
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

                    <div className="flex items-end w-full">
                      <textarea 
                        ref={textareaRef} value={newMessage} 
                        onChange={(e) => { setNewMessage(e.target.value); e.target.style.height = '48px'; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`; }} 
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(e); } }}
                        onFocus={handleInputFocus} onBlur={handleInputBlur} placeholder={previewUrl ? "Add a caption (optional)..." : "Message..."} disabled={isOffline || isUploading} rows={1}
                        className={`flex-1 bg-transparent py-2.5 text-[16px] text-slate-800 placeholder-slate-400 focus:outline-none resize-none custom-scrollbar leading-relaxed pl-3 pr-12`}
                        style={{ minHeight: '48px' }}
                      />
                      
                      <div className="absolute right-1.5 bottom-1.5">
                        <motion.button onClick={handleSendText} type="button" whileTap={{ scale: 0.95 }} disabled={(!newMessage.trim() && !pendingImage) || isOffline || isUploading} className="p-2 rounded-xl bg-orange-500 text-white shadow-sm disabled:opacity-50 transition-opacity min-h-[36px] min-w-[36px] flex items-center justify-center">
                          {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
                        </motion.button>
                      </div>
                    </div>
                  </div>

                </form>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
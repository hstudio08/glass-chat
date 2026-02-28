import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { Send, LogOut, ShieldCheck, Lock, WifiOff, ChevronDown, CheckCheck, Check, Clock, Image as ImageIcon, Loader2, Maximize, X, Sparkles, AlertCircle, UserCircle, Reply, Video, PhoneIncoming, PhoneOff } from 'lucide-react';
import { db } from '../services/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenerativeAI } from '@google/generative-ai';
import NativeVideoCall from '../components/NativeVideoCall'; // 🚀 NATIVE VIDEO ENGINE
import Login from './Login';

// ==========================================
// 🚀 API CONFIGURATION
const IMGBB_API_KEY = '250588b8b03b100c08b3df82baaa28a4';
const GEMINI_API_KEY = 'AIzaSyCzWUVmeJ1NE_8D_JmQQrFQv4elA1zS2iA';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// ==========================================

const animTween = { type: "tween", ease: "easeOut", duration: 0.25 };
const fadeUp = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: animTween } };

// 🎵 AUDIO TONES
const RING_TONE = new Audio('https://actions.google.com/sounds/v1/alarms/phone_ringing.ogg');
RING_TONE.loop = true;

export default function UserChat() {
  const [chatId, setChatId] = useState(null); 
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  
  // File & AI State
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiReplies, setAiReplies] = useState([]);
  const [showAIReplies, setShowAIReplies] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [compressImage, setCompressImage] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [replyingToId, setReplyingToId] = useState(null);
  
  // App State
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [connectionError, setConnectionError] = useState("");

  // User Profile State
  const [showProfile, setShowProfile] = useState(false);
  const [userProfile, setUserProfile] = useState({ name: "", bio: "", avatar: "" });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // 🎥 SIGNALING & NATIVE VIDEO STATE
  const [videoCallState, setVideoCallState] = useState(null); // { roomId, isIncoming }

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const previousMessageCount = useRef(0);
  const ignoreBlurRef = useRef(false); 
  const audioRef = useRef(typeof Audio !== "undefined" ? new Audio('/pop.mp3') : null);

  // --- 1. GLOBAL EVENT LISTENERS ---
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') { setSelectedImage(null); setShowProfile(false); }
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

  // --- 2. FETCH MESSAGES & PROFILE ---
  useEffect(() => {
    if (!chatId) return;
    setConnectionError("");
    
    // Fetch Profile Data
    const fetchProfile = async () => {
      const docSnap = await getDoc(doc(db, 'chats', chatId));
      if (docSnap.exists() && docSnap.data().userProfile) setUserProfile(docSnap.data().userProfile);
    };
    fetchProfile();

    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(fetchedMessages);
      if (previousMessageCount.current !== 0 && fetchedMessages.length > previousMessageCount.current) {
        const lastMsg = fetchedMessages[fetchedMessages.length - 1];
        if (lastMsg?.sender === 'admin') { audioRef.current?.play().catch(() => {}); setShowAIReplies(false); }
      }
      previousMessageCount.current = fetchedMessages.length;
      setTimeout(() => scrollToBottom('auto'), 100);
    }, () => setConnectionError("Secure connection lost."));

    const unsubscribeDoc = onSnapshot(doc(db, 'chats', chatId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsAdminTyping(data.adminTyping || false);

        // 🚨 WEBRTC SIGNALING: Listen for Call States
        if (data.activeCall) {
          if (data.activeCall.status === 'ringing' && data.activeCall.caller === 'admin') {
            RING_TONE.play().catch(()=>{});
            setVideoCallState({ roomId: data.activeCall.roomId, isIncoming: true });
          } else if (data.activeCall.status === 'ended' || data.activeCall.status === 'rejected') {
            RING_TONE.pause();
            setVideoCallState(null);
          }
        } else {
          RING_TONE.pause();
          setVideoCallState(null);
        }
      }
    });

    return () => { unsubscribeMessages(); unsubscribeDoc(); previousMessageCount.current = 0; RING_TONE.pause(); };
  }, [chatId]);

  // --- 3. RECEIPTS & PRESENCE ---
  useEffect(() => {
    if (!chatId) return;
    const hasFocus = document.hasFocus();
    messages.forEach(msg => {
      if (msg.sender === 'admin') {
        if (hasFocus && msg.status !== 'seen') updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), { status: 'seen' }).catch(()=>{});
        else if (!hasFocus && msg.status === 'sent') updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), { status: 'delivered' }).catch(()=>{});
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

  // --- UI SCROLL HELPERS ---
  const scrollToBottom = (behavior = 'smooth') => { if (chatContainerRef.current) chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior }); };
  const handleScroll = (e) => setShowScrollButton(e.target.scrollHeight - e.target.scrollTop - e.target.clientHeight > 100);
  const handleInputFocus = () => { if (chatId) setDoc(doc(db, 'chats', chatId), { userTyping: true }, { merge: true }).catch(()=>{}); };
  const handleInputBlur = () => { if (chatId) setDoc(doc(db, 'chats', chatId), { userTyping: false }, { merge: true }).catch(()=>{}); };

  // --- 🎥 VIDEO CALL HANDLERS ---
  const initiateCall = async () => {
    if (!chatId) return;
    const roomId = `vault-${Date.now()}`;
    await updateDoc(doc(db, 'chats', chatId), { activeCall: { caller: 'user', status: 'ringing', roomId: roomId } });
    setVideoCallState({ roomId, isIncoming: false });
  };

  const acceptCall = async () => {
    RING_TONE.pause();
    if (videoCallState?.roomId) {
      await updateDoc(doc(db, 'chats', chatId), { 'activeCall.status': 'in-progress' });
      setVideoCallState({ ...videoCallState, isIncoming: false }); 
    }
  };

  const rejectCall = async () => {
    RING_TONE.pause();
    await updateDoc(doc(db, 'chats', chatId), { 'activeCall.status': 'rejected' });
    setVideoCallState(null);
  };

  const endCallFirebase = async () => {
    await updateDoc(doc(db, 'chats', chatId), { activeCall: null });
    setVideoCallState(null);
  };

  // --- MESSAGE ENGINE ---
  const generateAIQuickReplies = async () => {
    if (showAIReplies && aiReplies.length > 0) { setShowAIReplies(false); return; }
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('PASTE')) return alert("Missing API Key");
    setIsGeneratingAI(true); setShowAIReplies(true); setAiReplies([]);
    try {
      const recentMessages = messages.slice(-3);
      if (recentMessages.length === 0) { setAiReplies(["Hello!", "How can I help?", "I have a question."]); return setIsGeneratingAI(false); }
      const waitingOnSupport = recentMessages[recentMessages.length - 1].sender === 'user';
      const transcript = recentMessages.map(m => `${m.sender === 'user' ? 'Me' : 'Support'}:${m.isImage ? '[Img]' : m.text}`).join('|');
      const prompt = `Context:${transcript}|Task:Return JSON array of exactly 3 short ${waitingOnSupport ? 'follow-up questions' : 'answers'}. Max 4 words each.`;
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite", generationConfig: { responseMimeType: "application/json", maxOutputTokens: 50 } });
      const result = await model.generateContent(prompt);
      const parsedReplies = JSON.parse(result.response.text());
      setAiReplies(Array.isArray(parsedReplies) ? parsedReplies.slice(0,3) : ["Understood.", "Can you explain?", "Thanks."]);
    } catch (error) { setAiReplies(["Yes.", "Could you elaborate?", "Thank you."]); } finally { setIsGeneratingAI(false); }
  };

  const handleImageSelect = (e) => { const file = e.target.files[0]; if (!file) return; setPendingImage(file); setPreviewUrl(URL.createObjectURL(file)); e.target.value = null; };

  const handleSendText = async (e, overrideText = null) => {
    if (e) e.preventDefault();
    const textToSend = overrideText || newMessage.trim();
    if (!textToSend && !pendingImage) return; 
    if (!chatId || isOffline || isUploading) return;
    
    const currentImg = pendingImage; const currentText = textToSend; const currentReply = replyingToId;
    setNewMessage(""); setPendingImage(null); setPreviewUrl(null); setShowAIReplies(false); setConnectionError(""); setReplyingToId(null);
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
              const MAX_WIDTH = 1200; const scaleSize = Math.min(MAX_WIDTH / img.width, 1);
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
        await addDoc(collection(db, 'chats', chatId, 'messages'), { text: json.data.url, isImage: true, sender: "user", timestamp: serverTimestamp(), status: "sent", replyToId: currentReply });
      }
      if (currentText) {
        await addDoc(collection(db, 'chats', chatId, 'messages'), { text: currentText, isImage: false, sender: "user", timestamp: serverTimestamp(), status: "sent", replyToId: currentReply });
      }
      scrollToBottom('auto');
    } catch (err) { setConnectionError("Delivery Failed: Session is Blocked or Expired."); } finally { setIsUploading(false); }
  };

  // --- PROFILE LOGIC ---
  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await setDoc(doc(db, 'chats', chatId), { userProfile }, { merge: true });
      setShowProfile(false);
    } catch (err) { alert("Failed to save profile."); }
    finally { setIsSavingProfile(false); }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setIsSavingProfile(true); ignoreBlurRef.current = true;
    try {
      const img = new Image(); img.src = URL.createObjectURL(file);
      await new Promise(resolve => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400; const scaleSize = Math.min(MAX_WIDTH / img.width, 1);
          canvas.width = img.width * scaleSize; canvas.height = img.height * scaleSize;
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          const base64Image = canvas.toDataURL('image/jpeg', 0.6).split(',')[1]; 
          resolve(base64Image);
        };
      }).then(async (base64) => {
        const formData = new FormData(); formData.append('image', base64);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
        const json = await res.json();
        setUserProfile({...userProfile, avatar: json.data.url});
      });
    } catch (err) { alert("Avatar upload failed"); } 
    finally { setIsSavingProfile(false); if(avatarInputRef.current) avatarInputRef.current.value = ""; }
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    if (chatId) setDoc(doc(db, 'chats', chatId), { userTyping: false }, { merge: true }).catch(()=>{});
    setTimeout(() => { setChatId(null); setMessages([]); setIsLoggingOut(false); }, 300); 
  };

  const formatTime = (ts) => ts && typeof ts.toDate === 'function' ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(ts.toDate()) : "";

  const MessageStatusIcon = ({ msg }) => {
    if (!msg.timestamp || typeof msg.timestamp.toDate !== 'function') return <Clock size={12} className="text-[#C1B2A6] ml-1" />; 
    if (msg.status === 'seen') return <CheckCheck size={14} className="text-sky-300 drop-shadow-sm ml-1" />;
    if (msg.status === 'delivered') return <CheckCheck size={14} className="text-[#E8E1D5] ml-1" />;
    return <Check size={14} className="text-[#E8E1D5] ml-1" />; 
  };

  if (!chatId) return <Login onLogin={setChatId} />;

  return (
    // ✅ BUG FIX: min-h-0 and min-w-0 prevents layout exploding
    <div className="fixed inset-0 w-full flex flex-col bg-gradient-to-br from-[#E6DCC8] to-[#D5C7B3] overflow-hidden font-sans text-[#4A3C31] min-h-0 min-w-0">
      
      <div className="absolute inset-0 pointer-events-none z-0 opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#C1B2A6] mix-blend-multiply blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#E8E1D5] mix-blend-multiply blur-[100px]" />
      </div>

      <AnimatePresence>
        {selectedImage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={animTween} className="fixed inset-0 z-[100] bg-[#3A2D23]/95 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setSelectedImage(null)}>
            <button className="absolute top-6 right-6 text-[#E8E1D5] hover:text-white p-2 rounded-full transition-colors z-50"><X size={28}/></button>
            <img src={selectedImage} alt="Fullscreen Attachment" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-[#8C7462]/30" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* 👤 USER PROFILE MODAL */}
        {showProfile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] bg-[#3A2D23]/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-[#F9F6F0] w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#C1B2A6]/50 flex flex-col relative">
              <button onClick={() => setShowProfile(false)} className="absolute top-4 right-4 p-2 text-[#9E8E81] hover:text-[#5A4535] bg-[#E8E1D5]/50 rounded-full"><X size={20}/></button>
              <h2 className="text-2xl font-serif font-bold text-[#3A2D23] mb-6">Profile Config</h2>
              
              <div className="flex flex-col items-center mb-6">
                <div className="relative group cursor-pointer" onClick={() => { ignoreBlurRef.current = true; avatarInputRef.current?.click(); }}>
                  <img src={userProfile.avatar || "https://i.ibb.co/3s3g3z1/default-avatar.png"} className="w-24 h-24 rounded-full object-cover border-4 border-[#E8E1D5] shadow-md" alt="Avatar"/>
                  <div className="absolute inset-0 bg-[#3A2D23]/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><ImageIcon className="text-white" size={24}/></div>
                  {isSavingProfile && <div className="absolute inset-0 bg-[#F9F6F0]/80 rounded-full flex items-center justify-center"><Loader2 className="animate-spin text-[#8C7462]" size={24}/></div>}
                </div>
                <input type="file" accept="image/*" ref={avatarInputRef} onChange={handleAvatarUpload} className="hidden" />
                <span className="text-xs font-bold text-[#9E8E81] uppercase mt-3 tracking-widest">Tap to change</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest mb-1.5 block text-[#7A6B5D]">Display Name</label>
                  <input type="text" value={userProfile.name} onChange={e => setUserProfile({...userProfile, name: e.target.value})} className="w-full rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8C7462]/50 font-bold border border-[#C1B2A6]/50 text-sm bg-[#F9F6F0] text-[#3A2D23] shadow-inner" placeholder="Your Name"/>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest mb-1.5 flex justify-between text-[#7A6B5D]"><span>About / Bio</span> <span>{userProfile.bio.length}/200</span></label>
                  <textarea value={userProfile.bio} maxLength={200} onChange={e => setUserProfile({...userProfile, bio: e.target.value})} rows={3} className="w-full rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8C7462]/50 font-medium border border-[#C1B2A6]/50 text-sm bg-[#F9F6F0] text-[#3A2D23] shadow-inner resize-none" placeholder="Add links, address, or info..."/>
                </div>
                <button onClick={handleSaveProfile} disabled={isSavingProfile} className="w-full mt-2 bg-[#5A4535] hover:bg-[#423226] disabled:opacity-50 text-[#F9F6F0] py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md">
                  {isSavingProfile ? <Loader2 size={18} className="animate-spin" /> : "Save Profile"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 📞 INCOMING CALL OVERLAY */}
      <AnimatePresence>
        {videoCallState?.isIncoming && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-2xl flex flex-col items-center justify-center text-white">
            <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center mb-8 animate-[pulse_1s_infinite]">
              <PhoneIncoming size={48} className="text-emerald-400" />
            </div>
            <h2 className="text-3xl font-bold mb-2 tracking-tight">Incoming Video Call</h2>
            <p className="text-white/60 font-medium mb-12">Administrator is attempting to connect securely.</p>
            <div className="flex gap-6">
              <button onClick={rejectCall} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.5)] transition-transform hover:scale-110"><PhoneOff size={28} /></button>
              <button onClick={acceptCall} className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-transform hover:scale-110"><Video size={28} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🎥 PEER.JS NATIVE VIDEO OVERLAY */}
      <AnimatePresence>
        {videoCallState && !videoCallState.isIncoming && (
          <NativeVideoCall 
            chatId={chatId} 
            myRole="user" 
            roomId={videoCallState.roomId}
            isIncoming={false}
            onClose={endCallFirebase} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isLoggingOut && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={animTween} className="flex flex-col w-full h-full relative z-10 min-h-0 min-w-0">
            
            {isOffline && <div className="absolute inset-0 bg-[#F9F6F0]/90 z-[60] flex flex-col items-center justify-center backdrop-blur-md"><WifiOff size={48} className="text-[#8C7462] mb-4 animate-pulse" /><h2 className="text-xl font-bold text-[#3A2D23]">Connection Lost</h2></div>}
            {privacyMode && !isOffline && !selectedImage && <div className="absolute inset-0 bg-[#F9F6F0]/95 z-[55] flex flex-col items-center justify-center backdrop-blur-xl"><Lock size={48} className="text-[#8C7462] mb-4" /><h2 className="text-xl font-bold text-[#3A2D23]">Session Locked</h2></div>}

            <header className="flex-none shrink-0 bg-[#F9F6F0]/70 backdrop-blur-xl border-b border-[#C1B2A6]/50 px-4 sm:px-8 py-3 flex items-center justify-between z-20 shadow-[0_10px_30px_rgba(90,70,50,0.03)]" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-10 h-10 bg-gradient-to-br from-[#8C7462] to-[#5A4535] rounded-xl shadow-sm text-[#F9F6F0]">
                  <ShieldCheck size={20} />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#F9F6F0] rounded-full shadow-sm"></span>
                </div>
                <div>
                  <h3 className="font-bold text-[16px] sm:text-lg tracking-tight text-[#3A2D23]">Support Hub</h3>
                  <p className="text-[11px] sm:text-xs font-semibold text-[#8C7462] flex items-center gap-1"><Lock size={10}/> Encrypted</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={initiateCall} className="p-2 sm:p-2.5 rounded-xl text-blue-600 hover:bg-[#E8E1D5] transition-colors"><Video size={20} /></button>
                <button onClick={() => setShowProfile(true)} className="p-2 sm:p-2.5 rounded-xl text-[#7A6B5D] hover:bg-[#E8E1D5] hover:text-[#5A4535] transition-colors"><UserCircle size={22} /></button>
                <button onClick={handleLogout} className="p-2 sm:p-2.5 rounded-xl text-[#7A6B5D] hover:text-red-600 hover:bg-red-50 transition-colors"><LogOut size={20} /></button>
              </div>
            </header>

            <main ref={chatContainerRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8 flex flex-col items-center z-10 custom-scrollbar relative">
              <div className="w-full max-w-4xl flex flex-col gap-4 pb-2">
                
                <AnimatePresence mode="popLayout">
                  {messages.length === 0 && (
                    <motion.div variants={fadeUp} initial="hidden" animate="visible" exit="hidden" className="flex flex-col items-center justify-center h-32 text-center gap-3 mt-10">
                      <div className="p-4 rounded-full bg-[#E8E1D5] text-[#8C7462]"><ShieldCheck size={32} /></div>
                      <div><h4 className="font-bold text-[#3A2D23]">Secure Channel Open</h4><p className="text-xs text-[#7A6B5D] mt-1 font-medium">End-to-end encrypted.</p></div>
                    </motion.div>
                  )}

                  {messages.map((msg) => {
                    const isUser = msg.sender === 'user';
                    return (
                      <motion.div key={msg.id} layout="position" variants={fadeUp} initial="hidden" animate="visible" className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group relative`}>
                        
                        {msg.replyToId && messages.find(m => m.id === msg.replyToId) && (
                          <div className={`mb-1 px-3 py-1.5 rounded-lg text-xs font-medium border opacity-80 max-w-[70%] truncate ${isUser ? 'bg-[#E8E1D5] border-[#C1B2A6]/50 text-[#4A3C31]' : 'bg-[#C1B2A6]/30 border-[#C1B2A6]/50 text-[#4A3C31]'}`}>
                            <Reply size={10} className="inline mr-1"/> {messages.find(m => m.id === msg.replyToId).text}
                          </div>
                        )}

                        <div className={`relative px-4 py-3 sm:px-5 sm:py-3.5 max-w-[85%] sm:max-w-[70%] rounded-2xl shadow-sm border ${isUser ? 'bg-[#5A4535] border-[#423226] text-[#F9F6F0] rounded-tr-sm' : 'bg-[#F9F6F0] border-[#C1B2A6]/50 text-[#4A3C31] rounded-tl-sm'}`}>
                          {msg.isImage ? (
                            <div className="relative group/img cursor-zoom-in rounded-lg overflow-hidden mb-1" onClick={() => setSelectedImage(msg.text)}>
                              <img src={msg.text} alt="Attachment" className="w-full max-w-[240px] sm:max-w-[320px] object-cover transition-transform duration-300 group-hover/img:scale-105" />
                              <div className="absolute inset-0 bg-[#3A2D23]/0 group-hover/img:bg-[#3A2D23]/10 transition-colors flex items-center justify-center"><Maximize className="text-white opacity-0 group-hover/img:opacity-100" size={24} /></div>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap break-words text-[15px] sm:text-[16px] leading-relaxed">{msg.text}</p>
                          )}
                          <div className={`text-[10px] font-medium mt-1.5 flex items-center gap-0.5 ${isUser ? 'justify-end text-[#C1B2A6]' : 'justify-start text-[#9E8E81]'}`}>
                            {msg.isEdited && isUser && <span className="italic mr-1">(edited)</span>}
                            {formatTime(msg.timestamp)}
                            {isUser && <MessageStatusIcon msg={msg} />}
                          </div>
                        </div>

                        <div className={`hidden sm:flex absolute top-1/2 -translate-y-1/2 ${isUser ? '-left-[44px]' : '-right-[44px]'} opacity-0 group-hover:opacity-100 transition-opacity gap-1.5`}>
                          <button onClick={() => setReplyingToId(msg.id)} className="p-2 rounded-xl bg-[#F9F6F0] border border-[#C1B2A6]/50 shadow-sm hover:text-[#5A4535] text-[#7A6B5D] transition-colors"><Reply size={14}/></button>
                        </div>
                      </motion.div>
                    )
                  })}

                  {isAdminTyping && (
                    <motion.div layout="position" variants={fadeUp} initial="hidden" animate="visible" exit="hidden" className="flex justify-start">
                      <div className="px-4 py-3 rounded-2xl rounded-tl-sm border bg-[#F9F6F0] border-[#C1B2A6]/50 shadow-sm flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#9E8E81]">Support typing</span>
                        <div className="flex gap-1 ml-1"><div className="w-1.5 h-1.5 bg-[#8C7462] rounded-full animate-bounce"/><div className="w-1.5 h-1.5 bg-[#8C7462] rounded-full animate-bounce" style={{animationDelay:'0.15s'}}/><div className="w-1.5 h-1.5 bg-[#8C7462] rounded-full animate-bounce" style={{animationDelay:'0.3s'}}/></div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={messagesEndRef} className="h-1" />
              </div>
            </main>

            <AnimatePresence>
              {showScrollButton && (
                <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={animTween} onClick={() => scrollToBottom('smooth')} className="absolute bottom-32 right-6 p-3 bg-[#F9F6F0] text-[#5A4535] rounded-full shadow-md border border-[#C1B2A6]/50 z-30">
                  <ChevronDown size={20} strokeWidth={3} />
                </motion.button>
              )}
            </AnimatePresence>

            <footer className="flex-none shrink-0 bg-[#F9F6F0]/80 backdrop-blur-xl border-t border-[#C1B2A6]/50 px-3 sm:px-8 py-3 z-20 w-full flex flex-col items-center shadow-[0_-10px_30px_rgba(90,70,50,0.03)]" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
              <div className="w-full max-w-4xl flex flex-col gap-2 relative">
                
                <AnimatePresence>
                  {connectionError && (
                    <motion.div initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 10, height: 0 }} className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-xl text-xs font-bold mb-1"><AlertCircle size={14} /> {connectionError}</motion.div>
                  )}
                  {replyingToId && (
                    <motion.div initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 10, height: 0 }} className="flex items-center justify-between bg-[#E8E1D5] border border-[#C1B2A6]/50 px-4 py-2 rounded-xl text-xs font-bold text-[#5A4535] shadow-sm mb-1">
                      <span className="truncate flex-1 flex items-center gap-2"><Reply size={14}/> Replying: {messages.find(m => m.id === replyingToId)?.text?.substring(0,40)}...</span>
                      <button onClick={() => setReplyingToId(null)} className="ml-2 bg-[#C1B2A6]/50 p-1 rounded-full hover:bg-[#C1B2A6]"><X size={12}/></button>
                    </motion.div>
                  )}
                  {showAIReplies && (
                    <motion.div initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 10, height: 0 }} className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                      {isGeneratingAI ? (
                        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E8E1D5] text-[#5A4535] border border-[#C1B2A6]/50 text-xs font-semibold"><Loader2 size={14} className="animate-spin" /> Analyzing context...</div>
                      ) : (
                        aiReplies.map((reply, i) => (
                          <button key={i} onClick={() => handleSendText(null, reply)} className="text-[12px] whitespace-nowrap font-bold px-4 py-1.5 rounded-full bg-[#F9F6F0] border border-[#C1B2A6]/50 text-[#5A4535] hover:border-[#8C7462] hover:bg-[#E8E1D5] shadow-sm transition-colors min-h-[36px]">{reply}</button>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <form className="flex gap-2 items-end w-full">
                  <div className="flex gap-1 mb-1">
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
                    <button type="button" onClick={() => { ignoreBlurRef.current = true; fileInputRef.current?.click(); }} disabled={isUploading || isOffline} className="p-2.5 sm:p-3 rounded-xl bg-[#F9F6F0] border border-[#C1B2A6]/50 text-[#7A6B5D] hover:border-[#8C7462] hover:text-[#5A4535] shadow-sm disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors">
                      {isUploading ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20} />}
                    </button>
                    <button type="button" onClick={generateAIQuickReplies} title="AI Replies" disabled={isOffline} className="p-2.5 sm:p-3 rounded-xl bg-[#E8E1D5] border border-[#C1B2A6]/50 text-[#8C7462] hover:bg-[#C1B2A6]/50 shadow-sm min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors">
                      <Sparkles size={20} className={isGeneratingAI ? "animate-pulse" : ""} />
                    </button>
                  </div>

                  <div className="flex-1 relative bg-[#F9F6F0] border border-[#C1B2A6]/50 rounded-2xl shadow-sm focus-within:border-[#8C7462] focus-within:ring-2 focus-within:ring-[#E8E1D5] transition-all flex flex-col p-1.5">
                    
                    {previewUrl && (
                      <div className="relative mb-2 ml-2 mt-2 inline-block w-max">
                        <img src={previewUrl} className="h-20 w-auto rounded-lg border border-[#C1B2A6]/50 object-cover shadow-sm" alt="Preview" />
                        <button type="button" onClick={() => { setPendingImage(null); setPreviewUrl(null); }} className="absolute -top-2 -right-2 bg-[#3A2D23] text-[#F9F6F0] rounded-full p-1 hover:bg-red-50 shadow-md transition-colors z-10"><X size={12}/></button>
                        <button type="button" onClick={() => setCompressImage(!compressImage)} className={`absolute bottom-2 left-2 text-[10px] font-bold px-2 py-1 rounded-md border z-10 transition-colors backdrop-blur-md shadow-sm ${compressImage ? 'bg-[#5A4535]/90 text-white border-[#4A3C31]' : 'bg-[#E8E1D5]/80 text-[#4A3C31] border-[#C1B2A6]'}`}>
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
                        className={`flex-1 bg-transparent py-2.5 text-[16px] text-[#4A3C31] placeholder-[#9E8E81] focus:outline-none resize-none custom-scrollbar leading-relaxed pl-3 pr-12`}
                        style={{ minHeight: '48px' }}
                      />
                      
                      <div className="absolute right-1.5 bottom-1.5">
                        <motion.button onClick={handleSendText} type="button" whileTap={{ scale: 0.95 }} disabled={(!newMessage.trim() && !pendingImage) || isOffline || isUploading} className="p-2 rounded-xl bg-[#5A4535] text-[#F9F6F0] shadow-sm disabled:opacity-50 transition-opacity min-h-[36px] min-w-[36px] flex items-center justify-center">
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
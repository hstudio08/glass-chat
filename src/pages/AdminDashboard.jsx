import { useState, useEffect, useRef } from 'react';
import { auth, db, googleProvider } from '../services/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { Send, LogOut, Plus, Trash2, Clock, ShieldHalf, Activity, MessageSquare, KeyRound, Settings, Ghost, Edit2, X, Eraser, Download, ChevronLeft, Copy, Image as ImageIcon, Loader2, Maximize, ChevronDown, Sparkles, Edit3, Check, CheckCheck, EyeOff, Bell, MapPin, Mail, UserPlus, Reply, Video, PhoneIncoming, PhoneOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenerativeAI } from '@google/generative-ai';
import NativeVideoCall from '../components/NativeVideoCall';

const ADMIN_EMAIL = "hstudio.webdev@gmail.com";

// ==========================================
// 🚀 API CONFIGURATION
const IMGBB_API_KEY = '250588b8b03b100c08b3df82baaa28a4';
const GEMINI_API_KEY = 'AIzaSyCzWUVmeJ1NE_8D_JmQQrFQv4elA1zS2iA';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// ==========================================

const animTween = { type: "tween", ease: "easeOut", duration: 0.25 };
const fadeUp = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: animTween } };

const RING_TONE = new Audio('https://actions.google.com/sounds/v1/alarms/phone_ringing.ogg');
RING_TONE.loop = true;

export default function AdminDashboard() {
  const [adminUser, setAdminUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('chats'); 
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiReplies, setAiReplies] = useState([]);
  const [showAIReplies, setShowAIReplies] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [compressImage, setCompressImage] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const ignoreBlurRef = useRef(false);
  
  const [accessCodes, setAccessCodes] = useState([]);
  const [accessRequests, setAccessRequests] = useState([]); 
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [activeChatDoc, setActiveChatDoc] = useState(null); 
  const [ghostMode, setGhostMode] = useState(false);
  const [hideReceipts, setHideReceipts] = useState(false); 
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [replyingToId, setReplyingToId] = useState(null);
  const [connectionError, setConnectionError] = useState("");
  
  const [newCodeId, setNewCodeId] = useState("");
  const [newCodeName, setNewCodeName] = useState("");
  const [expiryHours, setExpiryHours] = useState("0"); 
  
  const [videoCallState, setVideoCallState] = useState(null);

  const chatContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const previousMessageCount = useRef(0);
  const audioRef = useRef(typeof Audio !== "undefined" ? new Audio('/pop.mp3') : null);
  const isWindowFocused = useRef(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email === ADMIN_EMAIL) setAdminUser(user); else setAdminUser(null);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAdminLogout = async () => { 
    try { await signOut(auth); setAdminUser(null); setActiveChatId(null); setMessages([]); setActiveTab('chats'); } catch (err) { console.error(err); } 
  };

  useEffect(() => {
    const handleFocus = () => { isWindowFocused.current = true; document.title = "Admin HQ | Secure Portal"; };
    const handleBlur = () => isWindowFocused.current = false;
    const handleKeyDown = (e) => { if (e.key === 'Escape' && selectedImage) setSelectedImage(null); };

    window.addEventListener('focus', handleFocus); window.addEventListener('blur', handleBlur); window.addEventListener('keyup', handleKeyDown);
    return () => { window.removeEventListener('focus', handleFocus); window.removeEventListener('blur', handleBlur); window.removeEventListener('keyup', handleKeyDown); };
  }, [selectedImage]);

  useEffect(() => {
    if (!adminUser) return;
    const unsubCodes = onSnapshot(query(collection(db, 'access_codes')), (snapshot) => setAccessCodes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubReqs = onSnapshot(query(collection(db, 'id_requests'), orderBy('timestamp', 'desc')), (snapshot) => setAccessRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return () => { unsubCodes(); unsubReqs(); };
  }, [adminUser]);

  useEffect(() => {
    setShowAIReplies(false); setAiReplies([]); setPendingImage(null); setPreviewUrl(null); setReplyingToId(null); setConnectionError("");
    if (!activeChatId) return;
    
    const unsubscribeMessages = onSnapshot(query(collection(db, 'chats', activeChatId, 'messages'), orderBy('timestamp', 'asc')), (snapshot) => {
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
    }, () => setConnectionError("Secure connection lost."));

    const unsubscribeDoc = onSnapshot(doc(db, 'chats', activeChatId), (docSnap) => { 
      if (docSnap.exists()) {
        const data = docSnap.data();
        setActiveChatDoc(data);

        if (data.activeCall) {
          if (data.activeCall.status === 'ringing' && data.activeCall.caller === 'user') {
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
  }, [activeChatId]);

  useEffect(() => {
    if (!activeChatId) return;
    const setOnlineStatus = async () => setDoc(doc(db, 'chats', activeChatId), { adminOnline: !ghostMode, adminTyping: false }, { merge: true }).catch(()=>{});
    setOnlineStatus();
    return () => { if (!ghostMode && activeChatId) setDoc(doc(db, 'chats', activeChatId), { adminOnline: false, adminLastSeen: serverTimestamp() }, { merge: true }).catch(()=>{}); };
  }, [activeChatId, ghostMode]);

  useEffect(() => {
    if (!activeChatId || hideReceipts) return;
    const hasFocus = document.hasFocus();
    messages.forEach(msg => {
      if (msg.sender === 'user') {
        if (hasFocus && msg.status !== 'seen') updateDoc(doc(db, 'chats', activeChatId, 'messages', msg.id), { status: 'seen' }).catch(()=>{});
        else if (!hasFocus && msg.status === 'sent') updateDoc(doc(db, 'chats', activeChatId, 'messages', msg.id), { status: 'delivered' }).catch(()=>{});
      }
    });
  }, [messages, activeChatId, hideReceipts]);

  useEffect(() => {
    const handleFocus = () => {
      if (!activeChatId || hideReceipts) return;
      messages.forEach(msg => { if (msg.sender === 'user' && msg.status !== 'seen') updateDoc(doc(db, 'chats', activeChatId, 'messages', msg.id), { status: 'seen' }).catch(()=>{}); });
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [messages, activeChatId, hideReceipts]);

  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior });
  };
  const handleScroll = (e) => setShowScrollButton(e.target.scrollHeight - e.target.scrollTop - e.target.clientHeight > 100);

  const initiateCall = async () => {
    if (!activeChatId || !activeChatDoc) return;
    if (!activeChatDoc.userOnline) { alert("User is offline. Call cannot be delivered."); return; }
    const roomId = `vault-${Date.now()}`;
    await updateDoc(doc(db, 'chats', activeChatId), { activeCall: { caller: 'admin', status: 'ringing', roomId: roomId } });
    setVideoCallState({ roomId, isIncoming: false });
  };

  const acceptCall = async () => {
    RING_TONE.pause();
    if (videoCallState?.roomId) {
      await updateDoc(doc(db, 'chats', activeChatId), { 'activeCall.status': 'in-progress' });
      setVideoCallState({ ...videoCallState, isIncoming: false }); 
    }
  };

  const rejectCall = async () => {
    RING_TONE.pause();
    await updateDoc(doc(db, 'chats', activeChatId), { 'activeCall.status': 'rejected' });
    setVideoCallState(null);
  };

  const endCallFirebase = async () => {
    await updateDoc(doc(db, 'chats', activeChatId), { activeCall: null });
    setVideoCallState(null);
  };

  const handleApproveRequest = async (request) => {
    const generatedId = `VIP-${Math.floor(1000 + Math.random() * 9000)}`;
    const customId = window.prompt(`Assign an Access ID for ${request.name}:`, generatedId);
    if (!customId) return;
    try {
      await setDoc(doc(db, 'access_codes', customId.trim()), { type: 'permanent', status: 'active', createdAt: Date.now(), expiresAt: null, name: request.name });
      await setDoc(doc(db, 'chats', customId.trim()), { userTyping: false, adminTyping: false, userOnline: false }, { merge: true });
      await updateDoc(doc(db, 'id_requests', request.id), { status: 'approved', grantedId: customId.trim() });
    } catch (err) { alert("Failed to approve request."); }
  };

  const handleEmailDraft = (request) => {
    const subject = encodeURIComponent("Your Secure Chat Access ID");
    const body = encodeURIComponent(`Hello ${request.name},\n\nYour request for secure chat access has been approved.\n\nYour Access ID is: ${request.grantedId}\n\nPlease enter this ID on the secure portal at tinyurl.com/haadisabzar to begin our encrypted session.\n\nBest regards,\nSupport Team`);
    window.location.href = `mailto:${request.email}?subject=${subject}&body=${body}`;
  };

  const handleDeleteRequest = async (id) => { if (window.confirm("Permanently delete this request?")) await deleteDoc(doc(db, 'id_requests', id)); };

  const handleCreateCode = async (e) => {
    e.preventDefault();
    if (!newCodeId.trim()) return;
    let expiresAt = null;
    if (parseInt(expiryHours) > 0) expiresAt = Date.now() + (parseInt(expiryHours) * 60 * 60 * 1000);
    await setDoc(doc(db, 'access_codes', newCodeId.trim()), { type: expiresAt ? "temporary" : "permanent", status: "active", createdAt: Date.now(), expiresAt: expiresAt, name: newCodeName.trim() || "" });
    await setDoc(doc(db, 'chats', newCodeId.trim()), { userTyping: false, adminTyping: false, userOnline: false }, { merge: true });
    navigator.clipboard.writeText(newCodeId.trim());
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

  const generateAIQuickReplies = async () => {
    if (showAIReplies && aiReplies.length > 0) { setShowAIReplies(false); return; }
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('PASTE')) return alert("Missing API Key");
    setIsGeneratingAI(true); setShowAIReplies(true); setAiReplies([]);
    try {
      const recentMessages = messages.slice(-3);
      if (recentMessages.length === 0) { setAiReplies(["How can I assist you?", "Please send details.", "I'm looking into it."]); return setIsGeneratingAI(false); }
      const waitingOnClient = recentMessages[recentMessages.length - 1].sender === 'admin';
      const transcript = recentMessages.map(m => `${m.sender === 'admin' ? 'Agent' : 'Client'}:${m.isImage ? '[Img]' : m.text}`).join('|');
      const prompt = `Context:${transcript}|Task:Return JSON array of exactly 3 short professional ${waitingOnClient ? 'follow-ups' : 'support answers'}. Max 4 words each.`;
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite", generationConfig: { responseMimeType: "application/json", maxOutputTokens: 50 } });
      const result = await model.generateContent(prompt);
      const parsedReplies = JSON.parse(result.response.text());
      setAiReplies(Array.isArray(parsedReplies) ? parsedReplies.slice(0,3) : ["Understood.", "I'll check.", "Thank you."]);
    } catch (error) { setAiReplies(["Understood.", "Checking now.", "Thanks."]); } finally { setIsGeneratingAI(false); }
  };

  const handleImageSelect = (e) => { const file = e.target.files[0]; if (!file) return; setPendingImage(file); setPreviewUrl(URL.createObjectURL(file)); e.target.value = null; };

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

    const currentImg = pendingImage; const currentText = textToSend; const currentReply = replyingToId;
    setIsUploading(true);
    setNewMessage(""); setPendingImage(null); setPreviewUrl(null); setShowAIReplies(false); setReplyingToId(null);
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
        await addDoc(collection(db, 'chats', activeChatId, 'messages'), { text: json.data.url, isImage: true, sender: "admin", timestamp: serverTimestamp(), status: "sent", replyToId: currentReply });
      }

      if (currentText) {
        await addDoc(collection(db, 'chats', activeChatId, 'messages'), { text: currentText, isImage: false, sender: "admin", timestamp: serverTimestamp(), status: "sent", replyToId: currentReply });
      }
      scrollToBottom('auto');
    } catch (err) { alert("Delivery Failed."); } finally { setIsUploading(false); }
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

  const formatTime = (ts) => {
    if (!ts || typeof ts.toDate !== 'function') return "Sending...";
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(ts.toDate());
  };

  const formatLastSeen = (ts) => {
    if (!ts || typeof ts.toDate !== 'function') return "Never";
    const diffMins = Math.floor((new Date() - ts.toDate()) / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins/60)}h ago`;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(ts.toDate());
  };

  const MessageStatusIcon = ({ msg }) => {
    if (!msg.timestamp || typeof msg.timestamp.toDate !== 'function') return <Clock size={12} className="text-[#C1B2A6] ml-1" />; 
    if (msg.status === 'seen') return <CheckCheck size={14} className="text-sky-300 drop-shadow-sm ml-1" />;
    if (msg.status === 'delivered') return <CheckCheck size={14} className="text-[#E8E1D5] ml-1" />;
    return <Check size={14} className="text-[#E8E1D5] ml-1" />; 
  };

  const getDisplayName = (code) => code.name ? code.name : code.id;
  const pendingRequestsCount = accessRequests.filter(r => r.status === 'pending').length;

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-gradient-to-br from-[#E6DCC8] to-[#D5C7B3] text-[#4A3C31] font-bold">Loading Vault...</div>;

  if (!adminUser) {
    return (
      <div className="fixed inset-0 w-full flex items-center justify-center p-4 bg-gradient-to-br from-[#E6DCC8] to-[#D5C7B3] overflow-hidden font-sans text-[#4A3C31]">
        <div className="absolute inset-0 pointer-events-none z-0 opacity-40">
          <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-[#C1B2A6] mix-blend-multiply blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-[#E8E1D5] mix-blend-multiply blur-[100px]" />
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md p-10 flex flex-col items-center rounded-3xl z-10 bg-[#F9F6F0]/80 backdrop-blur-xl border border-[#C1B2A6]/50 shadow-[0_20px_50px_rgba(90,70,50,0.15)]">
          <ShieldHalf size={56} className="text-[#8C7462] mb-6" />
          <h1 className="text-2xl font-serif font-bold mb-2 tracking-tight">Admin Vault</h1>
          <p className="text-[#7A6B5D] mb-8 text-sm text-center font-medium">Secure administrator authorization.</p>
          <button onClick={() => signInWithPopup(auth, googleProvider)} className="w-full bg-[#5A4535] hover:bg-[#423226] text-[#F9F6F0] font-bold py-3.5 rounded-xl shadow-md transition-colors">Authenticate</button>
        </motion.div>
      </div>
    );
  }

  return (
    // 🔥 TITANIUM FLEXBOX: fixed inset-0, flex overflow-hidden guarantees no stretching
    <div className="fixed inset-0 flex flex-col sm:flex-row bg-gradient-to-br from-[#E6DCC8] to-[#D5C7B3] overflow-hidden font-sans text-[#4A3C31] min-h-0 min-w-0">
      
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
        {videoCallState?.isIncoming && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-2xl flex flex-col items-center justify-center text-white">
            <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center mb-8 animate-[pulse_1s_infinite]">
              <PhoneIncoming size={48} className="text-emerald-400" />
            </div>
            <h2 className="text-3xl font-bold mb-2 tracking-tight">Incoming Secure Call</h2>
            <p className="text-white/60 font-medium mb-12">Client is attempting to connect.</p>
            <div className="flex gap-6">
              <button onClick={rejectCall} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.5)] transition-transform hover:scale-110"><PhoneOff size={28} /></button>
              <button onClick={acceptCall} className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-transform hover:scale-110"><Video size={28} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {videoCallState && !videoCallState.isIncoming && (
          <NativeVideoCall chatId={activeChatId} myRole="admin" roomId={videoCallState.roomId} isIncoming={false} onClose={endCallFirebase} />
        )}
      </AnimatePresence>

      <nav className="flex-none shrink-0 order-last sm:order-first h-[calc(60px+env(safe-area-inset-bottom))] sm:h-full sm:w-[88px] bg-[#F9F6F0]/70 backdrop-blur-xl border-t sm:border-t-0 sm:border-r border-[#C1B2A6]/50 flex sm:flex-col items-center justify-around sm:justify-start sm:py-6 z-40 pb-[env(safe-area-bottom)] sm:pb-6 shadow-[0_0_30px_rgba(90,70,50,0.05)]">
        <div className="hidden sm:flex w-12 h-12 bg-gradient-to-br from-[#8C7462] to-[#5A4535] rounded-xl shadow-md items-center justify-center mb-6 text-[#F9F6F0]">
          <Activity size={24} />
        </div>
        <div className="flex sm:flex-col gap-1 sm:gap-3 w-full px-2 sm:px-4 justify-around sm:justify-start">
          <NavButton icon={<MessageSquare size={22}/>} label="Chats" active={activeTab === 'chats'} onClick={() => {setActiveTab('chats'); setShowMobileChat(false);}} />
          <NavButton icon={<KeyRound size={22}/>} label="IDs" active={activeTab === 'ids'} onClick={() => {setActiveTab('ids'); setShowMobileChat(false);}} />
          <button onClick={() => {setActiveTab('requests'); setShowMobileChat(false);}} className={`p-2.5 sm:p-3.5 flex sm:flex-col flex-row sm:w-full items-center justify-center gap-2 sm:gap-1.5 rounded-xl transition-all duration-200 relative group ${activeTab === 'requests' ? 'text-[#5A4535] bg-[#E8E1D5] shadow-sm border border-[#C1B2A6]/50' : 'text-[#7A6B5D] hover:text-[#5A4535] hover:bg-[#F9F6F0]/50 border border-transparent'}`}>
            <div className="relative">
              <Bell size={22} />
              {pendingRequestsCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#F9F6F0] shadow-sm"></span>}
            </div>
            <span className={`text-[10px] font-bold tracking-widest ${activeTab === 'requests' ? 'block' : 'hidden sm:block'}`}>Requests</span>
          </button>
          <NavButton icon={<Settings size={22}/>} label="Settings" active={activeTab === 'settings'} onClick={() => {setActiveTab('settings'); setShowMobileChat(false);}} />
          <div className="flex sm:hidden"><button onClick={handleAdminLogout} className="p-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors"><LogOut size={22} /></button></div>
        </div>
        <div className="hidden sm:flex mt-auto px-4 w-full flex-col gap-2">
          <button onClick={handleAdminLogout} className="w-full py-3 flex flex-col items-center gap-1 text-[#7A6B5D] hover:text-red-600 hover:bg-[#E8E1D5]/50 rounded-xl transition-colors">
            <LogOut size={20} /> <span className="text-[10px] font-bold">EXIT</span>
          </button>
        </div>
      </nav>

      {/* 🔥 TITANIUM FLEXBOX: flex-1 flex min-w-0 min-h-0 guarantees this never breaks past the screen */}
      <main className="flex-1 flex min-w-0 min-h-0 overflow-hidden z-10 relative">
        <AnimatePresence mode="wait">
          
          {activeTab === 'chats' && (
            <motion.div key="chats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={animTween} className="flex-1 flex min-h-0 min-w-0 w-full overflow-hidden">
              <div className={`w-full sm:w-[320px] shrink-0 flex flex-col h-full bg-[#F9F6F0]/50 backdrop-blur-md border-r border-[#C1B2A6]/50 overflow-hidden ${showMobileChat ? 'hidden sm:flex' : 'flex'}`}>
                <div className="p-5 border-b border-[#C1B2A6]/50 flex justify-between items-center shrink-0" style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>
                  <h2 className="font-serif font-bold text-xl text-[#3A2D23]">Sessions</h2>
                  <div className="px-2.5 py-1 bg-[#E8E1D5] text-[#5A4535] rounded-full text-xs font-bold border border-[#C1B2A6]/30">{accessCodes.filter(c=>c.status==='active').length}</div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                  {accessCodes.filter(c => c.status === 'active').map(code => {
                    const isActive = activeChatId === code.id;
                    return (
                      <div key={code.id} onClick={() => {setActiveChatId(code.id); setShowMobileChat(true);}} className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex justify-between items-center group ${isActive ? 'bg-[#5A4535] border-[#4A3C31] shadow-md text-[#F9F6F0]' : 'bg-[#F9F6F0]/80 border-[#C1B2A6]/50 hover:border-[#8C7462] shadow-sm text-[#4A3C31]'}`}>
                        <div className="flex flex-col overflow-hidden">
                          <span className={`font-bold truncate text-[15px] ${isActive ? 'text-[#F9F6F0]' : 'text-[#3A2D23]'}`}>{getDisplayName(code)}</span>
                          {code.name && <span className={`text-[10px] uppercase tracking-widest mt-0.5 ${isActive ? 'text-[#C1B2A6]' : 'text-[#7A6B5D]'}`}>{code.id}</span>}
                        </div>
                        <ChevronLeft size={18} className={`rotate-180 opacity-50 sm:hidden ${isActive ? 'text-white' : ''}`} />
                      </div>
                    )
                  })}
                  {accessCodes.filter(c => c.status === 'active').length === 0 && <p className="text-sm text-center mt-10 text-[#7A6B5D]">No active sessions.</p>}
                </div>
              </div>

              <div className={`flex-1 min-w-0 flex flex-col relative overflow-hidden ${!showMobileChat ? 'hidden sm:flex' : 'flex'}`}>
                {activeChatId ? (
                  <>
                    <header className="flex-none shrink-0 bg-[#F9F6F0]/70 backdrop-blur-xl border-b border-[#C1B2A6]/50 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-20 shadow-[0_10px_30px_rgba(90,70,50,0.03)]" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setShowMobileChat(false)} className="sm:hidden p-2 -ml-2 rounded-xl text-[#8C7462] hover:bg-[#E8E1D5]"><ChevronLeft size={24} /></button>
                        <div className="relative">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#F9F6F0] shadow-sm border border-[#C1B2A6]/50 text-[#8C7462]"><MessageSquare size={18} /></div>
                          {activeChatDoc?.userOnline && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#F9F6F0] rounded-full shadow-sm"></span>}
                        </div>
                        <div className="flex flex-col">
                          <h3 className="font-bold text-[16px] tracking-tight text-[#3A2D23]">{getDisplayName(accessCodes.find(c=>c.id===activeChatId) || {id: activeChatId})}</h3>
                          <p className={`text-[11px] font-medium ${activeChatDoc?.userOnline ? 'text-emerald-600' : 'text-[#7A6B5D]'}`}>{activeChatDoc?.userOnline ? "Online now" : `Seen ${formatLastSeen(activeChatDoc?.userLastSeen)}`}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {ghostMode && <div className="hidden sm:flex items-center gap-1.5 bg-[#E8E1D5] border border-[#C1B2A6] px-2.5 py-1 rounded-md text-[#5A4535]"><Ghost size={12} /> <span className="text-[10px] font-bold uppercase tracking-widest">Ghost</span></div>}
                        <button onClick={initiateCall} title="Start Secure Video Call" className="p-2 sm:p-2.5 rounded-xl bg-[#F9F6F0] border border-[#C1B2A6]/50 text-[#5A4535] hover:text-blue-600 shadow-sm transition-colors"><Video size={18} /></button>
                        <button onClick={exportChatHistory} className="p-2 sm:p-2.5 rounded-xl bg-[#F9F6F0] border border-[#C1B2A6]/50 text-[#7A6B5D] hover:text-[#5A4535] shadow-sm transition-colors"><Download size={18} /></button>
                        <button onClick={clearEntireChatHistory} className="p-2 sm:p-2.5 rounded-xl bg-[#F9F6F0] border border-[#C1B2A6]/50 text-[#7A6B5D] hover:text-red-600 shadow-sm transition-colors"><Eraser size={18} /></button>
                      </div>
                    </header>
                    
                    {/* 🔥 TITANIUM FLEXBOX: flex-1 min-h-0 strictly limits scrolling to this specific main block */}
                    <main ref={chatContainerRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 flex flex-col items-center z-10 custom-scrollbar relative">
                      <div className="w-full max-w-4xl flex flex-col gap-4 pb-2">
                        <AnimatePresence mode="popLayout">
                          {messages.map((msg) => {
                            const isAdmin = msg.sender === 'admin';
                            return (
                              <motion.div key={msg.id} layout="position" variants={fadeUp} initial="hidden" animate="visible" className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'} group relative`}>
                                
                                {msg.replyToId && messages.find(m => m.id === msg.replyToId) && (
                                  <div className={`mb-1 px-3 py-1.5 rounded-lg text-xs font-medium border opacity-80 max-w-[70%] truncate ${isAdmin ? 'bg-[#E8E1D5] border-[#C1B2A6]/50 text-[#4A3C31]' : 'bg-[#C1B2A6]/30 border-[#C1B2A6]/50 text-[#4A3C31]'}`}>
                                    <Reply size={10} className="inline mr-1"/> {messages.find(m => m.id === msg.replyToId).text}
                                  </div>
                                )}

                                {/* 🔥 TITANIUM FLEXBOX: break-words overflow-hidden prevents text blowing out horizontal layout */}
                                <div className={`relative px-4 py-3 sm:px-5 sm:py-3.5 max-w-[85%] sm:max-w-[70%] rounded-2xl shadow-sm border overflow-hidden break-words ${isAdmin ? 'bg-[#5A4535] border-[#423226] text-[#F9F6F0] rounded-tr-sm' : 'bg-[#F9F6F0] border-[#C1B2A6]/50 text-[#4A3C31] rounded-tl-sm'}`}>
                                  {msg.isImage ? (
                                    <div className="relative group/img cursor-zoom-in rounded-lg overflow-hidden mb-1" onClick={() => setSelectedImage(msg.text)}>
                                      <img src={msg.text} alt="Attachment" className="w-full max-w-[240px] sm:max-w-[320px] object-cover transition-transform duration-300 group-hover/img:scale-105" />
                                      <div className="absolute inset-0 bg-[#3A2D23]/0 group-hover/img:bg-[#3A2D23]/10 transition-colors flex items-center justify-center"><Maximize className="text-white opacity-0 group-hover/img:opacity-100" size={24} /></div>
                                    </div>
                                  ) : (
                                    <p className="whitespace-pre-wrap break-words leading-relaxed text-[15px] sm:text-[16px]">{msg.text}</p>
                                  )}
                                  <div className={`text-[10px] font-medium mt-1.5 flex items-center gap-0.5 ${isAdmin ? 'justify-end text-[#C1B2A6]' : 'justify-start text-[#9E8E81]'}`}>
                                    {msg.isEdited && !isAdmin && <span className="italic mr-1">(edited)</span>}
                                    {formatTime(msg.timestamp)}
                                    {isAdmin && !hideReceipts && <MessageStatusIcon msg={msg} />}
                                    {isAdmin && hideReceipts && <Check size={14} className="text-[#C1B2A6] ml-1" />}
                                  </div>
                                </div>
                                
                                <div className={`hidden sm:flex absolute top-1/2 -translate-y-1/2 ${isAdmin ? '-left-[104px]' : '-right-[72px]'} opacity-0 group-hover:opacity-100 transition-opacity gap-1.5`}>
                                  <button onClick={() => setReplyingToId(msg.id)} className="p-2 rounded-xl bg-[#F9F6F0] border border-[#C1B2A6]/50 shadow-sm hover:text-[#5A4535] text-[#7A6B5D] transition-colors"><Reply size={14}/></button>
                                  {isAdmin && !msg.isImage && <button onClick={() => {setEditingMsgId(msg.id); setNewMessage(msg.text);}} className="p-2 rounded-xl bg-[#F9F6F0] border border-[#C1B2A6]/50 shadow-sm hover:text-[#5A4535] text-[#7A6B5D] transition-colors"><Edit2 size={14}/></button>}
                                  {isAdmin && <button onClick={() => deleteMessage(msg.id)} className="p-2 rounded-xl bg-[#F9F6F0] border border-[#C1B2A6]/50 shadow-sm hover:text-red-600 text-[#7A6B5D] transition-colors"><Trash2 size={14}/></button>}
                                </div>
                              </motion.div>
                            )
                          })}
                          {activeChatDoc?.userTyping && (
                            <motion.div layout="position" variants={fadeUp} initial="hidden" animate="visible" exit="hidden" className="flex justify-start">
                              <div className="px-4 py-3 rounded-2xl rounded-tl-sm border bg-[#F9F6F0] border-[#C1B2A6]/50 shadow-sm flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[#9E8E81]">Client typing</span>
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

                    {/* 🔥 TITANIUM FLEXBOX: flex-none shrink-0 guarantees footer never gets squished */}
                    <footer className="flex-none shrink-0 bg-[#F9F6F0]/80 backdrop-blur-xl border-t border-[#C1B2A6]/50 px-3 sm:px-6 py-3 z-20 flex flex-col items-center shadow-[0_-10px_30px_rgba(90,70,50,0.03)]" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
                      <div className="w-full max-w-4xl flex flex-col gap-2 relative">
                        
                        <AnimatePresence>
                          {connectionError && (
                            <motion.div initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 10, height: 0 }} className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-xl text-xs font-bold shadow-sm mb-1">
                              <AlertCircle size={14} /> {connectionError}
                            </motion.div>
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
                                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E8E1D5] text-[#5A4535] border border-[#C1B2A6]/50 text-xs font-semibold">
                                  <Loader2 size={14} className="animate-spin" /> Analyzing context...
                                </div>
                              ) : (
                                aiReplies.map((reply, i) => (
                                  <button key={i} onClick={() => handleSendMessage(null, reply)} className="text-[12px] whitespace-nowrap font-bold px-4 py-1.5 rounded-full bg-[#F9F6F0] border border-[#C1B2A6]/50 text-[#5A4535] hover:border-[#8C7462] hover:bg-[#E8E1D5] shadow-sm transition-colors min-h-[36px]">
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
                            <button type="button" onClick={() => { ignoreBlurRef.current = true; fileInputRef.current?.click(); }} disabled={isUploading} className="p-2.5 sm:p-3 rounded-xl bg-[#F9F6F0] border border-[#C1B2A6]/50 text-[#7A6B5D] hover:text-[#5A4535] shadow-sm disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors">
                              {isUploading ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20}/>}
                            </button>
                            <button type="button" onClick={generateAIQuickReplies} title="AI Replies" className="p-2.5 sm:p-3 rounded-xl bg-[#E8E1D5] border border-[#C1B2A6]/50 text-[#8C7462] hover:bg-[#C1B2A6]/30 shadow-sm min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors">
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

                            {editingMsgId && <button type="button" onClick={() => {setEditingMsgId(null); setNewMessage("");}} className="absolute top-2 left-2 p-1 bg-[#E8E1D5] text-[#5A4535] rounded hover:bg-[#C1B2A6] z-10"><X size={14}/></button>}
                            
                            <div className="flex items-end w-full">
                              <textarea 
                                ref={textareaRef} value={newMessage} 
                                onChange={(e) => { setNewMessage(e.target.value); e.target.style.height = '48px'; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`; }}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                                onChangeCapture={handleTyping} placeholder={previewUrl ? "Caption (optional)..." : (editingMsgId ? "Edit message..." : "Message...")} rows={1} disabled={isUploading}
                                className={`flex-1 bg-transparent py-2.5 text-[16px] text-[#4A3C31] placeholder-[#9E8E81] focus:outline-none resize-none custom-scrollbar leading-relaxed ${editingMsgId ? 'pl-8' : 'pl-3'} pr-12`}
                                style={{ minHeight: '48px' }}
                              />
                              <div className="absolute right-1.5 bottom-1.5">
                                <motion.button onClick={handleSendMessage} type="button" whileTap={{ scale: 0.95 }} disabled={(!newMessage.trim() && !pendingImage) || isUploading} className={`p-2 rounded-xl text-[#F9F6F0] shadow-sm disabled:opacity-50 transition-opacity min-h-[36px] min-w-[36px] flex items-center justify-center ${editingMsgId || ghostMode ? 'bg-[#8C7462]' : 'bg-[#5A4535]'}`}>
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
                   <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 opacity-50 text-[#5A4535] pt-[env(safe-area-inset-top)]"><ShieldHalf size={56} strokeWidth={1.5} /><p className="text-xl font-serif font-bold">Select a vault session.</p></div>
                )}
              </div>
            </motion.div>
          )}

          {/* --- REQUESTS --- */}
          {activeTab === 'requests' && (
            <motion.div key="requests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={animTween} className="w-full h-full min-h-0 flex flex-col overflow-hidden p-4 sm:p-8" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}>
              <div className="mb-6 border-b border-[#C1B2A6]/50 pb-4 shrink-0">
                <h2 className="text-3xl font-serif font-bold tracking-tight text-[#3A2D23]">Access Requests</h2>
                <p className="text-sm text-[#7A6B5D] mt-1 font-medium">Review pending secure portal applications.</p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 pb-4">
                {accessRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-[#8C7462] opacity-60">
                    <UserPlus size={48} className="mb-4" strokeWidth={1.5}/>
                    <p className="font-bold">No pending requests.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    <AnimatePresence>
                      {accessRequests.map(req => (
                        <motion.div key={req.id} layout exit={{ opacity: 0, scale: 0.9 }} transition={animTween} className="p-5 rounded-2xl bg-[#F9F6F0]/80 backdrop-blur-md border border-[#C1B2A6]/50 shadow-[0_10px_20px_rgba(90,70,50,0.05)] flex flex-col justify-between">
                          <div className="mb-5">
                            <div className="flex justify-between items-start mb-3">
                              <h3 className="font-bold text-lg text-[#3A2D23] truncate pr-2">{req.name}</h3>
                              <span className={`text-[9px] uppercase tracking-widest px-2 py-1 rounded-full font-bold border ${req.status === 'pending' ? 'bg-[#E8E1D5] text-[#8C7462] border-[#C1B2A6]' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{req.status}</span>
                            </div>
                            <div className="space-y-2">
                              <a href={`mailto:${req.email}`} className="flex items-center gap-2 text-sm text-[#5A4535] hover:text-[#8C7462] transition-colors w-max font-medium"><Mail size={14}/> {req.email}</a>
                              <a href={`https://www.google.com/maps?q=${req.location.lat},${req.location.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors w-max font-medium"><MapPin size={14}/> View Location Coordinates</a>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 mt-auto">
                            {req.status === 'pending' ? (
                              <div className="flex gap-2">
                                <button onClick={() => handleApproveRequest(req)} className="flex-1 py-2.5 rounded-xl bg-[#5A4535] hover:bg-[#423226] text-[#F9F6F0] font-bold text-xs shadow-md transition-colors">APPROVE</button>
                                <button onClick={() => handleDeleteRequest(req.id)} className="px-4 py-2.5 rounded-xl bg-[#F9F6F0] border border-[#C1B2A6]/50 text-red-600 hover:bg-red-50 font-bold text-xs shadow-sm transition-colors">DELETE</button>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                <div className="p-2.5 bg-[#E8E1D5]/50 border border-[#C1B2A6]/50 rounded-xl flex justify-between items-center">
                                  <span className="text-xs font-bold text-[#7A6B5D] uppercase tracking-widest">Granted ID:</span>
                                  <span className="font-mono font-bold text-[#5A4535]">{req.grantedId}</span>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => handleEmailDraft(req)} className="flex-1 py-2.5 rounded-xl bg-[#F9F6F0] border border-[#C1B2A6]/50 hover:border-[#8C7462] text-[#5A4535] font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5"><Send size={14}/> Email Link</button>
                                  <button onClick={() => handleDeleteRequest(req.id)} className="px-3 py-2.5 rounded-xl bg-[#F9F6F0] border border-[#C1B2A6]/50 text-red-500 hover:bg-red-50 shadow-sm transition-colors"><Trash2 size={16}/></button>
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* --- IDs --- */}
          {activeTab === 'ids' && (
            <motion.div key="ids" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={animTween} className="w-full h-full min-h-0 flex flex-col overflow-hidden p-4 sm:p-8" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-[#C1B2A6]/50 pb-4 shrink-0">
                <div>
                  <h2 className="text-3xl font-serif font-bold tracking-tight text-[#3A2D23]">Access Vectors</h2>
                  <p className="text-sm text-[#7A6B5D] font-medium mt-1">Manage secure invitations.</p>
                </div>
                <button onClick={cleanupExpiredIDs} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-[#F9F6F0] border border-[#C1B2A6]/50 text-[#5A4535] hover:bg-[#E8E1D5] shadow-sm transition-colors">
                  <Clock size={16}/> Clean Expired
                </button>
              </div>
              <div className="p-6 rounded-3xl mb-6 bg-[#F9F6F0]/80 backdrop-blur-md border border-[#C1B2A6]/50 shadow-[0_10px_20px_rgba(90,70,50,0.05)] flex-shrink-0">
                <form onSubmit={handleCreateCode} className="flex flex-col md:flex-row gap-4 md:items-end">
                  <div className="flex-1">
                    <label className="text-[11px] font-bold uppercase tracking-widest mb-1.5 block text-[#7A6B5D]">Custom ID</label>
                    <input type="text" value={newCodeId} onChange={(e) => setNewCodeId(e.target.value)} placeholder="VIP-01" className="w-full rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#8C7462]/50 transition-all font-mono uppercase font-bold border border-[#C1B2A6]/50 text-sm bg-[#F9F6F0] text-[#3A2D23] shadow-inner"/>
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] font-bold uppercase tracking-widest mb-1.5 block text-[#7A6B5D]">Client Name</label>
                    <input type="text" value={newCodeName} onChange={(e) => setNewCodeName(e.target.value)} placeholder="John Doe" className="w-full rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#8C7462]/50 transition-all font-bold border border-[#C1B2A6]/50 text-sm bg-[#F9F6F0] text-[#3A2D23] shadow-inner"/>
                  </div>
                  <div className="w-full md:w-48">
                    <label className="text-[11px] font-bold uppercase tracking-widest mb-1.5 block text-[#7A6B5D]">Window</label>
                    <select value={expiryHours} onChange={(e) => setExpiryHours(e.target.value)} className="w-full rounded-xl px-4 py-3.5 outline-none font-bold border border-[#C1B2A6]/50 text-sm bg-[#F9F6F0] text-[#3A2D23] shadow-inner">
                      <option value="0">∞ Permanent</option>
                      <option value="1">⏱ 1 Hour</option>
                      <option value="24">⏱ 24 Hours</option>
                    </select>
                  </div>
                  <motion.button whileTap={{ scale: 0.95 }} type="submit" disabled={!newCodeId.trim()} className="bg-[#5A4535] hover:bg-[#423226] disabled:opacity-50 text-[#F9F6F0] px-6 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md">
                    <Plus size={18}/> Generate
                  </motion.button>
                </form>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <AnimatePresence>
                    {accessCodes.map(code => {
                      const isExpired = code.expiresAt && code.expiresAt < Date.now();
                      const displayName = getDisplayName(code);
                      return (
                        <motion.div key={code.id} layout exit={{ opacity: 0, scale: 0.9 }} transition={animTween} className={`p-5 rounded-2xl border flex flex-col justify-between h-40 transition-colors ${isExpired ? 'bg-[#E8E1D5]/50 border-[#C1B2A6]/30 opacity-60 grayscale' : 'bg-[#F9F6F0]/80 backdrop-blur-sm border-[#C1B2A6]/50 hover:border-[#8C7462] shadow-sm'}`}>
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col max-w-[70%]">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-lg text-[#3A2D23] truncate">{displayName}</span>
                                {!isExpired && <button onClick={() => renameCode(code.id, code.name)} className="text-[#9E8E81] hover:text-[#5A4535] transition-colors"><Edit3 size={14}/></button>}
                              </div>
                              {code.name && <span className="text-[10px] font-mono uppercase text-[#7A6B5D] mt-0.5 truncate">{code.id}</span>}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className={`text-[9px] uppercase tracking-widest px-2 py-1 rounded-full font-bold border ${code.type === 'permanent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-[#E8E1D5] text-[#8C7462] border-[#C1B2A6]'}`}>{isExpired ? 'EXPIRED' : code.type}</span>
                              {!isExpired && <button onClick={() => copyToClipboard(code.id)} className="p-1.5 rounded-md bg-[#F9F6F0] border border-[#C1B2A6]/50 text-[#5A4535] hover:bg-[#E8E1D5] shadow-sm"><Copy size={12}/></button>}
                            </div>
                          </div>
                          <div className="flex gap-2 mt-auto">
                            <button onClick={() => toggleBlockStatus(code.id, code.status)} className={`flex-1 py-2.5 rounded-xl flex justify-center items-center text-[11px] font-bold transition-colors border shadow-sm ${code.status === 'active' ? 'text-[#8C7462] bg-[#F9F6F0] border-[#C1B2A6]/50 hover:bg-[#E8E1D5]' : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'}`}>
                              {code.status === 'active' ? 'BLOCK' : 'UNBLOCK'}
                            </button>
                            <button onClick={() => deleteCode(code.id)} className="flex-1 py-2.5 rounded-xl flex justify-center items-center text-[11px] font-bold bg-[#F9F6F0] border border-red-200 text-red-600 hover:bg-red-50 shadow-sm transition-colors">DELETE</button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {/* --- SETTINGS --- */}
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={animTween} className="w-full h-full min-h-0 flex flex-col p-4 sm:p-8 overflow-y-auto" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}>
              <div className="mb-6 border-b border-[#C1B2A6]/50 pb-4 shrink-0">
                <h2 className="text-3xl font-serif font-bold tracking-tight text-[#3A2D23]">Configuration</h2>
                <p className="text-sm text-[#7A6B5D] font-medium mt-1">Manage administrative footprint.</p>
              </div>
              <div className="max-w-xl space-y-4 shrink-0">
                <div className="border border-[#C1B2A6]/50 p-6 rounded-2xl flex items-center justify-between shadow-sm bg-[#F9F6F0]/80 backdrop-blur-md">
                  <div className="flex gap-4 items-center">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-colors ${ghostMode ? 'bg-[#E8E1D5] text-[#5A4535] border-[#C1B2A6]' : 'bg-[#F9F6F0] text-[#9E8E81] border-[#C1B2A6]/50'}`}><Ghost size={24} /></div>
                    <div>
                      <h3 className="text-[16px] font-bold text-[#3A2D23]">Ghost Mode</h3>
                      <p className="text-[12px] mt-0.5 text-[#7A6B5D] font-medium max-w-[200px] sm:max-w-none">Hide online status & typing indicators from users.</p>
                    </div>
                  </div>
                  <button onClick={() => setGhostMode(!ghostMode)} className={`relative w-14 h-7 rounded-full transition-colors duration-300 shadow-inner flex-shrink-0 border border-[#C1B2A6]/50 ${ghostMode ? 'bg-[#5A4535]' : 'bg-[#E8E1D5]'}`}>
                    <motion.div animate={{ x: ghostMode ? 28 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className="absolute top-[1px] left-0 w-6 h-6 bg-[#F9F6F0] rounded-full shadow-sm" />
                  </button>
                </div>
                <div className="border border-[#C1B2A6]/50 p-6 rounded-2xl flex items-center justify-between shadow-sm bg-[#F9F6F0]/80 backdrop-blur-md">
                  <div className="flex gap-4 items-center">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-colors ${hideReceipts ? 'bg-[#E8E1D5] text-[#5A4535] border-[#C1B2A6]' : 'bg-[#F9F6F0] text-[#9E8E81] border-[#C1B2A6]/50'}`}><EyeOff size={24} /></div>
                    <div>
                      <h3 className="text-[16px] font-bold text-[#3A2D23]">Stealth Receipts</h3>
                      <p className="text-[12px] mt-0.5 text-[#7A6B5D] font-medium max-w-[200px] sm:max-w-none">Do not send Read or Delivered ticks to users.</p>
                    </div>
                  </div>
                  <button onClick={() => setHideReceipts(!hideReceipts)} className={`relative w-14 h-7 rounded-full transition-colors duration-300 shadow-inner flex-shrink-0 border border-[#C1B2A6]/50 ${hideReceipts ? 'bg-[#5A4535]' : 'bg-[#E8E1D5]'}`}>
                    <motion.div animate={{ x: hideReceipts ? 28 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className="absolute top-[1px] left-0 w-6 h-6 bg-[#F9F6F0] rounded-full shadow-sm" />
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
    <button onClick={onClick} className={`p-2.5 sm:p-3.5 flex sm:flex-col flex-row sm:w-full items-center justify-center gap-2 sm:gap-1.5 rounded-xl transition-all duration-200 relative group ${active ? 'text-[#5A4535] bg-[#E8E1D5] shadow-sm border border-[#C1B2A6]/50' : 'text-[#7A6B5D] hover:text-[#5A4535] hover:bg-[#F9F6F0]/50 border border-transparent'}`}>
      {icon}
      <span className={`text-[10px] font-bold tracking-widest ${active ? 'block' : 'hidden sm:block'}`}>{label}</span>
      {active && <motion.div layoutId="activeTab" transition={animTween} className="absolute sm:left-0 sm:top-1/4 sm:bottom-1/4 sm:w-1 sm:h-auto sm:rounded-r-full bottom-0 left-1/4 right-1/4 h-1 w-auto rounded-t-full bg-[#5A4535]" />}
    </button>
  );
}
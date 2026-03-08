import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, updateDoc, getDoc, where, deleteDoc } from 'firebase/firestore';
// ✅ FIXED: Sparkles and ChevronDown are now properly imported!
import { Send, LogOut, Lock, WifiOff, CheckCheck, Check, Clock, Loader2, Maximize, X, Reply, Video, PhoneIncoming, PhoneOff, Phone, Paperclip, Smile, Mic, MessageSquarePlus, MoreVertical, Search, ArrowLeft, Camera, Settings, Bell, Palette, CheckCircle, Trash2, Image as ImageIcon, FileText, User as UserIcon, Sparkles, ChevronDown } from 'lucide-react';
import { db } from '../services/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker from 'emoji-picker-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Imports from your project structure
import NativeVideoCall from '../components/NativeVideoCall'; 
import Login from './Login';

const IMGBB_API_KEY = '250588b8b03b100c08b3df82baaa28a4';
const GEMINI_API_KEY = 'AIzaSyCzWUVmeJ1NE_8D_JmQQrFQv4elA1zS2iA';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const animTween = { type: "tween", ease: "easeOut", duration: 0.2 };
const fadeUp = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: animTween } };
const RING_TONE = new Audio('https://actions.google.com/sounds/v1/alarms/phone_ringing.ogg');
RING_TONE.loop = true;

// 🎨 THEME ENGINE 
const themes = {
  whatsappLight: {
    name: 'WhatsApp Light',
    bgApp: 'bg-[#d1d7db]', bgMain: 'bg-[#efeae2]', bgSidebar: 'bg-white', bgHeader: 'bg-[#f0f2f5]',
    textMain: 'text-[#111b21]', textMuted: 'text-[#54656f]', primary: 'bg-[#00a884]',
    bubbleOut: 'bg-[#d9fdd3]', bubbleIn: 'bg-white',
  },
  telegramNight: {
    name: 'Telegram Night',
    bgApp: 'bg-[#0f0f0f]', bgMain: 'bg-[#0f0f0f]', bgSidebar: 'bg-[#17212b]', bgHeader: 'bg-[#17212b]',
    textMain: 'text-white', textMuted: 'text-[#7f91a4]', primary: 'bg-[#3390ec]',
    bubbleOut: 'bg-[#2b5278]', bubbleIn: 'bg-[#182533]',
  },
  oledMatrix: {
    name: 'OLED Matrix',
    bgApp: 'bg-black', bgMain: 'bg-black', bgSidebar: 'bg-black', bgHeader: 'bg-[#0a0a0a]',
    textMain: 'text-[#00ff41]', textMuted: 'text-[#008f11]', primary: 'bg-[#003b00]',
    bubbleOut: 'bg-[#001a00]', bubbleIn: 'bg-[#0a0a0a]',
  }
};

export default function UserChat() {
  // --- GLOBAL STATE ---
  const [myPhoneNumber, setMyPhoneNumber] = useState(null); 
  const [activeRoom, setActiveRoom] = useState(null); 
  const [activeRoomDoc, setActiveRoomDoc] = useState(null);
  
  // --- THEME STATE ---
  const [activeThemeKey, setActiveThemeKey] = useState('whatsappLight');
  const theme = themes[activeThemeKey];

  // --- SIDEBAR STATE ---
  const [activePanel, setActivePanel] = useState('chats'); // 'chats', 'profile', 'settings', 'newChat'
  const [chatList, setChatList] = useState([]); 
  const [searchQuery, setSearchQuery] = useState(""); 
  
  // ✅ FIXED: Initial state now has a default placeholder to prevent empty src errors
  const [userProfile, setUserProfile] = useState({ name: "", bio: "", avatar: "https://i.pravatar.cc/150?img=placeholder" });
  
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState(""); 
  const [newChatName, setNewChatName] = useState("");
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [newChatError, setNewChatError] = useState("");

  // --- CHAT AREA STATE ---
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiReplies, setAiReplies] = useState([]);
  const [showAIReplies, setShowAIReplies] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [replyingToId, setReplyingToId] = useState(null);
  const [videoCallState, setVideoCallState] = useState(null); 
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const messagesEndRef = useRef(null); 
  const chatContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const previousMessageCount = useRef(0);

  // Load Saved Theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme && themes[savedTheme]) setActiveThemeKey(savedTheme);
  }, []);

  const changeTheme = (key) => {
    setActiveThemeKey(key);
    localStorage.setItem('appTheme', key);
  };

  // Global Listeners
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    const handleKeyDown = (e) => { 
      if (e.key === 'Escape') { 
        setSelectedImage(null); setActivePanel('chats'); setShowEmojiPicker(false); setShowAttachMenu(false); setShowChatOptions(false);
      } 
    };
    window.addEventListener('online', handleOnline); 
    window.addEventListener('offline', handleOffline);
    window.addEventListener('keyup', handleKeyDown);
    return () => {
      window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); window.removeEventListener('keyup', handleKeyDown);
    };
  }, []);

  // Fetch Profile & Chat List
  useEffect(() => {
    if (!myPhoneNumber) return;
    
    const unsubProfile = onSnapshot(doc(db, 'users', myPhoneNumber), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserProfile({ name: data.name || "", bio: data.bio || "Hey there! I am using WhatsApp.", avatar: data.avatar || "https://i.pravatar.cc/150?img=placeholder" });
      }
    });

    const q = query(collection(db, 'rooms'), where('participants', 'array-contains', myPhoneNumber));
    const unsubscribeChats = onSnapshot(q, (snapshot) => {
      const chats = snapshot.docs.map(doc => {
        const data = doc.data();
        const otherId = data.participants.find(p => p !== myPhoneNumber);
        return {
          roomId: doc.id,
          otherId: otherId,
          name: data.names?.[myPhoneNumber] || otherId || "Unknown",
          lastMessage: data.lastMessage || "Start chatting",
          timestamp: data.lastUpdated
        };
      });
      chats.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      setChatList(chats);
    });

    return () => { unsubProfile(); unsubscribeChats(); }
  }, [myPhoneNumber]);

  // Fetch Active Room Messages
  useEffect(() => {
    setShowAIReplies(false); setAiReplies([]);
    if (!activeRoom) { setMessages([]); setActiveRoomDoc(null); return; }
    
    const q = query(collection(db, 'rooms', activeRoom, 'messages'), orderBy('timestamp', 'asc'));
    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(fetchedMessages);
      if (previousMessageCount.current !== 0 && fetchedMessages.length > previousMessageCount.current) {
        if (fetchedMessages[fetchedMessages.length - 1]?.senderId !== myPhoneNumber) setShowAIReplies(false);
      }
      previousMessageCount.current = fetchedMessages.length;
      setTimeout(() => scrollToBottom('auto'), 100);
    });

    const unsubscribeDoc = onSnapshot(doc(db, 'rooms', activeRoom), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setActiveRoomDoc(data);
        if (data.activeCall) {
          if (data.activeCall.status === 'ringing' && data.activeCall.caller !== myPhoneNumber) {
            RING_TONE.play().catch(()=>{});
            setVideoCallState({ roomId: data.activeCall.roomId, isIncoming: true });
          } else if (data.activeCall.status === 'ended' || data.activeCall.status === 'rejected') {
            RING_TONE.pause(); setVideoCallState(null);
          }
        } else { RING_TONE.pause(); setVideoCallState(null); }
      }
    });

    return () => { unsubscribeMessages(); unsubscribeDoc(); previousMessageCount.current = 0; RING_TONE.pause(); };
  }, [activeRoom, myPhoneNumber]);

  // Read Receipts
  useEffect(() => {
    if (!activeRoom) return;
    const hasFocus = document.hasFocus();
    messages.forEach(msg => {
      if (msg.senderId !== myPhoneNumber) {
        if (hasFocus && msg.status !== 'seen') updateDoc(doc(db, 'rooms', activeRoom, 'messages', msg.id), { status: 'seen' }).catch(()=>{});
        else if (!hasFocus && msg.status === 'sent') updateDoc(doc(db, 'rooms', activeRoom, 'messages', msg.id), { status: 'delivered' }).catch(()=>{});
      }
    });
  }, [messages, activeRoom, myPhoneNumber]);

  const handleStartNewChat = async (e) => {
    e.preventDefault();
    setNewChatError("");
    if (!newChatPhone.trim() || !newChatName.trim()) return;
    const friendPhone = newChatPhone.trim();
    if (friendPhone === myPhoneNumber) return setNewChatError("You cannot chat with yourself.");

    setIsStartingChat(true);
    try {
      const friendDoc = await getDoc(doc(db, 'users', friendPhone));
      if (!friendDoc.exists()) {
        setNewChatError("User with this Phone Number does not exist.");
        setIsStartingChat(false); return;
      }
      const friendData = friendDoc.data();
      const roomId = [myPhoneNumber, friendPhone].sort().join('_');

      await setDoc(doc(db, 'rooms', roomId), {
        participants: [myPhoneNumber, friendPhone],
        names: { [myPhoneNumber]: newChatName.trim(), [friendPhone]: userProfile.name || myPhoneNumber },
        lastUpdated: serverTimestamp()
      }, { merge: true });

      setActiveRoom(roomId); setActivePanel('chats'); setNewChatPhone(""); setNewChatName("");
    } catch (err) { setNewChatError("Failed to start chat."); } 
    finally { setIsStartingChat(false); }
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try { 
      await setDoc(doc(db, 'users', myPhoneNumber), { name: userProfile.name || myPhoneNumber, bio: userProfile.bio || "Available" }, { merge: true }); 
      setActivePanel('chats'); 
    } catch (err) { alert("Failed to update profile."); } 
    finally { setIsSavingProfile(false); }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setIsSavingProfile(true); 
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64Image = reader.result.split(',')[1];
          const formData = new FormData(); formData.append('image', base64Image);
          const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
          const json = await res.json();
          if(json.success) await setDoc(doc(db, 'users', myPhoneNumber), { avatar: json.data.url }, { merge: true });
        } catch(err) {} finally { setIsSavingProfile(false); if(avatarInputRef.current) avatarInputRef.current.value = ""; }
      };
    } catch (err) { setIsSavingProfile(false); }
  };

  const handleSendText = async (e, overrideText = null) => {
    if (e) e.preventDefault();
    const textToSend = overrideText || newMessage.trim();
    if (!textToSend && !pendingImage) return; 
    if (!activeRoom || isOffline || isUploading) return;
    
    const currentImg = pendingImage; const currentText = textToSend; const currentReply = replyingToId;
    setNewMessage(""); setPendingImage(null); setPreviewUrl(null); setShowAIReplies(false); setShowEmojiPicker(false); setShowAttachMenu(false); setReplyingToId(null);
    if (textareaRef.current) textareaRef.current.style.height = '42px';
    scrollToBottom('auto'); 
    
    setIsUploading(true);
    updateDoc(doc(db, 'rooms', activeRoom), { userTyping: false }).catch(()=>{});
    
    try {
      let finalImageUrl = null;
      if (currentImg) {
        const reader = new FileReader();
        await new Promise((resolve) => { reader.onload = (ev) => resolve(ev.target.result.split(',')[1]); reader.readAsDataURL(currentImg); })
        .then(async (base64Image) => {
          const formData = new FormData(); formData.append('image', base64Image);
          const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
          const json = await res.json();
          if (json.success) finalImageUrl = json.data.url;
        });
      }

      await addDoc(collection(db, 'rooms', activeRoom, 'messages'), { 
        text: finalImageUrl || currentText, isImage: !!finalImageUrl, senderId: myPhoneNumber, timestamp: serverTimestamp(), status: "sent", replyToId: currentReply 
      });
      await updateDoc(doc(db, 'rooms', activeRoom), { lastMessage: !!finalImageUrl ? "📷 Photo" : currentText, lastUpdated: serverTimestamp() });
      scrollToBottom('auto');
    } catch (err) {} finally { setIsUploading(false); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setShowAttachMenu(false); setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Image = reader.result.split(',')[1];
        const formData = new FormData(); formData.append('image', base64Image);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
        const json = await res.json();
        if (json.success) {
          await addDoc(collection(db, 'rooms', activeRoom, 'messages'), { text: json.data.url, isImage: true, senderId: myPhoneNumber, timestamp: serverTimestamp(), status: "sent" });
          await updateDoc(doc(db, 'rooms', activeRoom), { lastMessage: "📷 Photo", lastUpdated: serverTimestamp() });
        }
        setIsUploading(false); scrollToBottom('auto');
      };
    } catch (err) { setIsUploading(false); }
  };

  const clearChat = () => {
    if (window.confirm("Clear all messages for everyone?")) {
      messages.forEach(msg => deleteDoc(doc(db, 'rooms', activeRoom, 'messages', msg.id)));
      setShowChatOptions(false);
    }
  };

  const generateAIQuickReplies = async () => {
    if (showAIReplies && aiReplies.length > 0) { setShowAIReplies(false); return; }
    setIsGeneratingAI(true); setShowAIReplies(true); setAiReplies([]);
    try {
      const recentMessages = messages.slice(-3);
      if (recentMessages.length === 0) { setAiReplies(["Hello!", "How are you?", "What's up?"]); return setIsGeneratingAI(false); }
      const waitingOnSupport = recentMessages[recentMessages.length - 1].senderId === myPhoneNumber;
      const transcript = recentMessages.map(m => `${m.senderId === myPhoneNumber ? 'Me' : 'Them'}:${m.isImage ? '[Img]' : m.text}`).join('|');
      const prompt = `Context:${transcript}|Task:Return JSON array of exactly 3 short friendly ${waitingOnSupport ? 'follow-up questions' : 'answers'}. Max 4 words each.`;
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite", generationConfig: { responseMimeType: "application/json", maxOutputTokens: 50 } });
      const result = await model.generateContent(prompt);
      setAiReplies(JSON.parse(result.response.text()).slice(0,3));
    } catch (error) { setAiReplies(["Yes.", "Could you elaborate?", "Thank you."]); } finally { setIsGeneratingAI(false); }
  };

  const initiateCall = async () => {
    if (!activeRoom) return;
    const roomId = `call-${Date.now()}`;
    await updateDoc(doc(db, 'rooms', activeRoom), { activeCall: { caller: myPhoneNumber, status: 'ringing', roomId: roomId } });
    setVideoCallState({ roomId, isIncoming: false });
  };
  const acceptCall = async () => { RING_TONE.pause(); if (videoCallState?.roomId) { await updateDoc(doc(db, 'rooms', activeRoom), { 'activeCall.status': 'in-progress' }); setVideoCallState({ ...videoCallState, isIncoming: false }); } };
  const rejectCall = async () => { RING_TONE.pause(); await updateDoc(doc(db, 'rooms', activeRoom), { 'activeCall.status': 'rejected' }); setVideoCallState(null); };
  const endCallFirebase = async () => { await updateDoc(doc(db, 'rooms', activeRoom), { activeCall: null }); setVideoCallState(null); };

  const scrollToBottom = (behavior = 'smooth') => { if (chatContainerRef.current) { chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior }); } };
  const handleScroll = (e) => setShowScrollButton(e.target.scrollHeight - e.target.scrollTop - e.target.clientHeight > 100);
  const handleInputFocus = () => { if (activeRoom) updateDoc(doc(db, 'rooms', activeRoom), { userTyping: true, typingId: myPhoneNumber }).catch(()=>{}); };
  const handleInputBlur = () => { if (activeRoom) updateDoc(doc(db, 'rooms', activeRoom), { userTyping: false }).catch(()=>{}); };
  const handleImageSelect = (e) => { const file = e.target.files[0]; if (!file) return; setPendingImage(file); setPreviewUrl(URL.createObjectURL(file)); e.target.value = null; };

  const formatTime = (ts) => ts && typeof ts.toDate === 'function' ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(ts.toDate()) : "";
  const MessageStatusIcon = ({ msg }) => {
    if (!msg.timestamp || typeof msg.timestamp.toDate !== 'function') return <Clock size={11} className="opacity-50" />; 
    if (msg.status === 'seen') return <CheckCheck size={14} className={theme.name === 'WhatsApp Light' ? "text-[#53bdeb]" : "text-blue-400"} />;
    if (msg.status === 'delivered') return <CheckCheck size={14} className="opacity-50" />;
    return <Check size={14} className="opacity-50" />; 
  };

  if (!myPhoneNumber) return <Login onLogin={setMyPhoneNumber} />;

  const filteredChats = chatList.filter(chat => chat.name.toLowerCase().includes(searchQuery.toLowerCase()) || chat.otherId.includes(searchQuery));
  const currentChatData = chatList.find(c => c.roomId === activeRoom);
  const showTyping = activeRoomDoc && (activeRoomDoc.userTyping === true && activeRoomDoc.typingId !== myPhoneNumber);
  const slideAnim = { initial: { x: "-100%" }, animate: { x: 0 }, exit: { x: "-100%" }, transition: { type: "tween", duration: 0.25 } };

  return (
    <div className={`fixed inset-0 w-full h-[100dvh] flex flex-row ${theme.bgApp} font-sans ${theme.textMain} overflow-hidden transition-colors duration-300`}>
      
      {/* Container for Desktop Centering */}
      <div className="w-full h-full md:py-4 md:px-4 lg:py-6 lg:px-24 mx-auto max-w-[1600px] flex">
        <div className={`flex w-full h-full md:shadow-2xl md:rounded-md overflow-hidden ${theme.bgMain} border border-white/5 relative`}>
          
          {/* 🖼️ Image Lightbox */}
          <AnimatePresence>
            {selectedImage && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setSelectedImage(null)}>
                <button className="absolute top-6 right-6 text-white hover:text-gray-300 p-2"><X size={28}/></button>
                <img src={selectedImage} alt="Fullscreen" className="max-w-full max-h-full object-contain" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* 📞 CALL OVERLAYS */}
          <AnimatePresence>
            {videoCallState?.isIncoming && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[600] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center text-white">
                <div className={`w-32 h-32 ${theme.primary.replace('bg-','bg-opacity-20')} rounded-full flex items-center justify-center mb-8 animate-pulse`}>
                  <PhoneIncoming size={48} className={theme.primary.replace('bg-','text-')} />
                </div>
                <h2 className="text-3xl font-medium mb-12 tracking-wide">Incoming Call...</h2>
                <div className="flex gap-12">
                  <button onClick={rejectCall} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg"><PhoneOff size={28} /></button>
                  <button onClick={acceptCall} className={`w-16 h-16 rounded-full ${theme.primary} flex items-center justify-center shadow-lg`}><Video size={28} /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {videoCallState && !videoCallState.isIncoming && <NativeVideoCall chatId={activeRoom} myRole="user" roomId={videoCallState.roomId} isIncoming={false} onClose={endCallFirebase} />}
          </AnimatePresence>

          {/* ========================================== */}
          {/* 👈 LEFT SIDEBAR (Chats, Profile, Settings) */}
          {/* ========================================== */}
          <div className={`w-full md:w-[30%] md:min-w-[320px] md:max-w-[420px] h-full flex-none flex-col ${theme.bgSidebar} border-r border-black/10 z-30 relative overflow-hidden ${activeRoom ? 'hidden md:flex' : 'flex'}`}>
            
            {/* MAIN CHAT LIST PANEL */}
            <div className="flex flex-col h-full w-full">
              <div className={`flex-none h-[64px] flex justify-between items-center px-4 ${theme.bgHeader} border-b border-black/10`}>
                <img src={userProfile.avatar} onClick={() => setActivePanel('profile')} className="w-10 h-10 rounded-full object-cover cursor-pointer" alt="Me" />
                <div className={`flex items-center gap-4 ${theme.textMuted}`}>
                  <button onClick={() => setActivePanel('settings')} className="hover:text-current transition-colors"><Settings size={20}/></button>
                  <button onClick={() => setActivePanel('newChat')} className="hover:text-current transition-colors"><MessageSquarePlus size={20}/></button>
                </div>
              </div>

              <div className="flex-none p-2 border-b border-black/5">
                <div className={`rounded-lg flex items-center px-4 py-2 gap-3 ${theme.bgHeader}`}>
                  <Search size={18} className={theme.textMuted}/>
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search or start new chat" className="bg-transparent focus:outline-none w-full text-sm placeholder-current opacity-70 h-6"/>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filteredChats.length === 0 ? (
                  <div className={`flex flex-col items-center justify-center h-full ${theme.textMuted} opacity-80 px-6 text-center`}>
                    <Lock size={48} className="mb-4 stroke-1"/>
                    <h3 className="text-lg font-medium mb-1">Messages are end-to-end encrypted</h3>
                    <p className="text-sm">Click the chat icon above to start.</p>
                  </div>
                ) : (
                  filteredChats.map((chat) => (
                    <div key={chat.roomId} onClick={() => setActiveRoom(chat.roomId)} className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors ${activeRoom === chat.roomId ? 'bg-black/10' : 'hover:bg-black/5'}`}>
                      <div className={`w-[48px] h-[48px] rounded-full flex-shrink-0 flex items-center justify-center text-white font-medium text-lg ${theme.primary}`}>
                        {chat.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0 border-b border-black/5 pb-3 pt-1">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h4 className="text-[16px] font-medium truncate">{chat.name}</h4>
                          <span className={`text-xs ${theme.textMuted} flex-shrink-0`}>{formatTime(chat.timestamp)}</span>
                        </div>
                        <p className={`text-sm ${theme.textMuted} truncate`}>{chat.lastMessage}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* SLIDING PANELS (Profile, Settings, NewChat) */}
            <AnimatePresence>
              {activePanel !== 'chats' && (
                <motion.div {...slideAnim} className={`absolute inset-0 z-40 flex flex-col ${theme.bgSidebar}`}>
                  <header className={`h-[108px] text-white flex items-end px-5 pb-4 gap-6 flex-shrink-0 ${theme.primary}`}>
                    <button onClick={() => setActivePanel('chats')}><ArrowLeft size={24} /></button>
                    <h2 className="text-xl font-medium">
                      {activePanel === 'newChat' && "New Chat"}
                      {activePanel === 'profile' && "Profile"}
                      {activePanel === 'settings' && "Settings"}
                    </h2>
                  </header>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* NEW CHAT */}
                    {activePanel === 'newChat' && (
                      <form onSubmit={handleStartNewChat} className="space-y-6">
                        {newChatError && <div className="text-red-500 text-sm">{newChatError}</div>}
                        <div>
                          <label className={`text-xs font-bold uppercase tracking-wider mb-2 block ${theme.primary.replace('bg-', 'text-')}`}>Contact Name</label>
                          <input type="text" value={newChatName} onChange={e => setNewChatName(e.target.value)} required className="w-full border-b-2 border-gray-300 focus:border-current py-2 focus:outline-none bg-transparent" placeholder="E.g. John"/>
                        </div>
                        <div>
                          <label className={`text-xs font-bold uppercase tracking-wider mb-2 block ${theme.primary.replace('bg-', 'text-')}`}>6-Digit Phone No.</label>
                          <input type="text" value={newChatPhone} onChange={e => setNewChatPhone(e.target.value)} required className="w-full border-b-2 border-gray-300 focus:border-current py-2 focus:outline-none bg-transparent font-mono tracking-widest" placeholder="123456"/>
                        </div>
                        <button type="submit" disabled={isStartingChat} className={`w-full ${theme.primary} text-white py-3 rounded-lg font-medium flex justify-center`}>
                          {isStartingChat ? <Loader2 size={20} className="animate-spin"/> : "Start Chat"}
                        </button>
                      </form>
                    )}

                    {/* PROFILE */}
                    {activePanel === 'profile' && (
                      <div className="flex flex-col items-center">
                        <div className="relative group cursor-pointer mb-8" onClick={() => avatarInputRef.current?.click()}>
                          <img src={userProfile.avatar} className="w-48 h-48 rounded-full object-cover shadow-md border-4 border-white/10" alt="Avatar"/>
                          <div className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-medium gap-2"><Camera size={28}/> CHANGE</div>
                          {isSavingProfile && <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center"><Loader2 className="animate-spin text-white" size={32}/></div>}
                        </div>
                        <input type="file" accept="image/*" ref={avatarInputRef} onChange={handleAvatarUpload} className="hidden" />
                        <div className="w-full space-y-6">
                          <div>
                            <label className={`text-xs font-bold uppercase tracking-wider mb-2 block ${theme.textMuted}`}>Your Name</label>
                            <input type="text" value={userProfile.name} onChange={e => setUserProfile({...userProfile, name: e.target.value})} className="w-full border-b-2 border-gray-300 focus:border-current py-2 focus:outline-none bg-transparent" />
                          </div>
                          <div>
                            <label className={`text-xs font-bold uppercase tracking-wider mb-2 block ${theme.textMuted}`}>About</label>
                            <input type="text" value={userProfile.bio} onChange={e => setUserProfile({...userProfile, bio: e.target.value})} className="w-full border-b-2 border-gray-300 focus:border-current py-2 focus:outline-none bg-transparent" />
                          </div>
                          <button onClick={handleSaveProfile} disabled={isSavingProfile} className={`w-full ${theme.primary} text-white py-3 rounded-lg font-medium flex justify-center`}>
                            SAVE
                          </button>
                        </div>
                      </div>
                    )}

                    {/* SETTINGS (THEMES) */}
                    {activePanel === 'settings' && (
                      <div className="space-y-6">
                        <div>
                          <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${theme.textMuted}`}><Palette size={16}/> Theme Engine</h3>
                          <div className="space-y-2">
                            <button onClick={() => changeTheme('whatsappLight')} className={`w-full p-4 rounded-xl flex justify-between items-center border ${activeThemeKey === 'whatsappLight' ? `border-current ${theme.primary.replace('bg-','text-')} bg-black/5` : 'border-transparent hover:bg-black/5'}`}>
                              <span className="font-medium">WhatsApp Light</span>
                              {activeThemeKey === 'whatsappLight' && <CheckCircle size={18}/>}
                            </button>
                            <button onClick={() => changeTheme('telegramNight')} className={`w-full p-4 rounded-xl flex justify-between items-center border ${activeThemeKey === 'telegramNight' ? `border-blue-500 text-blue-500 bg-black/20` : 'border-transparent hover:bg-black/5'}`}>
                              <span className="font-medium text-gray-400">Telegram Night</span>
                              {activeThemeKey === 'telegramNight' && <CheckCircle size={18}/>}
                            </button>
                            <button onClick={() => changeTheme('oledMatrix')} className={`w-full p-4 rounded-xl flex justify-between items-center border ${activeThemeKey === 'oledMatrix' ? `border-green-500 text-green-500 bg-green-500/10` : 'border-transparent hover:bg-black/5'}`}>
                              <span className="font-medium text-gray-400">OLED Matrix</span>
                              {activeThemeKey === 'oledMatrix' && <CheckCircle size={18}/>}
                            </button>
                          </div>
                        </div>
                        <div className="pt-6 border-t border-black/10">
                          <button onClick={() => { setMyPhoneNumber(null); setActiveRoom(null); }} className="w-full flex items-center gap-3 text-red-500 p-4 hover:bg-red-500/10 rounded-xl transition-colors font-medium">
                            <LogOut size={20}/> Log out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ========================================== */}
          {/* 👉 RIGHT MAIN CHAT AREA */}
          {/* ========================================== */}
          <div className={`flex-1 flex flex-col h-full min-w-0 relative ${theme.bgMain} ${!activeRoom ? 'hidden md:flex' : 'flex'}`}>
            
            {/* ✅ FIXED: WhatsApp Chat Pattern Background uses inline style to prevent 404 errors */}
            <div className="absolute inset-0 z-0 opacity-30 bg-repeat" style={{ backgroundImage: "url('https://i.ibb.co/3W6qkVq/whatsapp-bg.png')", backgroundSize: '400px' }}></div>
            {isOffline && <div className="absolute inset-0 bg-black/50 backdrop-blur-md z-[60] flex flex-col items-center justify-center text-white"><WifiOff size={48} className="mb-4 animate-pulse" /><h2 className="text-xl font-bold">Reconnecting...</h2></div>}

            {activeRoom ? (
              <>
                {/* Chat Header */}
                <header className={`flex-none h-[64px] ${theme.bgHeader} px-4 flex items-center justify-between z-20 border-l border-black/10`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <button onClick={() => setActiveRoom(null)} className={`md:hidden ${theme.textMuted}`}><ArrowLeft size={24}/></button>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0 ${theme.primary}`}>
                      {currentChatData?.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <h3 className="text-[16px] font-medium truncate">{currentChatData?.name}</h3>
                      {showTyping && <p className={`text-[13px] ${theme.primary.replace('bg-','text-')}`}>typing...</p>}
                    </div>
                  </div>
                  <div className={`flex items-center gap-5 ${theme.textMuted} relative`}>
                    <button onClick={initiateCall}><Video size={20} /></button>
                    <button onClick={initiateCall}><Phone size={20} /></button>
                    <button><Search size={20} /></button>
                    
                    <button onClick={() => setShowChatOptions(!showChatOptions)}><MoreVertical size={20} /></button>
                    
                    {/* 3-DOTS MENU POPOVER */}
                    <AnimatePresence>
                      {showChatOptions && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowChatOptions(false)} />
                          <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={`absolute right-0 top-10 w-48 ${theme.bgSidebar} rounded-lg shadow-xl py-2 z-50 border border-black/10`}>
                            <button className="w-full text-left px-4 py-2.5 text-[14px] hover:bg-black/5 transition-colors">Contact info</button>
                            <button onClick={clearChat} className="w-full text-left px-4 py-2.5 text-[14px] text-red-500 hover:bg-red-500/10 transition-colors flex justify-between items-center">Clear chat <Trash2 size={14}/></button>
                            <button onClick={() => { setActiveRoom(null); setShowChatOptions(false); }} className="w-full text-left px-4 py-2.5 text-[14px] hover:bg-black/5 transition-colors">Close chat</button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </header>

                {/* Chat History */}
                <main ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto min-h-0 px-[5%] sm:px-[10%] py-4 relative z-10 custom-scrollbar">
                  
                  <div className="flex justify-center mb-6 mt-2">
                    <span className={`text-[12.5px] ${theme.bgSidebar} ${theme.textMuted} px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 font-medium`}>
                      <Lock size={12}/> Messages are end-to-end encrypted.
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 pb-2">
                    <AnimatePresence mode="popLayout">
                      {messages.map((msg, index) => {
                        const isMe = msg.senderId === myPhoneNumber;
                        const prevMsg = index > 0 ? messages[index - 1] : null;
                        const nextMsg = messages[index + 1];
                        const isFirstInGroup = !prevMsg || prevMsg.senderId !== msg.senderId;
                        const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId;

                        return (
                          <motion.div key={msg.id} layout="position" variants={fadeUp} initial="hidden" animate="visible" className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${isLastInGroup ? 'mb-3' : 'mb-0.5'} group relative`}>
                            
                            <div className={`relative px-2.5 py-1.5 shadow-sm text-[14.2px] leading-[19px] break-words min-w-[80px] max-w-[85%] sm:max-w-[75%]
                              ${isMe ? theme.bubbleOut : theme.bubbleIn}
                              ${isFirstInGroup && isMe ? 'rounded-l-lg rounded-br-lg rounded-tr-none' : ''}
                              ${isFirstInGroup && !isMe ? 'rounded-r-lg rounded-bl-lg rounded-tl-none' : ''}
                              ${!isFirstInGroup ? 'rounded-lg' : ''}
                            `}>
                              
                              {isFirstInGroup && (
                                <svg viewBox="0 0 8 13" width="8" height="13" className={`absolute top-0 ${isMe ? '-right-[8px] '+theme.bubbleOut.replace('bg-','text-') : '-left-[8px] '+theme.bubbleIn.replace('bg-','text-')} fill-current`}>
                                  {isMe ? <path d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" /> : <path d="M1.533 3.568 8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z" />}
                                </svg>
                              )}

                              {msg.replyToId && messages.find(m => m.id === msg.replyToId) && (
                                <div className={`mb-1 px-3 py-2 rounded-md text-[13px] bg-black/5 border-l-4 ${theme.primary.replace('bg-','border-')} opacity-80 truncate max-w-full`}>
                                  {messages.find(m => m.id === msg.replyToId).text}
                                </div>
                              )}

                              {msg.isImage ? (
                                <div className="cursor-pointer overflow-hidden rounded-md mb-1 relative" onClick={() => setSelectedImage(msg.text)}>
                                  <img src={msg.text} alt="Attachment" className="max-w-[260px] sm:max-w-[320px] object-cover" />
                                </div>
                              ) : (
                                <span className="whitespace-pre-wrap">{msg.text}</span>
                              )}
                              
                              <div className={`text-[11px] ${theme.textMuted} float-right mt-1 ml-3 flex items-center gap-1 translate-y-[2px]`}>
                                {formatTime(msg.timestamp)}
                                {isMe && <MessageStatusIcon msg={msg} />}
                              </div>
                            </div>

                            <div className={`hidden sm:flex absolute top-1/2 -translate-y-1/2 ${isMe ? '-left-10' : '-right-10'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                              <button onClick={() => setReplyingToId(msg.id)} className={`p-1.5 ${theme.textMuted} hover:text-current`}><Reply size={16}/></button>
                            </div>
                          </motion.div>
                        )
                      })}
                      
                      {/* AI Quick Replies Render Block */}
                      {showAIReplies && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                          {isGeneratingAI ? (
                            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full ${theme.bgSidebar} text-xs font-semibold shadow-sm`}><Loader2 size={14} className="animate-spin" /> Analyzing context...</div>
                          ) : (
                            aiReplies.map((reply, i) => (
                              <button key={i} onClick={() => handleSendText(null, reply)} className={`text-[13px] whitespace-nowrap font-medium px-4 py-2 rounded-full ${theme.bgSidebar} shadow-sm border border-black/5 hover:bg-black/5 transition-colors`}>{reply}</button>
                            ))
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div ref={messagesEndRef} className="h-1" />
                  </div>
                </main>

                {showScrollButton && (
                  <button onClick={() => scrollToBottom('smooth')} className={`absolute bottom-[80px] right-6 p-2.5 ${theme.bgSidebar} ${theme.textMuted} rounded-full shadow-md z-30`}>
                    <ChevronDown size={24} />
                  </button>
                )}

                {/* Chat Footer Input Area */}
                <footer className={`flex-none ${theme.bgHeader} min-h-[62px] px-4 py-2.5 z-20 flex flex-col relative border-l border-black/10`}>
                  
                  <AnimatePresence>
                    {replyingToId && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className={`flex items-center justify-between bg-black/5 px-4 py-3 rounded-t-lg border-l-4 ${theme.primary.replace('bg-','border-')} -mt-2 mb-2`}>
                        <span className={`text-[13px] ${theme.textMuted} truncate`}>Replying to: {messages.find(m => m.id === replyingToId)?.text}</span>
                        <button onClick={() => setReplyingToId(null)} className={theme.textMuted}><X size={16}/></button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form className="flex gap-2 sm:gap-4 items-end w-full relative">
                    
                    <div className={`flex gap-4 items-center ${theme.textMuted} pb-3 pl-2 relative`}>
                      <button type="button" onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachMenu(false); }} className={showEmojiPicker ? theme.primary.replace('bg-','text-') : ''}><Smile size={26} strokeWidth={1.5} /></button>
                      <AnimatePresence>
                        {showEmojiPicker && (
                          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-12 left-0 z-50 shadow-2xl rounded-xl overflow-hidden border border-black/10">
                            <EmojiPicker theme={activeThemeKey === 'whatsappLight' ? 'light' : 'dark'} onEmojiClick={(e) => setNewMessage(prev => prev + e.emoji)} />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <button type="button" onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmojiPicker(false); }} className={showAttachMenu ? theme.primary.replace('bg-','text-') : ''}><Paperclip size={24} strokeWidth={1.5}/></button>
                      <AnimatePresence>
                        {showAttachMenu && (
                          <motion.div initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 20 }} className="absolute bottom-14 left-6 flex flex-col gap-4 z-50 p-2">
                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 group">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><ImageIcon size={22}/></div>
                              <span className="text-sm font-medium text-white bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm">Photos & Videos</span>
                            </button>
                            <button type="button" onClick={generateAIQuickReplies} className="flex items-center gap-3 group">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><Sparkles size={22}/></div>
                              <span className="text-sm font-medium text-white bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm">AI Quick Reply</span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className={`flex-1 ${theme.bgSidebar} rounded-lg flex flex-col p-1 shadow-sm border border-transparent focus-within:border-black/10`}>
                      {previewUrl && (
                        <div className="relative m-2 inline-block w-max">
                          <img src={previewUrl} className="h-20 w-auto rounded-md object-cover border border-gray-200" alt="Preview" />
                          <button type="button" onClick={() => { setPendingImage(null); setPreviewUrl(null); }} className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full p-1"><X size={12}/></button>
                        </div>
                      )}
                      <textarea 
                        ref={textareaRef} value={newMessage} 
                        onChange={(e) => { setNewMessage(e.target.value); e.target.style.height = '42px'; e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`; }} 
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(e); } }}
                        onFocus={handleInputFocus} onBlur={handleInputBlur} placeholder="Type a message" disabled={isOffline || isUploading} rows={1}
                        className="flex-1 bg-transparent py-2.5 px-3 text-[15px] focus:outline-none resize-none custom-scrollbar placeholder-gray-500"
                        style={{ minHeight: '42px' }}
                      />
                    </div>

                    <div className="pb-2.5 flex items-center pr-2">
                      {isUploading ? (
                        <Loader2 size={26} className={`animate-spin ${theme.primary.replace('bg-','text-')}`} />
                      ) : newMessage.trim() || pendingImage ? (
                        <button onClick={handleSendText} type="button" disabled={isOffline || isUploading} className={`${theme.textMuted} hover:text-current transition-colors p-1`}><Send size={26} strokeWidth={1.5} /></button>
                      ) : (
                        <button type="button" className={`${theme.textMuted} p-1`}><Mic size={26} strokeWidth={1.5} /></button>
                      )}
                    </div>
                  </form>
                </footer>
              </>
            ) : (
              <div className={`flex-1 flex flex-col items-center justify-center text-center px-4 ${theme.bgHeader} border-l border-black/10 z-10`}>
                <div className={`w-32 h-32 rounded-full ${theme.primary} opacity-10 mb-8 flex items-center justify-center`}><MessageSquarePlus size={48} className="text-black opacity-50"/></div>
                <h2 className="text-[32px] font-light mb-4">Desktop Portal</h2>
                <p className={`text-[14px] ${theme.textMuted} max-w-[460px] leading-relaxed`}>Select a chat from the left or create a new one to start messaging.</p>
                <div className={`absolute bottom-10 flex items-center gap-1.5 text-[13px] ${theme.textMuted}`}><Lock size={12}/> End-to-end encrypted</div>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
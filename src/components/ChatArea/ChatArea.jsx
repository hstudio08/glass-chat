import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { Send, Phone, Video, Paperclip, Smile, Mic, Square, Loader2, Info, ArrowLeft } from 'lucide-react';
import { db } from '../../services/firebase';
import { useApp } from '../../contexts/AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker from 'emoji-picker-react';

// 🚨 CLOUDINARY CONFIGURATION 
const CLOUDINARY_CLOUD_NAME = "dclpaog2a"; 
const CLOUDINARY_UPLOAD_PRESET = "jjupg5h1"; 

export default function ChatArea({ onOpenVideo, onOpenProfile, onBack }) {
  const { myPhoneNumber, activeRoom } = useApp();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [activeRoomDoc, setActiveRoomDoc] = useState(null);
  
  // 🚀 Fetch the OTHER user's actual live profile for the header
  const [otherUserProfile, setOtherUserProfile] = useState(null);
  
  // UI States
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // 🎤 Premium Voice Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  // Refs
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // --- 1. FIREBASE CHAT LISTENER ---
  useEffect(() => {
    setShowEmojiPicker(false);
    if (!activeRoom) return;

    const q = query(collection(db, 'rooms', activeRoom, 'messages'), orderBy('timestamp', 'asc'));
    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setTimeout(() => chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' }), 150);
    });

    const unsubscribeDoc = onSnapshot(doc(db, 'rooms', activeRoom), (docSnap) => {
      if (docSnap.exists()) setActiveRoomDoc(docSnap.data());
    });

    return () => { unsubscribeMessages(); unsubscribeDoc(); };
  }, [activeRoom]);

  // --- 2. LIVE PROFILE LISTENER FOR HEADER ---
  useEffect(() => {
    if (!activeRoom || !myPhoneNumber) return;
    const otherId = activeRoom.split('_').find(id => id !== myPhoneNumber);
    if (!otherId) return;

    const unsubscribeUser = onSnapshot(doc(db, 'users', otherId), (docSnap) => {
      if (docSnap.exists()) setOtherUserProfile(docSnap.data());
    });

    return () => unsubscribeUser();
  }, [activeRoom, myPhoneNumber]);

  // --- 3. CLICK OUTSIDE EMOJI PICKER TO CLOSE ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showEmojiPicker && emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        if (!event.target.closest('.emoji-toggle-btn')) {
          setShowEmojiPicker(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  // --- 4. SEND TEXT MESSAGE ---
  const handleSendText = async (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !isUploading) return; 

    const textToSend = newMessage.trim();
    setNewMessage("");
    setShowEmojiPicker(false);
    
    try {
      await addDoc(collection(db, 'rooms', activeRoom, 'messages'), { 
        text: textToSend, isImage: false, isAudio: false, senderId: myPhoneNumber, timestamp: serverTimestamp() 
      });
      await updateDoc(doc(db, 'rooms', activeRoom), {
        lastMessage: textToSend, lastUpdated: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    }
  };

  // --- 5. UNIVERSAL CLOUDINARY UPLOAD ---
  const uploadToCloudinary = async (file, fileTypeLabel) => {
    setIsUploading(true);
    setShowEmojiPicker(false);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.secure_url) {
        const optimizedUrl = fileTypeLabel === "Photo" 
          ? data.secure_url.replace('/upload/', '/upload/q_auto,f_auto/') 
          : data.secure_url;

        await addDoc(collection(db, 'rooms', activeRoom, 'messages'), { 
          text: optimizedUrl, 
          isImage: fileTypeLabel === "Photo", 
          isAudio: fileTypeLabel === "Audio", 
          senderId: myPhoneNumber, 
          timestamp: serverTimestamp() 
        });
        
        await updateDoc(doc(db, 'rooms', activeRoom), {
          lastMessage: fileTypeLabel === "Photo" ? "📷 Photo" : "🎤 Voice Message", 
          lastUpdated: serverTimestamp()
        });
      } else {
        throw new Error(data.error?.message || "Upload failed");
      }
    } catch (err) { 
      console.error("Cloudinary Error:", err);
      alert("Failed to upload media. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) uploadToCloudinary(file, "Photo");
  };

  // --- 6. PREMIUM VOICE RECORDING LOGIC ---
  const handleToggleRecord = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
      setRecordingTime(0);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const mimeType = mediaRecorder.mimeType || 'audio/webm';
          const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
          
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const audioFile = new File([audioBlob], `voice_message_${Date.now()}.${extension}`, { type: mimeType });
          
          uploadToCloudinary(audioFile, "Audio");
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
        
        setRecordingTime(0);
        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);

      } catch (err) {
        console.error("Mic access error:", err);
        alert("Microphone access denied. Please allow microphone permissions in your browser.");
      }
    }
  };

  // --- HELPER FUNCTIONS ---
  const formatTime = (ts) => ts && typeof ts.toDate === 'function' ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(ts.toDate()) : "";
  const formatRecordingTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // 🚀 Perfect Naming & Avatar logic
  const getChatName = () => {
    const otherId = activeRoom?.split('_').find(id => id !== myPhoneNumber);
    return otherUserProfile?.name || otherUserProfile?.email || activeRoomDoc?.names?.[otherId] || otherId || "Contact";
  };

  const getChatAvatar = () => {
    return otherUserProfile?.avatar || null;
  };

  return (
    <div className="flex flex-col h-full w-full relative">
      
      {/* 🧊 HEADER */}
      <header className="flex-none h-[75px] md:h-[88px] px-4 md:px-10 flex items-center justify-between z-20 border-b border-white/30 bg-white/40 md:bg-white/10 backdrop-blur-md md:backdrop-blur-none shrink-0 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden p-2 -ml-2 rounded-full hover:bg-white/60 text-chatly-dark transition-colors">
            <ArrowLeft size={24} />
          </button>
          
          <div onClick={onOpenProfile} className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-chatly-peach to-chatly-maroon border-2 border-white/80 flex items-center justify-center text-white font-extrabold text-lg md:text-xl shadow-sm group-hover:scale-105 transition-transform overflow-hidden">
                {/* 🚀 Render custom avatar if they have one */}
                {getChatAvatar() ? (
                  <img src={getChatAvatar()} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  getChatName().charAt(0).toUpperCase()
                )}
              </div>
              <div className="absolute bottom-0 right-0 w-3 h-3 md:w-3.5 md:h-3.5 bg-chatly-green border-2 border-[#fdf2f0] rounded-full z-10"></div>
            </div>
            
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h3 className="text-[17px] md:text-[19px] font-extrabold text-chatly-dark leading-tight group-hover:text-chatly-maroon transition-colors">
                  {getChatName()}
                </h3>
              </div>
              <span className="text-[12px] md:text-[14px] font-bold text-chatly-green tracking-wide flex items-center gap-1">
                 <span className="w-1.5 h-1.5 rounded-full bg-chatly-green"></span> Online
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2 text-chatly-dark/80">
          <button className="p-2 md:p-2.5 rounded-full hover:bg-white/40 hover:text-chatly-maroon transition-all"><Phone size={20} className="md:w-6 md:h-6" /></button>
          <button onClick={onOpenVideo} className="p-2 md:p-2.5 rounded-full hover:bg-white/40 hover:text-chatly-maroon transition-all"><Video size={22} className="md:w-6 md:h-6" /></button>
          <button onClick={onOpenProfile} className="hidden md:block p-2.5 rounded-full hover:bg-white/40 hover:text-chatly-maroon transition-all"><Info size={24} /></button>
        </div>
      </header>

      {/* 💬 MESSAGE SCROLL AREA (WhatsApp Style Logic) */}
     <main ref={chatContainerRef} className="flex-1 overflow-y-auto px-[3%] sm:px-[5%] py-6 relative z-10 custom-scrollbar pb-[140px]" style={{ background: 'var(--chat-bg, transparent)' }}>
        <div className="flex justify-center mb-6 relative">
           <div className="absolute w-full h-px bg-chatly-dark/10 top-1/2"></div>
           <span className="text-[12px] font-extrabold text-chatly-dark/60 bg-chatly-peach px-4 py-1 rounded-full z-10 border border-white/50 shadow-sm uppercase tracking-wider">Today</span>
        </div>

        <div className="flex flex-col">
          <AnimatePresence>
            {messages.map((msg, index) => {
              const isMe = msg.senderId === myPhoneNumber;
              
              // WhatsApp Grouping Logic
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const isFirstInGroup = !prevMsg || prevMsg.senderId !== msg.senderId;

              // Dynamic Border Radius for chat "Tails"
              const bubbleRadius = isMe 
                ? (isFirstInGroup ? 'rounded-tl-[20px] rounded-bl-[20px] rounded-tr-[20px] rounded-br-[4px]' : 'rounded-[20px]')
                : (isFirstInGroup ? 'rounded-tr-[20px] rounded-br-[20px] rounded-tl-[20px] rounded-bl-[4px]' : 'rounded-[20px]');

              return (
                <motion.div 
                  key={msg.id} 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} w-full ${isFirstInGroup ? 'mt-4' : 'mt-1'}`}
                >
                  <div className={`relative px-4 py-2.5 shadow-sm font-medium leading-relaxed max-w-[85%] sm:max-w-[70%] transition-all flex flex-col min-w-[100px]
                  ${isMe 
                  ? `bg-gradient-to-br from-chatly-maroon to-chatly-rose text-white shadow-[0_4px_15px_rgba(167,111,111,0.2)] ${bubbleRadius}` 
                  : `bg-white/70 backdrop-blur-xl border border-white/80 text-chatly-dark ${bubbleRadius}`}
              `} style={{ fontSize: 'var(--chat-font-size, 15.5px)' }}>
                    
                    {/* Media/Text Content */}
                    <div className="mb-1">
                      {msg.isImage ? (
                        <img src={msg.text} alt="Attachment" className="max-w-full sm:max-w-[280px] rounded-xl shadow-sm mb-1" loading="lazy" />
                      ) : msg.isAudio ? (
                        <audio src={msg.text} controls className="h-10 w-56 sm:w-64 outline-none filter drop-shadow-sm mb-1" />
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      )}
                    </div>

                    {/* Timestamp inside the bubble, bottom right */}
                    <span className={`text-[10px] font-extrabold self-end ${isMe ? 'text-white/80' : 'text-chatly-dark/50'}`}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </main>

      <footer className="absolute bottom-6 left-0 right-0 px-[5%] sm:px-[8%] z-30">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[40px] bg-blue-200/40 blur-2xl rounded-full z-0 pointer-events-none"></div>

        <form onSubmit={handleSendText} className="relative z-10 flex items-center gap-3 w-full">
          <div className="flex-1 bg-white/50 backdrop-blur-2xl border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-full flex items-center px-2 py-1.5 focus-within:bg-white/70 transition-all">
            
            <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} disabled={isRecording} className={`emoji-toggle-btn p-3 rounded-full transition-colors ${showEmojiPicker ? 'text-chatly-maroon' : 'text-chatly-dark/60 hover:text-chatly-maroon hover:bg-white/40'} disabled:opacity-50`}>
              <Smile size={24} />
            </button>
            
            {isRecording ? (
              <div className="flex-1 flex items-center gap-3 px-3">
                <div className="w-3.5 h-3.5 rounded-full bg-red-500 animate-pulse shadow-sm border border-red-200"></div>
                <span className="text-red-600 font-extrabold text-[15px] animate-pulse tracking-wide">
                  Recording Audio... {formatRecordingTime(recordingTime)}
                </span>
              </div>
            ) : (
              <input 
              value={newMessage} 
              onChange={(e) => setNewMessage(e.target.value)} 
              onKeyDown={(e) => {
                // If the user turned on "Enter is Send" in settings, trigger the submit function!
                if (e.key === 'Enter' && userProfile?.settings?.enterIsSend) {
                  e.preventDefault();
                  handleSendText(e);
                }
              }}
              placeholder="Message" 
              className="flex-1 bg-transparent px-2 py-2 text-[16px] text-chatly-dark placeholder-chatly-dark/50 font-semibold focus:outline-none"
              disabled={isUploading}
/>
            )}
            
            <div className="flex items-center gap-1 pr-2">
               <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
               
               {!isRecording && (
                 <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 text-chatly-dark/60 hover:text-chatly-maroon rounded-full hover:bg-white/40 transition-colors">
                   {isUploading ? <Loader2 size={22} className="animate-spin text-chatly-maroon" /> : <Paperclip size={22} />}
                 </button>
               )}

               <button type="button" onClick={handleToggleRecord} className={`p-2.5 rounded-full transition-all ${isRecording ? 'bg-red-100 text-red-600 animate-pulse shadow-inner' : 'text-chatly-dark/60 hover:text-chatly-maroon hover:bg-white/40'}`}>
                 {isRecording ? <Square size={20} fill="currentColor" /> : <Mic size={22} />}
               </button>
            </div>
          </div>

          <button type="submit" disabled={(!newMessage.trim() && !isUploading) || isRecording} className="w-[60px] h-[60px] shrink-0 bg-gradient-to-r from-chatly-maroon to-chatly-rose text-white rounded-full flex items-center justify-center shadow-[0_8px_20px_rgba(167,111,111,0.4)] hover:shadow-[0_8px_25px_rgba(167,111,111,0.6)] transition-all disabled:opacity-50 hover:-translate-y-1">
            {isUploading ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} className="ml-1" />}
          </button>
        </form>

        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div 
              ref={emojiPickerRef}
              initial={{ opacity: 0, y: 20, scale: 0.95 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: 10, scale: 0.95 }} 
              transition={{ duration: 0.2 }}
              className="absolute bottom-24 left-[8%] z-50 origin-bottom-left"
            >
              <div className="p-1 bg-white/50 backdrop-blur-3xl rounded-3xl border border-white/80 shadow-[0_20px_60px_rgba(74,58,58,0.2)]">
                <EmojiPicker theme="light" onEmojiClick={(e) => setNewMessage(p => p + e.emoji)} previewConfig={{ showPreview: false }} skinTonesDisabled height={350} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </footer>
    </div>
  );
}
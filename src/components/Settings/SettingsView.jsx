import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useApp } from '../../contexts/AppContext';
import { 
  Settings, Lock, Bell, MessageSquare, Database, HelpCircle, 
  ArrowLeft, Loader2, Edit2, ShieldCheck, AlertTriangle, 
  Trash2, Cloud, CheckCircle, Smartphone, Wifi, Volume2, EyeOff,
  Image as ImageIcon, Send
} from 'lucide-react';

// 🚨 YOUR CLOUDINARY KEYS
const CLOUDINARY_CLOUD_NAME = "dclpaog2a"; 
const CLOUDINARY_UPLOAD_PRESET = "jjupg5h1"; 

// --- REUSABLE UI COMPONENTS ---
const GlassToggle = ({ isOn, onToggle, disabled }) => (
  <div onClick={() => !disabled && onToggle()} className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors shadow-inner flex items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${isOn ? 'bg-chatly-maroon' : 'bg-chatly-dark/20'}`}>
    <motion.div layout transition={{ type: "spring", stiffness: 500, damping: 30 }} className="w-4 h-4 bg-white rounded-full shadow-md" animate={{ x: isOn ? 24 : 0 }} />
  </div>
);

const SettingRow = ({ icon: Icon, title, description, children }) => (
  <div className="flex items-center justify-between py-4 border-b border-white/30 last:border-0 group">
    <div className="flex items-center gap-4 pr-4">
      {Icon && <div className="p-2 rounded-xl bg-white/40 text-chatly-dark/70 group-hover:text-chatly-maroon transition-colors"><Icon size={20} /></div>}
      <div className="flex flex-col">
        <span className="font-extrabold text-[15px] text-chatly-dark">{title}</span>
        {description && <span className="text-[12px] font-bold text-chatly-dark/50 mt-0.5">{description}</span>}
      </div>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const GlassSelect = ({ value, onChange, options }) => (
  <select value={value} onChange={onChange} className="bg-white/50 backdrop-blur-md border border-white/80 rounded-xl px-3 py-2 text-sm font-bold text-chatly-dark focus:outline-none focus:ring-2 focus:ring-chatly-maroon/50 shadow-sm appearance-none cursor-pointer">
    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
  </select>
);

export default function SettingsView({ onBack }) {
  const { userProfile, myPhoneNumber } = useApp();
  const [activeTab, setActiveTab] = useState('account'); 
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({ name: '', bio: '', email: '', phone: '' });

  // DEFAULT PREFERENCES
  const [prefs, setPrefs] = useState({
    lastSeen: 'Everyone', profilePhoto: 'Everyone', readReceipts: true, twoStepVerification: false,
    messageSound: true, vibrate: true, showPreviews: true,
    enterIsSend: false, fontSize: 15, chatWallpaper: '#fdf2f0',
    autoDownloadWifi: true, autoDownloadCellular: false
  });

  // LOAD DATA ON MOUNT
  useEffect(() => {
    if (userProfile) {
      setFormData({
        name: userProfile.name || '', bio: userProfile.bio || '',
        email: userProfile.email || '', phone: userProfile.phone || ''
      });
      if (userProfile.settings) {
        setPrefs(prev => ({ ...prev, ...userProfile.settings }));
        // Apply saved visual settings immediately
        document.documentElement.style.setProperty('--chat-bg', userProfile.settings.chatWallpaper || '#fdf2f0');
        document.documentElement.style.setProperty('--chat-font-size', (userProfile.settings.fontSize || 15) + 'px');
      }
    }
  }, [userProfile]);

  // SAVE TO FIREBASE
  const handleSaveSettings = async (specificData = null) => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      const userRef = doc(db, 'users', myPhoneNumber);
      const dataToSave = specificData || {
        name: formData.name, bio: formData.bio, email: formData.email, phone: formData.phone,
        settings: prefs
      };
      await updateDoc(userRef, dataToSave);
      setSaveMessage('Saved!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage('Failed to save.');
    } finally {
      setIsSaving(false);
    }
  };

  // UPDATE PREFERENCE & APPLY GLOBALLY
  const updatePref = (key, value) => {
    const updatedPrefs = { ...prefs, [key]: value };
    setPrefs(updatedPrefs);
    handleSaveSettings({ settings: updatedPrefs });

    // 🚀 REAL-TIME IMPLEMENTATION: Inject into CSS Variables
    if (key === 'chatWallpaper') document.documentElement.style.setProperty('--chat-bg', value);
    if (key === 'fontSize') document.documentElement.style.setProperty('--chat-font-size', `${value}px`);
  };

  // 🚀 REAL CLOUDINARY AVATAR UPLOAD
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploadingAvatar(true);
    try {
      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: "POST", body: uploadData,
      });

      const data = await res.json();
      if (data.secure_url) {
        const optimizedUrl = data.secure_url.replace('/upload/', '/upload/w_300,h_300,c_fill,q_auto,f_auto/');
        await updateDoc(doc(db, 'users', myPhoneNumber), { avatar: optimizedUrl });
        setSaveMessage('Profile photo updated!');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch (err) {
      alert("Failed to upload photo");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const tabs = [
    { id: 'account', label: 'Profile', icon: Settings },
    { id: 'privacy', label: 'Privacy', icon: Lock },
    { id: 'notifications', label: 'Alerts', icon: Bell },
    { id: 'chat', label: 'Chats', icon: MessageSquare },
    { id: 'storage', label: 'Storage', icon: Database }
  ];

  return (
    <div className="w-full h-full flex flex-col md:flex-row bg-white/20 backdrop-blur-xl z-10 animate-in fade-in duration-300">
      
      {/* MOBILE TABS */}
      <div className="md:hidden flex flex-col shrink-0 bg-white/40 border-b border-white/50 pt-[max(env(safe-area-inset-top),16px)]">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/60 text-chatly-dark transition-colors"><ArrowLeft size={24} /></button>
          <h2 className="text-2xl font-extrabold text-chatly-dark tracking-tight">Settings</h2>
        </div>
        <div className="flex overflow-x-auto custom-scrollbar px-4 pb-3 gap-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-extrabold whitespace-nowrap transition-all shadow-sm ${isActive ? 'bg-gradient-to-r from-chatly-maroon to-chatly-rose text-white' : 'bg-white/60 text-chatly-dark/70 hover:bg-white/80 border border-white/60'}`}>
                <Icon size={16} /> {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* DESKTOP SIDEBAR */}
      <div className="hidden md:flex w-[280px] lg:w-[320px] bg-white/40 border-r border-white/60 flex-col pt-8 pb-6 px-4 shrink-0">
        <div className="px-4 mb-8">
           <h2 className="text-3xl font-extrabold text-chatly-dark flex items-center gap-3"><Settings className="text-chatly-maroon" size={32} /> Settings</h2>
           <p className="text-chatly-dark/60 font-bold text-sm mt-1">Manage your account preferences</p>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl font-extrabold transition-all text-[15px] ${isActive ? 'bg-white/80 text-chatly-dark shadow-sm border border-white/80' : 'text-chatly-dark/70 hover:bg-white/50'}`}>
                <div className={`p-1.5 rounded-full shadow-sm ${isActive ? 'bg-gradient-to-br from-chatly-maroon to-chatly-rose text-white' : 'bg-white/60 text-chatly-dark/60'}`}><Icon size={20} /></div>
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-12 relative bg-transparent">
        <AnimatePresence mode="wait">
          
          {activeTab === 'account' && (
            <motion.div key="account" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-[700px] w-full mx-auto md:mx-0 pb-20 md:pb-0">
              <div className="flex items-center justify-between mb-6 md:mb-8">
                <h1 className="text-2xl md:text-3xl font-extrabold text-chatly-dark">Profile Details</h1>
                {saveMessage && <span className="text-chatly-green font-bold text-xs md:text-sm bg-chatly-green/10 px-4 py-1.5 rounded-full border border-chatly-green/20 animate-pulse">{saveMessage}</span>}
              </div>
              <div className="bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[2rem] p-6 md:p-8 shadow-sm flex flex-col md:flex-row gap-8">
                <div className="flex flex-col items-center shrink-0">
                  <div className="relative group cursor-pointer w-32 h-32 md:w-40 md:h-40" onClick={() => !isUploadingAvatar && fileInputRef.current?.click()}>
                    {isUploadingAvatar ? (
                       <div className="w-full h-full rounded-full border-4 border-white shadow-lg flex items-center justify-center bg-white/50 backdrop-blur-md"><Loader2 className="animate-spin text-chatly-maroon" size={32} /></div>
                    ) : (
                       <img src={userProfile?.avatar || "https://i.pravatar.cc/150?img=placeholder"} className="w-full h-full rounded-full object-cover border-4 border-white shadow-lg group-hover:opacity-80 transition-opacity" alt="Avatar"/>
                    )}
                    <button className="absolute bottom-1 right-1 bg-chatly-maroon text-white p-2.5 rounded-full shadow-md border-2 border-white"><Edit2 size={16} /></button>
                    <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-5">
                  <div>
                    <label className="text-xs font-extrabold text-chatly-dark/60 uppercase tracking-widest mb-1.5 block">Display Name</label>
                    <input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full bg-white/70 border border-white/80 rounded-xl px-4 py-3.5 text-chatly-dark font-bold focus:outline-none focus:border-chatly-maroon transition-colors shadow-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-extrabold text-chatly-dark/60 uppercase tracking-widest mb-1.5 block">About / Bio</label>
                    <textarea value={formData.bio} onChange={(e) => setFormData({...formData, bio: e.target.value})} rows={2} className="w-full bg-white/70 border border-white/80 rounded-xl px-4 py-3.5 text-chatly-dark font-bold focus:outline-none focus:border-chatly-maroon transition-colors shadow-sm resize-none custom-scrollbar" />
                  </div>
                  <button onClick={() => handleSaveSettings()} disabled={isSaving} className="mt-4 w-full bg-gradient-to-r from-chatly-maroon to-chatly-rose text-white font-extrabold py-4 rounded-xl transition-all flex justify-center items-center shadow-md hover:-translate-y-0.5">
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : "Save Profile Details"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'privacy' && (
            <motion.div key="privacy" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-[700px] w-full mx-auto md:mx-0 pb-20 md:pb-0">
              <h1 className="text-2xl md:text-3xl font-extrabold text-chatly-dark mb-6 md:mb-8">Privacy & Security</h1>
              <div className="bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[2rem] p-6 shadow-sm mb-6">
                <SettingRow icon={EyeOff} title="Last Seen & Online" description="Choose who can see when you were last active.">
                  <GlassSelect value={prefs.lastSeen} onChange={(e) => updatePref('lastSeen', e.target.value)} options={['Everyone', 'My Contacts', 'Nobody']} />
                </SettingRow>
                <SettingRow icon={ImageIcon} title="Profile Photo" description="Who can view your profile avatar.">
                  <GlassSelect value={prefs.profilePhoto} onChange={(e) => updatePref('profilePhoto', e.target.value)} options={['Everyone', 'My Contacts', 'Nobody']} />
                </SettingRow>
                <SettingRow icon={CheckCircle} title="Read Receipts" description="If turned off, you won't send or receive read receipts.">
                  <GlassToggle isOn={prefs.readReceipts} onToggle={() => updatePref('readReceipts', !prefs.readReceipts)} />
                </SettingRow>
              </div>
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div key="notifications" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-[700px] w-full mx-auto md:mx-0 pb-20 md:pb-0">
              <h1 className="text-2xl md:text-3xl font-extrabold text-chatly-dark mb-6 md:mb-8">Notifications</h1>
              <div className="bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[2rem] p-6 shadow-sm mb-6">
                <SettingRow icon={Volume2} title="Play sounds for incoming messages" description="Enable audio cues for new texts.">
                  <GlassToggle isOn={prefs.messageSound} onToggle={() => updatePref('messageSound', !prefs.messageSound)} />
                </SettingRow>
                <SettingRow icon={Smartphone} title="Vibrate" description="Vibrate the device on new message.">
                  <GlassToggle isOn={prefs.vibrate} onToggle={() => updatePref('vibrate', !prefs.vibrate)} />
                </SettingRow>
              </div>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-[700px] w-full mx-auto md:mx-0 pb-20 md:pb-0">
              <h1 className="text-2xl md:text-3xl font-extrabold text-chatly-dark mb-6 md:mb-8">Chat Settings</h1>
              <div className="bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[2rem] p-6 shadow-sm mb-6">
                
                {/* DYNAMIC FONT SIZE */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-extrabold text-[15px] text-chatly-dark">Chat Font Size</span>
                    <span className="text-sm font-bold text-chatly-maroon">{prefs.fontSize}px</span>
                  </div>
                  <input type="range" min="12" max="24" value={prefs.fontSize} onChange={(e) => updatePref('fontSize', Number(e.target.value))} className="w-full h-2 bg-white/50 rounded-lg appearance-none cursor-pointer accent-chatly-maroon shadow-inner" />
                </div>

                {/* DYNAMIC WALLPAPER */}
                <div className="mb-2">
                  <span className="font-extrabold text-[15px] text-chatly-dark block mb-4">Chat Wallpaper</span>
                  <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2">
                     {/* Added image wallpapers alongside colors */}
                     {[
                       { val: '#fdf2f0', type: 'color' }, 
                       { val: '#dbe4f0', type: 'color' }, 
                       { val: '#e0f0db', type: 'color' }, 
                       { val: '#1e1a1a', type: 'color' },
                       { val: 'url(https://www.transparenttextures.com/patterns/cubes.png)', type: 'pattern' },
                       { val: 'url(https://www.transparenttextures.com/patterns/diagmonds-light.png)', type: 'pattern' }
                     ].map(bg => (
                       <div key={bg.val} onClick={() => updatePref('chatWallpaper', bg.val)} className={`w-16 h-24 shrink-0 rounded-2xl cursor-pointer shadow-sm border-2 transition-all hover:scale-105 relative ${prefs.chatWallpaper === bg.val ? 'border-chatly-maroon shadow-md' : 'border-white/50'}`} style={{ background: bg.val, backgroundColor: bg.type === 'pattern' ? '#fdf2f0' : bg.val }}>
                         {prefs.chatWallpaper === bg.val && <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-xl"><CheckCircle className="text-chatly-maroon fill-white" size={24}/></div>}
                       </div>
                     ))}
                  </div>
                </div>
              </div>
              <div className="bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[2rem] p-6 shadow-sm">
                 <SettingRow icon={Send} title="Enter is Send" description="Pressing Enter will send your message immediately.">
                    <GlassToggle isOn={prefs.enterIsSend} onToggle={() => updatePref('enterIsSend', !prefs.enterIsSend)} />
                 </SettingRow>
              </div>
            </motion.div>
          )}

          {activeTab === 'storage' && (
            <motion.div key="storage" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-[700px] w-full mx-auto md:mx-0 pb-20 md:pb-0">
              <h1 className="text-2xl md:text-3xl font-extrabold text-chatly-dark mb-6 md:mb-8">Data & Storage</h1>
              <div className="bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[2rem] p-6 shadow-sm">
                <SettingRow icon={Wifi} title="When using Wi-Fi" description="Automatically download photos and videos on Wi-Fi.">
                  <GlassToggle isOn={prefs.autoDownloadWifi} onToggle={() => updatePref('autoDownloadWifi', !prefs.autoDownloadWifi)} />
                </SettingRow>
                <SettingRow icon={Database} title="When using Cellular" description="Automatically download photos on mobile data.">
                  <GlassToggle isOn={prefs.autoDownloadCellular} onToggle={() => updatePref('autoDownloadCellular', !prefs.autoDownloadCellular)} />
                </SettingRow>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
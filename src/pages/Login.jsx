import { useState } from 'react';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { KeyRound, User, Mail, MapPin, Send, ArrowLeft, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' or 'request'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Login State
  const [accessId, setAccessId] = useState("");

  // Request State
  const [reqName, setReqName] = useState("");
  const [reqEmail, setReqEmail] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!accessId.trim()) return;
    setLoading(true);
    setError("");

    try {
      const docRef = doc(db, 'access_codes', accessId.trim());
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'active') {
          // Check expiration
          if (data.expiresAt && data.expiresAt < Date.now()) {
            setError("This Access ID has expired.");
          } else {
            onLogin(accessId.trim()); // Success!
          }
        } else {
          setError("This Access ID has been blocked by the administrator.");
        }
      } else {
        setError("Invalid Access ID. Please try again.");
      }
    } catch (err) {
      setError("Connection error. Please check your internet.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async (e) => {
    e.preventDefault();
    if (!reqName.trim() || !reqEmail.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    
    setLoading(true);
    setError("");
    setSuccess("");

    // Request GPS Location
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          await addDoc(collection(db, 'id_requests'), {
            name: reqName.trim(),
            email: reqEmail.trim(),
            location: { lat: latitude, lng: longitude },
            status: 'pending',
            timestamp: serverTimestamp()
          });

          setSuccess("Request sent! The administrator will email you shortly.");
          setReqName("");
          setReqEmail("");
          setTimeout(() => setMode('login'), 3000);
        } catch (err) {
          setError("Failed to send request. Please try again.");
        } finally {
          setLoading(false);
        }
      },
      (geoError) => {
        setError("Location access is required to request an ID. Please allow location permissions and try again.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center p-4 relative overflow-hidden font-sans bg-gradient-to-br from-[#E6DCC8] to-[#D5C7B3] text-[#4A3C31]">
      
      {/* 📜 Vintage Sketch Background Details */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-40">
        <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full mix-blend-multiply filter blur-[100px] bg-[#C1B2A6]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full mix-blend-multiply filter blur-[100px] bg-[#E8E1D5]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="w-full max-w-md p-8 sm:p-10 flex flex-col relative z-10 bg-[#F9F6F0]/80 backdrop-blur-xl border border-[#C1B2A6]/50 shadow-[0_20px_50px_rgba(90,70,50,0.15)] rounded-3xl"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8C7462] to-[#5A4535] flex items-center justify-center shadow-lg text-[#F9F6F0]">
            <ShieldCheck size={32} strokeWidth={1.5} />
          </div>
        </div>

        <h1 className="text-3xl font-serif font-bold text-center mb-2 tracking-tight text-[#3A2D23]">Secure Portal</h1>
        <p className="text-center text-[#7A6B5D] font-medium mb-8 text-sm">Encrypted communication channel.</p>

        <AnimatePresence mode="wait">
          {/* --- LOGIN MODE --- */}
          {mode === 'login' && (
            <motion.form key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={handleLogin} className="flex flex-col gap-5">
              
              <AnimatePresence>
                {error && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-red-50 text-red-600 border border-red-200 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2"><AlertCircle size={14} /> {error}</motion.div>}
                {success && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2"><ShieldCheck size={14} /> {success}</motion.div>}
              </AnimatePresence>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#9E8E81]"><KeyRound size={18} /></div>
                <input 
                  type="text" value={accessId} onChange={(e) => setAccessId(e.target.value)} placeholder="Enter Access ID" disabled={loading}
                  className="w-full bg-[#E8E1D5]/50 border border-[#C1B2A6] text-[#4A3C31] placeholder-[#9E8E81] rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#8C7462]/50 focus:bg-[#F9F6F0] transition-all font-mono uppercase font-bold tracking-widest text-sm shadow-inner"
                />
              </div>

              <button type="submit" disabled={loading || !accessId.trim()} className="w-full bg-[#5A4535] hover:bg-[#423226] disabled:opacity-70 text-[#F9F6F0] font-bold py-3.5 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 mt-2">
                {loading ? <Loader2 size={18} className="animate-spin" /> : "Authenticate"}
              </button>

              <div className="mt-4 text-center">
                <button type="button" onClick={() => {setMode('request'); setError(""); setSuccess("");}} className="text-[13px] font-bold text-[#8C7462] hover:text-[#5A4535] transition-colors underline decoration-2 underline-offset-4 decoration-[#C1B2A6]">
                  Request an Access ID
                </button>
              </div>
            </motion.form>
          )}

          {/* --- REQUEST MODE --- */}
          {mode === 'request' && (
            <motion.form key="request" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleRequestAccess} className="flex flex-col gap-4">
              
              <AnimatePresence>
                {error && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-red-50 text-red-600 border border-red-200 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2"><AlertCircle size={14} /> {error}</motion.div>}
              </AnimatePresence>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#9E8E81]"><User size={18} /></div>
                <input 
                  type="text" value={reqName} onChange={(e) => setReqName(e.target.value)} placeholder="Full Name" disabled={loading}
                  className="w-full bg-[#E8E1D5]/50 border border-[#C1B2A6] text-[#4A3C31] placeholder-[#9E8E81] rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8C7462]/50 focus:bg-[#F9F6F0] transition-all font-semibold text-sm shadow-inner"
                />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#9E8E81]"><Mail size={18} /></div>
                <input 
                  type="email" value={reqEmail} onChange={(e) => setReqEmail(e.target.value)} placeholder="Email Address" disabled={loading}
                  className="w-full bg-[#E8E1D5]/50 border border-[#C1B2A6] text-[#4A3C31] placeholder-[#9E8E81] rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8C7462]/50 focus:bg-[#F9F6F0] transition-all font-semibold text-sm shadow-inner"
                />
              </div>

              <div className="flex items-start gap-3 mt-2 bg-[#E8E1D5]/40 p-3 rounded-xl border border-[#C1B2A6]/50">
                <MapPin size={16} className="text-[#8C7462] flex-shrink-0 mt-0.5" />
                <p className="text-[11px] font-medium text-[#7A6B5D] leading-relaxed">
                  To verify your identity, your GPS location will be securely shared with the administrator upon requesting an ID.
                </p>
              </div>

              <button type="submit" disabled={loading || !reqName.trim() || !reqEmail.trim()} className="w-full bg-[#5A4535] hover:bg-[#423226] disabled:opacity-70 text-[#F9F6F0] font-bold py-3.5 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 mt-2">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <><Send size={16}/> Submit Request</>}
              </button>

              <div className="mt-2 text-center">
                <button type="button" onClick={() => {setMode('login'); setError("");}} className="text-[13px] font-bold text-[#8C7462] hover:text-[#5A4535] transition-colors flex items-center justify-center gap-1.5 mx-auto">
                  <ArrowLeft size={14} /> Back to Login
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}
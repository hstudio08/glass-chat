import React, { useState } from 'react';
import { auth, googleProvider } from '../services/firebase';
import { signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Mail, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Login({ onLogin }) {
  // --- UI STATE ---
  const [authMode, setAuthMode] = useState('phone'); // 'phone' or 'email'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- PHONE AUTH STATE ---
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  
  // --- EMAIL AUTH STATE (Phase 3 Prep) ---
  const [email, setEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailStep, setEmailStep] = useState('request'); // 'request' or 'verify'

  // ==========================================
  // 1. GOOGLE LOGIN LOGIC
  // ==========================================
  const handleGoogleLogin = async () => {
    setLoading(true); setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Pass the user ID or email back to the app to log them in
      onLogin(result.user.email || result.user.uid); 
    } catch (err) {
      setError('Google Sign-In failed. Please try again.');
    } finally { 
      setLoading(false); 
    }
  };

  // ==========================================
  // 2. PHONE OTP LOGIC (FIREBASE)
  // ==========================================
  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { 
        size: 'invisible' 
      });
    }
  };

  const handleSendPhoneOTP = async (e) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      return setError("Enter a valid phone number (e.g. +1234567890).");
    }
    setLoading(true); setError('');
    try {
      setupRecaptcha();
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
    } catch (err) { 
      setError('Failed to send OTP. Ensure number includes country code.'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleVerifyPhoneOTP = async (e) => {
    e.preventDefault();
    if (!otp || otp.length < 6) return setError("Enter the 6-digit code.");
    
    setLoading(true); setError('');
    try {
      const result = await confirmationResult.confirm(otp);
      onLogin(result.user.phoneNumber);
    } catch (err) { 
      setError('Invalid code. Please try again.'); 
    } finally { 
      setLoading(false); 
    }
  };

  // ==========================================
  // 3. EMAIL OTP LOGIC (FRONTEND FLOW)
  // ==========================================
  const handleSendEmailOTP = async (e) => {
    e.preventDefault();
    if (!email.includes('@')) return setError("Enter a valid email address.");
    
    setLoading(true); setError('');
    // Simulate connecting to EmailJS or backend
    setTimeout(() => { 
      setEmailStep('verify'); 
      setLoading(false); 
    }, 1500);
  };

  const handleVerifyEmailOTP = async (e) => {
    e.preventDefault();
    if (!emailOtp) return setError("Enter the verification code.");
    
    setLoading(true); setError('');
    // Simulate verification success
    setTimeout(() => {
      if (emailOtp === '123456') {
        onLogin(email);
      } else { 
        setError('Invalid Code. Use 123456 for testing.'); 
        setLoading(false); 
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
      
      {/* 🌟 Decorative Background Orbs */}
      <div className="absolute top-[10%] left-[5%] w-64 h-64 bg-white/60 rounded-full blur-[80px] pointer-events-none"></div>
      <div className="absolute bottom-[10%] right-[5%] w-80 h-80 bg-chatly-rose/20 rounded-full blur-[100px] pointer-events-none"></div>

      {/* 🧊 MAIN GLASS CARD */}
      <div className="w-full max-w-[420px] bg-white/30 backdrop-blur-2xl border border-white/60 shadow-xl rounded-[3rem] p-6 sm:p-10 flex flex-col relative z-10">
        
        {/* Header / Logo */}
        <div className="flex justify-center items-center gap-2 mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-chatly-dark">CHATLY</h1>
          <span className="text-chatly-maroon text-2xl drop-shadow-sm">♥</span>
        </div>

        {/* 🎛️ Segmented Tabs */}
        <div className="flex w-full bg-white/30 p-1.5 rounded-full mb-6 border border-white/40 shadow-inner">
          <button 
            onClick={() => {setAuthMode('phone'); setError(''); setConfirmationResult(null);}} 
            className={`flex-1 py-3 text-[14px] sm:text-[15px] font-bold rounded-full transition-all duration-300 ${authMode === 'phone' ? 'bg-white shadow-sm text-chatly-maroon' : 'text-chatly-dark/60 hover:text-chatly-dark'}`}
          >
            Phone
          </button>
          <button 
            onClick={() => {setAuthMode('email'); setError(''); setEmailStep('request');}} 
            className={`flex-1 py-3 text-[14px] sm:text-[15px] font-bold rounded-full transition-all duration-300 ${authMode === 'email' ? 'bg-white shadow-sm text-chatly-maroon' : 'text-chatly-dark/60 hover:text-chatly-dark'}`}
          >
            Email
          </button>
        </div>

        {/* ⚠️ Error Message Display */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="w-full overflow-hidden mb-4">
              <div className="bg-red-50/90 backdrop-blur-md text-red-600 text-[13px] font-bold p-3 rounded-2xl border border-red-200 text-center shadow-sm">
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form Container */}
        <div className="w-full flex flex-col min-h-[140px]">
          <AnimatePresence mode="wait">
            
            {/* 📱 PHONE FORM */}
            {authMode === 'phone' && (
              <motion.form key="phone" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} onSubmit={confirmationResult ? handleVerifyPhoneOTP : handleSendPhoneOTP} className="flex flex-col gap-4">
                
                {!confirmationResult ? (
                  <>
                    <div className="flex items-center w-full bg-white/50 border border-white/60 rounded-full px-5 py-3.5 focus-within:bg-white/80 focus-within:border-chatly-maroon transition-all shadow-sm">
                      <Phone className="text-chatly-maroon shrink-0" size={20} />
                      <input 
                        type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} 
                        placeholder="+1 234 567 8900" 
                        className="flex-1 bg-transparent border-none outline-none ml-3 text-chatly-dark placeholder-chatly-dark/40 font-semibold text-[15px]" 
                      />
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-chatly-maroon to-chatly-rose hover:from-chatly-dark hover:to-chatly-maroon text-white font-bold py-3.5 rounded-full flex justify-center items-center gap-2 shadow-[0_4px_15px_rgba(167,111,111,0.3)] hover:shadow-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:transform-none">
                      {loading ? <Loader2 className="animate-spin" size={20} /> : <>Send Secure OTP <ArrowRight size={18} /></>}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center w-full bg-white/50 border border-white/60 rounded-full px-5 py-3.5 focus-within:bg-white/80 focus-within:border-chatly-maroon transition-all shadow-sm">
                      <ShieldCheck className="text-chatly-maroon shrink-0" size={20} />
                      <input 
                        type="text" value={otp} onChange={(e) => setOtp(e.target.value)} 
                        placeholder="6-Digit Code" 
                        className="flex-1 bg-transparent border-none outline-none ml-3 text-chatly-dark placeholder-chatly-dark/40 font-bold tracking-widest text-lg" 
                      />
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-chatly-maroon to-chatly-rose hover:from-chatly-dark hover:to-chatly-maroon text-white font-bold py-3.5 rounded-full flex justify-center items-center shadow-[0_4px_15px_rgba(167,111,111,0.3)] hover:shadow-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:transform-none">
                      {loading ? <Loader2 className="animate-spin" size={20} /> : "Verify & Connect"}
                    </button>
                  </>
                )}
                
                {/* Invisible Recaptcha required by Firebase */}
                <div id="recaptcha-container"></div>
              </motion.form>
            )}

            {/* ✉️ EMAIL FORM */}
            {authMode === 'email' && (
              <motion.form key="email" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }} onSubmit={emailStep === 'request' ? handleSendEmailOTP : handleVerifyEmailOTP} className="flex flex-col gap-4">
                
                {emailStep === 'request' ? (
                  <>
                    <div className="flex items-center w-full bg-white/50 border border-white/60 rounded-full px-5 py-3.5 focus-within:bg-white/80 focus-within:border-chatly-maroon transition-all shadow-sm">
                      <Mail className="text-chatly-maroon shrink-0" size={20} />
                      <input 
                        type="email" value={email} onChange={(e) => setEmail(e.target.value)} 
                        placeholder="hello@example.com" 
                        className="flex-1 bg-transparent border-none outline-none ml-3 text-chatly-dark placeholder-chatly-dark/40 font-semibold text-[15px]" 
                      />
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-chatly-maroon to-chatly-rose hover:from-chatly-dark hover:to-chatly-maroon text-white font-bold py-3.5 rounded-full flex justify-center items-center gap-2 shadow-[0_4px_15px_rgba(167,111,111,0.3)] hover:shadow-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:transform-none">
                      {loading ? <Loader2 className="animate-spin" size={20} /> : <>Send Email Code <ArrowRight size={18} /></>}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center w-full bg-white/50 border border-white/60 rounded-full px-5 py-3.5 focus-within:bg-white/80 focus-within:border-chatly-maroon transition-all shadow-sm">
                      <ShieldCheck className="text-chatly-maroon shrink-0" size={20} />
                      <input 
                        type="text" value={emailOtp} onChange={(e) => setEmailOtp(e.target.value)} 
                        placeholder="6-Digit Code" 
                        className="flex-1 bg-transparent border-none outline-none ml-3 text-chatly-dark placeholder-chatly-dark/40 font-bold tracking-widest text-lg" 
                      />
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-chatly-maroon to-chatly-rose hover:from-chatly-dark hover:to-chatly-maroon text-white font-bold py-3.5 rounded-full flex justify-center items-center shadow-[0_4px_15px_rgba(167,111,111,0.3)] hover:shadow-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:transform-none">
                      {loading ? <Loader2 className="animate-spin" size={20} /> : "Verify & Connect"}
                    </button>
                  </>
                )}
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="flex items-center w-full my-8 gap-4 opacity-50">
          <div className="flex-1 h-px bg-chatly-dark/40"></div>
          <span className="text-[11px] font-extrabold text-chatly-dark uppercase tracking-widest">Or continue with</span>
          <div className="flex-1 h-px bg-chatly-dark/40"></div>
        </div>

        {/* Google Button */}
        <button 
          onClick={handleGoogleLogin} 
          disabled={loading} 
          className="flex items-center justify-center gap-3 w-full bg-white/50 hover:bg-white/80 border border-white/60 py-3.5 rounded-full font-bold text-chatly-dark shadow-sm transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:transform-none"
        >
          {/* Hardcoded Dimensions (22x22) to prevent CSS crashing */}
          <svg width="22" height="22" viewBox="0 0 24 24" className="shrink-0">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </button>

      </div>
    </div>
  );
}
import { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { motion } from 'framer-motion';
import { ShieldAlert, KeyRound, ArrowRight } from 'lucide-react';

export default function Login({ onLogin }) {
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleJoinChat = async (e) => {
    e.preventDefault();
    if (!accessCode.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const codeRef = doc(db, 'access_codes', accessCode);
      const codeSnap = await getDoc(codeRef);

      if (codeSnap.exists()) {
        const codeData = codeSnap.data();
        const isExpired = codeData.expiresAt && codeData.expiresAt < Date.now();

        if (codeData.status === 'active' && !isExpired) {
          onLogin(accessCode);
        } else {
          setError('This secure session has expired or been closed.');
        }
      } else {
        setError('Invalid access code. Please check your invitation.');
      }
    } catch (err) {
      setError('Secure connection failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="glass-panel w-full max-w-md p-10 flex flex-col items-center relative overflow-hidden"
      >
        {/* Decorative background glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl shadow-xl flex items-center justify-center mb-6 relative z-10"
        >
          <KeyRound className="text-white" size={32} />
        </motion.div>

        <h1 className="text-3xl font-extrabold text-gray-800 mb-2 relative z-10 tracking-tight">Secure Portal</h1>
        <p className="text-gray-500 mb-8 text-center font-medium relative z-10">Enter your private access code to initiate an encrypted session.</p>

        <form onSubmit={handleJoinChat} className="w-full flex flex-col gap-5 relative z-10">
          <div className="relative">
            <input
              type="text"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="e.g., VIP-01"
              className="w-full bg-white/60 border border-white/50 rounded-2xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-blue-400/30 transition-all text-gray-800 placeholder-gray-400 shadow-inner font-semibold tracking-wide text-lg text-center uppercase"
            />
          </div>
          
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex items-center justify-center gap-2 text-red-500 bg-red-100/50 p-3 rounded-xl border border-red-200/50">
              <ShieldAlert size={18} />
              <p className="text-sm font-semibold">{error}</p>
            </motion.div>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isLoading || !accessCode.trim()}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
          >
            {isLoading ? 'Verifying...' : (
              <>Connect Securely <ArrowRight size={20} /></>
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
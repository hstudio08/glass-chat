import { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

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
        
        // Check if active AND not expired
        const isExpired = codeData.expiresAt && codeData.expiresAt < Date.now();

        if (codeData.status === 'active' && !isExpired) {
          onLogin(accessCode);
        } else {
          setError('This chat session is expired or blocked.');
        }
      } else {
        setError('Invalid access code.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md p-8 flex flex-col items-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Secure Chat</h1>
        <p className="text-gray-600 mb-8 text-center">Enter your private access code to join.</p>

        <form onSubmit={handleJoinChat} className="w-full flex flex-col gap-4">
          <input
            type="text"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            placeholder="e.g., VIP-01"
            className="w-full bg-white/40 border border-glassBorder rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400/50 backdrop-blur-sm transition-all text-gray-800 placeholder-gray-500"
          />
          
          {error && <p className="text-red-500 text-sm text-center font-semibold">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-500/80 hover:bg-blue-600/80 text-white font-semibold py-3 rounded-xl backdrop-blur-md transition-all shadow-lg disabled:opacity-50"
          >
            {isLoading ? 'Verifying...' : 'Join Chat'}
          </button>
        </form>
      </div>
    </div>
  );
}
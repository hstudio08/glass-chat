import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore'; 

// Replace these with your actual Firebase keys!
const firebaseConfig = {
  apiKey: "AIzaSyASpc86EM61keqZDLR9EEpMf6aSsqKV3Ik",
  authDomain: "as-creators-final.firebaseapp.com",
  projectId: "as-creators-final",
  storageBucket: "as-creators-final.firebasestorage.app",
  messagingSenderId: "749658925168",
  appId: "1:749658925168:web:1fd8266a55b6364a2c6cb5"
};

const app = initializeApp(firebaseConfig);

// 🛡️ THE FIX: Let Firebase Auto-Detect the best network protocol 
// to prevent QUIC errors and 400 Bad Requests on strict networks.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
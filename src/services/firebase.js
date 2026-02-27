import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // Added GoogleAuthProvider

const firebaseConfig = {
  apiKey: "AIzaSyASpc86EM61keqZDLR9EEpMf6aSsqKV3Ik",
  authDomain: "as-creators-final.firebaseapp.com",
  projectId: "as-creators-final",
  storageBucket: "as-creators-final.firebasestorage.app",
  messagingSenderId: "749658925168",
  appId: "1:749658925168:web:1fd8266a55b6364a2c6cb5"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider(); // Export the provider

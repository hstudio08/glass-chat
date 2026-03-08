import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

const AppContext = createContext();

export function useApp() {
  return useContext(AppContext);
}

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [myPhoneNumber, setMyPhoneNumber] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // 1. INITIAL LOGIN & AUTHENTICATION
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setCurrentUser(firebaseUser);
        
        const identifier = firebaseUser.email || firebaseUser.phoneNumber || firebaseUser.uid;
        setMyPhoneNumber(identifier);

        let authMethod = "Unknown";
        if (firebaseUser.providerData && firebaseUser.providerData.length > 0) {
          const provider = firebaseUser.providerData[0].providerId;
          if (provider.includes('google')) authMethod = "Google OAuth";
          else if (provider.includes('phone')) authMethod = "Phone OTP";
        }

        // Save login time to DB
        const userRef = doc(db, 'users', identifier);
        await setDoc(userRef, {
          id: identifier,
          email: firebaseUser.email || "No Email",
          phone: firebaseUser.phoneNumber || "No Phone",
          authMethod: authMethod,
          lastLogin: serverTimestamp()
        }, { merge: true });

      } else {
        setCurrentUser(null);
        setMyPhoneNumber(null);
        setUserProfile(null);
        setActiveRoom(null);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // 🚨 2. THE REAL-TIME ADMIN KILL SWITCH 🚨
  // This constantly watches the user's document in Firebase. 
  // If the Admin changes 'isBlocked' to true, this triggers instantly.
  useEffect(() => {
    if (!myPhoneNumber) return;

    const userRef = doc(db, 'users', myPhoneNumber);
    
    const unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserProfile(data);
        
        // If the admin deleted the user entirely from the DB, sign them out instantly
      } else {
        auth.signOut();
      }
    });

    return () => unsubscribeProfile();
  }, [myPhoneNumber]);

  const value = {
    currentUser,
    myPhoneNumber,
    setMyPhoneNumber,
    userProfile,
    activeRoom,
    setActiveRoom,
  };

  return (
    <AppContext.Provider value={value}>
      {!isAuthLoading && children}
    </AppContext.Provider>
  );
}
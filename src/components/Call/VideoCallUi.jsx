import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize } from 'lucide-react';
import { doc, setDoc, getDoc, onSnapshot, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useApp } from '../../contexts/AppContext';

// Free Google STUN Servers to establish P2P connection
const servers = {
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
  ],
  iceCandidatePoolSize: 10,
};

export default function VideoCallUI({ onEndCall }) {
  const { activeRoom, myPhoneNumber } = useApp();
  
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callStatus, setCallStatus] = useState("Connecting...");
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(new RTCPeerConnection(servers));
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());

  useEffect(() => {
    initCall();
    return () => hangUp();
  }, []);

  const initCall = async () => {
    try {
      // 1. Get Local Video & Audio
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // 2. Push local tracks to WebRTC Connection
      stream.getTracks().forEach((track) => {
        pcRef.current.addTrack(track, stream);
      });

      // 3. Listen for Remote Video Tracks
      pcRef.current.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          remoteStreamRef.current.addTrack(track);
        });
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStreamRef.current;
        setCallStatus("Connected");
      };

      // 4. Firestore Signaling Room
      const callDoc = doc(db, 'calls', activeRoom);
      const offerCandidates = collection(callDoc, 'offerCandidates');
      const answerCandidates = collection(callDoc, 'answerCandidates');

      const callData = await getDoc(callDoc);

      if (!callData.exists() || !callData.data().offer) {
        // 🔥 WE ARE THE CALLER (Create Offer)
        setCallStatus("Ringing...");
        
        // Save ICE candidates
        pcRef.current.onicecandidate = (event) => {
          if (event.candidate) addDoc(offerCandidates, event.candidate.toJSON());
        };

        // Create Offer
        const offerDescription = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offerDescription);

        const offer = {
          sdp: offerDescription.sdp,
          type: offerDescription.type,
        };

        await setDoc(callDoc, { offer });

        // Listen for Answer
        onSnapshot(callDoc, (snapshot) => {
          const data = snapshot.data();
          if (!pcRef.current.currentRemoteDescription && data?.answer) {
            const answerDescription = new RTCSessionDescription(data.answer);
            pcRef.current.setRemoteDescription(answerDescription);
          }
        });

        // Listen for remote ICE candidates
        onSnapshot(answerCandidates, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const candidate = new RTCIceCandidate(change.doc.data());
              pcRef.current.addIceCandidate(candidate);
            }
          });
        });

      } else {
        // 🔥 WE ARE THE RECEIVER (Answer Call)
        setCallStatus("Connecting...");

        pcRef.current.onicecandidate = (event) => {
          if (event.candidate) addDoc(answerCandidates, event.candidate.toJSON());
        };

        // Set Remote Offer
        const offerDescription = new RTCSessionDescription(callData.data().offer);
        await pcRef.current.setRemoteDescription(offerDescription);

        // Create Answer
        const answerDescription = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answerDescription);

        const answer = {
          type: answerDescription.type,
          sdp: answerDescription.sdp,
        };

        await updateDoc(callDoc, { answer });

        // Listen for remote ICE candidates
        onSnapshot(offerCandidates, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const candidate = new RTCIceCandidate(change.doc.data());
              pcRef.current.addIceCandidate(candidate);
            }
          });
        });
      }
    } catch (error) {
      console.error("WebRTC Error:", error);
      setCallStatus("Hardware Access Denied");
    }
  };

  const hangUp = async () => {
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    pcRef.current?.close();
    
    // Clear Firestore room so next call works
    try {
      await setDoc(doc(db, 'calls', activeRoom), { ended: true });
    } catch (e) {}
    
    onEndCall();
  };

  const toggleMic = () => {
    localStreamRef.current.getAudioTracks()[0].enabled = isMicMuted;
    setIsMicMuted(!isMicMuted);
  };

  const toggleVideo = () => {
    localStreamRef.current.getVideoTracks()[0].enabled = isVideoOff;
    setIsVideoOff(!isVideoOff);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-[#1e1a1a] flex flex-col justify-between">
      
      {/* 🔴 REMOTE VIDEO (Full Screen) */}
      <div className="absolute inset-0 w-full h-full bg-black flex items-center justify-center">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
        {callStatus !== "Connected" && (
           <div className="absolute inset-0 bg-[#1e1a1a]/80 backdrop-blur-md flex flex-col items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-white/10 animate-pulse flex items-center justify-center mb-6">
                 <div className="w-16 h-16 rounded-full bg-chatly-maroon/50 flex items-center justify-center"><Video size={32} className="text-white"/></div>
              </div>
              <h2 className="text-white text-2xl font-extrabold tracking-wide">{callStatus}</h2>
           </div>
        )}
      </div>

      {/* 🟢 LOCAL VIDEO (Floating PiP) */}
      <motion.div drag dragConstraints={{ top: 20, left: 20, right: 300, bottom: 500 }} className="absolute top-[max(env(safe-area-inset-top),20px)] right-4 w-28 h-40 md:w-48 md:h-64 bg-black rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-10 cursor-grab active:cursor-grabbing">
        <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]"></video>
      </motion.div>

      {/* HEADER OVERLAY */}
      <div className="relative z-10 w-full px-6 py-8 bg-gradient-to-b from-black/60 to-transparent flex justify-between items-start pt-[max(env(safe-area-inset-top),20px)]">
         <div>
           <h3 className="text-white font-extrabold text-xl shadow-sm tracking-wide">End-to-End Encrypted</h3>
           <p className="text-white/70 font-bold text-sm">Room: {activeRoom?.substring(0,8)}</p>
         </div>
      </div>

      {/* CONTROLS (Bottom) */}
      <div className="relative z-10 w-full px-6 py-10 bg-gradient-to-t from-black/80 to-transparent pb-[max(env(safe-area-inset-bottom),40px)] flex justify-center items-center gap-6">
        <button onClick={toggleMic} className={`p-4 rounded-full backdrop-blur-md transition-all ${isMicMuted ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'}`}>
          {isMicMuted ? <MicOff size={28} /> : <Mic size={28} />}
        </button>
        
        <button onClick={hangUp} className="p-5 rounded-full bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.5)] hover:scale-105 transition-transform">
          <PhoneOff size={32} />
        </button>
        
        <button onClick={toggleVideo} className={`p-4 rounded-full backdrop-blur-md transition-all ${isVideoOff ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'}`}>
          {isVideoOff ? <VideoOff size={28} /> : <Video size={28} />}
        </button>
      </div>
    </motion.div>
  );
}
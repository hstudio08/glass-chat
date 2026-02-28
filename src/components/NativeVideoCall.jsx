import React, { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import { Video, PhoneOff, Mic, MicOff, VideoOff, Camera, Loader2, ShieldCheck, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Helper to format seconds into MM:SS ---
const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export default function NativeVideoCall({ chatId, myRole, onClose }) {
  const [peer, setPeer] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  const myVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const containerRef = useRef(null); // Used for drag constraints
  const timerRef = useRef(null);

  // --- 1. PeerJS & Media Initialization ---
  useEffect(() => {
    const initPeer = new Peer(`${chatId}-${myRole}`);
    const targetRole = myRole === 'admin' ? 'user' : 'admin';
    const targetId = `${chatId}-${targetRole}`;

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setMyStream(stream);
        if (myVideoRef.current) myVideoRef.current.srcObject = stream;

        // Answer incoming calls
        initPeer.on('call', (call) => {
          call.answer(stream);
          call.on('stream', (remoteStream) => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
            setIsConnected(true);
          });
        });

        // Try calling the other peer immediately
        const call = initPeer.call(targetId, stream);
        if (call) {
          call.on('stream', (remoteStream) => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
            setIsConnected(true);
          });
        }
      })
      .catch((err) => {
        alert("Camera and Microphone access is required for secure video channels.");
        onClose();
      });

    setPeer(initPeer);

    return () => {
      initPeer.destroy();
      if (myStream) myStream.getTracks().forEach(track => track.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, myRole]);

  // --- 2. Call Timer Engine ---
  useEffect(() => {
    if (isConnected) {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isConnected]);

  // --- 3. Hardware Controls ---
  const toggleMute = () => {
    if (myStream) {
      const audioTrack = myStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (myStream) {
      const videoTrack = myStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const endCall = () => {
    if (peer) peer.destroy();
    if (myStream) myStream.getTracks().forEach(track => track.stop());
    onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 0.98 }} 
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[500] bg-[#0a0a0a] flex flex-col font-sans overflow-hidden select-none"
      ref={containerRef}
    >
      {/* 🌌 Ambient Background Blur for Cinematic Feel */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-30">
        <div className="absolute top-1/4 left-1/4 w-[50vw] h-[50vw] rounded-full bg-emerald-500/20 mix-blend-screen blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[50vw] h-[50vw] rounded-full bg-amber-500/20 mix-blend-screen blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* 🔝 HEADER BAR */}
      <header className="absolute top-0 w-full h-20 bg-gradient-to-b from-black/80 to-transparent z-30 flex items-center justify-between px-6 sm:px-8 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-lg text-emerald-400">
            <ShieldCheck size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold tracking-wide text-[15px]">Encrypted A/V Tunnel</span>
            <span className="text-white/50 text-[11px] font-semibold uppercase tracking-widest flex items-center gap-1.5">
              {isConnected ? <><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"/> Connected</> : "Establishing Connection..."}
            </span>
          </div>
        </div>

        <AnimatePresence>
          {isConnected && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white font-mono text-sm font-bold shadow-lg">
              {formatDuration(callDuration)}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* 🎬 MAIN VIDEO STAGE */}
      <div className="flex-1 relative w-full h-full flex items-center justify-center bg-black">
        
        {/* Remote Video (Fullscreen) */}
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          className={`w-full h-full object-cover transition-opacity duration-700 ${isConnected ? 'opacity-100' : 'opacity-0'}`} 
        />

        {/* Radar Pulse Waiting State */}
        {!isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <div className="relative flex items-center justify-center mb-8">
              <div className="absolute w-32 h-32 border border-emerald-500/30 rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
              <div className="absolute w-48 h-48 border border-emerald-500/20 rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" style={{ animationDelay: '0.4s' }}></div>
              <div className="absolute w-64 h-64 border border-emerald-500/10 rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" style={{ animationDelay: '0.8s' }}></div>
              <div className="w-20 h-20 bg-emerald-500/20 backdrop-blur-md border border-emerald-500/50 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.3)] text-emerald-400">
                <Loader2 className="animate-spin" size={32} />
              </div>
            </div>
            <p className="text-white/80 font-bold tracking-[0.2em] uppercase text-sm animate-pulse">Awaiting Signal</p>
          </div>
        )}

        {/* 📱 LOCAL VIDEO (DRAGGABLE PICTURE-IN-PICTURE) */}
        <motion.div 
          drag 
          dragConstraints={containerRef}
          dragElastic={0.2}
          dragMomentum={true}
          whileDrag={{ scale: 1.05, cursor: "grabbing" }}
          className="absolute bottom-28 sm:bottom-32 right-6 sm:right-8 w-32 sm:w-48 aspect-[3/4] bg-[#1a1a1a] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-2 border-white/10 z-30 cursor-grab origin-bottom-right"
        >
          <video 
            ref={myVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover scale-x-[-1]" // scale-x-[-1] mirrors the camera natively
          />
          {/* Local Camera Off State */}
          <AnimatePresence>
            {isVideoOff && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#1a1a1a]/90 backdrop-blur-md flex flex-col items-center justify-center text-white/50 border border-white/5">
                <Camera size={28} className="mb-2" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Paused</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* 🔽 FLOATING CONTROL DOCK */}
      <div className="absolute bottom-8 w-full flex justify-center z-40 pb-[env(safe-area-inset-bottom)] pointer-events-none">
        <div className="bg-white/10 backdrop-blur-2xl border border-white/10 p-2.5 sm:p-3 rounded-full flex items-center gap-2 sm:gap-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] pointer-events-auto">
          
          {/* Mute Button */}
          <div className="relative group">
            <button onClick={toggleMute} className={`p-4 sm:p-5 rounded-full transition-all duration-300 flex items-center justify-center ${isMuted ? 'bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.4)] text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
              {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
            <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/80 backdrop-blur-md text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {isMuted ? 'Unmute' : 'Mute'}
            </span>
          </div>

          {/* Camera Button */}
          <div className="relative group">
            <button onClick={toggleVideo} className={`p-4 sm:p-5 rounded-full transition-all duration-300 flex items-center justify-center ${isVideoOff ? 'bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.4)] text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
              {isVideoOff ? <VideoOff size={22} /> : <Camera size={22} />}
            </button>
            <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/80 backdrop-blur-md text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {isVideoOff ? 'Start Video' : 'Stop Video'}
            </span>
          </div>

          <div className="w-px h-8 bg-white/10 mx-1 sm:mx-2"></div>

          {/* End Call Button */}
          <div className="relative group">
            <button onClick={endCall} className="p-4 sm:p-5 rounded-full bg-red-500 hover:bg-red-600 transition-all duration-300 shadow-[0_0_20px_rgba(239,68,68,0.4)] text-white flex items-center justify-center">
              <PhoneOff size={22} />
            </button>
            <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/80 backdrop-blur-md text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              End Call
            </span>
          </div>

        </div>
      </div>

    </motion.div>
  );
}
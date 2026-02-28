import React, { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import { Video, PhoneOff, Mic, MicOff, VideoOff, Camera, Loader2, ShieldCheck, Maximize2, Minimize2, Sparkles, SwitchCamera, UserPlus, MonitorUp, PictureInPicture, SignalHigh } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Free Cinematic Ringtones ---
const DIAL_TONE = new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
DIAL_TONE.loop = true;

const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export default function NativeVideoCall({ chatId, myRole, roomId, isIncoming, onClose }) {
  const [peer, setPeer] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  // 🌟 Advanced Features
  const [isEnhanced, setIsEnhanced] = useState(false); // Studio/Beauty Mode
  const [facingMode, setFacingMode] = useState('user'); // Camera Swap
  const [isFullscreen, setIsFullscreen] = useState(false); 

  const myVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const ambientVideoRef = useRef(null); // Used for background blur glow
  const timerRef = useRef(null);
  const containerRef = useRef(null);

  // Advanced Cinematic Studio Filter
  const beautyFilter = isEnhanced 
    ? 'brightness(1.1) contrast(1.05) saturate(1.2) drop-shadow(0px 0px 10px rgba(255,255,255,0.1))' 
    : 'none';

  // --- 1. CORE WEBRTC ENGINE ---
  useEffect(() => {
    const initPeer = new Peer(`${roomId}-${myRole}`, {
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] }
    });
    const targetRole = myRole === 'admin' ? 'user' : 'admin';
    const targetId = `${roomId}-${targetRole}`;

    const getMedia = async (mode) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } }, 
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
        });
        setMyStream(stream);
        if (myVideoRef.current) myVideoRef.current.srcObject = stream;
        return stream;
      } catch (err) {
        alert("Camera/Mic access is required to establish a secure tunnel.");
        onClose();
        return null;
      }
    };

    getMedia(facingMode).then((stream) => {
      if (!stream) return;
      if (!isIncoming) DIAL_TONE.play().catch(()=>{});

      // Answer incoming call
      initPeer.on('call', (call) => {
        DIAL_TONE.pause();
        call.answer(stream);
        call.on('stream', (incomingStream) => {
          setRemoteStream(incomingStream);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = incomingStream;
          if (ambientVideoRef.current) ambientVideoRef.current.srcObject = incomingStream;
          setIsConnected(true);
        });
      });

      // Dial out
      if (!isIncoming) {
        const tryCall = setInterval(() => {
          const call = initPeer.call(targetId, stream);
          if (call) {
            call.on('stream', (incomingStream) => {
              clearInterval(tryCall);
              DIAL_TONE.pause();
              setRemoteStream(incomingStream);
              if (remoteVideoRef.current) remoteVideoRef.current.srcObject = incomingStream;
              if (ambientVideoRef.current) ambientVideoRef.current.srcObject = incomingStream;
              setIsConnected(true);
            });
          }
        }, 1500); // Retry pinging every 1.5s until they pick up
        
        initPeer.on('connection', () => clearInterval(tryCall));
        setTimeout(() => { clearInterval(tryCall); DIAL_TONE.pause(); }, 45000); // 45 sec timeout
      }
    });

    setPeer(initPeer);

    // Flawless Garbage Collection
    return () => {
      DIAL_TONE.pause();
      initPeer.destroy();
      if (myStream) myStream.getTracks().forEach(track => track.stop());
      clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, myRole, isIncoming]);

  // --- 2. TIMER ---
  useEffect(() => {
    if (isConnected) {
      DIAL_TONE.pause();
      timerRef.current = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isConnected]);

  // --- 3. HARDWARE & STREAM CONTROLS ---
  const toggleMute = () => {
    if (myStream && myStream.getAudioTracks()[0]) {
      myStream.getAudioTracks()[0].enabled = !myStream.getAudioTracks()[0].enabled;
      setIsMuted(!myStream.getAudioTracks()[0].enabled);
    }
  };

  const toggleVideo = () => {
    if (myStream && myStream.getVideoTracks()[0]) {
      myStream.getVideoTracks()[0].enabled = !myStream.getVideoTracks()[0].enabled;
      setIsVideoOff(!myStream.getVideoTracks()[0].enabled);
    }
  };

  // 🔄 Seamless Camera Swap
  const swapCamera = async () => {
    if (isScreenSharing) return; // Disable swap if sharing screen
    if (myStream) myStream.getVideoTracks().forEach(track => track.stop());
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newMode }, audio: !isMuted });
      
      // Keep existing audio track, just replace video
      const audioTrack = myStream.getAudioTracks()[0];
      if (audioTrack) newStream.addTrack(audioTrack);
      
      setMyStream(newStream);
      if (myVideoRef.current) myVideoRef.current.srcObject = newStream;
      
      // Hot-swap track on active Peer connection
      if (peer) {
        Object.values(peer.connections).forEach(connArray => {
          connArray.forEach(conn => {
            const sender = conn.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) sender.replaceTrack(newStream.getVideoTracks()[0]);
          });
        });
      }
    } catch (err) { console.error("Camera swap failed", err); }
  };

  // 💻 Screen Share Engine
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Revert to camera
      setIsScreenSharing(false);
      swapCamera(); // Triggers a re-fetch of the camera
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      
      // If user clicks "Stop Sharing" on the browser's native banner
      screenTrack.onended = () => {
        setIsScreenSharing(false);
        swapCamera();
      };

      if (myVideoRef.current) myVideoRef.current.srcObject = screenStream;
      
      // Hot-swap track to peer
      if (peer) {
        Object.values(peer.connections).forEach(connArray => {
          connArray.forEach(conn => {
            const sender = conn.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) sender.replaceTrack(screenTrack);
          });
        });
      }
      setIsScreenSharing(true);
    } catch (err) {
      console.log("Screen share cancelled or failed.");
    }
  };

  // 🖼️ Native OS Picture-in-Picture
  const requestPiP = async () => {
    if (remoteVideoRef.current && document.pictureInPictureEnabled) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await remoteVideoRef.current.requestPictureInPicture();
        }
      } catch (err) { console.error("PiP failed", err); }
    }
  };

  const endCall = () => {
    if (peer) peer.destroy();
    if (myStream) myStream.getTracks().forEach(track => track.stop());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-3xl flex items-center justify-center font-sans overflow-hidden select-none" ref={containerRef}>
      
      {/* 📱 MAIN CINEMATIC FRAME */}
      <motion.div 
        layout
        className={`relative bg-[#050505] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-[420px] h-[100dvh] max-h-[850px] sm:h-[85vh] sm:rounded-[48px] border-[8px] border-[#1a1a1a] ring-1 ring-white/10'}`}
      >
        
        {/* 🌌 Ambient Blurred Background (Takes the remote stream and heavily blurs it) */}
        <video 
          ref={ambientVideoRef} 
          autoPlay 
          playsInline 
          muted 
          className={`absolute inset-0 w-full h-full object-cover blur-[100px] opacity-40 scale-125 transition-opacity duration-1000 ${isConnected ? 'opacity-50' : 'opacity-0'}`} 
        />

        {/* 🔝 HEADER BAR */}
        <header className="absolute top-0 w-full h-28 bg-gradient-to-b from-black/90 via-black/50 to-transparent z-30 flex items-start justify-between px-6 pt-6 sm:pt-8 transition-opacity">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-lg text-emerald-400">
              <ShieldCheck size={20} />
            </div>
            <div className="flex flex-col drop-shadow-md">
              <span className="text-white font-bold tracking-wide text-[16px]">Encrypted Tunnel</span>
              <span className="text-emerald-400 text-[12px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                {isConnected ? <><SignalHigh size={12} className="animate-pulse"/> {formatDuration(callDuration)}</> : "Connecting..."}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {document.pictureInPictureEnabled && (
              <button onClick={requestPiP} className="text-white/70 hover:text-white p-2.5 bg-black/40 hover:bg-black/60 rounded-full backdrop-blur-md transition-colors">
                <PictureInPicture size={18}/>
              </button>
            )}
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="text-white/70 hover:text-white p-2.5 bg-black/40 hover:bg-black/60 rounded-full backdrop-blur-md transition-colors hidden sm:block">
              {isFullscreen ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}
            </button>
          </div>
        </header>

        {/* 🎬 REMOTE VIDEO STAGE */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className={`w-full h-full object-cover transition-opacity duration-700 ${isConnected ? 'opacity-100' : 'opacity-0'}`} 
          />
          
          {/* Waiting/Ringing State */}
          {!isConnected && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-10">
              <div className="relative flex items-center justify-center mb-10">
                <div className="absolute w-32 h-32 border-[1.5px] border-emerald-500/40 rounded-full animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                <div className="absolute w-48 h-48 border-[1.5px] border-emerald-500/20 rounded-full animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite]" style={{ animationDelay: '0.5s' }}></div>
                <div className="absolute w-64 h-64 border-[1.5px] border-emerald-500/5 rounded-full animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite]" style={{ animationDelay: '1s' }}></div>
                
                {/* Glowing Avatar Placeholder */}
                <div className="w-24 h-24 bg-gradient-to-br from-zinc-800 to-black border-2 border-emerald-500/50 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.3)] text-emerald-400 z-10">
                  <Loader2 className="animate-spin" size={36} strokeWidth={1.5} />
                </div>
              </div>
              <p className="text-white/90 font-bold tracking-[0.25em] uppercase text-xs animate-pulse">Establishing Signal</p>
            </div>
          )}
        </div>

        {/* 📱 LOCAL VIDEO (MAGNETIC DRAGGABLE PiP) */}
        <motion.div 
          drag 
          dragConstraints={containerRef}
          dragElastic={0.1}
          dragMomentum={true}
          whileDrag={{ scale: 1.05, cursor: "grabbing" }}
          className="absolute top-28 right-4 sm:right-6 w-28 sm:w-32 aspect-[3/4] bg-[#111] rounded-2xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.6)] border border-white/20 z-30 cursor-grab active:cursor-grabbing group"
        >
          <video 
            ref={myVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover transition-all duration-300" 
            style={{ 
              filter: beautyFilter, 
              transform: facingMode === 'user' && !isScreenSharing ? 'scaleX(-1)' : 'none' 
            }} 
          />
          
          {/* Mute Indicator Ring */}
          {isMuted && <div className="absolute inset-0 border-2 border-red-500 rounded-2xl pointer-events-none"></div>}

          {/* Camera Off State */}
          <AnimatePresence>
            {isVideoOff && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#1a1a1a]/95 backdrop-blur-xl flex flex-col items-center justify-center text-white/50 border border-white/5">
                <Camera size={24} className="mb-2 opacity-50" />
                <span className="text-[9px] font-bold uppercase tracking-widest">Paused</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* 🎛️ FLOATING SIDE TOOLBAR (Advanced Features) */}
        <div className="absolute top-1/2 -translate-y-1/2 right-4 sm:right-6 flex flex-col gap-3 z-30 opacity-0 hover:opacity-100 sm:opacity-100 transition-opacity duration-300">
          
          {/* Studio Beauty Mode */}
          <div className="relative group">
            <button onClick={() => setIsEnhanced(!isEnhanced)} className={`p-3 rounded-2xl backdrop-blur-xl border border-white/10 shadow-xl transition-all duration-300 ${isEnhanced ? 'bg-pink-500/20 text-pink-400 border-pink-500/50 shadow-[0_0_20px_rgba(236,72,153,0.3)]' : 'bg-black/60 text-white/70 hover:bg-black/80 hover:text-white'}`}>
              <Sparkles size={20} className={isEnhanced ? "animate-pulse" : ""} />
            </button>
            <span className="absolute right-14 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-black/90 backdrop-blur-md text-white text-[10px] font-bold tracking-widest uppercase rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">Studio Mode</span>
          </div>

          {/* Screen Share */}
          {navigator.mediaDevices?.getDisplayMedia && (
            <div className="relative group">
              <button onClick={toggleScreenShare} className={`p-3 rounded-2xl backdrop-blur-xl border border-white/10 shadow-xl transition-all duration-300 ${isScreenSharing ? 'bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'bg-black/60 text-white/70 hover:bg-black/80 hover:text-white'}`}>
                <MonitorUp size={20} />
              </button>
              <span className="absolute right-14 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-black/90 backdrop-blur-md text-white text-[10px] font-bold tracking-widest uppercase rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">{isScreenSharing ? 'Stop Share' : 'Share Screen'}</span>
            </div>
          )}

          {/* Camera Swap */}
          {!isScreenSharing && (
            <div className="relative group">
              <button onClick={swapCamera} className="p-3 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-xl text-white/70 hover:bg-black/80 hover:text-white transition-all duration-300 active:scale-95">
                <SwitchCamera size={20} />
              </button>
              <span className="absolute right-14 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-black/90 backdrop-blur-md text-white text-[10px] font-bold tracking-widest uppercase rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">Flip Camera</span>
            </div>
          )}
        </div>

        {/* 🔽 MAIN BOTTOM CONTROL DOCK */}
        <div className="absolute bottom-8 sm:bottom-10 w-full flex justify-center z-40 pb-[env(safe-area-inset-bottom)]">
          <div className="bg-black/60 backdrop-blur-3xl border border-white/10 p-2.5 rounded-[2rem] flex items-center gap-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            
            <div className="relative group">
              <button onClick={toggleMute} className={`p-4 rounded-full transition-all duration-300 flex items-center justify-center ${isMuted ? 'bg-white text-black shadow-lg' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
              <span className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/90 text-white text-[10px] font-bold tracking-widest uppercase rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">{isMuted ? 'Unmute' : 'Mute'}</span>
            </div>

            <div className="relative group">
              <button onClick={toggleVideo} className={`p-4 rounded-full transition-all duration-300 flex items-center justify-center ${isVideoOff ? 'bg-white text-black shadow-lg' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                {isVideoOff ? <VideoOff size={24} /> : <Camera size={24} />}
              </button>
              <span className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/90 text-white text-[10px] font-bold tracking-widest uppercase rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">{isVideoOff ? 'Start Video' : 'Stop Video'}</span>
            </div>

            <div className="w-px h-8 bg-white/20 mx-1"></div>

            <div className="relative group">
              <button onClick={endCall} className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition-all duration-300 shadow-[0_0_30px_rgba(239,68,68,0.6)] hover:shadow-[0_0_40px_rgba(239,68,68,0.8)] text-white flex items-center justify-center ml-1 active:scale-90">
                <PhoneOff size={24} />
              </button>
              <span className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/90 text-white text-[10px] font-bold tracking-widest uppercase rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">End Call</span>
            </div>

          </div>
        </div>

      </motion.div>
    </div>
  );
}
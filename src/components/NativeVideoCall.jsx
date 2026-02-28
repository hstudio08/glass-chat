import React, { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import { Video, PhoneOff, Mic, MicOff, VideoOff, Camera } from 'lucide-react';

export default function NativeVideoCall({ chatId, myRole, onClose }) {
  const [peer, setPeer] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const myVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

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
        alert("Camera and Microphone access is required.");
        onClose();
      });

    setPeer(initPeer);

    return () => {
      initPeer.destroy();
      if (myStream) myStream.getTracks().forEach(track => track.stop());
    };
  }, [chatId, myRole]);

  const toggleMute = () => {
    if (myStream) {
      const audioTrack = myStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    if (myStream) {
      const videoTrack = myStream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const endCall = () => {
    if (peer) peer.destroy();
    if (myStream) myStream.getTracks().forEach(track => track.stop());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black flex flex-col font-sans">
      <div className="h-16 flex items-center justify-between px-6 bg-[#1a1a1a] border-b border-white/10 z-20 absolute top-0 w-full">
        <span className="text-white font-bold flex items-center gap-2"><Video size={20} className="text-emerald-400"/> Secure A/V Tunnel</span>
      </div>

      <div className="flex-1 relative bg-zinc-900 flex items-center justify-center pt-16 pb-24">
        {/* Remote Video (Big) */}
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

        {/* Local Video (Small Picture-in-Picture) */}
        <div className="absolute bottom-28 right-6 w-32 sm:w-48 aspect-[3/4] bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 z-10">
          <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {isVideoOff && <div className="absolute inset-0 bg-zinc-800 flex items-center justify-center"><Camera className="text-white/50" size={32} /></div>}
        </div>

        {/* Waiting State */}
        {!isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md">
            <Loader2 className="animate-spin text-emerald-400 mb-4" size={48} />
            <p className="text-white font-bold tracking-widest uppercase">Awaiting Connection...</p>
          </div>
        )}
      </div>

      {/* Floating Control Dock */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-xl border border-white/20 p-2 sm:p-3 rounded-full flex gap-2 sm:gap-4 shadow-2xl z-20">
        <button onClick={toggleMute} className={`p-3 sm:p-4 rounded-full transition-colors ${isMuted ? 'bg-amber-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`}>
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <button onClick={toggleVideo} className={`p-3 sm:p-4 rounded-full transition-colors ${isVideoOff ? 'bg-amber-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`}>
          {isVideoOff ? <VideoOff size={20} /> : <Camera size={20} />}
        </button>
        <button onClick={endCall} className="p-3 sm:p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors ml-2 sm:ml-4">
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
}
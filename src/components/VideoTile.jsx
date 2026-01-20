import { useRef, useEffect } from "react";

export default function VideoTile({ stream, name }) {
  const videoRef = useRef(null);
  const displayName = name || "Unknown User";

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-black rounded-3xl flex flex-col items-center justify-center text-white shadow-2xl border border-white/10 relative overflow-hidden group hover:scale-105 transition-all duration-500 ring-1 ring-white/5">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          className="w-full h-full object-cover rounded-3xl scale-x-[-1]"
        />
      ) : (
        <>
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 animate-pulse"></div>
          
          {/* Avatar */}
          <div className="w-24 h-24 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center text-3xl font-black mb-6 shadow-2xl relative z-10 ring-4 ring-white/20 group-hover:ring-white/40 transition-all duration-500">
            {displayName.charAt(0).toUpperCase()}
          </div>
          
          {/* Name */}
          <h3 className="text-2xl font-black mb-4 relative z-10 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">{displayName}</h3>
          
          {/* Status indicator */}
          <div className="flex items-center gap-3 text-lg text-white/80 relative z-10 font-semibold">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
            <span>CONNECTED</span>
          </div>
          
          {/* Video placeholder overlay */}
          <div className="absolute inset-6 bg-black/40 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/10">
            <div className="text-white/30 text-6xl">📹</div>
          </div>
          
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
        </>
      )}
    </div>
  );
}
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Home() {
  const navigate = useNavigate();
  const [joinRoomId, setJoinRoomId] = useState("");

  const createRoom = async () => {
    console.log("Creating room...");
    const roomId = crypto.randomUUID();
    console.log("Generated room ID:", roomId);
    setJoinRoomId(roomId);
    try {
      await navigator.clipboard.writeText(roomId);
      console.log("Room ID copied to clipboard");
    } catch (error) {
      console.error("Failed to copy room ID:", error);
    }
  };

  const joinRoom = () => {
    if (!joinRoomId.trim()) return alert("Please enter a room ID.");
    navigate(`/room/${joinRoomId}/premeeting`);
  };

  return (
    <div className="w-screen h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">

      {/* Header */}
      <header className="w-full flex justify-between items-center gap-4 px-4 py-3 bg-black/20 backdrop-blur-xl shadow-lg sticky top-0 z-20 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
            <div className="w-3 h-3 border-2 border-white rounded-sm"></div>
          </div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            CONVO
          </h1>
        </div>

 main
        <div>
          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur rounded-full border border-white/20">
                <div className="w-5 h-5 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                  {user.email ? user.email.charAt(0).toUpperCase() : "U"}
                </div>
                <span className="text-white font-medium text-xs">{user.email?.split('@')[0] || 'User'}</span>
              </div>
              <button
                onClick={logout}
                className="px-2 py-1 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 font-medium hover:bg-red-600/30 transition-all text-xs"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={openLogin}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold hover:from-cyan-700 hover:to-blue-700 shadow-lg transition-all text-sm"
            >
              Sign In
            </button>
          )}

        <div className="w-full sm:w-auto">
          <div className="text-white text-sm sm:text-base font-medium">
            Video Call App
          </div>
 main
        </div>
      </header>

      {/* Animated Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-cyan-500/30 to-blue-500/30 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-blue-500/30 to-purple-500/30 rounded-full filter blur-3xl animate-pulse animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full filter blur-2xl animate-bounce"></div>
      </div>

      {/* Floating Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-4 h-4 bg-cyan-400/60 rounded-full animate-bounce"></div>
        <div className="absolute top-40 right-20 w-6 h-6 bg-blue-400/60 rounded-full animate-pulse"></div>
        <div className="absolute bottom-32 left-20 w-3 h-3 bg-purple-400/60 rounded-full animate-ping"></div>
        <div className="absolute bottom-20 right-32 w-5 h-5 bg-pink-400/60 rounded-full animate-bounce"></div>
        <div className="absolute top-60 left-1/3 w-2 h-2 bg-emerald-400/60 rounded-full animate-pulse"></div>
        <div className="absolute bottom-40 right-1/4 w-4 h-4 bg-yellow-400/60 rounded-full animate-ping"></div>
      </div>

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center flex-1 gap-3 px-4 py-2 relative z-10 overflow-y-auto min-h-0">

        <div className="text-center space-y-1 max-w-2xl animate-fade-in">
          <h2 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-white via-cyan-200 to-blue-300 bg-clip-text text-transparent leading-tight">
            Video Meetings
          </h2>
          <p className="text-gray-300 text-xs sm:text-sm font-light px-2">
            Secure meetings for teams
          </p>
        </div>

        <div className="w-full max-w-2xl">
          <div className="bg-white/10 backdrop-blur-xl rounded-xl p-3 border border-white/20 shadow-xl">
            <div className="flex flex-col gap-3">
              
              {/* Create Meeting */}
              <div className="w-full">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <span className="w-4 h-4 bg-green-500 rounded text-xs flex items-center justify-center text-white">+</span>
                  New Meeting
                </h3>
                <button
                  onClick={createRoom}
                  className="w-full py-2 px-4 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold hover:from-green-600 hover:to-emerald-700 transition-all text-sm"
                >
                  Create
                </button>
                
                {joinRoomId && (
                  <div className="mt-2 p-2 bg-green-500/10 rounded-lg border border-green-400/30">
                    <p className="text-green-300 font-semibold text-xs mb-1">Created</p>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={joinRoomId}
                        readOnly
                        className="flex-1 py-1 px-2 rounded bg-white/10 text-white font-mono text-xs"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(joinRoomId);
                          alert('Copied');
                        }}
                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                      >
                        Copy
                      </button>
                    </div>
                    <button
 main
                      onClick={() => navigate(`/room/${joinRoomId}`)}
                      className="w-full mt-1 py-1 bg-blue-600 text-white rounded text-xs font-bold"

                      onClick={() => navigate(`/room/${joinRoomId}/premeeting`)}
                      className="w-full mt-2 py-2 px-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all text-sm"
 main
                    >
                      Join
                    </button>
                  </div>
                )}
              </div>

              <div className="h-px bg-white/20"></div>

              {/* Join Meeting */}
              <div className="w-full">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <span className="w-4 h-4 bg-blue-500 rounded text-xs flex items-center justify-center text-white">→</span>
                  Join Meeting
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Meeting ID"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    className="flex-1 py-2 px-3 rounded-lg border border-white/20 focus:outline-none focus:border-blue-400 bg-white/10 text-white placeholder-gray-400 text-xs"
                  />
                  <button
                    onClick={joinRoom}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold hover:from-blue-600 hover:to-purple-700 text-xs"
                  >
                    Join
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>

      </main>

    </div>
  );
}

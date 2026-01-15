import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import LoginModal from "../components/LoginModal";
import { auth } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

export default function Home() {
  const navigate = useNavigate();
  const [joinRoomId, setJoinRoomId] = useState("");
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const createRoom = () => {
    const roomId = crypto.randomUUID();
    setJoinRoomId(roomId);
    navigator.clipboard.writeText(roomId);
  };

  const joinRoom = () => {
    if (!joinRoomId.trim()) return alert("Please enter a room ID.");
    navigate(`/room/${joinRoomId}`);
  };

  const openLogin = () => setIsLoginOpen(true);
  const closeLogin = () => setIsLoginOpen(false);
  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <div className="w-screen h-screen bg-gradient-to-b from-blue-50 to-white relative overflow-hidden">

      {/* Header */}
      <header className="w-full flex justify-between items-center px-6 py-4 bg-white shadow-md sticky top-0 z-20">
        <h1 className="text-2xl font-bold text-blue-600">VideoCallApp</h1>

        <div>
          {user ? (
            <div className="flex items-center gap-2 text-blue-600 font-bold text-lg">
              {/* Show first letter of email */}
              {user.email ? user.email.charAt(0).toUpperCase() : "U"}

              <button
                onClick={logout}
                className="py-1 px-3 rounded-xl bg-white border border-blue-600 text-blue-600 font-semibold hover:bg-blue-50 transition"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={openLogin}
              className="py-2 px-4 rounded-xl bg-blue-600 text-blue-600 font-semibold hover:bg-blue-700 transition"
            >
              Login
            </button>
          )}
        </div>
      </header>

      {/* Background shapes */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>

      {/* Hero / Body */}
      <main className="flex flex-col items-center justify-center h-[calc(100vh-72px)] gap-8 px-4 z-10">

        <h2 className="text-5xl md:text-6xl font-bold text-blue-600 text-center">
          Start or Join a Video Meeting
        </h2>

        <p className="text-gray-600 text-lg md:text-xl text-center max-w-2xl">
          Simple, fast, and secure. Works on desktop and mobile.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xl justify-center">

          <button
            onClick={createRoom}
            className="flex-1 py-4 rounded-xl bg-blue-600 text-blue-600 font-semibold hover:bg-blue-700 transition"
          >
            New Meeting
          </button>

          <div className="flex flex-1 gap-2">
            <input
              type="text"
              placeholder="Enter Room ID"
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              className="flex-1 py-3 px-4 rounded-xl border border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={joinRoom}
              className="py-3 px-6 rounded-xl bg-blue-600 text-blue-600 font-semibold hover:bg-blue-700 transition"
            >
              Join
            </button>
          </div>

        </div>

        <p className="text-gray-400 text-sm mt-4 text-center">
          Click 'New Meeting' to get a link that you can share with others.
        </p>
      </main>

      {/* Login modal */}
      <LoginModal isOpen={isLoginOpen} onClose={closeLogin} />

    </div>
  );
}

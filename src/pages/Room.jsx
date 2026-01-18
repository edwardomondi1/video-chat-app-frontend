import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import VideoTile from "../components/VideoTile";
import ControlButton from "../components/ControlButton";

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  // Local media state
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
 main
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [focusedVideo, setFocusedVideo] = useState(null);

 main
  const localVideoRef = useRef(null);

 main
  // chat state
  // WebRTC state
  const [remoteStreams, setRemoteStreams] = useState([]);
  const peerConnectionsRef = useRef({});
  const socketRef = useRef(null);

  // Chat state
 main
  const [messages, setMessages] = useState([
    { sender: "System", text: "Welcome to the room" },
  ]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef(null);

 main
  // WebSocket signaling
  const socketRef = useRef(null);
  const peerConnections = useRef({});
  
  // WebRTC configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };
  
  // Create peer connection
  const createPeerConnection = async (userId) => {
    const peerConnection = new RTCPeerConnection(rtcConfig);
    peerConnections.current[userId] = peerConnection;
    
    // Add local stream to peer connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }
    
    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('Received remote stream from:', userId);
      const [remoteStream] = event.streams;
      setRemoteStreams(prev => {
        const existing = prev.find(s => s.id === userId);
        if (existing) {
          return prev.map(s => s.id === userId ? { ...s, stream: remoteStream } : s);
        } else {
          return [...prev, { id: userId, name: `User ${userId.slice(0, 8)}`, stream: remoteStream }];
        }
      });
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice_candidate', {
          candidate: event.candidate,
          to: userId
        });
      }
    };
    
    return peerConnection;
  };
  
  // Handle offer
  const handleOffer = async (offer, fromUserId) => {
    try {
      const peerConnection = await createPeerConnection(fromUserId);
      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      if (socketRef.current) {
        socketRef.current.emit('answer', {
          answer: answer,
          to: fromUserId
        });
      }
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };
  
  // Handle answer
  const handleAnswer = async (answer, fromUserId) => {
    try {
      const peerConnection = peerConnections.current[fromUserId];
      if (peerConnection) {
        await peerConnection.setRemoteDescription(answer);
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };
  
  // Handle ICE candidate
  const handleIceCandidate = async (candidate, fromUserId) => {
    try {
      const peerConnection = peerConnections.current[fromUserId];
      if (peerConnection) {
        await peerConnection.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };


 main
  // Get user media on component mount
  useEffect(() => {
    const getUserMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing camera/microphone:", error);
        alert("Could not access camera/microphone. Please check permissions.");
      }
    };

    getUserMedia();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Update video element when stream changes
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

 main
  // Socket connection
  useEffect(() => {
    if (!localStream) return;
    
    const serverUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:5001";
    socketRef.current = io(serverUrl);
    
    console.log("Connecting to signaling server:", serverUrl);
    
    // Join room
    socketRef.current.emit('join_room', {
      roomId: roomId,
      userName: 'User'
    });
    
    // Listen for other users
    socketRef.current.on('user_joined', async (data) => {
      console.log('User joined:', data);
      const peerConnection = await createPeerConnection(data.userId);
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      socketRef.current.emit('offer', {
        offer: offer,
        to: data.userId
      });
    });
    
    socketRef.current.on('user_left', (data) => {
      console.log('User left:', data);
      setRemoteStreams(prev => prev.filter(stream => stream.id !== data.userId));
      if (peerConnections.current[data.userId]) {
        peerConnections.current[data.userId].close();
        delete peerConnections.current[data.userId];
      }
    });
    
    // WebRTC signaling
    socketRef.current.on('offer', async (data) => {
      console.log('Received offer from:', data.from);
      await handleOffer(data.offer, data.from);
    });
    
    socketRef.current.on('answer', async (data) => {
      console.log('Received answer from:', data.from);
      await handleAnswer(data.answer, data.from);
    });
    
    socketRef.current.on('ice_candidate', async (data) => {
      console.log('Received ICE candidate from:', data.from);
      await handleIceCandidate(data.candidate, data.from);
    });
    
    // Chat messages
    socketRef.current.on('chat_message', (data) => {
      setMessages(prev => [...prev, {
        sender: data.sender,
        text: data.message
      }]);
    });
    
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_room', { roomId });
        socketRef.current.disconnect();
      }
      Object.values(peerConnections.current).forEach(pc => pc.close());
      peerConnections.current = {};
    };
  }, [roomId, localStream]);

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);

  // Socket.IO and WebRTC setup
  useEffect(() => {
    const serverUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
    socketRef.current = io(serverUrl);

    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("Connected to signaling server");
      // For development, use a simple user ID
      const userId = `user_${socket.id}`;
      socket.emit("join_room", { room_id: roomId, token: userId });
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from signaling server");
    });

    // WebRTC signaling
    socket.on("offer", async (data) => {
      const { offer, from } = data;
      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current.emit("answer", { answer, room_id: roomId, token: `user_${socketRef.current.id}` });
    });

    socket.on("answer", async (data) => {
      const { answer, from } = data;
      const pc = peerConnectionsRef.current[from];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
 main
      }
    });

    socket.on("ice_candidate", (data) => {
      const { candidate, from } = data;
      const pc = peerConnectionsRef.current[from];
      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

 main
  const toggleVideoFocus = (videoType) => {
    if (focusedVideo === videoType) {
      setFocusedVideo(null); // Return to grid view
    } else {
      setFocusedVideo(videoType); // Focus on this video
    }
  };

  const toggleRecording = () => {
    if (!localStream) return;

    if (!isRecording) {
      recordedChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(localStream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `video-call-${roomId}-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } else {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();

    socket.on("user_joined", (data) => {
      const { user_id } = data;
      if (user_id !== socket.id) {
        createPeerConnection(user_id);
      }
    });

    socket.on("user_left", (data) => {
      const { user_id } = data;
      if (peerConnectionsRef.current[user_id]) {
        peerConnectionsRef.current[user_id].close();
        delete peerConnectionsRef.current[user_id];
        setRemoteStreams((prev) => prev.filter((s) => s.id !== user_id));
      }
    });

    socket.on("chat_message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on("error", (data) => {
      console.error("Socket error:", data.message);
      alert(data.message);
    });

    // Cleanup function
    return () => {
      socket.disconnect();
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
 main
      }
    };
  }, [roomId, localStream]);

  const createPeerConnection = (userId) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peerConnectionsRef.current[userId] = pc;

    // Add local stream
    if (localStream) {
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("ice_candidate", {
          candidate: event.candidate,
          room_id: roomId,
          token: `user_${socketRef.current.id}`,
        });
 main
        
        // Stop current stream
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
        }
        
        setLocalStream(screenStream);
        setIsScreenSharing(true);
        
        // Update peer connections with new stream
        Object.values(peerConnections.current).forEach(peerConnection => {
          screenStream.getTracks().forEach(track => {
            const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === track.kind);
            if (sender) {
              sender.replaceTrack(track);
            } else {
              peerConnection.addTrack(track, screenStream);
            }
          });
        });
        
        screenStream.getVideoTracks()[0].onended = () => {
          stopScreenShare();
        };
      } else {
        stopScreenShare()
 main
      }
    };

 main
  const stopScreenShare = async () => {
    try {
      // Stop screen sharing, go back to camera
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      setIsScreenSharing(false);
      
      // Get camera stream
      const cameraStream = await getUserMedia();
      if (cameraStream) {
        setLocalStream(cameraStream);
        setIsCameraOn(true); // Reset camera state
        setIsMicOn(true);    // Reset mic state
      }
    } catch (error) {
      console.error('Error stopping screen share:', error);
    }
  };

  const getUserMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      // Update peer connections with camera stream
      Object.values(peerConnections.current).forEach(peerConnection => {
        stream.getTracks().forEach(track => {
          const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track);
          } else {
            peerConnection.addTrack(track, stream);
          }
        });
      });
      
      return stream;
    } catch (error) {
      console.error('Error accessing camera:', error);
      return null;
    }
  };

  const sendMessage = () => {
    if (!input.trim()) return;

    if (socketRef.current) {
      socketRef.current.emit('chat_message', {
        message: input,
        timestamp: Date.now()
      });
    }
    
    setMessages((prev) => [...prev, { sender: "You", text: input }]);
    setInput("");
  };

  // Dynamic grid layout
  const getGridLayout = () => {
    const totalUsers = 1 + remoteStreams.length;
    if (totalUsers === 1) return "grid-cols-1";
    if (totalUsers === 2) return "grid-cols-1 lg:grid-cols-2";
    if (totalUsers <= 4) return "grid-cols-2";
    return "grid-cols-2 lg:grid-cols-3";
  };

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => [
        ...prev.filter((s) => s.id !== userId),
        { id: userId, stream: event.streams[0] },
      ]);
    };

    // Create offer if we're the initiator
    if (Object.keys(peerConnectionsRef.current).length === 1) {
      pc.createOffer().then((offer) => {
        pc.setLocalDescription(offer);
        socketRef.current.emit("offer", { offer, room_id: roomId, token: `user_${socketRef.current.id}` });
      });
    }

    return pc;
  };

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const sendMessage = () => {
    if (!input.trim()) return;

    const message = { sender: "You", text: input };
    setMessages((prev) => [...prev, message]);
    socketRef.current.emit("chat_message", { ...message, room_id: roomId });
    setInput("");
  };

  // Scroll to bottom when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
 main

  const allStreams = [
    { id: "local", stream: localStream, name: "You" },
    ...remoteStreams.map((rs) => ({ ...rs, name: `User ${rs.id.slice(0, 4)}` })),
  ];

  return (
 main
    <div className="w-screen h-screen bg-gray-900 flex flex-col relative overflow-hidden">
      

    <div className="w-screen h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col relative overflow-hidden">

      {/* Background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full filter blur-3xl animate-pulse animation-delay-2000"></div>
      </div>

 main
      {/* Header */}
      <header className="bg-gray-800 shadow-sm px-2 py-0.5 border-b border-gray-700 relative z-10 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
              <div className="w-1.5 h-1.5 border border-white rounded-sm"></div>
            </div>
            <div>
              <h1 className="text-xs font-semibold text-white">CONVO</h1>
            </div>
          </div>
 main
          
          <div className="flex items-center">
            <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-700 rounded border border-gray-600">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
              <span className="text-white font-medium text-xs">{1 + remoteStreams.length}</span>


          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
            <div className="flex items-center gap-1 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 bg-white/10 backdrop-blur rounded-lg border border-white/20">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-white font-medium">{allStreams.length} users</span>
 main
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative min-h-0">

        {/* Video Grid */}
        <div className="flex-1 p-2 sm:p-4 min-h-0">
 main
          {focusedVideo ? (
            // Focused video view
            <div className="h-full">
              {focusedVideo === 'local' ? (
                // Focused local video
                <div className="relative bg-gray-800 rounded-lg overflow-hidden border border-gray-700 shadow-lg h-full">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  
                  <div className="absolute top-2 left-2 flex gap-1">
                    <div className="px-2 py-1 bg-black/70 backdrop-blur-sm rounded-md text-white text-xs font-medium">
                      You (Focused)
                    </div>
                    {!isCameraOn && (
                      <div className="px-2 py-1 bg-red-600/90 backdrop-blur-sm rounded-md text-white text-xs font-medium">
                        Camera off
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => toggleVideoFocus('local')}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/70 backdrop-blur-sm rounded-md flex items-center justify-center text-white hover:bg-black/80 transition-colors text-sm"
                  >
                    ⛶
                  </button>
                  
                  {!isCameraOn && (
                    <div className="absolute inset-0 bg-gray-900/90 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-20 h-20 bg-gray-600 rounded-full flex items-center justify-center font-semibold mb-2 mx-auto text-white text-2xl">
                          Y
                        </div>
                        <p className="text-gray-300 text-lg">Camera is off</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Focused remote video
                <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg overflow-hidden border border-white/10 shadow-xl h-full">
                  {remoteStreams.find(user => user.id === focusedVideo)?.stream ? (
                    <video
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                      ref={(videoEl) => {
                        const user = remoteStreams.find(u => u.id === focusedVideo);
                        if (videoEl && user?.stream) {
                          videoEl.srcObject = user.stream;
                        }
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-2xl font-bold mb-4 mx-auto text-white">
                          {remoteStreams.find(user => user.id === focusedVideo)?.name?.charAt(0) || 'U'}
                        </div>
                        <p className="text-white text-lg">{remoteStreams.find(user => user.id === focusedVideo)?.name || 'User'} (Focused)</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="absolute top-2 left-2">
                    <div className="px-2 py-1 bg-black/60 backdrop-blur rounded-full text-white text-xs font-medium">
                      {remoteStreams.find(user => user.id === focusedVideo)?.name || 'User'} (Focused)
                    </div>
                  </div>
                  
                  <button
                    onClick={() => toggleVideoFocus(focusedVideo)}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur rounded-lg flex items-center justify-center text-white hover:bg-black/80 transition-all text-sm"
                  >
                    ⛶
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Normal grid view
            <div className={`grid ${getGridLayout()} gap-2 sm:gap-4 h-full`}>
              
              {/* Local Video */}
              <div 
                className="relative bg-gray-800 rounded-lg overflow-hidden border border-gray-700 shadow-lg aspect-video cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => toggleVideoFocus('local')}
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                
                <div className="absolute top-2 left-2 flex gap-1">
                  <div className="px-2 py-1 bg-black/70 backdrop-blur-sm rounded-md text-white text-xs font-medium">
                    {isScreenSharing ? "Screen" : "You"}
                  </div>
                  {!isCameraOn && !isScreenSharing && (
                    <div className="px-2 py-1 bg-red-600/90 backdrop-blur-sm rounded-md text-white text-xs font-medium">
                      Camera off
                    </div>
                  )}
                  {isScreenSharing && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleScreenShare();
                      }}
                      className="px-2 py-1 bg-red-600/90 backdrop-blur-sm rounded-md text-white text-xs font-medium hover:bg-red-700/90 transition-colors"
                    >
                      Stop Sharing
                    </button>
                  )}
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVideoFocus('local');
                  }}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/70 backdrop-blur-sm rounded-md flex items-center justify-center text-white hover:bg-black/80 transition-colors text-sm"
                  title="Focus Video"
                >
                  ⛶
                </button>
                
                {!isCameraOn && !isScreenSharing && (
                  <div className="absolute inset-0 bg-gray-900/90 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center font-semibold mb-2 mx-auto text-white text-xl">
                        Y
                      </div>
                      <p className="text-gray-300 text-sm">Camera is off</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Remote Users */}
              {remoteStreams.map((user) => (
                <div 
                  key={user.id} 
                  className="relative aspect-video bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg overflow-hidden border border-white/10 shadow-xl flex items-center justify-center cursor-pointer hover:border-blue-500 transition-colors"
                  onClick={() => toggleVideoFocus(user.id)}
                >
                  {user.stream ? (
                    <video
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                      ref={(videoEl) => {
                        if (videoEl && user.stream) {
                          videoEl.srcObject = user.stream;
                        }
                      }}
                    />
                  ) : (
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-xl font-bold mb-3 mx-auto text-white">
                        {user.name.charAt(0)}
                      </div>
                      <p className="text-white/80 text-base">{user.name}</p>
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <div className="px-2 py-1 bg-black/60 backdrop-blur rounded-full text-white text-xs font-medium">
                      {user.name}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVideoFocus(user.id);
                    }}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur rounded-lg flex items-center justify-center text-white hover:bg-black/80 transition-all text-sm"
                    title="Focus Video"
                  >
                    ⛶
                  </button>
                </div>
              ))}
              
            </div>
          )}
        </div>

        {/* Chat Sidebar */}
        <div className="hidden lg:flex w-64 bg-gray-800 border-l border-gray-700 flex-col shadow-lg min-h-0">
          
=======
          <div className={`grid gap-2 sm:gap-4 h-full ${
            allStreams.length === 1 ? 'grid-cols-1' :
            allStreams.length === 2 ? 'grid-cols-1 lg:grid-cols-2' :
            'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
          }`}>
            {allStreams.map((tile) => (
              <VideoTile key={tile.id} stream={tile.stream} name={tile.name} />
            ))}
          </div>
        </div>

        {/* Chat Sidebar - Hidden on mobile */}
        <div className="hidden lg:flex w-80 bg-black/40 backdrop-blur-xl border-l border-white/10 flex-col shadow-xl min-h-0">

 main
          {/* Chat Header */}
          <div className="p-3 border-b border-gray-700 flex-shrink-0 bg-gray-750">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-xs text-white">💬</span>
              </div>
              Chat
            </h3>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-850 scroll-smooth" style={{paddingTop: '12px'}}>
            {messages.map((msg, i) => {
              const isYou = msg.sender === "You";
              const isSystem = msg.sender === "System";

              if (isSystem) {
                return (
                  <div key={i} className="text-center py-1">
                    <div className="px-3 py-1 bg-blue-600/20 border border-blue-500/30 rounded-lg text-blue-300 text-xs inline-block">
                      {msg.text}
                    </div>
                  </div>
                );
              }

              return (
                <div key={i} className={`flex ${isYou ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[75%]">
                    {!isYou && (
                      <div className="text-xs text-gray-400 mb-1 px-1 font-medium">
                        {msg.sender}
                      </div>
                    )}
                    <div
                      className={`px-3 py-2 rounded-lg text-xs shadow-sm ${
                        isYou
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-gray-700 text-white rounded-bl-sm border border-gray-600"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef}></div>
          </div>

          {/* Message Input */}
          <div className="p-3 border-t border-gray-700 flex-shrink-0 bg-gray-750">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 text-white placeholder-gray-400 text-xs transition-colors"
              />
              <button
                onClick={sendMessage}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 text-xs transition-colors flex items-center gap-1"
              >
                <span>Send</span>
                <span className="text-xs">↗</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
 main
      <div className="p-3 bg-gray-800 border-t border-gray-700 flex-shrink-0">
        <div className="flex justify-center items-center gap-3">
          <div className="flex items-center gap-2">
            <ControlButton type="mute" isActive={isMicOn} onClick={toggleMic} />
            <ControlButton type="camera" isActive={isCameraOn} onClick={toggleCamera} />
          </div>
          
          <div className="flex items-center gap-2">
            <ControlButton type="screen" isActive={isScreenSharing} onClick={toggleScreenShare} />
            <ControlButton type="record" isActive={isRecording} onClick={toggleRecording} />
          </div>
          
          <div className="flex items-center">
            <ControlButton type="leave" onClick={() => {
              if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
              }
              navigate("/");
            }} />
          </div>

      <div className="p-2 sm:p-4 bg-black/30 backdrop-blur-xl border-t border-white/10 flex-shrink-0">
        <div className="flex justify-center gap-1 sm:gap-3">
          <ControlButton type="mute" isActive={isMicOn} onClick={toggleMic} />
          <ControlButton type="camera" isActive={isCameraOn} onClick={toggleCamera} />
          <ControlButton
            type="leave"
            onClick={() => {
              if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
              }
              if (socketRef.current) {
                socketRef.current.emit("leave_room", { room_id: roomId });
              }
              navigate("/");
            }}
          />
 main
        </div>
      </div>
    </div>
  );
}

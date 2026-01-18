import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import VideoTile from "../components/VideoTile";
import ControlButton from "../components/ControlButton";

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [focusedVideo, setFocusedVideo] = useState(null);
  const localVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const [messages, setMessages] = useState([
    { sender: "System", text: "Welcome to the room" },
  ]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef(null);

  const socketRef = useRef(null);
  const peerConnections = useRef({});
  
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };
  
  const createPeerConnection = async (userId) => {
    const peerConnection = new RTCPeerConnection(rtcConfig);
    peerConnections.current[userId] = peerConnection;
    
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }
    
    peerConnection.ontrack = (event) => {
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

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (!localStream) return;
    
    const serverUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:5001";
    socketRef.current = io(serverUrl);
    
    socketRef.current.emit('join_room', {
      roomId: roomId,
      userName: 'User'
    });
    
    socketRef.current.on('user_joined', async (data) => {
      const peerConnection = await createPeerConnection(data.userId);
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      socketRef.current.emit('offer', {
        offer: offer,
        to: data.userId
      });
    });
    
    socketRef.current.on('user_left', (data) => {
      setRemoteStreams(prev => prev.filter(stream => stream.id !== data.userId));
      if (peerConnections.current[data.userId]) {
        peerConnections.current[data.userId].close();
        delete peerConnections.current[data.userId];
      }
    });
    
    socketRef.current.on('offer', async (data) => {
      await handleOffer(data.offer, data.from);
    });
    
    socketRef.current.on('answer', async (data) => {
      await handleAnswer(data.answer, data.from);
    });
    
    socketRef.current.on('ice_candidate', async (data) => {
      await handleIceCandidate(data.candidate, data.from);
    });
    
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

  const toggleVideoFocus = (videoType) => {
    if (focusedVideo === videoType) {
      setFocusedVideo(null);
    } else {
      setFocusedVideo(videoType);
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
      }
      setIsRecording(false);
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
        }
        
        setLocalStream(screenStream);
        setIsScreenSharing(true);
        
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
        stopScreenShare();
      }
    } catch (error) {
      console.error('Error sharing screen:', error);
    }
  };

  const stopScreenShare = async () => {
    try {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      setIsScreenSharing(false);
      
      const cameraStream = await getUserMedia();
      if (cameraStream) {
        setLocalStream(cameraStream);
        setIsCameraOn(true);
        setIsMicOn(true);
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

  const getGridLayout = () => {
    const totalUsers = 1 + remoteStreams.length;
    if (totalUsers === 1) return "grid-cols-1";
    if (totalUsers === 2) return "grid-cols-1 lg:grid-cols-2";
    if (totalUsers <= 4) return "grid-cols-2";
    return "grid-cols-2 lg:grid-cols-3";
  };

  return (
    <div className="w-screen h-screen bg-gray-900 flex flex-col relative overflow-hidden">
      
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
          
          <div className="flex items-center">
            <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-700 rounded border border-gray-600">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
              <span className="text-white font-medium text-xs">{1 + remoteStreams.length}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative min-h-0">
        
        <div className="flex-1 p-2 sm:p-4 min-h-0">
          <div className={`grid ${getGridLayout()} gap-2 sm:gap-4 h-full`}>
            
            <div className="relative bg-gray-800 rounded-lg overflow-hidden border border-gray-700 shadow-lg aspect-video">
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
                    onClick={toggleScreenShare}
                    className="px-2 py-1 bg-red-600/90 backdrop-blur-sm rounded-md text-white text-xs font-medium hover:bg-red-700/90 transition-colors"
                  >
                    Stop Sharing
                  </button>
                )}
              </div>
              
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
            
            {remoteStreams.map((user) => (
              <div key={user.id} className="relative aspect-video bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg overflow-hidden border border-white/10 shadow-xl flex items-center justify-center">
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
              </div>
            ))}
            
          </div>
        </div>

        <div className="hidden lg:flex w-64 bg-gray-800 border-l border-gray-700 flex-col shadow-lg min-h-0">
          
          <div className="p-3 border-b border-gray-700 flex-shrink-0 bg-gray-750">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-xs text-white">💬</span>
              </div>
              Chat
            </h3>
          </div>

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
        </div>
      </div>
    </div>
  );
}
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import VideoTile from "../components/VideoTile";
import ControlButton from "../components/ControlButton";
import { auth } from "../firebase";
import { getIdToken } from "firebase/auth";

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const [socketConnectionStatus, setSocketConnectionStatus] = useState('connecting');
  const [showRetryButton, setShowRetryButton] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [lastErrorType, setLastErrorType] = useState(null);
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

  const connectSocket = async () => {
      const isDevelopment = import.meta.env.DEV;
      const serverUrl = isDevelopment ? window.location.origin : (import.meta.env.VITE_SOCKET_URL || "https://video-call-app-backend.onrender.com");
      const user = auth?.currentUser;
      let token = null;
      if (user && auth) {
        try {
          token = await getIdToken(user);
        } catch (error) {
          console.error('Error getting auth token:', error);
        }
      }

      console.log('Attempting to connect to backend:', serverUrl);
      if (isDevelopment) {
        console.log('Development mode: Using local proxy to connect to Render.com backend');
      }

      // Add Render.com specific logging
      console.log('Socket.IO config for Render.com:', {
        transports: ['polling', 'websocket'],
        timeout: 20000,
        reconnectionAttempts: 5,
        path: '/socket.io/',
        withCredentials: true
      });

      // Check WebSocket support
      if (!window.WebSocket) {
        console.warn('WebSocket not supported by browser, using polling only');
        setMessages(prev => [...prev, {
          sender: "System",
          text: "WebSocket not supported - using HTTP polling fallback"
        }]);
      }

      // Chrome-specific error detection
      const isChrome = navigator.userAgent.includes('Chrome') && !navigator.userAgent.includes('Edg');
      if (isChrome) {
        console.log('Chrome browser detected - enabling Chrome-specific error handling');

        // Check for Chrome extension interference
        if (window.chrome && window.chrome.runtime) {
          console.log('Chrome extensions detected - monitoring for extension interference');
        }

        // Check for service worker interference
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(registrations => {
            if (registrations.length > 0) {
              console.log('Service workers detected - monitoring for SW interference');
            }
          });
        }
      }

      socketRef.current = io(serverUrl, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
        timeout: 20000,
        forceNew: true,
        // Prefer polling for Render.com compatibility
        transports: ['polling', 'websocket'],
        upgrade: true,
        rememberUpgrade: true,
        // Render.com specific configurations
        path: '/socket.io/',
        // Add ping/pong for connection stability
        pingInterval: 25000,
        pingTimeout: 20000,
        // CORS handling
        withCredentials: true,
        auth: token ? { token } : undefined,
        // Additional options for Render.com and polling stability
        // Polling-specific options to handle xhr poll errors
        polling: {
        },
        // Force JSONP fallback for older browsers/networks
        allowEIO3: true,
        // Disable binary data to avoid transport issues
        forceBase64: false,
      });

      // Set a timeout for initial connection
      const connectionTimeout = setTimeout(() => {
        if (socketConnectionStatus === 'connecting') {
          setSocketConnectionStatus('error');
          setMessages(prev => [...prev, {
            sender: "System",
            text: "Backend server is not responding. Video chat features may not work."
          }]);
        }
      }, 10000); // 10 second timeout

      socketRef.current.on('connect', () => {
        clearTimeout(connectionTimeout);
        setSocketConnectionStatus('connected');
        console.log('Connected to WebSocket server');
      });

      socketRef.current.on('disconnect', (reason) => {
        setSocketConnectionStatus('disconnected');
        console.log('Disconnected from WebSocket server:', reason);
      });

      socketRef.current.on('connect_error', (error) => {
        const newAttempts = connectionAttempts + 1;
        setConnectionAttempts(newAttempts);
        setLastErrorType(error.message);
        setSocketConnectionStatus('error');
        setShowRetryButton(true);

        console.error('WebSocket connection error:', error.message, error);
        console.error('Error details:', {
          type: error.type,
          description: error.description,
          context: error.context,
          attemptNumber: newAttempts
        });

        let errorMessage = 'Connection failed';
        let suggestion = '';

        if (error.message.includes('timeout')) {
          errorMessage = 'Connection timeout - Render.com backend may be sleeping (free tier)';
          suggestion = 'Try clicking Retry in a moment.';
        } else if (error.message.includes('CORS')) {
          errorMessage = 'CORS error - Render.com backend configuration issue';
          suggestion = 'Backend CORS policy may need updating.';
        } else if (error.message.includes('Network')) {
          errorMessage = 'Network error - check internet connection';
          suggestion = 'Check your internet connection and try again.';
        } else if (error.message.includes('xhr poll error')) {
          errorMessage = 'HTTP polling transport error - backend may be unreachable';
          suggestion = 'Check if backend server is running and accessible.';
        } else if (error.message.includes('websocket error')) {
          errorMessage = 'WebSocket protocol error - trying HTTP polling fallback';
          suggestion = 'Falling back to HTTP polling transport.';
        } else if (error.message.includes('websocket upgrade')) {
          errorMessage = 'WebSocket upgrade failed - using HTTP polling';
          suggestion = 'WebSocket upgrade blocked, using polling.';
        } else if (error.message.includes('Mixed Content')) {
          errorMessage = 'Mixed content error - ensure HTTPS is used';
          suggestion = 'Ensure the app is loaded over HTTPS.';
        } else if (error.message.includes('WebSocket is closed')) {
          errorMessage = 'WebSocket connection closed unexpectedly';
          suggestion = 'Connection was interrupted unexpectedly.';
        } else if (error.message.includes('CORS')) {
          errorMessage = 'Cross-Origin Resource Sharing (CORS) error';
          suggestion = 'Backend CORS policy needs to be configured.';
        } else if (error.message.includes('certificate') || error.message.includes('SSL') || error.message.includes('TLS')) {
          errorMessage = 'SSL/TLS certificate error';
          suggestion = 'Check HTTPS certificate validity.';
        } else if (error.message.includes('DNS') || error.message.includes('ENOTFOUND')) {
          errorMessage = 'DNS resolution error';
          suggestion = 'Domain name cannot be resolved.';
        } else if (error.message.includes('ECONNREFUSED')) {
          errorMessage = 'Connection refused by server';
          suggestion = 'Backend server may not be running.';
        } else if (error.message.includes('ECONNRESET')) {
          errorMessage = 'Connection reset by server';
          suggestion = 'Server unexpectedly closed the connection.';
        } else if (error.message.includes('ETIMEDOUT')) {
          errorMessage = 'Connection timed out';
          suggestion = 'Network timeout - check internet connection.';
        } else if (error.message.includes('ENETUNREACH')) {
          errorMessage = 'Network unreachable';
          suggestion = 'Check network connectivity.';
        } else if (error.message.includes('EHOSTUNREACH')) {
          errorMessage = 'Host unreachable';
          suggestion = 'Cannot reach the server host.';
        } else if (error.message.includes('429') || error.message.includes('rate limit')) {
          errorMessage = 'Rate limit exceeded';
          suggestion = 'Too many requests - please wait and try again.';
        } else if (error.message.includes('5') && error.message.includes('00')) {
          errorMessage = 'Server error (5xx)';
          suggestion = 'Backend server encountered an error.';
        } else if (error.message.includes('4') && error.message.includes('00')) {
          errorMessage = 'Client error (4xx)';
          suggestion = 'Request error - check authentication.';
        } else if (error.message.includes('Mixed Content')) {
          errorMessage = 'Mixed content error - HTTPS required';
          suggestion = 'Ensure app is loaded over HTTPS.';
        } else if (error.message.includes('blocked') || error.message.includes('intercepted')) {
          errorMessage = 'Request blocked by browser or extension';
          suggestion = 'Check browser extensions or security settings.';
        } else if (error.message.includes('net::ERR_BLOCKED_BY_CLIENT') || error.message.includes('blocked by client')) {
          errorMessage = 'Request blocked by Chrome extension';
          suggestion = 'Disable ad blockers or security extensions temporarily.';
        } else if (error.message.includes('net::ERR_NETWORK_CHANGED') || error.message.includes('network changed')) {
          errorMessage = 'Network configuration changed';
          suggestion = 'Network settings changed - try refreshing the page.';
        } else if (error.message.includes('net::ERR_INTERNET_DISCONNECTED') || error.message.includes('internet disconnected')) {
          errorMessage = 'Internet connection lost';
          suggestion = 'Check your internet connection and try again.';
        } else if (error.message.includes('net::ERR_CONNECTION_REFUSED') || error.message.includes('connection refused')) {
          errorMessage = 'Server refused connection';
          suggestion = 'Backend server may be down or blocking connections.';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('fetch failed')) {
          errorMessage = 'Network request failed';
          suggestion = 'Check network connectivity and firewall settings.';
        } else if (error.message.includes('TypeError: Failed to fetch')) {
          errorMessage = 'CORS or network error in Chrome';
          suggestion = 'Try disabling Chrome security features temporarily.';
        } else if (error.message.includes('401') || error.message.includes('unauthorized') || error.message.includes('authentication')) {
          errorMessage = 'Authentication error - Firebase token expired';
          suggestion = 'Try refreshing the page or logging in again.';
        } else if (error.message.includes('403') || error.message.includes('forbidden')) {
          errorMessage = 'Access forbidden - insufficient permissions';
          suggestion = 'Check your account permissions or contact support.';
        } else if (error.message.includes('WebRTC') || error.message.includes('getUserMedia') || error.message.includes('media')) {
          errorMessage = 'WebRTC media access error';
          suggestion = 'Check camera/microphone permissions in Chrome settings.';
        } else if (error.message.includes('quota') || error.message.includes('storage') || error.message.includes('cache')) {
          errorMessage = 'Browser storage/cache error';
          suggestion = 'Clear browser cache and storage data.';
        } else if (error.message.includes('permission') || error.message.includes('denied')) {
          errorMessage = 'Permission denied by browser';
          suggestion = 'Grant camera/microphone permissions in Chrome.';
        } else if (error.message.includes('version') || error.message.includes('compatibility')) {
          errorMessage = 'Browser version compatibility issue';
          suggestion = 'Update Chrome to the latest version.';
        } else if (error.message.includes('memory') || error.message.includes('out of memory')) {
          errorMessage = 'Browser memory exhausted';
          suggestion = 'Close other tabs and restart Chrome.';
        } else if (error.message.includes('CPU') || error.message.includes('performance')) {
          errorMessage = 'Browser performance issue';
          suggestion = 'Close unnecessary tabs and extensions.';
        } else if (error.message.includes('proxy') || error.message.includes('VPN')) {
          errorMessage = 'Proxy or VPN interference';
          suggestion = 'Try disabling proxy/VPN temporarily.';
        } else if (error.message.includes('CSP') || error.message.includes('Content Security Policy')) {
          errorMessage = 'Content Security Policy violation';
          suggestion = 'Backend CSP headers need configuration.';
        } else if (error.message.includes('HSTS') || error.message.includes('HTTP Strict Transport Security')) {
          errorMessage = 'HSTS policy error';
          suggestion = 'Clear HSTS cache: chrome://net-internals/#hsts';
        } else if (error.message.includes('third-party') || error.message.includes('ad blocker')) {
          errorMessage = 'Third-party blocking detected';
          suggestion = 'Disable ad blockers or whitelist the site.';
        } else if (error.message.includes('firewall')) {
          errorMessage = 'Firewall blocking connection';
          suggestion = 'Check firewall settings or contact IT support.';
        } else if (error.message.includes('WebSocket connection limit') || error.message.includes('max connections')) {
          errorMessage = 'WebSocket connection limit exceeded in Chrome';
          suggestion = 'Close other tabs with WebSocket connections.';
        } else if (error.message.includes('frame size') || error.message.includes('too large')) {
          errorMessage = 'WebSocket frame size limit exceeded';
          suggestion = 'Reduce message size or check for large data transfers.';
        } else if (error.message.includes('compression') || error.message.includes('deflate')) {
          errorMessage = 'WebSocket compression error';
          suggestion = 'Disable WebSocket compression in Chrome DevTools.';
        } else if (error.message.includes('protocol') && error.message.includes('negotiation')) {
          errorMessage = 'WebSocket protocol negotiation failed';
          suggestion = 'Check WebSocket subprotocol configuration.';
        } else if (error.message.includes('keep-alive') || error.message.includes('ping timeout')) {
          errorMessage = 'WebSocket keep-alive failed';
          suggestion = 'Check network stability or firewall settings.';
        } else if (error.message.includes('throttled') || error.message.includes('rate limited')) {
          errorMessage = 'Chrome network throttling active';
          suggestion = 'Disable network throttling in DevTools.';
        } else if (error.message.includes('header size') || error.message.includes('headers too large')) {
          errorMessage = 'HTTP header size limit exceeded';
          suggestion = 'Reduce custom headers or check proxy settings.';
        } else if (error.message.includes('subprotocol') || error.message.includes('Sec-WebSocket-Protocol')) {
          errorMessage = 'WebSocket subprotocol mismatch';
          suggestion = 'Check WebSocket subprotocol configuration on backend.';
        } else if (error.message.includes('transport closed') || error.message.includes('connection aborted')) {
          errorMessage = 'Transport connection aborted by Chrome';
          suggestion = 'Check Chrome stability or reduce concurrent connections.';
        } else if (error.message.includes('invalid frame') || error.message.includes('malformed')) {
          errorMessage = 'Invalid WebSocket frame received';
          suggestion = 'Check for network corruption or proxy interference.';
        } else if (error.message.includes('service worker') || error.message.includes('cache storage')) {
          errorMessage = 'Service worker cache error';
          suggestion = 'Clear service worker cache: chrome://serviceworker-internals/';
        } else if (error.message.includes('indexeddb') || error.message.includes('database') || error.message.includes('quota exceeded')) {
          errorMessage = 'Browser storage quota exceeded';
          suggestion = 'Clear browser storage: chrome://settings/storage';
        } else if (error.message.includes('web worker') || error.message.includes('worker')) {
          errorMessage = 'Background worker error';
          suggestion = 'Check Chrome task manager for worker processes';
        } else if (error.message.includes('geolocation') || error.message.includes('location')) {
          errorMessage = 'Location permission error';
          suggestion = 'Grant location permissions in Chrome settings';
        } else if (error.message.includes('notification') || error.message.includes('push')) {
          errorMessage = 'Push notification error';
          suggestion = 'Enable notifications: chrome://settings/content/notifications';
        } else if (error.message.includes('battery') || error.message.includes('power')) {
          errorMessage = 'Device battery/power error';
          suggestion = 'Check device power settings and battery level';
        } else if (error.message.includes('webgl') || error.message.includes('graphics')) {
          errorMessage = 'Graphics acceleration error';
          suggestion = 'Enable hardware acceleration: chrome://settings/advanced';
        } else if (error.message.includes('web audio') || error.message.includes('audio context')) {
          errorMessage = 'Web Audio API error';
          suggestion = 'Check audio settings and permissions';
        } else if (error.message.includes('file system') || error.message.includes('filesystem')) {
          errorMessage = 'File system access error';
          suggestion = 'Grant file system permissions';
        } else if (error.message.includes('clipboard') || error.message.includes('copy') || error.message.includes('paste')) {
          errorMessage = 'Clipboard access error';
          suggestion = 'Grant clipboard permissions in Chrome settings';
        } else if (error.message.includes('fullscreen') || error.message.includes('full screen')) {
          errorMessage = 'Fullscreen API error';
          suggestion = 'Allow fullscreen mode for the site';
        } else if (error.message.includes('orientation') || error.message.includes('screen orientation')) {
          errorMessage = 'Screen orientation error';
          suggestion = 'Check device orientation lock settings';
        } else if (error.message.includes('vibration') || error.message.includes('vibrate')) {
          errorMessage = 'Device vibration error';
          suggestion = 'Enable vibration in device settings';
        } else if (error.message.includes('payment') || error.message.includes('transaction')) {
          errorMessage = 'Payment API error';
          suggestion = 'Check payment method and network connection';
        } else if (error.message.includes('share') || error.message.includes('sharing')) {
          errorMessage = 'Web Share API error';
          suggestion = 'Check sharing permissions and supported platforms';
        } else if (error.message.includes('bluetooth') || error.message.includes('ble')) {
          errorMessage = 'Bluetooth/Web Bluetooth error';
          suggestion = 'Grant Bluetooth permissions and check device compatibility';
        } else if (error.message.includes('usb') || error.message.includes('webusb')) {
          errorMessage = 'WebUSB error';
          suggestion = 'Grant USB device permissions';
        } else if (error.message.includes('serial') || error.message.includes('web serial')) {
          errorMessage = 'Web Serial API error';
          suggestion = 'Grant serial port permissions';
        } else if (error.message.includes('hid') || error.message.includes('human interface')) {
          errorMessage = 'WebHID error';
          suggestion = 'Grant HID device permissions';
        } else if (error.message.includes('nfc') || error.message.includes('near field')) {
          errorMessage = 'Web NFC error';
          suggestion = 'Enable NFC and grant permissions';
        } else if (error.message.includes('ambient light') || error.message.includes('light sensor')) {
          errorMessage = 'Ambient Light Sensor error';
          suggestion = 'Grant ambient light sensor permissions';
        } else if (error.message.includes('accelerometer') || error.message.includes('gyroscope')) {
          errorMessage = 'Motion sensors error';
          suggestion = 'Grant motion sensor permissions';
        } else if (error.message.includes('magnetometer') || error.message.includes('compass')) {
          errorMessage = 'Magnetometer error';
          suggestion = 'Grant magnetometer permissions';
        } else if (error.message.includes('proximity') || error.message.includes('proximity sensor')) {
          errorMessage = 'Proximity sensor error';
          suggestion = 'Grant proximity sensor permissions';
        } else if (error.message.includes('wake lock') || error.message.includes('screen wake')) {
          errorMessage = 'Screen Wake Lock error';
          suggestion = 'Grant screen wake lock permissions';
        } else if (error.message.includes('background sync') || error.message.includes('sync')) {
          errorMessage = 'Background Sync error';
          suggestion = 'Check background sync permissions';
        } else if (error.message.includes('periodic background sync')) {
          errorMessage = 'Periodic Background Sync error';
          suggestion = 'Grant periodic background sync permissions';
        } else if (error.message.includes('content indexing') || error.message.includes('indexing')) {
          errorMessage = 'Content Indexing API error';
          suggestion = 'Check content indexing permissions';
        } else if (error.message.includes('badging') || error.message.includes('badge')) {
          errorMessage = 'Badging API error';
          suggestion = 'Grant badging permissions';
        } else if (error.message.includes('contacts') || error.message.includes('contact picker')) {
          errorMessage = 'Contact Picker API error';
          suggestion = 'Grant contacts permissions';
        } else if (error.message.includes('font access') || error.message.includes('local fonts')) {
          errorMessage = 'Local Font Access error';
          suggestion = 'Grant local font access permissions';
        } else if (error.message.includes('storage access') || error.message.includes('storage foundation')) {
          errorMessage = 'Storage Access API error';
          suggestion = 'Grant storage access permissions';
        } else if (error.message.includes('managed configuration') || error.message.includes('enterprise')) {
          errorMessage = 'Managed Configuration error';
          suggestion = 'Check enterprise policy settings';
        } else if (error.message.includes('digital goods') || error.message.includes('in-app purchase')) {
          errorMessage = 'Digital Goods API error';
          suggestion = 'Check in-app purchase configuration';
        } else if (error.message.includes('web otp') || error.message.includes('sms')) {
          errorMessage = 'WebOTP error';
          suggestion = 'Grant SMS permissions for OTP';
        } else if (error.message.includes('web authentication') || error.message.includes('webauthn')) {
          errorMessage = 'WebAuthn error';
          suggestion = 'Check biometric authentication settings';
        } else if (error.message.includes('web transport') || error.message.includes('http/3')) {
          errorMessage = 'WebTransport error';
          suggestion = 'Check HTTP/3 and WebTransport support';
        } else if (error.message.includes('webcodecs') || error.message.includes('video codec')) {
          errorMessage = 'WebCodecs error';
          suggestion = 'Check video codec support and permissions';
        } else if (error.message.includes('webgpu') || error.message.includes('gpu')) {
          errorMessage = 'WebGPU error';
          suggestion = 'Enable WebGPU: chrome://flags/#enable-webgpu';
        } else if (error.message.includes('webxr') || error.message.includes('xr') || error.message.includes('vr') || error.message.includes('ar')) {
          errorMessage = 'WebXR error';
          suggestion = 'Grant XR device permissions and check hardware';
        } else if (error.message.includes('web midi') || error.message.includes('midi')) {
          errorMessage = 'Web MIDI error';
          suggestion = 'Grant MIDI device permissions';
        } else if (error.message.includes('web socket stream') || error.message.includes('socket stream')) {
          errorMessage = 'WebSocketStream error';
          suggestion = 'Check WebSocketStream support and permissions';
        } else if (error.message.includes('web lock') || error.message.includes('lock manager')) {
          errorMessage = 'Web Locks API error';
          suggestion = 'Check lock manager permissions';
        } else if (error.message.includes('web background fetch') || error.message.includes('background fetch')) {
          errorMessage = 'Background Fetch API error';
          suggestion = 'Grant background fetch permissions';
        } else if (error.message.includes('web app manifest') || error.message.includes('pwa')) {
          errorMessage = 'Web App Manifest error';
          suggestion = 'Check PWA manifest configuration';
        } else if (error.message.includes('web app install') || error.message.includes('install prompt')) {
          errorMessage = 'Web App Install error';
          suggestion = 'Check PWA install criteria and permissions';
        }

        // Add Chrome-specific troubleshooting tips
        const chromeTips = getChromeTroubleshootingTips(error.message);
        const troubleshootingText = chromeTips.length > 0 ?
          `\n\nChrome Troubleshooting:\n${chromeTips.map(tip => `• ${tip}`).join('\n')}` : '';

        // Add error message to chat
        setMessages(prev => [...prev, {
          sender: "System",
          text: `Backend Error: ${errorMessage}${suggestion ? ` ${suggestion}` : ''}${troubleshootingText}`
        }]);
      });

      socketRef.current.on('reconnect_failed', () => {
        setSocketConnectionStatus('error');
        console.error('Failed to reconnect to WebSocket server');
        setMessages(prev => [...prev, {
          sender: "System",
          text: "Unable to reconnect to server. Please refresh the page."
        }]);
      });

      // Add WebSocket-specific event handlers
      socketRef.current.on('ping', () => {
        console.log('WebSocket ping received');
      });

      socketRef.current.on('pong', () => {
        console.log('WebSocket pong sent');
      });

      socketRef.current.on('reconnecting', (attemptNumber) => {
        console.log(`Reconnecting to WebSocket server (attempt ${attemptNumber})`);
        setMessages(prev => [...prev, {
          sender: "System",
          text: `Reconnecting... (attempt ${attemptNumber})`
        }]);
      });

      socketRef.current.on('reconnect', (attemptNumber) => {
        console.log(`Successfully reconnected to WebSocket server after ${attemptNumber} attempts`);
        setMessages(prev => [...prev, {
          sender: "System",
          text: "Reconnected to server successfully"
        }]);
      });

      socketRef.current.emit('join_room', {
        room_id: roomId,
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
    };

    connectSocket();

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

  const getChromeTroubleshootingTips = (errorType) => {
    const tips = [];

    if (errorType.includes('CORS')) {
      tips.push('Try disabling Chrome security features: chrome://flags/#disable-web-security');
      tips.push('Check if backend has proper CORS headers configured');
    }

    if (errorType.includes('certificate') || errorType.includes('SSL')) {
      tips.push('Check certificate validity at: chrome://net-internals/#hsts');
      tips.push('Try clearing SSL cache: chrome://net-internals/#ssl');
    }

    if (errorType.includes('blocked') || errorType.includes('extension')) {
      tips.push('Try incognito mode to disable extensions');
      tips.push('Check chrome://extensions/ for blocking extensions');
    }

    if (errorType.includes('network') || errorType.includes('DNS')) {
      tips.push('Flush DNS cache: chrome://net-internals/#dns');
      tips.push('Check chrome://net-internals/#proxy for proxy settings');
    }

    if (errorType.includes('xhr poll') || errorType.includes('polling')) {
      tips.push('Try disabling Chrome cache: DevTools → Network → Disable cache');
      tips.push('Check for VPN or proxy interference');
    }

    if (errorType.includes('401') || errorType.includes('unauthorized')) {
      tips.push('Try logging out and back in: chrome://settings/clearBrowserData');
      tips.push('Check Firebase authentication status');
    }

    if (errorType.includes('WebRTC') || errorType.includes('getUserMedia')) {
      tips.push('Check site permissions: chrome://settings/content/siteDetails');
      tips.push('Reset camera/microphone permissions');
    }

    if (errorType.includes('quota') || errorType.includes('storage')) {
      tips.push('Clear site data: chrome://settings/clearBrowserData');
      tips.push('Check storage quota: chrome://settings/storage');
    }

    if (errorType.includes('CSP') || errorType.includes('Content Security Policy')) {
      tips.push('Check backend CSP headers configuration');
      tips.push('Try disabling CSP: chrome://flags/#disable-csp');
    }

    if (errorType.includes('HSTS')) {
      tips.push('Clear HSTS cache: chrome://net-internals/#hsts');
      tips.push('Delete domain security policies');
    }

    if (errorType.includes('third-party') || errorType.includes('ad blocker')) {
      tips.push('Try incognito mode to bypass extensions');
      tips.push('Whitelist site in ad blocker settings');
    }

    if (errorType.includes('proxy') || errorType.includes('VPN')) {
      tips.push('Disable proxy: chrome://settings/proxy');
      tips.push('Try without VPN connection');
    }

    if (errorType.includes('memory') || errorType.includes('performance')) {
      tips.push('Monitor Chrome task manager: Shift+Esc');
      tips.push('Close unnecessary tabs and extensions');
      tips.push('Try Chrome in safe mode: chrome://flags/#disable-background-timer-throttling');
    }

    if (errorType.includes('WebSocket connection limit') || errorType.includes('max connections')) {
      tips.push('Check chrome://net-internals/#sockets for active connections');
      tips.push('Close other tabs using WebSocket connections');
      tips.push('Restart Chrome to reset connection limits');
    }

    if (errorType.includes('frame size') || errorType.includes('too large')) {
      tips.push('Check WebSocket message sizes in DevTools Network tab');
      tips.push('Implement message chunking for large data');
      tips.push('Check chrome://flags/#max-tiles-for-interest-area for WebSocket limits');
    }

    if (errorType.includes('compression') || errorType.includes('deflate')) {
      tips.push('Disable WebSocket compression: chrome://flags/#enable-websocket-deflate-frame');
      tips.push('Check backend compression settings');
    }

    if (errorType.includes('protocol') && errorType.includes('negotiation')) {
      tips.push('Check WebSocket subprotocols in DevTools Network tab');
      tips.push('Verify backend supports required subprotocols');
    }

    if (errorType.includes('keep-alive') || errorType.includes('ping timeout')) {
      tips.push('Check network stability: chrome://net-internals/#dns');
      tips.push('Disable firewall temporarily');
      tips.push('Check VPN/proxy keep-alive settings');
    }

    if (errorType.includes('throttled') || errorType.includes('rate limited')) {
      tips.push('Disable throttling: DevTools → Network → No throttling');
      tips.push('Check chrome://net-internals/#throttling for active throttling');
    }

    if (errorType.includes('header size') || errorType.includes('headers too large')) {
      tips.push('Check request headers in DevTools Network tab');
      tips.push('Reduce custom headers or use shorter header names');
      tips.push('Check proxy header size limits');
    }

    if (errorType.includes('subprotocol') || errorType.includes('Sec-WebSocket-Protocol')) {
      tips.push('Check WebSocket handshake in DevTools Network tab');
      tips.push('Verify subprotocol negotiation with backend');
    }

    if (errorType.includes('transport closed') || errorType.includes('connection aborted')) {
      tips.push('Check Chrome stability: chrome://version');
      tips.push('Monitor memory usage: Shift+Esc');
      tips.push('Try incognito mode to isolate issues');
    }

    if (errorType.includes('invalid frame') || errorType.includes('malformed')) {
      tips.push('Check network corruption: chrome://net-internals/#events');
      tips.push('Disable proxy/VPN temporarily');
      tips.push('Check for antivirus interference');
    }

    return tips;
  };

  const retryConnection = () => {
    console.log('Manual retry triggered for WebSocket connection');
    setSocketConnectionStatus('connecting');
    setShowRetryButton(false);
    setConnectionAttempts(0);

    // Disconnect existing socket if any
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    // Clear any existing timeout
    if (window.connectionTimeoutId) {
      clearTimeout(window.connectionTimeoutId);
    }

    // Try different transport strategies based on previous attempts
    const tryConnection = async (transportStrategy = 'polling-first') => {
      const isDevelopment = import.meta.env.DEV;
      const serverUrl = isDevelopment ? window.location.origin : (import.meta.env.VITE_SOCKET_URL || "https://video-call-app-backend.onrender.com");
      const user = auth?.currentUser;
      let token = null;
      if (user && auth) {
        try {
          token = await getIdToken(user);
        } catch (error) {
          console.error('Error getting auth token:', error);
        }
      }

      console.log(`Retrying WebSocket connection (${transportStrategy}):`, serverUrl);

      let transports = ['polling', 'websocket'];
      let upgrade = true;
      let allowEIO3 = true;
      let forceBase64 = false;

      if (transportStrategy === 'websocket-first') {
        transports = ['websocket', 'polling'];
      } else if (transportStrategy === 'websocket-only') {
        transports = ['websocket'];
        upgrade = false;
      } else if (transportStrategy === 'polling-first-alt') {
        transports = ['polling', 'websocket'];
        allowEIO3 = false; // Try without EIO3 for alternative polling
        forceBase64 = true; // Force base64 encoding
      } else if (transportStrategy === 'websocket-first-alt') {
        transports = ['websocket', 'polling'];
        allowEIO3 = false;
        forceBase64 = true;
      } else if (transportStrategy === 'websocket-only-alt') {
        transports = ['websocket'];
        upgrade = false;
        allowEIO3 = false;
        forceBase64 = true;
      }

      socketRef.current = io(serverUrl, {
        reconnection: true,
        reconnectionAttempts: 3, // Fewer attempts for manual retry
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 15000,
        forceNew: true,
        transports: transports,
        upgrade: upgrade,
        rememberUpgrade: true,
        path: '/socket.io/',
        pingInterval: 20000,
        pingTimeout: 15000,
        withCredentials: true,
        auth: token ? { token } : undefined,
        extraHeaders: {
          'X-Connection-Attempt': transportStrategy,
        },
        // Polling-specific options for retry attempts
        polling: {
          extraHeaders: {
            'X-Connection-Attempt': transportStrategy,
          },
        },
        // Additional retry-specific options
        allowEIO3: allowEIO3,
        forceBase64: forceBase64,
      });

      socketRef.current.on('connect', () => {
        setSocketConnectionStatus('connected');
        setShowRetryButton(false);
        setConnectionAttempts(0);
        console.log(`Successfully connected using ${transportStrategy}`);
        setMessages(prev => [...prev, {
          sender: "System",
          text: `Connected successfully using ${transportStrategy === 'polling-first' ? 'HTTP polling' : 'WebSocket'}`
        }]);
      });

      socketRef.current.on('connect_error', (error) => {
        console.error(`Connection failed with ${transportStrategy}:`, error.message);

        // Special handling for xhr poll error
        if (error.message.includes('xhr poll error')) {
          console.log('XHR poll error detected, trying alternative polling configuration...');
          socketRef.current.disconnect();
          setTimeout(() => tryConnection(`${transportStrategy}-alt`), 1000);
          return;
        }

        // Try alternative transport strategy
        if (transportStrategy === 'polling-first') {
          console.log('Trying WebSocket-first approach...');
          socketRef.current.disconnect();
          setTimeout(() => tryConnection('websocket-first'), 1000);
        } else if (transportStrategy === 'websocket-first') {
          console.log('Trying WebSocket-only approach...');
          socketRef.current.disconnect();
          setTimeout(() => tryConnection('websocket-only'), 1000);
        } else if (transportStrategy === 'polling-first-alt') {
          console.log('Trying WebSocket-first with alternative config...');
          socketRef.current.disconnect();
          setTimeout(() => tryConnection('websocket-first-alt'), 1000);
        } else if (transportStrategy === 'websocket-first-alt') {
          console.log('Trying WebSocket-only with alternative config...');
          socketRef.current.disconnect();
          setTimeout(() => tryConnection('websocket-only-alt'), 1000);
        } else {
          // All strategies failed
          setSocketConnectionStatus('error');
          setShowRetryButton(true);
          setMessages(prev => [...prev, {
            sender: "System",
            text: "All connection methods failed. Backend server may be down or unreachable."
          }]);
        }
      });
    };

    // Start with polling-first strategy
    tryConnection('polling-first');
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
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-700 rounded border border-gray-600">
              <div className={`w-1.5 h-1.5 rounded-full ${
                socketConnectionStatus === 'connected' ? 'bg-green-400' :
                socketConnectionStatus === 'connecting' ? 'bg-yellow-400' :
                socketConnectionStatus === 'error' ? 'bg-red-400' :
                'bg-gray-400'
              }`}></div>
              <span className="text-white font-medium text-xs">
                {socketConnectionStatus === 'connected' ? 'Connected' :
                 socketConnectionStatus === 'connecting' ? 'Connecting...' :
                 socketConnectionStatus === 'error' ? 'Connection Error' :
                 'Disconnected'}
              </span>
            </div>
            {showRetryButton && (
              <button
                onClick={retryConnection}
                className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
                title="Retry connection to Render.com backend"
              >
                Retry
              </button>
            )}
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
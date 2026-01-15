// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAfhkTdGDchE3_NG4Zo3CNs0RZq9X4wQHU",
  authDomain: "video-chat-app-6ce34.firebaseapp.com",
  projectId: "video-chat-app-6ce34",
  storageBucket: "video-chat-app-6ce34.firebasestorage.app",
  messagingSenderId: "751696686702",
  appId: "1:751696686702:web:fd1ad058d71fb3f589007f",
  measurementId: "G-MSNGB532PL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

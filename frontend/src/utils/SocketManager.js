// frontend/src/utils/SocketManager.js
import { io } from 'socket.io-client';
// Import these at the top level, but don't use them until store is set
import { setOnlineUsers } from '../store/authSlice';
import { addMessage, removeMessage } from '../store/chatSlice';

// Define your base URL
const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:4000" : "/";

let socket = null;
let storeRef = null;

// Function to set store reference from outside (will be called after store is created)
export const setStoreReference = (store) => {
  storeRef = store;
};

// Initialize socket connection
export const initializeSocket = (userId) => {
  if (socket) return socket; // Return existing socket if already connected
  
  socket = io(BASE_URL, {
    query: { userId },
    withCredentials: true
  });
  
  // Set up event listeners
  socket.on('connect', () => {
    console.log('Socket connected with ID:', socket.id);
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });
  
  socket.on('getOnlineUsers', (userIds) => {
    if (storeRef) {
      storeRef.dispatch(setOnlineUsers(userIds));
    }
  });
  
  socket.on('newMessage', (newMessage) => {
    if (storeRef) {
      storeRef.dispatch(addMessage(newMessage));
    }
  });
  
  socket.on('messageDeleted', (messageId) => {
    if (storeRef) {
      storeRef.dispatch(removeMessage(messageId));
    }
  });
  
  return socket;
};

// Get the socket instance
export const getSocket = () => socket;

// Disconnect socket
export const disconnectSocket = () => {
  if (socket && socket.connected) {
    socket.disconnect();
    socket = null;
    return true;
  }
  return false;
};

// Send a message via socket
export const emitMessage = (event, data) => {
  if (socket && socket.connected) {
    socket.emit(event, data);
    return true;
  }
  return false;
};
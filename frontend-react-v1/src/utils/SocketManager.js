import { io } from 'socket.io-client';
import { setOnlineUsers } from '../store/authSlice';
import { addMessage, fetchUsers, removeMessage, updateMessagesReadStatus } from '../store/chatSlice';
import { requestNotificationPermission, showNotification } from './NotificationManager';

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:4000" : "/";

let socket = null;
let storeRef = null;

export const setStoreReference = (store) => {
  storeRef = store;
};

export const initializeSocket = (userId) => {
  if (socket) return socket;
  
  socket = io(BASE_URL, {
    query: { userId },
    withCredentials: true
  });
  
  socket.on('connect', () => {
    console.log('Socket connected with ID:', socket.id);
    requestNotificationPermission(); // Request permission on connect
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
      const currentUserId = storeRef.getState().auth.user?._id;
      const isChatPage = window.location.pathname.startsWith('/chat');
      
      storeRef.dispatch(addMessage(newMessage));

      // Show notification if the user is not on the chat page or not chatting with the sender
      if (
        newMessage.receiverId === currentUserId &&
        (!isChatPage || window.location.pathname !== `/chat/${newMessage.senderId}`)
      ) {
        showNotification(
          "New Message",
          {
            body: newMessage.text || "You received a new image message",
            icon: "/path/to/icon.png", // Replace with your app icon path
          },
          () => {
            window.location.href = `/chat/${newMessage.senderId}`;
          }
        );
      }
    }
  });
  
  socket.on('messageDeleted', (messageId) => {
    if (storeRef) {
      storeRef.dispatch(removeMessage(messageId));
    }
  });
  
  socket.on('messagesReadByReceiver', (receiverId) => {
    if (storeRef) {
      const currentUserId = storeRef.getState().auth.user?._id;
      if (currentUserId) {
        storeRef.dispatch(updateMessagesReadStatus({ receiverId, currentUserId }));
      }
    }
  });

  // eslint-disable-next-line no-unused-vars
  socket.on('refreshSidebar', ({ senderId }) => {
    if (storeRef) {
      storeRef.dispatch(fetchUsers());
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
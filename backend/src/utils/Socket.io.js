// backend/src/utils/Socket.io.js
import { Server } from "socket.io";

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// Map to track online users
const userSocketMap = {}; // {userId: socketId}

let io;

// Initialize socket with existing server
const initializeSocket = (server) => {
  // Initialize Socket.io with the HTTP server
  io = new Server(server, {
    cors: {
      origin: [CLIENT_URL],
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    console.log("A user connected", socket.id);
    
    const userId = socket.handshake.query.userId;
    if (userId) userSocketMap[userId] = socket.id;
    
    // Send current online users to all clients
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
    
    // Handle custom events
    socket.on("sendMessage", ({ receiverId, message }) => {
      const receiverSocketId = userSocketMap[receiverId];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", message);
      }
    });
    
    socket.on("markMessagesAsRead", ({ senderId }) => {
      const senderSocketId = userSocketMap[senderId];
      if (senderSocketId) {
        io.to(senderSocketId).emit("messagesReadByReceiver", socket.handshake.query.userId);
      }
    });
    
    socket.on("disconnect", () => {
      console.log("A user disconnected", socket.id);
      // Find and remove the disconnected user
      const userIdToRemove = Object.keys(userSocketMap).find(
        key => userSocketMap[key] === socket.id
      );
      
      if (userIdToRemove) {
        delete userSocketMap[userIdToRemove];
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
      }
    });
  });

  return io;
};

// Function to get receiver socket ID
const getReceiverSocketId = (userId) => {
  return userSocketMap[userId];
};

// Export everything needed
export { io, initializeSocket, getReceiverSocketId };
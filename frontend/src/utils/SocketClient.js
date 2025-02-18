// src/socket.js
import { io } from "socket.io-client";

// Connect to your backend socket.io server (adjust the URL if needed)
const socket = io("http://localhost:4000", { withCredentials: true, transports: ["websocket"] });

export default socket;
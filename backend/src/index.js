import express from "express"
import dotenv from "dotenv"
import { connectDB } from './database/dbConfig.js';
import cookieParser from 'cookie-parser';
import path from 'path';
import AuthRoutes from "./routes/authRoutes.js"
import UserRoutes from "./routes/userRoutes.js"
import CompanyRoutes from "./routes/companyRoutes.js"
import JobRoutes from "./routes/jobRoutes.js"
import ApplicationRoutes from "./routes/applicationRoutes.js"
import savedJobRoutes from "./routes/savedJobRoutes.js"
import MessageRoutes from "./routes/messageRoutes.js"
import cors from "cors"
import http from "http";
import { initializeSocket } from "./utils/Socket.io.js";

dotenv.config()

// Create Express app
const app = express();

const PORT = process.env.PORT || 5000;

// Create HTTP server with Express app
const server = http.createServer(app);

const __dirname = path.resolve();

// Validate required environment variables
if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    console.error("Missing required environment variables!");
    process.exit(1);
}

// Initialize middleware
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json()); // Parse JSON requests
app.use(cookieParser()); // Parse incoming cookies

// Initialize Socket.IO with the server
initializeSocket(server);

// Routes
app.use("/api/auth", AuthRoutes)
app.use("/api/user", UserRoutes)
app.use("/api/company", CompanyRoutes)
app.use("/api/job", JobRoutes)
app.use("/api/application", ApplicationRoutes)
app.use("/api/saved-job", savedJobRoutes)
app.use("/api/message", MessageRoutes)

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "/frontend/dist")));

    app.get("*", (req, res) => {
        res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
    }); 
}

// Start the server only after connecting to the database
connectDB()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`Server running on PORT ${PORT}.`);
        });
    })
    .catch((err) => {
        console.error("Database connection failed!", err);
        process.exit(1);
    });
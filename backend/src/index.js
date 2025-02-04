import express from "express"
import dotenv from "dotenv"
import { connectDB } from './database/dbConfig.js';
import cookieParser from 'cookie-parser';
import AuthRoutes from "./routes/authRoutes.js"
import UserRoutes from "./routes/userRoutes.js"
import cors from "cors"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000;

// Validate required environment variables
if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    console.error("Missing required environment variables!");
    process.exit(1);
}

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json()); // Parse JSON requests
app.use(cookieParser()); // Parse incoming cookies

// Routes
app.use("/api/auth", AuthRoutes)
app.use("/api/user", UserRoutes)

// Start the server only after connecting to the database
connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on PORT ${PORT}.`);
        });
    })
    .catch((err) => {
        console.error("Database connection failed!", err);
        process.exit(1);
    });
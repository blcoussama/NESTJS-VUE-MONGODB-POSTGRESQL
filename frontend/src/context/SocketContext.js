import { createContext } from "react";
import socket from "../utils/SocketClient";

export const SocketContext = createContext(socket);
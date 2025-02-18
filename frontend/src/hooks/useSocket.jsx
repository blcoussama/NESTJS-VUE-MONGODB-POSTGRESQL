import { useContext } from "react";
import { SocketContext } from "./SocketContext";

const useSocket = () => {
  return useContext(SocketContext);
};

export default useSocket;
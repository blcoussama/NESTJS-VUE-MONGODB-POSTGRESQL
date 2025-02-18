/* eslint-disable react/prop-types */
import { SocketContext } from "./SocketContext";
import socket from "../utils/SocketClient";

const SocketProvider = ({ children }) => {
  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketProvider;
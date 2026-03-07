import { io } from "socket.io-client";

let socket = null;

function getServerBase() {
  const host = window.location.hostname;
  return `http://${host}:5175`;
}

export function getOneVOneSocket() {
  if (socket) return socket;

  socket = io(getServerBase(), {
    transports: ["websocket", "polling"],
    timeout: 8000,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500,
  });

  return socket;
}
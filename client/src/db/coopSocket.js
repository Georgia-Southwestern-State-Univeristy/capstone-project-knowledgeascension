// client/src/db/coopSocket.js
import { io } from "socket.io-client";

let socket = null;
let socketBase = "";

export function getCoopServerBase() {
  const host = window.location.hostname;
  return `http://${host}:5175`;
}

export function getCoopSocket() {
  const base = getCoopServerBase();

  if (socket && socketBase === base) return socket;

  if (socket) {
    try { socket.disconnect(); } catch {}
    socket = null;
  }

  socketBase = base;

  socket = io(base, {
    transports: ["websocket", "polling"],
    timeout: 8000,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500,
  });

  return socket;
}

export function disconnectCoopSocket() {
  if (!socket) return;
  try { socket.disconnect(); } catch {}
  socket = null;
  socketBase = "";
}
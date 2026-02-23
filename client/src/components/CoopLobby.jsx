import React, { useEffect, useMemo, useRef, useState } from "react";
import "./coopLobby.css";
import { io } from "socket.io-client";
import { useAuth } from "../auth/AuthContext.jsx";

function getCoopServerBase() {
  // Manual: if you hardcode later, change this.
  const host = window.location.hostname;
  return `http://${host}:5175`;
}

export default function CoopLobby({ onBackToMenu, onEnterGame }) {
  const { username, profile } = useAuth();

  const [mode, setMode] = useState("join"); // join | host
  const [name, setName] = useState(username || "");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  const [room, setRoom] = useState(null);
  const [socketId, setSocketId] = useState("");
  const [connected, setConnected] = useState(false);

  const socketRef = useRef(null);

  const equipped = String(profile?.equippedCharacter || "knight").toLowerCase();
  const apiBase = useMemo(() => getCoopServerBase(), []);

  useEffect(() => {
    setErr("");

    const s = io(apiBase, {
      transports: ["websocket", "polling"], // important
      timeout: 8000,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
    });

    socketRef.current = s;

    s.on("connect", () => {
      setConnected(true);
      setSocketId(s.id);
      setErr("");
    });

    s.on("disconnect", () => {
      setConnected(false);
    });

    s.on("connect_error", (e) => {
      setConnected(false);
      setErr(`Server connection failed (${apiBase}). Start the server on port 5175.`);
    });

    s.on("coop:error", (e) => setErr(e?.message || "Error"));

    s.on("coop:room_state", (state) => {
      setRoom(state);
      setErr("");
    });

    s.on("coop:started", (state) => {
      setRoom(state);
      onEnterGame?.({
        code: state.code,
        isHost: state.players?.[0]?.id === s.id,
      });
    });

    return () => {
      try { s.disconnect(); } catch {}
      socketRef.current = null;
    };
  }, [apiBase, onEnterGame]);

  const isHost = !!room && room.players?.[0]?.id === socketId;
  const me = room?.players?.find((p) => p.id === socketId);

  const createRoom = () => {
    setErr("");
    if (!connected) return setErr("Not connected to server yet.");
    if (!name.trim()) return setErr("Enter a name.");
    socketRef.current?.emit("coop:create_room", { name: name.trim(), equipped });
  };

  const joinRoom = () => {
    setErr("");
    if (!connected) return setErr("Not connected to server yet.");
    if (!name.trim()) return setErr("Enter a name.");
    if (!code.trim()) return setErr("Enter a room code.");
    socketRef.current?.emit("coop:join_room", { code: code.trim(), name: name.trim(), equipped });
  };

  const setReady = (v) => {
    if (!connected || !room) return;
    socketRef.current?.emit("coop:set_ready", { code: room.code, ready: v });
  };

  const start = () => {
    if (!connected || !room) return;
    socketRef.current?.emit("coop:start_game", { code: room.code });
  };

  const onDropFiles = async (files) => {
    if (!room || !isHost) return;

    for (const f of files) {
      try {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("code", room.code);

        const res = await fetch(`${apiBase}/api/coop/upload`, { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Upload failed.");

        const questions = Array.isArray(data?.questions) ? data.questions : [];
        if (questions.length) {
          socketRef.current?.emit("coop:push_questions", { code: room.code, questions });
        } else {
          setErr("Upload worked, but no questions were returned.");
        }
      } catch (e) {
        setErr(e?.message || "Upload failed.");
      }
    }
  };

  return (
    <div className="coopLobbyRoot">
      <video className="coopLobbyBg" src="/assets/menu/bg.mp4" autoPlay loop muted playsInline />

      <div className="coopLobbyHud">
        <button className="coopBack" onClick={onBackToMenu}>Back</button>

        <div className="coopLeftPanel">
          <div className="panelTitle">Host Upload</div>

          {!room ? (
            <div className="panelHint">Create a room first to enable uploading.</div>
          ) : !isHost ? (
            <div className="panelHint">Only the host can upload study files.</div>
          ) : (
            <DropZone onFiles={onDropFiles} />
          )}

          <div className="panelSmall">Supported: PDF, DOCX, PPTX</div>
        </div>

        <div className="coopRightPanel">
          <div className="panelTitle">Co-op Room</div>

          <div className="panelSmall" style={{ marginTop: 0 }}>
            Status: {connected ? "Connected" : "Connecting..."}
          </div>

          <div className="modeTabs">
            <button className={mode === "join" ? "tab active" : "tab"} onClick={() => setMode("join")}>Join</button>
            <button className={mode === "host" ? "tab active" : "tab"} onClick={() => setMode("host")}>Host</button>
          </div>

          <div className="row">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>

          {mode === "join" && (
            <div className="row">
              <label>Room Code</label>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" />
            </div>
          )}

          <div className="actions">
            {mode === "host" ? (
              <button className="primary" onClick={createRoom} disabled={!connected}>
                Create Room
              </button>
            ) : (
              <button className="primary" onClick={joinRoom} disabled={!connected || !code.trim()}>
                Join Room
              </button>
            )}
          </div>

          {room && (
            <>
              <div className="roomCode">Room: <b>{room.code}</b></div>

              <div className="playerList">
                {room.players.map((p) => (
                  <div className="playerRow" key={p.id}>
                    <div className="playerName">{p.name}</div>
                    <div className={p.ready ? "pill ready" : "pill"}>{p.ready ? "Ready" : "Not Ready"}</div>
                  </div>
                ))}
              </div>

              <div className="bottomActions">
                <button className="secondary" onClick={() => setReady(!me?.ready)} disabled={!connected || !me}>
                  {me?.ready ? "Unready" : "Ready"}
                </button>

                <button className="primary" onClick={start} disabled={!connected || !isHost}>
                  Start
                </button>
              </div>
            </>
          )}

          {err && <div className="error">{err}</div>}
          <div className="panelSmall">Tip: share the room code with friends on the same Wi-Fi.</div>
        </div>
      </div>
    </div>
  );
}

function DropZone({ onFiles }) {
  const [active, setActive] = useState(false);

  const onDragOver = (e) => { e.preventDefault(); setActive(true); };
  const onDragLeave = () => setActive(false);
  const onDrop = (e) => {
    e.preventDefault();
    setActive(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) onFiles(files);
  };

  const pick = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) onFiles(files);
    e.target.value = "";
  };

  return (
    <div className={active ? "dropZone active" : "dropZone"} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <div className="dropText">Drop study files here</div>
      <div className="dropSub">or</div>
      <label className="fileBtn">
        Browse
        <input type="file" accept=".pdf,.docx,.pptx" multiple onChange={pick} />
      </label>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import "./coopLobby.css";
import { useAuth } from "../auth/AuthContext.jsx";
import { getCoopSocket } from "../net/coopSocket.js";

function getCoopServerBase() {
  const host = window.location.hostname;
  return `http://${host}:5175`;
}

function uploadFormDataWithProgress(url, formData, onUploadPct) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.max(0, Math.min(100, Math.round((e.loaded / e.total) * 100)));
      onUploadPct?.(pct);
    };

    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300) resolve(json);
        else reject(new Error(json?.error || `Upload failed (${xhr.status})`));
      } catch {
        reject(new Error("Upload failed (bad server response)."));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed (network error)."));
    xhr.send(formData);
  });
}

export default function CoopLobby({ onBackToMenu, onEnterGame }) {
  const { username, profile } = useAuth();

  const [mode, setMode] = useState("join");
  const [name, setName] = useState(username || "");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  const [room, setRoom] = useState(null);
  const [socketId, setSocketId] = useState("");
  const [connected, setConnected] = useState(false);

  const [uploadLocked, setUploadLocked] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");

  const genTimerRef = useRef(null);
  const socketRef = useRef(null);

  const equipped = String(profile?.equippedCharacter || "knight").toLowerCase();
  const apiBase = useMemo(() => getCoopServerBase(), []);

  const stopGenTimer = () => {
    if (genTimerRef.current) {
      clearInterval(genTimerRef.current);
      genTimerRef.current = null;
    }
  };

  const startGeneratingProgress = () => {
    stopGenTimer();
    setProgressLabel("Generating questions…");
    setProgressPct((p) => Math.max(p, 12));

    genTimerRef.current = setInterval(() => {
      setProgressPct((p) => {
        const next = p + Math.max(1, Math.round((95 - p) * 0.06));
        return Math.min(95, next);
      });
    }, 260);
  };

  useEffect(() => {
    setErr("");

    const s = getCoopSocket();
    socketRef.current = s;

    const onConnect = () => {
      setConnected(true);
      setSocketId(s.id);
      setErr("");
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onConnectError = () => {
      setConnected(false);
      setErr(`Server connection failed (${apiBase}). Start the server on port 5175.`);
    };

    const onError = (e) => setErr(e?.message || "Error");

    const onRoomState = (state) => {
      setRoom(state);
      setErr("");
    };

    const onStarted = (state) => {
      setRoom(state);
      onEnterGame?.({
        code: state.code,
        isHost: state.players?.[0]?.id === s.id,
      });
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onConnectError);

    s.on("coop:error", onError);
    s.on("coop:room_state", onRoomState);
    s.on("coop:started", onStarted);

    if (s.connected) onConnect();

    return () => {
      stopGenTimer();

      // keep socket alive for the game screen
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("connect_error", onConnectError);

      s.off("coop:error", onError);
      s.off("coop:room_state", onRoomState);
      s.off("coop:started", onStarted);
    };
  }, [apiBase, onEnterGame]);

  const isHost = !!room && room.players?.[0]?.id === socketId;
  const me = room?.players?.find((p) => p.id === socketId);

  const createRoom = () => {
    setErr("");
    if (!connected) return setErr("Not connected to server yet.");
    if (!name.trim()) return setErr("Enter a name.");

    stopGenTimer();
    setUploadLocked(false);
    setUploadStatus("");
    setProgressPct(0);
    setProgressLabel("");

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
    if (uploadLocked) return;

    const first = Array.isArray(files) ? files[0] : null;
    if (!first) return;

    stopGenTimer();
    setErr("");
    setUploadLocked(true);

    setProgressPct(0);
    setProgressLabel("Uploading…");
    setUploadStatus("Uploading file…");

    try {
      const fd = new FormData();
      fd.append("file", first);
      fd.append("code", room.code);

      const data = await uploadFormDataWithProgress(`${apiBase}/api/coop/upload`, fd, (pct) => {
        setProgressPct(Math.min(10, Math.round(pct * 0.1)));
        setProgressLabel(`Uploading… ${pct}%`);
      });

      setProgressPct(12);
      startGeneratingProgress();
      setUploadStatus("Generating 100 questions…");

      const questions = Array.isArray(data?.questions) ? data.questions : [];
      if (!questions.length) throw new Error("Upload worked, but no questions were returned.");

      stopGenTimer();
      setProgressLabel("Saving…");
      setProgressPct(96);

      socketRef.current?.emit("coop:push_questions", { code: room.code, questions });

      setProgressLabel("Done");
      setProgressPct(100);
      setUploadStatus(`Saved ${questions.length} questions ✔ Upload locked`);
    } catch (e) {
      stopGenTimer();
      setErr(e?.message || "Upload failed.");
      setUploadLocked(false);
      setUploadStatus("");
      setProgressPct(0);
      setProgressLabel("");
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
            <>
              <DropZone onFiles={onDropFiles} disabled={uploadLocked} />

              {uploadLocked && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontWeight: 800 }}>
                    <div style={{ opacity: 0.95 }}>{progressLabel || "Working…"}</div>
                    <div style={{ opacity: 0.85 }}>{progressPct}%</div>
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      height: 12,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.14)",
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.18)",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${progressPct}%`,
                        background: "rgba(255,210,120,0.85)",
                        transition: "width 180ms ease",
                      }}
                    />
                  </div>
                </div>
              )}

              {uploadStatus ? <div className="panelSmall">{uploadStatus}</div> : null}
              {!uploadLocked ? (
                <div className="panelSmall">Generates 100 questions for this room.</div>
              ) : null}
            </>
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

function DropZone({ onFiles, disabled }) {
  const [active, setActive] = useState(false);

  const onDragOver = (e) => {
    if (disabled) return;
    e.preventDefault();
    setActive(true);
  };

  const onDragLeave = () => setActive(false);

  const onDrop = (e) => {
    if (disabled) return;
    e.preventDefault();
    setActive(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) onFiles(files);
  };

  const pick = (e) => {
    if (disabled) return;
    const files = Array.from(e.target.files || []);
    if (files.length) onFiles(files);
    e.target.value = "";
  };

  return (
    <div
      className={active ? "dropZone active" : "dropZone"}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={disabled ? { opacity: 0.6, pointerEvents: "none" } : undefined}
    >
      <div className="dropText">{disabled ? "Upload Locked" : "Drop study file here"}</div>
      <div className="dropSub">{disabled ? "Questions loaded" : "or"}</div>

      {!disabled && (
        <label className="fileBtn">
          Browse
          <input type="file" accept=".pdf,.docx,.pptx" onChange={pick} />
        </label>
      )}
    </div>
  );
}

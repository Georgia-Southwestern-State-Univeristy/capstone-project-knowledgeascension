import React, { useEffect, useMemo, useRef, useState } from "react";
import "./onevoneLobby.css";
import { useAuth } from "../auth/AuthContext.jsx";
import { getOneVOneSocket } from "../net/onevoneSocket.js";

function getServerBase() {
  const host = window.location.hostname;
  return `http://${host}:5175`;
}

function safeLower(v) {
  return String(v || "").trim().toLowerCase();
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

export default function OneVOneLobby({ onBackToMenu, onEnterGame }) {
  const { username, profile } = useAuth();

  const apiBase = useMemo(() => getServerBase(), []);
  const socketRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState("");

  const [mode, setMode] = useState("join"); // join | host
  const [name, setName] = useState(username || "Player");
  const [code, setCode] = useState("");

  const [room, setRoom] = useState(null);
  const [err, setErr] = useState("");

  // Host upload UX
  const [uploadLocked, setUploadLocked] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");

  const genTimerRef = useRef(null);

  const equipped = safeLower(profile?.equippedCharacter || "knight");

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

    genTimerRef.current = window.setInterval(() => {
      setProgressPct((p) => {
        const next = p + Math.max(1, Math.round((95 - p) * 0.06));
        return Math.min(95, next);
      });
    }, 260);
  };

  useEffect(() => {
    setErr("");

    const s = getOneVOneSocket();
    socketRef.current = s;

    const onConnect = () => {
      setConnected(true);
      setSocketId(s.id);
      setErr("");
    };

    const onDisconnect = () => setConnected(false);

    const onConnectError = () => {
      setConnected(false);
      setErr(`Server connection failed (${apiBase}). Start the server on port 5175.`);
    };

    const onError = (p) => setErr(String(p?.message || "Error"));

    const onState = (st) => {
      setRoom(st);
      setErr("");
    };

    const onStarted = (st) => {
      onEnterGame?.({
        code: st.code,
        isHost: st.players?.[0]?.id === s.id,
      });
    };

    const onUploadProgress = (p) => {
      const done = Number(p?.done || 0);
      const total = Math.max(1, Number(p?.total || 100));
      const pct = Math.max(0, Math.min(100, Math.round((done / total) * 100)));

      setProgressLabel(p?.status ? String(p.status) : "Generating questions…");
      setProgressPct((cur) => Math.max(cur, Math.min(95, Math.max(12, pct))));
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onConnectError);

    s.on("onevone:error", onError);
    s.on("onevone:state", onState);
    s.on("onevone:started", onStarted);
    s.on("onevone:upload_progress", onUploadProgress);

    if (s.connected) onConnect();

    return () => {
      stopGenTimer();

      // IMPORTANT: do NOT disconnect here. We need the same socket in the 1v1 game screen.
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("connect_error", onConnectError);

      s.off("onevone:error", onError);
      s.off("onevone:state", onState);
      s.off("onevone:started", onStarted);
      s.off("onevone:upload_progress", onUploadProgress);
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

    socketRef.current?.emit("onevone:create_room", { name: name.trim(), equipped });
  };

  const joinRoom = () => {
    setErr("");
    if (!connected) return setErr("Not connected to server yet.");
    if (!name.trim()) return setErr("Enter a name.");
    if (!code.trim()) return setErr("Enter a room code.");

    socketRef.current?.emit("onevone:join_room", { code: code.trim(), name: name.trim(), equipped });
  };

  const setReady = (v) => {
    if (!connected || !room) return;
    socketRef.current?.emit("onevone:set_ready", { code: room.code, ready: v });
  };

  const start = () => {
    if (!connected || !room) return;
    socketRef.current?.emit("onevone:start_game", { code: room.code });
    // DO NOT navigate here; server emits "onevone:started" to both players.
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

      const data = await uploadFormDataWithProgress(`${apiBase}/api/onevone/upload`, fd, (pct) => {
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

      socketRef.current?.emit("onevone:push_questions", { code: room.code, questions });

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

  const everyoneReady = !!room?.players?.length && room.players.length === 2 && room.players.every((p) => !!p.ready);
  const hasQuestions = Number(room?.questionCount || 0) > 0;

  return (
    <div className="onevoneLobbyRoot">
      <video className="onevoneLobbyBg" src="/assets/menu/bg.mp4" autoPlay loop muted playsInline />

      <div className="onevoneHud">
        <button className="onevoneBack" onClick={onBackToMenu}>
          Back
        </button>

        <div className="onevoneLeftPanel">
          <div className="panelTitle">Host Upload</div>

          {!room ? (
            <div className="panelHint">Create a room first to enable uploading.</div>
          ) : !isHost ? (
            <div className="panelHint">Only the host can upload study files.</div>
          ) : (
            <>
              <DropZone onFiles={onDropFiles} disabled={uploadLocked} />

              {uploadLocked && (
                <div className="progressWrap">
                  <div className="progressTop">
                    <div className="progressLabel">{progressLabel || "Working…"}</div>
                    <div className="progressPct">{progressPct}%</div>
                  </div>

                  <div className="progressBar">
                    <div className="progressFill" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
              )}

              {uploadStatus ? <div className="panelSmall">{uploadStatus}</div> : null}
              {!uploadLocked ? <div className="panelSmall">Generates 100 questions for this room.</div> : null}
            </>
          )}

          <div className="panelSmall">Supported: PDF, DOCX, PPTX</div>
        </div>

        <div className="onevoneRightPanel">
          <div className="panelTitle">1v1 Room</div>

          <div className="panelSmall" style={{ marginTop: 0 }}>
            Status: {connected ? "Connected" : "Connecting..."}
          </div>

          <div className="modeTabs">
            <button className={mode === "join" ? "tab active" : "tab"} onClick={() => setMode("join")}>
              Join
            </button>
            <button className={mode === "host" ? "tab active" : "tab"} onClick={() => setMode("host")}>
              Host
            </button>
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
              <div className="roomCode">
                Room: <b>{room.code}</b>
              </div>

              <div className="playerList">
                {(room.players || []).map((p) => (
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

                <button className="primary" onClick={start} disabled={!connected || !isHost || !everyoneReady || !hasQuestions}>
                  Start
                </button>
              </div>

              <div className="panelSmall">Match requirements: 2 players ready + questions loaded.</div>
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
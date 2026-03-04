// client/src/components/CoopMode.jsx
import React, { useEffect, useRef, useState } from "react";
import "./coop.css";
import { useAuth } from "../auth/AuthContext.jsx";
import { CHARACTERS } from "../db/characters";
import { getCoopSocket, disconnectCoopSocket } from "../db/coopSocket.js";

function folderForEquippedId(id) {
  const key = String(id || "knight").toLowerCase();
  const found = CHARACTERS.find((c) => String(c.id).toLowerCase() === key);
  return found?.folderName || "Knight";
}

export default function CoopMode({ room, onBackToMenu }) {
  const { addCoins } = useAuth();

  const [state, setState] = useState(null);
  const [socketId, setSocketId] = useState("");
  const [q, setQ] = useState(null);
  const [endReason, setEndReason] = useState("");
  const [localDeadUntil, setLocalDeadUntil] = useState(0);

  const socketRef = useRef(null);
  const roomCode = String(room?.code || "").toUpperCase();

  useEffect(() => {
    if (!roomCode) return;

    const s = getCoopSocket();
    socketRef.current = s;

    const onConnect = () => setSocketId(s.id);
    const onRoomState = (st) => setState(st);
    const onQuestion = (payload) => setQ(payload?.q || null);
    const onStarted = (st) => {
      setEndReason("");
      setState(st);
      // server separately emits coop:question; we don’t depend on st.curQuestion
    };

    const onHit = async (payload) => {
      if (!payload) return;
      if (payload.playerId === s.id && payload.coinDrop > 0) {
        try { await addCoins(payload.coinDrop); } catch {}
      }
    };

    const onEnded = (payload) => {
      setEndReason(String(payload?.reason || "ended"));
    };

    s.on("connect", onConnect);
    s.on("coop:room_state", onRoomState);
    s.on("coop:question", onQuestion);
    s.on("coop:started", onStarted);
    s.on("coop:hit", onHit);
    s.on("coop:ended", onEnded);

    if (s.connected) onConnect();

    return () => {
      s.off("connect", onConnect);
      s.off("coop:room_state", onRoomState);
      s.off("coop:question", onQuestion);
      s.off("coop:started", onStarted);
      s.off("coop:hit", onHit);
      s.off("coop:ended", onEnded);
      socketRef.current = null;
    };
  }, [roomCode, addCoins]);

  const me = state?.players?.find((p) => p.id === socketId);
  const bossHp = Number(state?.bossHp || 0);
  const bossHpMax = 5000;

  const timerMs = Number(state?.timerMs || 0);
  const timerMax = 5 * 60 * 1000;

  const started = !!state?.started;

  useEffect(() => {
    if (!me) return;
    if (me.hp <= 0) setLocalDeadUntil(Date.now() + 5000);
    else setLocalDeadUntil(0);
  }, [me?.hp]);

  const sendAnswer = (picked) => {
    if (!started || !q) return;
    if (me?.hp <= 0) return;
    socketRef.current?.emit("coop:submit_answer", { code: roomCode, picked });
  };

  const respawn = () => {
    socketRef.current?.emit("coop:respawn", { code: roomCode });
  };

  const remaining = Math.max(0, localDeadUntil - Date.now());
  const respawnReady = me?.hp <= 0 && remaining <= 0;

  const exit = () => {
    // leaving co-op entirely
    disconnectCoopSocket();
    onBackToMenu?.();
  };

  return (
    <div className="coopRoot">
      <img className="coopBg" src="/assets/arenas/boss_stage.png" alt="Boss Arena" draggable="false" />
      <div className="coopStage">
        <button className="coopExit" onClick={exit}>Main Menu</button>

        {/* Manual: UI placement vars are in coop.css */}
        <div className="coopTopBars">
          <div className="barBlock">
            <div className="barLabel">Boss</div>
            <div className="barOuter">
              <div
                className="barFill"
                style={{ width: `${Math.max(0, Math.min(1, bossHp / bossHpMax)) * 100}%` }}
              />
            </div>
            <div className="barValue">{bossHp} / {bossHpMax}</div>
          </div>

          <div className="barBlock">
            <div className="barLabel">Time</div>
            <div className="barOuter">
              <div
                className="barFill"
                style={{ width: `${Math.max(0, Math.min(1, timerMs / timerMax)) * 100}%` }}
              />
            </div>
            <div className="barValue">{formatMs(timerMs)}</div>
          </div>
        </div>

        <div className="bossWrap">
          <img className="bossSprite" src="/assets/enemies/boss.png" alt="Boss" draggable="false" />
        </div>

        <div className="playersRow">
          {(state?.players || []).map((p) => {
            const folder = folderForEquippedId(p.equipped);
            const sprite = `/assets/characters/${folder}/back.png`;

            return (
              <div className="playerSlot" key={p.id}>
                <div className="namePlate">
                  <div className="nm">{p.name}</div>
                  <div className={p.hp > 0 ? "hp ok" : "hp dead"}>HP {p.hp}</div>
                </div>
                <img className="playerSprite" src={sprite} alt={p.name} draggable="false" />
              </div>
            );
          })}
        </div>

        <div className="questionHud">
          <img className="qBox" src="/assets/ui/question_box.png" alt="" draggable="false" />

          <div className="qContent">
            {!started ? (
              <div className="qCenter">
                <div className="qTitle">Waiting for host to start…</div>
                <div className="qSub">Room: {roomCode}</div>
              </div>
            ) : endReason ? (
              <div className="qCenter">
                <div className="qTitle">{endText(endReason)}</div>
                <div className="qSub">Press Main Menu to exit.</div>
              </div>
            ) : !q ? (
              <div className="qCenter">
                <div className="qTitle">Loading questions…</div>
                <div className="qSub">Host needs to upload study files.</div>
              </div>
            ) : (
              <>
                <div className="qText">{q.text}</div>

                <div className="ansGrid">
                  <button className="ansBtn" onClick={() => sendAnswer("a")}>A) {q.a}</button>
                  <button className="ansBtn" onClick={() => sendAnswer("b")}>B) {q.b}</button>
                  <button className="ansBtn" onClick={() => sendAnswer("c")}>C) {q.c}</button>
                  <button className="ansBtn" onClick={() => sendAnswer("d")}>D) {q.d}</button>
                </div>

                {me?.hp <= 0 && (
                  <div className="deadOverlay">
                    <div className="deadTitle">You’re down</div>
                    {!respawnReady ? (
                      <div className="deadSub">Respawning in {Math.ceil(remaining / 1000)}…</div>
                    ) : (
                      <button className="respawnBtn" onClick={respawn}>Respawn</button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatMs(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function endText(reason) {
  if (reason === "win") return "Boss Defeated!";
  if (reason === "time") return "Time’s Up!";
  if (reason === "all_dead") return "Party Wiped!";
  if (reason === "host_left") return "Host Left";
  return "Match Ended";
}
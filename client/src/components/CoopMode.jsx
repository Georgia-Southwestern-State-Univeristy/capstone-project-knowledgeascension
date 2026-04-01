import React, { useEffect, useMemo, useRef, useState } from "react";
import "./coop.css";
import { io } from "socket.io-client";
import { useAuth } from "../auth/AuthContext.jsx";
import { CHARACTERS } from "../db/characters";
import { recordDailyStat } from "../game/dailyTasks.js";

function getCoopServerBase() {
  const host = window.location.hostname;
  return `http://${host}:5175`;
}

function folderForEquippedId(id) {
  const key = String(id || "knight").toLowerCase();
  const found = CHARACTERS.find((c) => String(c.id).toLowerCase() === key);
  return found?.folderName || "Knight";
}

export default function CoopMode({ room, onBackToMenu }) {
  const { username, addCoins } = useAuth();

  const [state, setState] = useState(null);
  const [socketId, setSocketId] = useState("");
  const [q, setQ] = useState(null);
  const [endReason, setEndReason] = useState("");
  const [localDeadUntil, setLocalDeadUntil] = useState(0);

  const [bossQuake, setBossQuake] = useState(false);
  const [playerQuakeMap, setPlayerQuakeMap] = useState({});

  const prevBossHpRef = useRef(null);
  const prevHpMapRef = useRef({});
  const startedTrackedRef = useRef(false);
  const winTrackedRef = useRef(false);

  const socketRef = useRef(null);
  const apiBase = useMemo(() => getCoopServerBase(), []);

  const roomCode = String(room?.code || "").toUpperCase();

  const quakeBoss = () => {
    setBossQuake(true);
    window.setTimeout(() => setBossQuake(false), 220);
  };

  const quakePlayer = (playerId) => {
    setPlayerQuakeMap((m) => ({ ...m, [playerId]: true }));
    window.setTimeout(() => {
      setPlayerQuakeMap((m) => ({ ...m, [playerId]: false }));
    }, 220);
  };

  useEffect(() => {
    if (!roomCode) return;

    const s = io(apiBase, { transports: ["websocket"] });
    socketRef.current = s;

    s.on("connect", () => setSocketId(s.id));

    s.on("coop:room_state", (st) => {
      const bossHpNow = Number(st?.bossHp ?? 0);
      const bossHpPrev = prevBossHpRef.current;

      if (bossHpPrev != null && bossHpNow < bossHpPrev) {
        quakeBoss();
      }
      prevBossHpRef.current = bossHpNow;

      const prevHpMap = prevHpMapRef.current || {};
      const curPlayers = Array.isArray(st?.players) ? st.players : [];

      for (const p of curPlayers) {
        const prev = Number(prevHpMap[p.id] ?? p.hp);
        const now = Number(p.hp ?? 0);
        if (prev != null && now < prev) {
          quakePlayer(p.id);
        }
        prevHpMap[p.id] = now;
      }

      prevHpMapRef.current = prevHpMap;
      setState(st);

      if (st?.started && !startedTrackedRef.current) {
        startedTrackedRef.current = true;
        winTrackedRef.current = false;

        if (username) {
          recordDailyStat(username, "coopMatches", 1);
        }
      }

      if (!st?.started && !endReason) {
        startedTrackedRef.current = false;
      }
    });

    s.on("coop:question", (payload) => setQ(payload?.q || null));

    s.on("coop:started", (st) => {
      setEndReason("");
      setState(st);
      setQ(st?.curQuestion || null);
      startedTrackedRef.current = true;
      winTrackedRef.current = false;

      if (username) {
        recordDailyStat(username, "coopMatches", 1);
      }
    });

    s.on("coop:hit", async (payload) => {
      if (!payload) return;

      quakeBoss();

      if (payload.playerId === s.id) {
        if (username) {
          recordDailyStat(username, "correctAnswers", 1);

          if (payload.coinDrop > 0) {
            recordDailyStat(username, "coinsEarned", payload.coinDrop);
          }
        }

        if (payload.coinDrop > 0) {
          try {
            await addCoins(payload.coinDrop);
          } catch {}
        }
      }
    });

    s.on("coop:player_hurt", (payload) => {
      if (payload?.playerId) quakePlayer(payload.playerId);
    });

    s.on("coop:ended", (payload) => {
      const reason = String(payload?.reason || "ended");
      setEndReason(reason);

      if (reason === "win" && !winTrackedRef.current) {
        winTrackedRef.current = true;
        if (username) {
          recordDailyStat(username, "coopWins", 1);
        }
      }
    });

    return () => {
      try { s.disconnect(); } catch {}
      socketRef.current = null;
    };
  }, [apiBase, roomCode, addCoins, username, endReason]);

  const me = state?.players?.find((p) => p.id === socketId);
  const bossHp = Number(state?.bossHp || 0);
  const bossHpMax = 5000;
  const timerMs = Number(state?.timerMs || 0);
  const timerMax = 5 * 60 * 1000;

  const started = !!state?.started;

  useEffect(() => {
    if (!me) return;
    if (me.hp <= 0) {
      const until = Date.now() + 5000;
      setLocalDeadUntil(until);
    } else {
      setLocalDeadUntil(0);
    }
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

  return (
    <div className="coopRoot">
      <img className="coopBg" src="/assets/arenas/boss_stage.png" alt="Boss Arena" draggable="false" />
      <div className="coopStage">
        <button className="coopExit" onClick={onBackToMenu}>Main Menu</button>

        <div className="coopTopBars">
          <div className="barBlock bossBlock">
            <div className="barLabel">Boss</div>
            <div className="barOuter">
              <div
                className="barFill"
                style={{ width: `${Math.max(0, Math.min(1, bossHp / bossHpMax)) * 100}%` }}
              />
            </div>
            <div className="barValue">{bossHp} / {bossHpMax}</div>
          </div>

          <div className="barBlock timeBlock">
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
          <img
            className={bossQuake ? "bossSprite quake" : "bossSprite"}
            src="/assets/enemies/boss.png"
            alt="Boss"
            draggable="false"
          />
        </div>

        <div className="playersRow">
          {(state?.players || []).map((p) => {
            const folder = folderForEquippedId(p.equipped);
            const sprite = `/assets/characters/${folder}/back.png`;
            const quaking = !!playerQuakeMap[p.id];

            return (
              <div className="playerSlot" key={p.id}>
                <div className="namePlate">
                  <div className="nm">{p.name}</div>
                  <div className={p.hp > 0 ? "hp ok" : "hp dead"}>HP {p.hp}</div>
                </div>

                <img
                  className={quaking ? "playerSprite quake" : "playerSprite"}
                  src={sprite}
                  alt={p.name}
                  draggable="false"
                />
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
                <div className="qTitle">Loading your questions…</div>
                <div className="qSub">You’ll get your own random stream.</div>
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
                    <div>
                      <div className="deadTitle">You’re down</div>
                      {!respawnReady ? (
                        <div className="deadSub">Respawning in {Math.ceil(remaining / 1000)}…</div>
                      ) : (
                        <button className="respawnBtn" onClick={respawn}>Respawn</button>
                      )}
                    </div>
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
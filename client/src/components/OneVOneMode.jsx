import React, { useEffect, useMemo, useRef, useState } from "react";
import "./onevone.css";
import { io } from "socket.io-client";
import { useAuth } from "../auth/AuthContext.jsx";
import { getFolderNameFromId } from "../db/characters";
import { recordDailyStat } from "../game/dailyTasks.js";

function getServerBase() {
  const host = window.location.hostname;
  return `http://${host}:5175`;
}

function safeLower(v) {
  return String(v || "").trim().toLowerCase();
}

export default function OneVOneMode({ room, onBackToMenu }) {
  const { profile, addCoins, username } = useAuth();

  const apiBase = useMemo(() => getServerBase(), []);
  const socketRef = useRef(null);

  const [socketId, setSocketId] = useState("");
  const [state, setState] = useState(null);
  const [q, setQ] = useState(null);
  const [endReason, setEndReason] = useState("");

  const [meQuake, setMeQuake] = useState(false);
  const [enemyQuake, setEnemyQuake] = useState(false);

  const prevHpRef = useRef({ me: null, enemy: null });
  const startedTrackedRef = useRef(false);
  const winTrackedRef = useRef(false);

  const roomCode = String(room?.code || "").toUpperCase();
  const equipped = safeLower(profile?.equippedCharacter || "knight");

  useEffect(() => {
    if (!roomCode) return;

    const s = io(apiBase, { transports: ["websocket"] });
    socketRef.current = s;

    s.on("connect", () => {
      setSocketId(s.id);
      s.emit("onevone:update_equipped", { code: roomCode, equipped });
    });

    s.on("onevone:state", (st) => {
      setState(st);

      const me = st?.players?.find((p) => p.id === s.id);
      const enemy = st?.players?.find((p) => p.id !== s.id);

      const meHp = me ? Number(me.hp ?? 0) : null;
      const enHp = enemy ? Number(enemy.hp ?? 0) : null;

      const prev = prevHpRef.current;

      if (prev.me != null && meHp != null && meHp < prev.me) {
        setMeQuake(true);
        window.setTimeout(() => setMeQuake(false), 220);
      }

      if (prev.enemy != null && enHp != null && enHp < prev.enemy) {
        setEnemyQuake(true);
        window.setTimeout(() => setEnemyQuake(false), 220);

        if (username && st?.started) {
          recordDailyStat(username, "correctAnswers", 1);
        }
      }

      prevHpRef.current = { me: meHp, enemy: enHp };

      if (st?.started && !startedTrackedRef.current) {
        startedTrackedRef.current = true;
        winTrackedRef.current = false;

        if (username) {
          recordDailyStat(username, "onevoneMatches", 1);
        }
      }

      if (!st?.started && !endReason) {
        startedTrackedRef.current = false;
      }
    });

    s.on("onevone:question", (payload) => setQ(payload?.q || null));

    s.on("onevone:loot", async (payload) => {
      const amount = Math.max(0, Number(payload?.amount || 0));
      if (!amount) return;

      if (username) {
        recordDailyStat(username, "coinsEarned", amount);
      }

      try {
        await addCoins(amount);
      } catch {}
    });

    s.on("onevone:ended", async (payload) => {
      const reason = String(payload?.reason || "ended");
      setEndReason(reason);

      if (payload?.winner === s.id) {
        if (!winTrackedRef.current && username) {
          winTrackedRef.current = true;
          recordDailyStat(username, "onevoneWins", 1);
          recordDailyStat(username, "coinsEarned", 50);
        }

        try {
          await addCoins(50);
        } catch {}
      }
    });

    return () => {
      try { s.disconnect(); } catch {}
      socketRef.current = null;
    };
  }, [apiBase, roomCode, equipped, addCoins, username, endReason]);

  const started = !!state?.started;

  const me = state?.players?.find((p) => p.id === socketId);
  const enemy = state?.players?.find((p) => p.id !== socketId);

  const myFolder = getFolderNameFromId(me?.equipped || equipped);
  const enemyFolder = getFolderNameFromId(enemy?.equipped || "knight");

  const myBack = `/assets/characters/${myFolder}/back.png`;
  const enemyFront = `/assets/characters/${enemyFolder}/front.png`;

  const sendAnswer = (picked) => {
    if (!started || endReason) return;
    if (!q) return;
    socketRef.current?.emit("onevone:submit_answer", { code: roomCode, picked });
  };

  const pct = (hp, maxHp) => {
    const p = maxHp ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    return `${p * 100}%`;
  };

  const myHp = Number(me?.hp ?? 0);
  const myHpMax = Number(me?.hpMax ?? 1);

  const enHp = Number(enemy?.hp ?? 0);
  const enHpMax = Number(enemy?.hpMax ?? 1);

  return (
    <div className="v1GameRoot">
      <img className="v1Arena" src="/assets/arenas/forest.png" alt="" draggable="false" />

      <button className="v1Exit" onClick={onBackToMenu}>Main Menu</button>

      <div className="v1Hud">
        <div className="v1HudBlock">
          <div className="v1HudName">{enemy?.name || "Enemy"}</div>
          <div className="v1HudBar">
            <div className="v1HudFill" style={{ width: pct(enHp, enHpMax) }} />
          </div>
          <div className="v1HudNum">{enHp} / {enHpMax}</div>
        </div>

        <div className="v1HudBlock me">
          <div className="v1HudName">{me?.name || "You"}</div>
          <div className="v1HudBar">
            <div className="v1HudFill" style={{ width: pct(myHp, myHpMax) }} />
          </div>
          <div className="v1HudNum">{myHp} / {myHpMax}</div>
        </div>
      </div>

      <div className="v1Sprites">
        <img className={enemyQuake ? "v1Enemy quake" : "v1Enemy"} src={enemyFront} alt="Enemy" draggable="false" />
        <img className={meQuake ? "v1Me quake" : "v1Me"} src={myBack} alt="You" draggable="false" />
      </div>

      <div className="v1QuestionHud">
        <img className="v1QFrame" src="/assets/ui/question_box.png" alt="" draggable="false" />
        <div className="v1QInner">
          {!started ? (
            <div className="v1Center">
              <div className="v1Title">Waiting for host to start…</div>
              <div className="v1Sub">Room: {roomCode}</div>
            </div>
          ) : endReason ? (
            <div className="v1Center">
              <div className="v1Title">{endText(endReason, socketId, state)}</div>
              <div className="v1Sub">Winner gets 50 coins.</div>
            </div>
          ) : !q ? (
            <div className="v1Center">
              <div className="v1Title">Loading your questions…</div>
              <div className="v1Sub">You and your opponent have separate questions.</div>
            </div>
          ) : (
            <>
              <div className="v1QText">{q.text}</div>

              <div className="v1AnsCol">
                <button className="v1Ans" onClick={() => sendAnswer("a")}>A) {q.a}</button>
                <button className="v1Ans" onClick={() => sendAnswer("b")}>B) {q.b}</button>
                <button className="v1Ans" onClick={() => sendAnswer("c")}>C) {q.c}</button>
                <button className="v1Ans" onClick={() => sendAnswer("d")}>D) {q.d}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function endText(reason, socketId, state) {
  if (reason === "win") {
    const winnerId = state?.winnerId;
    if (!winnerId) return "Match Over";
    return winnerId === socketId ? "You Win!" : "You Lose";
  }
  if (reason === "opponent_left") return "Opponent Left";
  return "Match Ended";
}
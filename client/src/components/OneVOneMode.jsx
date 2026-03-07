import React, { useEffect, useMemo, useRef, useState } from "react";
import "./onevone.css";
import { useAuth } from "../auth/AuthContext.jsx";
import { getFolderNameFromId } from "../db/characters";
import { getOneVOneSocket } from "../net/onevoneSocket.js";

function safeLower(v) {
  return String(v || "").trim().toLowerCase();
}

export default function OneVOneMode({ room, onBackToMenu }) {
  const { profile, addCoins, username } = useAuth();

  const socketRef = useRef(null);

  const [socketId, setSocketId] = useState("");
  const [state, setState] = useState(null);
  const [q, setQ] = useState(null);
  const [endReason, setEndReason] = useState("");

  const [meQuake, setMeQuake] = useState(false);
  const [enemyQuake, setEnemyQuake] = useState(false);

  const prevHpRef = useRef({ me: null, enemy: null });

  const roomCode = String(room?.code || "").toUpperCase();
  const equipped = safeLower(profile?.equippedCharacter || "knight");

  useEffect(() => {
    if (!roomCode) return;

    const s = getOneVOneSocket();
    socketRef.current = s;

    const onConnect = () => {
      setSocketId(s.id);
      s.emit("onevone:update_equipped", { code: roomCode, equipped });

      // If we navigated in after the host started, request the current question for THIS player.
      s.emit("onevone:request_question", { code: roomCode });
    };

    const onState = (st) => {
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
      }

      prevHpRef.current = { me: meHp, enemy: enHp };
    };

    const onQuestion = (payload) => {
      setQ(payload?.q || null);
    };

    const onLoot = async (payload) => {
      const amount = Math.max(0, Number(payload?.amount || 0));
      if (!amount) return;
      try {
        await addCoins(amount);
      } catch {}
    };

    const onEnded = async (payload) => {
      setEndReason(String(payload?.reason || "ended"));

      // winner gets 50 coins
      if (payload?.winner === s.id) {
        try {
          await addCoins(50);
        } catch {}
      }
    };

    const onDisconnect = () => {
      // keep UI; socket reconnect will re-request question on connect
    };

    const onError = () => {
      // errors are already handled in lobby; game can stay quiet
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);

    s.on("onevone:error", onError);
    s.on("onevone:state", onState);
    s.on("onevone:question", onQuestion);
    s.on("onevone:loot", onLoot);
    s.on("onevone:ended", onEnded);

    if (s.connected) onConnect();

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);

      s.off("onevone:error", onError);
      s.off("onevone:state", onState);
      s.off("onevone:question", onQuestion);
      s.off("onevone:loot", onLoot);
      s.off("onevone:ended", onEnded);

      socketRef.current = null;
    };
  }, [roomCode, equipped, addCoins]);

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

      <button className="v1Exit" onClick={onBackToMenu}>
        Main Menu
      </button>

      <div className="v1Hud">
        <div className="v1HudBlock">
          <div className="v1HudName">{enemy?.name || "Enemy"}</div>
          <div className="v1HudBar">
            <div className="v1HudFill" style={{ width: pct(enHp, enHpMax) }} />
          </div>
          <div className="v1HudNum">
            {enHp} / {enHpMax}
          </div>
        </div>

        <div className="v1HudBlock me">
          <div className="v1HudName">{me?.name || "You"}</div>
          <div className="v1HudBar">
            <div className="v1HudFill" style={{ width: pct(myHp, myHpMax) }} />
          </div>
          <div className="v1HudNum">
            {myHp} / {myHpMax}
          </div>
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
              <div className="v1Title">Loading your question…</div>
              <div className="v1Sub">If it takes long, host may not have uploaded yet.</div>
            </div>
          ) : (
            <>
              <div className="v1QText">{q.text}</div>

              <div className="v1AnsCol">
                <button className="v1Ans" onClick={() => sendAnswer("a")}>
                  A) {q.a}
                </button>
                <button className="v1Ans" onClick={() => sendAnswer("b")}>
                  B) {q.b}
                </button>
                <button className="v1Ans" onClick={() => sendAnswer("c")}>
                  C) {q.c}
                </button>
                <button className="v1Ans" onClick={() => sendAnswer("d")}>
                  D) {q.d}
                </button>
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
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./endless.css";
import { seedQuestionsIfNeeded, getRandomQuestion } from "../db/questionsDb";

const UI = {
  ENEMY_BAR: "/assets/ui/enemy_bar.png",
  HERO_BAR: "/assets/ui/hero_bar.png",
  QUESTION_BOX: "/assets/ui/question_box.png",
  YOU_DIED: "/assets/ui/you_died.png",
};

const ARENAS = [
  "/assets/arenas/forest.png",
  "/assets/arenas/desert.png",
  "/assets/arenas/temple.png",
];

const ENEMIES = [
  { name: "Clam", src: "/assets/enemies/clam.png" },
  { name: "Fire Sprite", src: "/assets/enemies/fire.png" },
  { name: "Crystal Monster", src: "/assets/enemies/crystal.png" },
  { name: "Slime", src: "/assets/enemies/slime.png" },
  { name: "Skeleton", src: "/assets/enemies/skeleton.png" },
  { name: "Cave Skeleton", src: "/assets/enemies/cave_skeleton.png" },
];

// ✅ MUSIC IS IN client/public/assets/src/audio
const BATTLE_MUSIC_URL = "/assets/src/assets/audio/track_battle.mp3";

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function EndlessMode({ onBackToMenu }) {
  // ---- 1920x1080 stage scaling ----
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const W = 1920, H = 1080;
    const update = () =>
      setScale(Math.min(1, Math.min(window.innerWidth / W, window.innerHeight / H)));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const stageStyle = useMemo(
    () => ({ transform: `translate(-50%, -50%) scale(${scale})` }),
    [scale]
  );

  // ---- click-to-start music ----
  const musicRef = useRef(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const a = new Audio(BATTLE_MUSIC_URL);
    a.loop = true;
    a.volume = 0.7;
    musicRef.current = a;

    return () => {
      try { a.pause(); } catch {}
      musicRef.current = null;
    };
  }, []);

  const startRun = async () => {
    setStarted(true);
    const a = musicRef.current;
    if (a) {
      try {
        await a.play();
      } catch (e) {
        // If autoplay blocks, user can click again
        console.warn("Audio play blocked:", e);
      }
    }
  };

  // ---- game state ----
  const [arena] = useState(() => pick(ARENAS));
  const [playerHp, setPlayerHp] = useState(100);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [kills, setKills] = useState(0);
  const [dead, setDead] = useState(false);
  const [locked, setLocked] = useState(false);

  const [enemy, setEnemy] = useState(() => {
    const e = pick(ENEMIES);
    const hp = randInt(10, 100);
    return { ...e, maxHp: hp, hp };
  });

  const [question, setQuestion] = useState(null);

  useEffect(() => {
    (async () => {
      await seedQuestionsIfNeeded();
      setQuestion(await getRandomQuestion());
    })();
  }, []);

  const nextQuestion = async () => setQuestion(await getRandomQuestion());

  const rollCoinDrop = () => (Math.random() < 0.35 ? randInt(1, 7) : 0);

  const spawnEnemy = () => {
    const e = pick(ENEMIES);
    const hp = randInt(10, 100);
    setEnemy({ ...e, maxHp: hp, hp });
  };

  const answer = async (key) => {
    if (!started || !question || locked || dead) return;
    setLocked(true);

    const correct = question.correct === key;

    if (correct) {
      setEnemy((cur) => ({ ...cur, hp: Math.max(0, cur.hp - 10) }));
    } else {
      setPlayerHp((hp) => Math.max(0, hp - 10));
    }

    setTimeout(async () => {
      // player death
      setPlayerHp((hp) => {
        if (hp <= 0) setDead(true);
        return hp;
      });

      // enemy death
      if (correct) {
        let diedNow = false;
        setEnemy((cur) => {
          if (cur.hp <= 0) diedNow = true;
          return cur;
        });
        if (diedNow) {
          setKills((k) => k + 1);
          setCoinsEarned((c) => c + rollCoinDrop());
          spawnEnemy();
        }
      }

      await nextQuestion();
      setLocked(false);
    }, 180);
  };

  const heroPct = Math.max(0, Math.min(1, playerHp / 100));
  const enemyPct = enemy.maxHp ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHp)) : 1;

  const heroFront = "/assets/characters/knight/front.png";

  if (dead) {
    return (
      <div className="endRoot">
        <div className="endStage" style={stageStyle}>
          <img className="arenaBg" src={arena} alt="" draggable="false" />
          <div className="deathOverlay">
            <img className="youDied" src={UI.YOU_DIED} alt="You Died" draggable="false" />
            <div className="deathStats">
              <div><b>Enemies Killed:</b> {kills}</div>
              <div><b>Brains Earned:</b> {coinsEarned}</div>
            </div>
            <div className="deathButtons">
              <button onClick={() => window.location.reload()}>Play Again</button>
              <button onClick={onBackToMenu}>Menu</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="endRoot">
      <div className="endStage" style={stageStyle}>
        <img className="arenaBg" src={arena} alt="" draggable="false" />

        <div className="hud">
          <div>Brains: {coinsEarned}</div>
          <div>Kills: {kills}</div>
        </div>

        <button className="menuBtn" onClick={onBackToMenu}>Menu</button>

        <img className="heroSprite" src={heroFront} alt="Hero" draggable="false" />
        <img className="enemySprite" src={enemy.src} alt={enemy.name} draggable="false" />

        <div className="bar enemyBar">
          <img className="barFrame" src={UI.ENEMY_BAR} alt="" draggable="false" />
          <div className="barName">{enemy.name}</div>
          <div className="barFill" style={{ transform: `scaleX(${enemyPct})` }} />
        </div>

        <div className="bar heroBar">
          <img className="barFrame" src={UI.HERO_BAR} alt="" draggable="false" />
          <div className="barName">Hero</div>
          <div className="barFill" style={{ transform: `scaleX(${heroPct})` }} />
        </div>

        <div className="qWrap">
          <img className="qFrame" src={UI.QUESTION_BOX} alt="" draggable="false" />
          <div className="qText">{question ? question.text : "Loading..."}</div>

          <button className="ans a1" disabled={!started || locked} onClick={() => answer("a")}><span>{question?.a ?? ""}</span></button>
          <button className="ans a2" disabled={!started || locked} onClick={() => answer("b")}><span>{question?.b ?? ""}</span></button>
          <button className="ans a3" disabled={!started || locked} onClick={() => answer("c")}><span>{question?.c ?? ""}</span></button>
          <button className="ans a4" disabled={!started || locked} onClick={() => answer("d")}><span>{question?.d ?? ""}</span></button>
        </div>

        {!started && (
          <div className="startOverlay">
            <div className="startCard">
              <div className="startTitle">Endless Mode</div>
              <div className="startSub">Click Start to enable questions + battle music</div>
              <button className="startBtn" onClick={startRun}>Start</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

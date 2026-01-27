import React, { useEffect, useMemo, useRef, useState } from "react";
import "./menu.css";

// Menu music (your lobby track)
import trackLobby from "../assets/audio/track_menu1.mp3";

export default function MainMenu() {
  // ---- Selection ----
  const [selected, setSelected] = useState("1V1");

  // ---- 1920x1080 scaling (guaranteed fit) ----
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const stageW = 1920;
    const stageH = 1080;

    const update = () => {
      const s = Math.min(window.innerWidth / stageW, window.innerHeight / stageH);
      setScale(Math.min(s, 1));
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const stageStyle = useMemo(
    () => ({ transform: `translate(-50%, -50%) scale(${scale})` }),
    [scale]
  );

  // ---- Menu Music (click to start) ----
  const audioRef = useRef(null);
  const [musicOn, setMusicOn] = useState(false);
  const [volume, setVolume] = useState(0.6);

  useEffect(() => {
    const a = new Audio(trackLobby);
    a.loop = true;
    a.volume = volume;
    audioRef.current = a;

    return () => {
      a.pause();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const startMusic = async () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      await a.play();
      setMusicOn(true);
    } catch (e) {
      console.log("Music blocked until user interaction:", e);
      setMusicOn(false);
    }
  };

  const stopMusic = () => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setMusicOn(false);
  };

  // Keyboard menu selection
  useEffect(() => {
    const order = ["1V1", "COOP", "ENDLESS"];
    function onKey(e) {
      const k = (e.key || "").toLowerCase();
      if (k === "arrowdown" || k === "s") {
        setSelected((cur) => order[(order.indexOf(cur) + 1) % order.length]);
      }
      if (k === "arrowup" || k === "w") {
        setSelected((cur) => order[(order.indexOf(cur) - 1 + order.length) % order.length]);
      }
      if (k === "enter") console.log("Start mode:", selected);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  // helper: button markup with gold plate layer
  const ButtonWithPlate = ({ imgSrc, alt }) => (
    <div className="btnWrap">
      <div className="goldGlow" />
      <img src={imgSrc} alt={alt} draggable="false" />
    </div>
  );

  return (
    <div className="menuRoot">
      <video className="menuBg" src="/assets/menu/bg.mp4" autoPlay loop muted playsInline />

      <div className="menuStage" style={stageStyle}>
        <img
          className="menuTitle"
          src="/assets/menu/title.png"
          alt="Knowledge Ascension"
          draggable="false"
        />

        {/* Shop */}
        <button className="imgBtn shopBtn" onClick={() => console.log("Shop")}>
          <ButtonWithPlate imgSrc="/assets/menu/btn_shop.png" alt="Shop" />
        </button>

        {/* Modes */}
        <button
          className={`imgBtn modeBtn btn1 ${selected === "1V1" ? "selected" : ""}`}
          onMouseEnter={() => setSelected("1V1")}
          onClick={() => console.log("Start 1v1")}
        >
          <ButtonWithPlate imgSrc="/assets/menu/btn_1v1.png" alt="1v1" />
        </button>

        <button
          className={`imgBtn modeBtn btn2 ${selected === "COOP" ? "selected" : ""}`}
          onMouseEnter={() => setSelected("COOP")}
          onClick={() => console.log("Start Co-op")}
        >
          <ButtonWithPlate imgSrc="/assets/menu/btn_coop.png" alt="Co-op Boss" />
        </button>

        <button
          className={`imgBtn modeBtn btn3 ${selected === "ENDLESS" ? "selected" : ""}`}
          onMouseEnter={() => setSelected("ENDLESS")}
          onClick={() => console.log("Start Endless")}
        >
          <ButtonWithPlate imgSrc="/assets/menu/btn_endless.png" alt="Endless Mode" />
        </button>

        {/* Music controls (click to start) */}
        <div className="musicPanel">
          {!musicOn ? (
            <button onClick={startMusic}>Start Music</button>
          ) : (
            <button onClick={stopMusic}>Stop Music</button>
          )}
          <span>Vol</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}

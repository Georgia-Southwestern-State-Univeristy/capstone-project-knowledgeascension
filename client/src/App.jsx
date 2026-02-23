import React, { useState } from "react";
import MainMenu from "./components/MainMenu.jsx";
import EndlessMode from "./components/EndlessMode.jsx";
import Shop from "./components/Shop.jsx";
import CoopLobby from "./components/CoopLobby.jsx";
import CoopMode from "./components/CoopMode.jsx";

export default function App() {
  const [screen, setScreen] = useState("menu"); // "menu" | "endless" | "shop" | "coop_lobby" | "coop_game"
  const [coopRoom, setCoopRoom] = useState(null); // { code, isHost }

  if (screen === "endless") {
    return <EndlessMode onBackToMenu={() => setScreen("menu")} />;
  }

  if (screen === "shop") {
    return <Shop onBackToMenu={() => setScreen("menu")} />;
  }

  if (screen === "coop_lobby") {
    return (
      <CoopLobby
        onBackToMenu={() => setScreen("menu")}
        onEnterGame={(roomInfo) => {
          setCoopRoom(roomInfo);
          setScreen("coop_game");
        }}
      />
    );
  }

  if (screen === "coop_game") {
    return (
      <CoopMode
        room={coopRoom}
        onBackToMenu={() => {
          setCoopRoom(null);
          setScreen("menu");
        }}
      />
    );
  }

  return (
    <MainMenu
      onStartEndless={() => setScreen("endless")}
      onOpenShop={() => setScreen("shop")}
      onOpenCoop={() => setScreen("coop_lobby")}
    />
  );
}

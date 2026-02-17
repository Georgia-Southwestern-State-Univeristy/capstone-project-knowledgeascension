import React, { useState } from "react";
import MainMenu from "./components/MainMenu.jsx";
import EndlessMode from "./components/EndlessMode.jsx";
import Shop from "./components/Shop.jsx";

export default function App() {
  const [screen, setScreen] = useState("menu"); // "menu" | "endless" | "shop"

  if (screen === "endless") {
    return <EndlessMode onBackToMenu={() => setScreen("menu")} />;
  }

  if (screen === "shop") {
    return <Shop onBackToMenu={() => setScreen("menu")} />;
  }

  return (
    <MainMenu
      onStartEndless={() => setScreen("endless")}
      onOpenShop={() => setScreen("shop")}
    />
  );
}

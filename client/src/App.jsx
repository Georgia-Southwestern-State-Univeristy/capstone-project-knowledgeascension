import React, { useState } from "react";
import MainMenu from "./components/MainMenu.jsx";
import EndlessMode from "./components/EndlessMode.jsx";
import Shop from "./components/Shop.jsx";

export default function App() {
  const [page, setPage] = useState("menu");

  const goMenu = () => setPage("menu");
  const goShop = () => setPage("shop");
  const goEndless = () => setPage("endless");

  if (page === "shop") {
    return <Shop onBackToMenu={goMenu} />;
  }

  if (page === "endless") {
    return <EndlessMode onBackToMenu={goMenu} />;
  }

  return <MainMenu onStartEndless={goEndless} onOpenShop={goShop} />;
}

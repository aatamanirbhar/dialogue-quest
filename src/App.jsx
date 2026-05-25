import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Categories from "./pages/Categories";
import SoloGame from "./pages/SoloGame";
import MultiplayerLobby from "./pages/MultiplayerLobby";
import Room from "./pages/Room";
import LyricsGame from "./pages/LyricsGame";
import LyricsAdmin from "./pages/LyricsAdmin";
import ResetPassword from "./pages/ResetPassword";
import { useMusicMode } from "./lib/audio";

export default function App(){
 const location = useLocation();
 const path = location.pathname;
 const musicMode =
  path.startsWith("/solo") || path === "/lyrics"
   ? "solo"
   : path.startsWith("/multiplayer") ||
     path.startsWith("/room")
    ? "multiplayer"
    : "home";

 useMusicMode(musicMode);

 return (
  <Routes>
   <Route path="/" element={<Home />} />
   <Route path="/categories" element={<Categories />} />
   <Route path="/solo/:category" element={<SoloGame />} />
   <Route path="/lyrics" element={<LyricsGame />} />
   <Route path="/admin/lyrics" element={<LyricsAdmin />} />
   <Route path="/reset-password" element={<ResetPassword />} />
   <Route path="/multiplayer" element={<MultiplayerLobby />} />
   <Route path="/room/:code" element={<Room />} />
  </Routes>
 )
}

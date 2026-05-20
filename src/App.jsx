import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Categories from "./pages/Categories";
import SoloGame from "./pages/SoloGame";
import Payment from "./pages/Payment";
import MultiplayerLobby from "./pages/MultiplayerLobby";
import Room from "./pages/Room";
import LyricsGame from "./pages/LyricsGame";
import ResetPassword from "./pages/ResetPassword";

export default function App(){
 return (
  <Routes>
   <Route path="/" element={<Home />} />
   <Route path="/categories" element={<Categories />} />
   <Route path="/solo/:category" element={<SoloGame />} />
   <Route path="/lyrics" element={<LyricsGame />} />
   <Route path="/payment" element={<Payment />} />
   <Route path="/reset-password" element={<ResetPassword />} />
   <Route path="/multiplayer" element={<MultiplayerLobby />} />
   <Route path="/room/:code" element={<Room />} />
  </Routes>
 )
}

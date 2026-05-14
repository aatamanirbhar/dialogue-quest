import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getPlayerId } from "../lib/player";

export default function MultiplayerLobby() {
 const [roomCode, setRoomCode] = useState("");
 const [username, setUsername] = useState("");
 const navigate = useNavigate();

 const createRoom = async () => {
  if (!username) {
   alert("Enter username");
   return;
  }

  const code = Math.random()
   .toString(36)
   .substring(2, 8)
   .toUpperCase();

  const playerId = getPlayerId();

  const { error } = await supabase
   .from("rooms")
   .insert({
    room_code: code,
    host_id: playerId,
    current_question: 0,
    game_started: false
   });

  if (error) {
   console.error(error);
   return;
  }

  await supabase
   .from("room_players")
   .insert({
    room_code: code,
    player_id: playerId,
    username,
    score: 0
   });

  navigate(`/room/${code}`);
 };

 const joinRoom = async () => {
  if (!username) {
   alert("Enter username");
   return;
  }

  const playerId = getPlayerId();

  const { data } = await supabase
   .from("rooms")
   .select("*")
   .eq("room_code", roomCode.toUpperCase())
   .single();

  if (!data) {
   alert("Room not found");
   return;
  }

  const { data: existing } = await supabase
   .from("room_players")
   .select("*")
   .eq("room_code", roomCode.toUpperCase())
   .eq("player_id", playerId)
   .maybeSingle();

  if (!existing) {
   await supabase
    .from("room_players")
    .insert({
      room_code: roomCode.toUpperCase(),
      player_id: playerId,
      username,
      score: 0
    });
  }

  navigate(`/room/${roomCode.toUpperCase()}`);
 };

 return (
  <div className="min-h-screen flex items-center justify-center px-6">
   <div className="bg-zinc-900 p-10 rounded-3xl w-full max-w-xl">
    <h1 className="text-5xl font-bold mb-8">
     Multiplayer
    </h1>

    <input
     value={username}
     onChange={(e) => setUsername(e.target.value)}
     placeholder="Username"
     className="w-full p-4 rounded-xl bg-zinc-800 mb-5"
    />

    <button
     onClick={createRoom}
     className="w-full bg-yellow-400 text-black py-4 rounded-xl font-bold mb-6"
    >
     Create Room
    </button>

    <input
     value={roomCode}
     onChange={(e) => setRoomCode(e.target.value)}
     placeholder="Enter room code"
     className="w-full p-4 rounded-xl bg-zinc-800 mb-5 uppercase"
    />

    <button
     onClick={joinRoom}
     className="w-full bg-white text-black py-4 rounded-xl font-bold"
    >
     Join Room
    </button>
   </div>
  </div>
 );
}
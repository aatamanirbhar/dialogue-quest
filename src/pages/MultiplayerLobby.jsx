import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { getPlayerId } from "../lib/player";

export default function MultiplayerLobby() {
 const navigate = useNavigate();

 const [username, setUsername] = useState("");
 const [roomCode, setRoomCode] = useState("");
 const [selectedCategory, setSelectedCategory] =
  useState("Hollywood");

 const [selectedRounds, setSelectedRounds] =
  useState(10);

 const [endlessMode, setEndlessMode] =
  useState(false);

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

    game_started: false,

    category: selectedCategory,

    total_rounds: selectedRounds,

    endless_mode: endlessMode
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

  const upperCode = roomCode.toUpperCase();

  const { data: room } = await supabase
   .from("rooms")
   .select("*")
   .eq("room_code", upperCode)
   .single();

  if (!room) {
   alert("Room not found");
   return;
  }

  const { data: existing } = await supabase
   .from("room_players")
   .select("*")
   .eq("room_code", upperCode)
   .eq("player_id", playerId)
   .maybeSingle();

  if (!existing) {
   await supabase
    .from("room_players")
    .insert({
      room_code: upperCode,

      player_id: playerId,

      username,

      score: 0
    });
  }

  navigate(`/room/${upperCode}`);
 };

 return (
  <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">

   <div className="bg-zinc-900 rounded-3xl p-10 w-full max-w-xl">

    <h1 className="text-5xl font-bold mb-8">
      Multiplayer
    </h1>

    <input
     value={username}
     onChange={(e) =>
      setUsername(e.target.value)
     }
     placeholder="Username"
     className="w-full bg-zinc-800 p-4 rounded-xl mb-5"
    />

    <select
     value={selectedCategory}
     onChange={(e) =>
      setSelectedCategory(e.target.value)
     }
     className="w-full bg-zinc-800 p-4 rounded-xl mb-5"
    >
      <option>Hollywood</option>
      <option>Bollywood</option>
      <option>TV Series</option>
      <option>Anime</option>
    </select>

    <select
     value={selectedRounds}
     onChange={(e) =>
      setSelectedRounds(
       Number(e.target.value)
      )
     }
     className="w-full bg-zinc-800 p-4 rounded-xl mb-5"
    >
      <option value={5}>
        5 Rounds
      </option>

      <option value={10}>
        10 Rounds
      </option>

      <option value={20}>
        20 Rounds
      </option>
    </select>

    <button
     onClick={() =>
      setEndlessMode(!endlessMode)
     }
     className="w-full bg-zinc-800 p-4 rounded-xl mb-5"
    >
      {endlessMode
       ? "Endless Mode Enabled"
       : "Enable Endless Mode"}
    </button>

    <button
     onClick={createRoom}
     className="w-full bg-yellow-400 text-black p-4 rounded-xl font-bold mb-8"
    >
      Create Room
    </button>

    <input
     value={roomCode}
     onChange={(e) =>
      setRoomCode(e.target.value)
     }
     placeholder="Enter Room Code"
     className="w-full bg-zinc-800 p-4 rounded-xl mb-5 uppercase"
    />

    <button
     onClick={joinRoom}
     className="w-full bg-white text-black p-4 rounded-xl font-bold"
    >
      Join Room
    </button>
   </div>
  </div>
 );
}
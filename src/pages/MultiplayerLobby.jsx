import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { getPlayerId } from "../lib/player";

export default function MultiplayerLobby() {
 const navigate = useNavigate();

 const [username, setUsername] = useState("");
 const [roomCode, setRoomCode] = useState("");
 const [selectedCategory, setSelectedCategory] =
  useState("hollywood");

 const [selectedRounds, setSelectedRounds] =
  useState(10);

 const [questionDuration, setQuestionDuration] =
  useState(30);

 const [endlessMode, setEndlessMode] =
  useState(false);

 const handleLobbyKeyDown = (event) => {
  if (event.key !== "Enter") return;

  if (roomCode.trim()) {
   joinRoom();
   return;
  }

  createRoom();
 };

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

    endless_mode: endlessMode,

    question_duration:
     questionDuration,

    game_finished: false,

    show_trivia: true,

    processing_answer: false
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

  if (room.game_finished) {
   alert("This room has already ended");
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

   <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-6 w-full max-w-6xl">

    <div
     onKeyDown={handleLobbyKeyDown}
     className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8"
    >

     <div className="mb-8">
      <p className="text-yellow-400 uppercase tracking-[0.25em] text-sm mb-3">
       Realtime Arena
      </p>
      <h1 className="text-5xl font-bold">
        Multiplayer
      </h1>
     </div>

    <input
     value={username}
     onChange={(e) =>
      setUsername(e.target.value)
     }
     placeholder="Username"
     className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5"
    />

    <select
     value={selectedCategory}
     onChange={(e) =>
      setSelectedCategory(e.target.value)
     }
     className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5"
    >
      <option value="hollywood">Hollywood</option>
      <option value="bollywood">Bollywood</option>
      <option value="tvshows">TV Series</option>
      <option value="mix">Mixed</option>
      <option value="anime">Anime</option>
    </select>

    <select
     value={selectedRounds}
     onChange={(e) =>
      setSelectedRounds(
       Number(e.target.value)
      )
     }
     className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5"
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

    <select
     value={questionDuration}
     onChange={(e) =>
      setQuestionDuration(
       Number(e.target.value)
      )
     }
     className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5"
    >
      <option value={15}>
        15 Seconds
      </option>
      <option value={30}>
        30 Seconds
      </option>
      <option value={45}>
        45 Seconds
      </option>
      <option value={60}>
        60 Seconds
      </option>
      <option value={0}>
        Timeless
      </option>
    </select>

    <button
     onClick={() =>
      setEndlessMode(!endlessMode)
     }
     className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5"
    >
      {endlessMode
       ? "Endless Mode Enabled"
       : "Enable Endless Mode"}
    </button>

    <button
     onClick={createRoom}
     className="w-full bg-yellow-400 text-black p-4 rounded-lg font-bold mb-8"
    >
      Create Room
    </button>

    <input
     value={roomCode}
     onChange={(e) =>
      setRoomCode(e.target.value)
     }
     placeholder="Enter Room Code"
     className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5 uppercase"
    />

    <button
     onClick={joinRoom}
     className="w-full bg-white text-black p-4 rounded-lg font-bold"
    >
      Join Room
    </button>
    </div>

    <div className="bg-white text-black rounded-2xl p-8 flex flex-col justify-between">
     <div>
      <p className="uppercase tracking-[0.25em] text-sm text-zinc-500 mb-4">
       Premium Wall Ready
      </p>

      <h2 className="text-4xl font-bold mb-5">
       Turn game nights into a paid arena.
      </h2>

      <p className="text-zinc-600 leading-relaxed mb-8">
       Use this panel as the premium gate for private rooms, longer competitions, hosted events, and creator packs.
      </p>

      <div className="grid gap-3 mb-8">
       {[
        "Private rooms and invite codes",
        "Longer round packs and timeless mode",
        "Leaderboard bragging rights",
        "Future Stripe or PayPal checkout hook"
       ].map((feature) => (
        <div
         key={feature}
         className="border border-zinc-200 rounded-lg p-4 font-medium"
        >
         {feature}
        </div>
       ))}
      </div>
     </div>

     <button
      onClick={() => navigate("/payment")}
      className="bg-black text-white p-4 rounded-lg font-bold"
     >
      View Premium Plans
     </button>
    </div>
   </div>
  </div>
 );
}

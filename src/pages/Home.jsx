import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { getPlayerId } from "../lib/player";

export default function Home(){
 const navigate = useNavigate();
 const [roomCode, setRoomCode] = useState("");
 const [username, setUsername] = useState("");
 const [joining, setJoining] = useState(false);

 const joinRoom = async (event) => {
  event.preventDefault();

  if (!username.trim()) {
   alert("Enter your name");
   return;
  }

  if (!roomCode.trim()) {
   alert("Enter room code");
   return;
  }

  setJoining(true);

  const playerId = getPlayerId();
  const upperCode =
   roomCode.trim().toUpperCase();

  const { data: room } = await supabase
   .from("rooms")
   .select("*")
   .eq("room_code", upperCode)
   .maybeSingle();

  if (!room) {
   setJoining(false);
   alert("Room not found");
   return;
  }

  if (room.game_finished) {
   setJoining(false);
   alert("This room has already ended");
   return;
  }

  const { data: existing } = await supabase
   .from("room_players")
   .select("*")
   .eq("room_code", upperCode)
   .eq("player_id", playerId)
   .maybeSingle();

  const { count: playerCount } =
   await supabase
    .from("room_players")
    .select("*", {
     count: "exact",
     head: true
    })
    .eq("room_code", upperCode);

  if (
   !existing &&
   playerCount >=
    Number(room.max_players || 2)
  ) {
   setJoining(false);
   alert("This room is full");
   return;
  }

  if (!existing) {
   await supabase
    .from("room_players")
    .insert({
     room_code: upperCode,
     player_id: playerId,
     username: username.trim(),
     score: 0
    });
  }

  navigate(`/room/${upperCode}`);
 };

 return (
  <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 py-8">
   <h1 className="text-5xl sm:text-7xl font-bold mb-6">Dialogue Quest</h1>

   <p className="text-gray-400 max-w-xl mb-8">
    Guess movie and TV dialogues with friends in realtime multiplayer.
   </p>

   <div className="flex flex-col sm:flex-row gap-3 mb-5">
    <button
     onClick={() =>
      navigate("/multiplayer?auth=signin")
     }
     className="bg-yellow-400 text-black px-8 py-4 rounded-lg font-bold"
    >
     Login
    </button>

    <button
     onClick={() =>
      navigate("/multiplayer?auth=signup")
     }
     className="bg-zinc-900 border border-zinc-800 px-8 py-4 rounded-lg font-bold"
    >
     Create Account
    </button>
   </div>

   <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 mb-5">
    <h2 className="text-2xl font-bold mb-4">
     Join Room
    </h2>

    <form
     onSubmit={joinRoom}
     className="grid gap-3"
    >
     <input
      value={username}
      onChange={(event) =>
       setUsername(event.target.value)
      }
      placeholder="Your name"
      className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg"
     />

     <input
      value={roomCode}
      onChange={(event) =>
       setRoomCode(event.target.value)
      }
      placeholder="Room code"
      className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg uppercase"
     />

     <button
     type="submit"
      disabled={joining}
      className="bg-yellow-400 text-black px-8 py-4 rounded-lg font-bold"
     >
      {joining ? "Joining..." : "Join Room"}
     </button>
    </form>
   </div>

   <button
    onClick={()=>navigate('/categories')}
   className="bg-white text-black px-8 py-4 rounded-lg font-bold"
  >
    Play Solo
  </button>
  </div>
 )
}

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { getPlayerId } from "../lib/player";
import { getAccount } from "../lib/account";

const insertRoomPlayer = async (payload) => {
 const { error } = await supabase
  .from("room_players")
  .insert(payload);

 if (
  error &&
  /account_id|schema cache|column/i.test(
   error.message || ""
  )
 ) {
  const {
   account_id: _accountId,
   ...fallbackPayload
  } = payload;

  return supabase
   .from("room_players")
   .insert(fallbackPayload);
 }

 return { error };
};

export default function Home(){
 const navigate = useNavigate();
 const [roomCode, setRoomCode] = useState("");
 const [username, setUsername] = useState("");
 const [joining, setJoining] = useState(false);
 const [account, setAccount] = useState(null);

 useEffect(() => {
  let active = true;

  const loadAccount = async () => {
   const nextAccount = await getAccount();

   if (active) {
    setAccount(nextAccount);
   }
  };

  loadAccount();

  return () => {
   active = false;
  };
 }, []);

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
   const { error } = await insertRoomPlayer({
     room_code: upperCode,
     player_id: playerId,
     account_id: account?.id || null,
     avatar_url: account?.avatarUrl || null,
     username: username.trim(),
     score: 0
    });

   if (error) {
    setJoining(false);
    alert(error.message);
    return;
   }
  }

  navigate(
   `/room/${upperCode}${
    account?.id ? `?account=${account.id}` : ""
   }`
  );
 };

 return (
  <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 py-8">
   <h1 className="text-5xl sm:text-7xl font-bold mb-6">Dialogue Quest</h1>

   <p className="text-gray-400 max-w-xl mb-8">
    Guess movie and TV dialogues with friends in realtime multiplayer.
   </p>

   {account && (
    <button
     onClick={() => navigate("/multiplayer")}
     className="mb-5 bg-yellow-400 text-black px-5 py-3 rounded-lg font-bold"
    >
     Open Profile
    </button>
   )}

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

   <div className="flex flex-col sm:flex-row gap-3">
    <button
     onClick={() => navigate("/categories")}
     className="bg-white text-black px-8 py-4 rounded-lg font-bold"
    >
     Play Solo
    </button>

    <button
     onClick={() =>
      navigate("/multiplayer?auth=signup")
     }
     className="bg-yellow-400 text-black px-8 py-4 rounded-lg font-bold"
    >
     Play Multiplayer
    </button>
   </div>
  </div>
 )
}

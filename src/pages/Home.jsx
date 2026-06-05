import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { getPlayerId } from "../lib/player";
import { getAccount } from "../lib/account";
import {
 playSoundEffect,
 useAudioPreference
} from "../lib/audio";
import DonateModal from "../components/DonateModal";
import MultiplayerQuickModal from "../components/MultiplayerQuickModal";
import { useSEO, SEO_PRESETS } from "../lib/seo";

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
 useSEO(SEO_PRESETS.home);
 const navigate = useNavigate();
 const [audioEnabled, setAudioEnabled] =
  useAudioPreference();
 const [roomCode, setRoomCode] = useState("");
 const [username, setUsername] = useState("");
 const [joining, setJoining] = useState(false);
 const [account, setAccount] = useState(null);
 const [showDonate, setShowDonate] = useState(false);
 const [multiplayerModalOpen, setMultiplayerModalOpen] =
  useState(false);

 const toggleAudio = () => {
  const nextEnabled = !audioEnabled;

  setAudioEnabled(nextEnabled);

  if (nextEnabled) {
   playSoundEffect("start");
  }
 };

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
  playSoundEffect("roomJoin");
 };

 return (
  <main className="min-h-screen flex flex-col items-center justify-center text-center px-4 py-8" aria-label="Dialogue Quest home">
   <DonateModal
    open={showDonate}
    onClose={() => setShowDonate(false)}
   />
   <button
    type="button"
    onClick={toggleAudio}
    aria-label={audioEnabled ? "Mute background music" : "Enable background music"}
    aria-pressed={audioEnabled}
    className="fixed top-4 right-4 z-20 flex items-center gap-3 rounded-full border border-zinc-700 bg-zinc-950/90 px-4 py-3 text-sm font-bold text-white shadow-xl"
   >
    <span
     className={`relative h-5 w-10 rounded-full transition ${
      audioEnabled
       ? "bg-yellow-400"
       : "bg-zinc-700"
     }`}
    >
     <span
      className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition ${
       audioEnabled
        ? "translate-x-5"
        : "translate-x-0"
      }`}
     />
    </span>
    <span>
     Music {audioEnabled ? "On" : "Off"}
    </span>
   </button>

   <h1 className="text-5xl sm:text-7xl font-bold mb-6">Dialogue Quest</h1>

   <p className="text-gray-400 max-w-xl mb-8">
    Free online multiplayer game. Guess Hollywood, Bollywood, TV show and anime dialogues, or identify songs from their lyrics. Play solo or with friends in realtime rooms.
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
     onClick={() => setMultiplayerModalOpen(true)}
     className="bg-yellow-400 text-black px-8 py-4 rounded-lg font-bold"
    >
     Play Multiplayer
    </button>
   </div>

   <MultiplayerQuickModal
    open={multiplayerModalOpen}
    account={account}
    onClose={() => setMultiplayerModalOpen(false)}
    onExplore={() => {
     setMultiplayerModalOpen(false);
     navigate("/multiplayer?auth=signup");
    }}
   />
  </main>
 )
}

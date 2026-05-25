import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { getPlayerId } from "../lib/player";
import { playSoundEffect } from "../lib/audio";
import { PLANS } from "../lib/account";

const categoryOptions = [
 { value: "hollywood", label: "Hollywood" },
 { value: "bollywood", label: "Bollywood" },
 { value: "tvshows", label: "TV Series" },
 { value: "mix", label: "Mixed" },
 { value: "anime", label: "Anime" }
];

const DEFAULT_MIX_CATEGORIES = ["hollywood", "tvshows"];

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

export default function MultiplayerQuickModal({
 open,
 onClose,
 onExplore,
 account
}) {
 const navigate = useNavigate();
 const [username, setUsername] = useState("");
 const [category, setCategory] = useState("hollywood");
 const [rounds, setRounds] = useState(10);
 const [duration, setDuration] = useState(30);
 const [maxPlayers, setMaxPlayers] = useState(2);
 const [creating, setCreating] = useState(false);
 const [error, setError] = useState("");

 useEffect(() => {
  if (open && account?.name && !username) {
   setUsername(account.name);
  }
 }, [open, account, username]);

 if (!open) return null;

 const createRoom = async () => {
  if (creating) return;

  if (!username.trim()) {
   setError("Enter your name");
   return;
  }

  setCreating(true);
  setError("");

  try {
   const code = Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();

   const playerId = getPlayerId();
   const mixCategories =
    category === "mix"
     ? DEFAULT_MIX_CATEGORIES
     : null;

   const { error: roomError } = await supabase
    .from("rooms")
    .insert({
     room_code: code,
     host_id: playerId,
     current_question: 0,
     game_started: false,
     category,
     total_rounds: rounds,
     endless_mode: false,
     question_duration: duration,
     game_finished: false,
     show_trivia: true,
     processing_answer: false,
     max_players: maxPlayers,
     mix_categories: mixCategories,
     plan_required: PLANS.FREE
    });

   if (roomError) throw roomError;

   const { error: playerError } =
    await insertRoomPlayer({
     room_code: code,
     player_id: playerId,
     account_id: account?.id || null,
     avatar_url: account?.avatarUrl || null,
     username: username.trim(),
     score: 0
    });

   if (playerError) throw playerError;

   playSoundEffect("roomCreate");
   navigate(
    account?.id
     ? `/room/${code}?account=${account.id}`
     : `/room/${code}`
   );
  } catch (err) {
   setError(
    err.message ||
     "Could not create room. Try Explore for more options."
   );
  } finally {
   setCreating(false);
  }
 };

 return (
  <div
   onClick={onClose}
   className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
  >
   <div
    onClick={(event) => event.stopPropagation()}
    className="bg-zinc-950 border border-yellow-500/40 rounded-2xl p-6 sm:p-8 max-w-lg w-full my-6 text-left"
   >
    <div className="flex justify-between items-start mb-5">
     <div>
      <p className="text-yellow-400 uppercase tracking-[0.25em] text-xs mb-2">
       Quick Multiplayer
      </p>
      <h2 className="text-3xl font-bold">
       Start a room
      </h2>
     </div>
     <button
      onClick={onClose}
      className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-700 font-bold"
      aria-label="Close"
     >
      x
     </button>
    </div>

    {error && (
     <div className="border border-red-500/40 bg-red-500/10 text-red-100 rounded-lg p-3 mb-4 text-sm">
      {error}
     </div>
    )}

    <input
     value={username}
     onChange={(event) => setUsername(event.target.value)}
     placeholder="Your name"
     className="w-full bg-zinc-800 border border-zinc-700 p-3 rounded-lg mb-4"
    />

    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">
     Category
    </p>
    <div className="grid grid-cols-2 gap-2 mb-4">
     {categoryOptions.map((option) => {
      const active = category === option.value;

      return (
       <button
        key={option.value}
        type="button"
        onClick={() => setCategory(option.value)}
        className={`border p-3 rounded-lg font-bold text-sm ${
         active
          ? "bg-yellow-400 text-black border-yellow-400"
          : "bg-zinc-800 text-white border-zinc-700"
        }`}
       >
        {option.label}
       </button>
      );
     })}
    </div>

    <div className="grid grid-cols-3 gap-2 mb-5">
     <select
      value={rounds}
      onChange={(event) =>
       setRounds(Number(event.target.value))
      }
      className="bg-zinc-800 border border-zinc-700 p-3 rounded-lg text-sm"
     >
      <option value={5}>5 Rounds</option>
      <option value={10}>10 Rounds</option>
      <option value={20}>20 Rounds</option>
     </select>
     <select
      value={duration}
      onChange={(event) =>
       setDuration(Number(event.target.value))
      }
      className="bg-zinc-800 border border-zinc-700 p-3 rounded-lg text-sm"
     >
      <option value={15}>15s</option>
      <option value={30}>30s</option>
      <option value={45}>45s</option>
      <option value={60}>60s</option>
      <option value={0}>Timeless</option>
     </select>
     <select
      value={maxPlayers}
      onChange={(event) =>
       setMaxPlayers(Number(event.target.value))
      }
      className="bg-zinc-800 border border-zinc-700 p-3 rounded-lg text-sm"
     >
      {Array.from(
       { length: 19 },
       (_, index) => index + 2
      ).map((count) => (
       <option key={count} value={count}>
        {count} players
       </option>
      ))}
     </select>
    </div>

    <button
     onClick={createRoom}
     disabled={creating}
     className="w-full bg-yellow-400 text-black p-4 rounded-lg font-bold mb-3 disabled:opacity-60"
    >
     {creating ? "Creating Room..." : "Create Room"}
    </button>

    <button
     onClick={onExplore}
     className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg font-bold"
    >
     Explore (full lobby, lyrics, sign in)
    </button>

    <p className="text-zinc-500 text-xs mt-4 text-center">
     Need lyrics rooms or account features? Tap Explore.
    </p>
   </div>
  </div>
 );
}

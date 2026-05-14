import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getPlayerId } from "../lib/player";
import movies from "../data/movies";

export default function Room() {
 const { code } = useParams();
 const playerId = getPlayerId();

 const [room, setRoom] = useState(null);
 const [players, setPlayers] = useState([]);
 const [message, setMessage] = useState("");

 const fetchRoom = async () => {
  const { data } = await supabase
   .from("rooms")
   .select("*")
   .eq("room_code", code)
   .single();

  if (data) {
   setRoom(data);
  }
 };

 const fetchPlayers = async () => {
  const { data } = await supabase
   .from("room_players")
   .select("*")
   .eq("room_code", code)
   .order("score", { ascending: false });

  if (data) {
   setPlayers(data);
  }
 };

 useEffect(() => {
  fetchRoom();
  fetchPlayers();

  const roomChannel = supabase
   .channel(`room-${code}`)
   .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "rooms"
    },
    () => {
      fetchRoom();
    }
   )
   .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "room_players"
    },
    () => {
      fetchPlayers();
    }
   )
   .subscribe();

  return () => {
   supabase.removeChannel(roomChannel);
  };
 }, []);

 if (!room) {
  return <div className="p-10">Loading...</div>;
 }

 const currentQuestion = movies[room.current_question];

 const me = players.find(
  (p) => p.player_id === playerId
 );

 const isHost = room.host_id === playerId;

 const startGame = async () => {
  await supabase
   .from("rooms")
   .update({
    game_started: true
   })
   .eq("room_code", code);
 };

 const nextQuestion = async () => {
  const nextIndex = room.current_question + 1;

  if (nextIndex >= movies.length) {
   const sorted = [...players].sort(
    (a, b) => b.score - a.score
   );

   await supabase
    .from("rooms")
    .update({
      winner: sorted[0]?.username || "No Winner"
    })
    .eq("room_code", code);

   return;
  }

  await supabase
   .from("rooms")
   .update({
    current_question: nextIndex
   })
   .eq("room_code", code);
 };

 const submitAnswer = async () => {
  if (!currentQuestion) return;

  if (
   message.trim().toLowerCase() ===
   currentQuestion.answer.toLowerCase()
  ) {
   const newScore = (me?.score || 0) + 1;

   await supabase
    .from("room_players")
    .update({
      score: newScore
    })
    .eq("player_id", playerId)
    .eq("room_code", code);

   await nextQuestion();
  }

  setMessage("");
 };

 return (
  <div className="p-6 lg:p-10 min-h-screen">
   <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
    <div>
      <h1 className="text-5xl font-bold">
       Room: {code}
      </h1>

      <p className="text-zinc-400 mt-2">
       Live Multiplayer Battle
      </p>
    </div>

    {room.winner && (
      <div className="text-3xl font-bold text-yellow-400">
       Winner: {room.winner}
      </div>
    )}
   </div>

   {!room.game_started ? (
    <div className="bg-zinc-900 rounded-3xl p-10">
      <h2 className="text-3xl font-bold mb-6">
       Waiting Room
      </h2>

      <div className="space-y-4 mb-8">
       {players.map((player) => (
        <div
         key={player.id}
         className="bg-zinc-800 p-4 rounded-xl"
        >
         {player.username}
        </div>
       ))}
      </div>

      {isHost ? (
       <button
        onClick={startGame}
        className="bg-yellow-400 text-black px-8 py-4 rounded-xl font-bold"
       >
        Start Competition
       </button>
      ) : (
       <p className="text-zinc-400">
        Waiting for host to start game...
       </p>
      )}
    </div>
   ) : (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-zinc-900 p-8 rounded-3xl">
       <div className="flex justify-between mb-6">
        <div>
         Question {room.current_question + 1}
        </div>

        <div>
         Your Score: {me?.score || 0}
        </div>
       </div>

       {currentQuestion ? (
        <>
         <p className="text-4xl mb-8 leading-relaxed">
          "{currentQuestion.dialogue}"
         </p>

         <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Guess movie/show"
          className="w-full p-4 rounded-xl bg-zinc-800 mb-5"
         />

         <button
          onClick={submitAnswer}
          className="bg-yellow-400 text-black px-8 py-4 rounded-xl font-bold"
         >
          Submit
         </button>
        </>
       ) : (
        <div className="text-4xl font-bold">
         Game Finished
        </div>
       )}
      </div>

      <div className="bg-zinc-900 p-8 rounded-3xl">
       <h2 className="text-3xl font-bold mb-6">
        Leaderboard
       </h2>

       <div className="space-y-4">
        {players.map((player) => (
         <div
          key={player.id}
          className="bg-zinc-800 p-4 rounded-xl flex justify-between"
         >
          <span>{player.username}</span>
          <span>{player.score}</span>
         </div>
        ))}
       </div>
      </div>
    </div>
   )}
  </div>
 );
}
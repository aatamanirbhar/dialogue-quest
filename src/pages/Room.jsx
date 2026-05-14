import React from "react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import movies from "../data/movies";

export default function Room(){
 const { code } = useParams();

 const [players,setPlayers] = useState([]);
 const [message,setMessage] = useState("");
 const [score,setScore] = useState(0);
 const [questionIndex,setQuestionIndex] = useState(0);

 const current = movies[questionIndex];

 const fetchPlayers = async () => {
  const { data } = await supabase
   .from("room_players")
   .select("*")
   .eq("room_code",code);

  if(data){
   setPlayers(data);
  }
 };

 useEffect(()=>{
  fetchPlayers();

  const channel = supabase
   .channel("room-sync")
   .on(
    "postgres_changes",
    {
      event:"*",
      schema:"public",
      table:"room_players"
    },
    ()=>{
      fetchPlayers();
    }
   )
   .subscribe();

  return ()=>{
   supabase.removeChannel(channel);
  }
 },[]);

 const submitAnswer = async () => {
  if(
   message.toLowerCase() ===
   current.answer.toLowerCase()
  ){
   const newScore = score + 1;
   setScore(newScore);

   await supabase
    .from("room_players")
    .upsert({
      room_code:code,
      username:"Player",
      score:newScore
    });

   if(questionIndex < movies.length - 1){
    setQuestionIndex(questionIndex + 1);
   }
  }

  setMessage("");
 };

 return (
  <div className="p-10">
   <div className="flex justify-between items-center mb-10">
    <div>
      <h1 className="text-5xl font-bold">Room: {code}</h1>
      <p className="text-gray-400 mt-2">Realtime Multiplayer Active</p>
    </div>

    <div className="text-3xl font-bold">
      Score: {score}
    </div>
   </div>

   <div className="grid lg:grid-cols-3 gap-6">
    <div className="lg:col-span-2 bg-zinc-900 p-8 rounded-3xl">
      <p className="text-4xl mb-8">
        "{current.dialogue}"
      </p>

      <input
       value={message}
       onChange={(e)=>setMessage(e.target.value)}
       placeholder="Guess movie/show"
       className="w-full p-4 rounded-xl bg-zinc-800 mb-5"
      />

      <button
       onClick={submitAnswer}
       className="bg-yellow-400 text-black px-8 py-4 rounded-xl font-bold"
      >
       Submit
      </button>
    </div>

    <div className="bg-zinc-900 p-8 rounded-3xl">
      <h2 className="text-3xl font-bold mb-6">Players</h2>

      <div className="space-y-4">
       {players.map((player,index)=>(
         <div
          key={index}
          className="bg-zinc-800 p-4 rounded-xl flex justify-between"
         >
          <span>{player.username}</span>
          <span>{player.score}</span>
         </div>
       ))}
      </div>
    </div>
   </div>
  </div>
 )
}

import React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function MultiplayerLobby(){
 const [roomCode,setRoomCode] = useState("");
 const navigate = useNavigate();

 const createRoom = async () => {
  const code = Math.random().toString(36).substring(2,8);

  const { error } = await supabase
   .from("rooms")
   .insert({
    room_code:code,
    current_question:0
   });

  if(!error){
   navigate(`/room/${code}`);
  }
 };

 const joinRoom = async () => {
  const { data } = await supabase
   .from("rooms")
   .select("*")
   .eq("room_code",roomCode)
   .single();

  if(data){
   navigate(`/room/${roomCode}`);
  }else{
   alert("Room not found");
  }
 };

 return (
  <div className="min-h-screen flex items-center justify-center">
   <div className="bg-zinc-900 p-10 rounded-3xl w-full max-w-xl">
    <h1 className="text-5xl font-bold mb-8">Multiplayer</h1>

    <button
      onClick={createRoom}
      className="w-full bg-yellow-400 text-black py-4 rounded-xl font-bold mb-6"
    >
      Create Room
    </button>

    <input
      value={roomCode}
      onChange={(e)=>setRoomCode(e.target.value)}
      placeholder="Enter room code"
      className="w-full p-4 rounded-xl bg-zinc-800 mb-5"
    />

    <button
      onClick={joinRoom}
      className="w-full bg-white text-black py-4 rounded-xl font-bold"
    >
      Join Room
    </button>
   </div>
  </div>
 )
}

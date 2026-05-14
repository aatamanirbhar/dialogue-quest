import React from "react";
import { useNavigate } from "react-router-dom";

export default function Home(){
 const navigate = useNavigate();

 return (
  <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
   <h1 className="text-7xl font-bold mb-6">Dialogue Quest</h1>

   <p className="text-gray-400 max-w-xl mb-10">
    Guess movie and TV dialogues with friends in realtime multiplayer.
   </p>

   <button
    onClick={()=>navigate('/categories')}
    className="bg-yellow-400 text-black px-8 py-4 rounded-2xl font-bold"
   >
    Let's Play
   </button>
  </div>
 )
}

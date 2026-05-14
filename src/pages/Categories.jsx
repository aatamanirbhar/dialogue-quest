import React from "react";
import { useNavigate } from "react-router-dom";

export default function Categories(){
 const navigate = useNavigate();

 const categories = ["hollywood","tvshows","mix","bollywood","aNiMe"];

 return (
  <div className="p-10">
   <h1 className="text-5xl font-bold mb-10">Choose Category</h1>

   <div className="grid md:grid-cols-2 gap-6">
    {categories.map((item)=>(
      <div key={item} className="bg-zinc-900 p-8 rounded-3xl">
       <h2 className="text-3xl capitalize mb-6">{item}</h2>

       <div className="flex gap-4">
        <button
         onClick={()=>navigate(`/solo/${item}`)}
         className="bg-white text-black px-5 py-3 rounded-xl"
        >
         Solo
        </button>

        <button
         onClick={()=>navigate('/multiplayer')}
         className="bg-yellow-400 text-black px-5 py-3 rounded-xl"
        >
         Multiplayer
        </button>
       </div>
      </div>
    ))}
   </div>
  </div>
 )
}

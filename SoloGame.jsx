import { useParams } from "react-router-dom";
import { useState } from "react";
import movies from "../data/movies";
import tvshows from "../data/tvshows";
import mix from "../data/mix";
import bollywood from "../data/bollywood";

export default function SoloGame(){
 const { category } = useParams();

 const datasets = { movies,tvshows,mix,bollywood };

 const data = datasets[category];
 const [index,setIndex] = useState(0);
 const [answer,setAnswer] = useState("");
 const [score,setScore] = useState(0);

 const current = data[index];

 const submit = () => {
  if(answer.toLowerCase() === current.answer.toLowerCase()){
   setScore(score + 1);
  }

  setAnswer("");

  if(index < data.length - 1){
   setIndex(index + 1);
  }
 };

 return (
  <div className="p-10">
   <h1 className="text-4xl font-bold mb-5">Score: {score}</h1>

   <div className="bg-zinc-900 p-10 rounded-3xl max-w-2xl">
    <p className="text-3xl mb-8">"{current.dialogue}"</p>

    <input
     value={answer}
     onChange={(e)=>setAnswer(e.target.value)}
     className="w-full p-4 rounded-xl bg-zinc-800 mb-5"
     placeholder="Guess"
    />

    <button
     onClick={submit}
     className="bg-white text-black px-8 py-4 rounded-xl"
    >
     Submit
    </button>
   </div>
  </div>
 )
}

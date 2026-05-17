import React, {
 useEffect,
 useState
} from "react";
import { useNavigate } from "react-router-dom";
import { getAccount, isPremiumPlus } from "../lib/account";
import { supabase } from "../lib/supabase";

const normalizeAnswer = (value) =>
 String(value || "")
  .toLowerCase()
  .replace(/[^a-z0-9]/g, "");

const getActiveLyrics = async () => {
 let response = await supabase
  .from("lyrics_questions")
  .select("*")
  .eq("is_active", true)
  .order("sort_order", { ascending: true });

 if (
  response.error &&
  /is_active|sort_order|schema cache|column/i.test(
   response.error.message || ""
  )
 ) {
  response = await supabase
   .from("lyrics_questions")
   .select("*");
 }

 if (
  response.error &&
  /relation|table/i.test(
   response.error.message || ""
  )
 ) {
  return response;
 }

 const rows = response.data || [];

 return {
  data: rows
   .filter(
    (item) =>
     item.is_active !== false &&
     item.active !== false
   )
   .sort(
    (a, b) =>
     Number(a.sort_order || 0) -
     Number(b.sort_order || 0)
   ),
  error: response.error
 };
};

export default function LyricsGame() {
 const navigate = useNavigate();
 const [account, setAccount] = useState(null);
 const [questions, setQuestions] = useState([]);
 const [loading, setLoading] = useState(true);
 const [index, setIndex] = useState(0);
 const [answer, setAnswer] = useState("");
 const [feedback, setFeedback] = useState("");
 const [finished, setFinished] = useState(false);
 const [score, setScore] = useState(0);

 useEffect(() => {
  let active = true;

  const load = async () => {
   const nextAccount = await getAccount();
   if (!active) return;
   setAccount(nextAccount);

   if (!isPremiumPlus(nextAccount)) {
    navigate("/categories");
    return;
   }

   const { data, error } =
    await getActiveLyrics();

   if (!active) return;

   if (error) {
    setFeedback(
     `Lyrics could not load: ${error.message}`
    );
    setLoading(false);
    return;
   }

   setQuestions(data || []);
   setLoading(false);
  };

  load();

  return () => {
   active = false;
  };
 }, [navigate]);

 const current = questions[index];

 const submit = () => {
  if (!current) return;

  const correct =
   normalizeAnswer(answer) ===
   normalizeAnswer(current.answer);

  setFeedback(correct ? "Correct" : `Wrong. ${current.answer}`);
  if (correct) setScore((value) => value + 1);

  setTimeout(() => {
   const next = index + 1;
   setAnswer("");
   if (next >= questions.length) {
    setFinished(true);
   } else {
    setIndex(next);
    setFeedback("");
   }
  }, 1000);
 };

 if (loading) {
  return (
   <div className="min-h-screen bg-black text-white flex items-center justify-center">
    Loading lyrics...
   </div>
  );
 }

 if (!questions.length) {
  return (
   <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 text-center">
    <div>
     <h1 className="text-3xl font-bold mb-4">
      No lyrics questions found
     </h1>
     {feedback && (
      <p className="text-red-200 bg-red-500/10 border border-red-500/40 rounded-lg p-4 mb-4 max-w-xl">
       {feedback}
      </p>
     )}
     <button
      onClick={() => navigate("/categories")}
      className="bg-yellow-400 text-black px-6 py-3 rounded-lg font-bold"
     >
      Back
     </button>
    </div>
   </div>
  );
 }

 if (finished) {
  return (
   <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 text-center">
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-xl w-full">
     <h1 className="text-4xl font-bold mb-4">
      Lyrics Finished
     </h1>
     <p className="text-zinc-300 mb-6">
      Score: {score} / {questions.length}
     </p>
     <button
      onClick={() => navigate("/categories")}
      className="bg-yellow-400 text-black px-6 py-3 rounded-lg font-bold"
     >
      Back to Categories
     </button>
    </div>
   </div>
  );
 }

 return (
  <div className="min-h-screen bg-black text-white p-6 flex items-center justify-center">
   <div className="w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8">
    <div className="flex justify-between items-center mb-6">
     <h1 className="text-2xl sm:text-3xl font-bold">
      Complete the Lyrics
     </h1>
     <div className="text-yellow-300 font-bold">
      {score} / {questions.length}
     </div>
    </div>

    <div className="bg-zinc-800 rounded-2xl p-6 mb-5">
     <p className="text-2xl leading-relaxed">
      {current.prompt}
     </p>
    </div>

    {current.options?.length === 2 ? (
     <div className="grid gap-3 mb-5">
      {current.options.map((option) => (
       <button
        key={option}
        onClick={() => {
         setAnswer(option);
         setTimeout(submit, 50);
        }}
        className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-left font-bold"
       >
        {option}
       </button>
      ))}
     </div>
    ) : (
     <input
      value={answer}
      onChange={(event) =>
       setAnswer(event.target.value)
      }
      placeholder="Type the missing lyrics"
      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-4 mb-5"
      onKeyDown={(event) => {
       if (event.key === "Enter") submit();
      }}
     />
    )}

    <button
     onClick={submit}
     className="w-full bg-yellow-400 text-black py-4 rounded-xl font-bold"
    >
     Submit
    </button>

    {feedback && (
     <p className="mt-4 text-zinc-300">
      {feedback}
     </p>
    )}
   </div>
  </div>
 );
}

import React, {
 useEffect,
 useRef,
 useState
} from "react";
import { useNavigate } from "react-router-dom";
import { getAccount, isPremiumPlus } from "../lib/account";
import { playSoundEffect } from "../lib/audio";
import { supabase } from "../lib/supabase";

const QUESTION_TIME = 30;

const normalizeAnswer = (value) =>
 String(value || "")
  .toLowerCase()
  .replace(/[^a-z0-9]/g, "");

const getQuestionOptions = (question) => {
 const rawOptions = question?.options;

 if (Array.isArray(rawOptions)) {
  return rawOptions
   .map((option) => String(option).trim())
   .filter(Boolean);
 }

 if (typeof rawOptions === "string") {
  try {
   const parsed = JSON.parse(rawOptions);

   if (Array.isArray(parsed)) {
    return parsed
     .map((option) => String(option).trim())
     .filter(Boolean);
   }
  } catch {
   return rawOptions
    .split("|")
    .map((option) => option.trim())
    .filter(Boolean);
  }
 }

 return [];
};

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
 const [questions, setQuestions] = useState([]);
 const [loading, setLoading] = useState(true);
 const [index, setIndex] = useState(0);
 const [answer, setAnswer] = useState("");
 const [feedback, setFeedback] = useState("");
 const [finished, setFinished] = useState(false);
 const [score, setScore] = useState(0);
 const [timeLeft, setTimeLeft] =
  useState(QUESTION_TIME);
 const [locked, setLocked] = useState(false);
 const lockedRef = useRef(false);
 const advanceTimerRef = useRef(null);

 useEffect(() => {
  let active = true;

  const load = async () => {
   const nextAccount = await getAccount();
   if (!active) return;

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

 useEffect(() => {
  return () => {
   if (advanceTimerRef.current) {
    window.clearTimeout(
     advanceTimerRef.current
    );
   }
  };
 }, []);

 const current = questions[index];
 const currentOptions =
  getQuestionOptions(current);

 const goNext = () => {
  const next = index + 1;

  setAnswer("");
  setFeedback("");
  setTimeLeft(QUESTION_TIME);
  lockedRef.current = false;
  setLocked(false);

  if (next >= questions.length) {
   setFinished(true);
   return;
  }

  setIndex(next);
 };

 const submit = (
  submittedAnswer = answer,
  { timedOut = false } = {}
 ) => {
  if (!current || lockedRef.current) return;

  const value = String(
   submittedAnswer || ""
  ).trim();

  if (!timedOut && !value) return;

  lockedRef.current = true;
  setLocked(true);

  const correct =
   !timedOut &&
   normalizeAnswer(value) ===
    normalizeAnswer(current.answer);

  if (correct) {
   setScore((scoreValue) => scoreValue + 1);
  }

  playSoundEffect(
   correct ? "correct" : "incorrect"
  );

  setFeedback(
   timedOut
    ? `Time's up. ${current.answer}`
    : correct
     ? "Correct"
     : `Wrong. ${current.answer}`
  );

  advanceTimerRef.current =
   window.setTimeout(goNext, 1200);
 };

 useEffect(() => {
  if (!current || finished || locked) return;

  setTimeLeft(QUESTION_TIME);

  const interval = window.setInterval(() => {
   setTimeLeft((previous) => {
    if (previous <= 1) {
     window.clearInterval(interval);
     submit("", { timedOut: true });
     return 0;
    }

    return previous - 1;
   });
  }, 1000);

  return () => {
   window.clearInterval(interval);
  };
 }, [index, current?.id, finished, locked]);

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
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
     <div>
      <h1 className="text-2xl sm:text-3xl font-bold">
       Complete the Lyrics
      </h1>
      <p className="text-zinc-400 mt-2">
       Question {index + 1} / {questions.length}
      </p>
     </div>

     <div className="flex gap-4 text-right">
      <div>
       <p className="text-zinc-500 text-sm">
        Time
       </p>
       <p className="text-yellow-300 font-bold text-xl">
        {timeLeft}s
       </p>
      </div>
      <div>
       <p className="text-zinc-500 text-sm">
        Score
       </p>
       <p className="text-green-300 font-bold text-xl">
        {score}
       </p>
      </div>
     </div>
    </div>

    <div className="bg-zinc-800 rounded-2xl p-6 mb-5">
     <p className="text-2xl leading-relaxed">
      {current.prompt || current.dialogue}
     </p>
    </div>

    {currentOptions.length > 0 ? (
     <div className="grid sm:grid-cols-2 gap-3 mb-5">
      {currentOptions.map((option) => (
       <button
        key={option}
        type="button"
        onClick={() => submit(option)}
        disabled={locked}
        className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-left font-bold disabled:opacity-60"
       >
        {option}
       </button>
      ))}
     </div>
    ) : (
     <>
      <input
       value={answer}
       onChange={(event) =>
        setAnswer(event.target.value)
       }
       placeholder="Type the missing lyrics"
       disabled={locked}
       className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-4 mb-5 disabled:opacity-60"
       onKeyDown={(event) => {
        if (event.key === "Enter") submit();
       }}
      />

      <button
       onClick={() => submit()}
       disabled={locked}
       className="w-full bg-yellow-400 text-black py-4 rounded-xl font-bold disabled:opacity-60"
      >
       Submit
      </button>
     </>
    )}

    {feedback && (
     <p className="mt-4 text-zinc-300">
      {feedback}
     </p>
    )}
   </div>
  </div>
 );
}

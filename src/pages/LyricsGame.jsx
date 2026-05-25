import React, {
 useEffect,
 useRef,
 useState
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getAccount } from "../lib/account";
import { playSoundEffect } from "../lib/audio";
import { supabase } from "../lib/supabase";
import LyricsLanguageModal, {
 LYRICS_LANGUAGES
} from "../components/LyricsLanguageModal";
import DonateModal from "../components/DonateModal";

const QUESTION_TIME = 30;
const TRIVIA_DURATION_MS = 5000;

const normalizeAnswer = (value) =>
 String(value || "")
  .toLowerCase()
  .replace(/[^a-z0-9]/g, "");

const shuffleQuestions = (items) => {
 const shuffled = [...items];

 for (
  let index = shuffled.length - 1;
  index > 0;
  index -= 1
 ) {
  const randomIndex = Math.floor(
   Math.random() * (index + 1)
  );
  const current = shuffled[index];
  shuffled[index] = shuffled[randomIndex];
  shuffled[randomIndex] = current;
 }

 return shuffled;
};

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

const getActiveLyrics = async (language) => {
 const cleanLanguage = String(language || "").toLowerCase();

 const runQuery = async ({ withLanguage }) => {
  let query = supabase
   .from("lyrics_questions")
   .select("*");

  if (withLanguage && cleanLanguage) {
   query = query.eq("fetch_by", cleanLanguage);
  }

  let response = await query
   .eq("is_active", true)
   .order("sort_order", { ascending: true });

  if (
   response.error &&
   /is_active|sort_order|schema cache|column/i.test(
    response.error.message || ""
   )
  ) {
   let fallback = supabase
    .from("lyrics_questions")
    .select("*");

   if (withLanguage && cleanLanguage) {
    fallback = fallback.eq(
     "fetch_by",
     cleanLanguage
    );
   }

   response = await fallback;
  }

  return response;
 };

 let response = await runQuery({ withLanguage: true });

 if (
  response.error &&
  /fetch_by|schema cache|column/i.test(
   response.error.message || ""
  )
 ) {
  response = await runQuery({ withLanguage: false });
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

 const filteredRows = rows.filter((item) => {
  if (item.is_active === false || item.active === false) {
   return false;
  }

  if (!cleanLanguage) return true;

  const itemLanguage = String(item.fetch_by || "")
   .toLowerCase()
   .trim();

  return !itemLanguage || itemLanguage === cleanLanguage;
 });

 return {
  data: shuffleQuestions(filteredRows),
  error: response.error
 };
};

export default function LyricsGame() {
 const navigate = useNavigate();
 const [searchParams, setSearchParams] = useSearchParams();
 const queryLanguage = (
  searchParams.get("language") || ""
 ).toLowerCase();
 const initialLanguage = LYRICS_LANGUAGES.includes(
  queryLanguage
 )
  ? queryLanguage
  : "";

 const [language, setLanguage] = useState(
  initialLanguage
 );
 const [showLanguageModal, setShowLanguageModal] =
  useState(!initialLanguage);
 const [questions, setQuestions] = useState([]);
 const [loading, setLoading] = useState(Boolean(initialLanguage));
 const [index, setIndex] = useState(0);
 const [answer, setAnswer] = useState("");
 const [feedback, setFeedback] =
  useState(null);
 const [finished, setFinished] = useState(false);
 const [score, setScore] = useState(0);
 const [timeLeft, setTimeLeft] =
  useState(QUESTION_TIME);
 const [locked, setLocked] = useState(false);
 const [trivia, setTrivia] = useState(null);
 const [showDonate, setShowDonate] = useState(false);
 const triviaEnabledRef = useRef(true);
 const [triviaEnabled, setTriviaEnabled] = useState(true);
 const lockedRef = useRef(false);
 const advanceTimerRef = useRef(null);
 const triviaTimerRef = useRef(null);

 const startGame = (selectedLanguage) => {
  if (advanceTimerRef.current) {
   window.clearTimeout(advanceTimerRef.current);
   advanceTimerRef.current = null;
  }
  if (triviaTimerRef.current) {
   window.clearTimeout(triviaTimerRef.current);
   triviaTimerRef.current = null;
  }

  setLanguage(selectedLanguage);
  setShowLanguageModal(false);
  setIndex(0);
  setAnswer("");
  setFeedback(null);
  setFinished(false);
  setScore(0);
  setTimeLeft(QUESTION_TIME);
  setLocked(false);
  lockedRef.current = false;
  setTrivia(null);
  setLoading(true);

  setSearchParams(
   { language: selectedLanguage },
   { replace: true }
  );
 };

 useEffect(() => {
  let active = true;

  const load = async () => {
   await getAccount();
   if (!active) return;

   if (!language) {
    setLoading(false);
    return;
   }

   const { data, error } = await getActiveLyrics(
    language
   );

   if (!active) return;

   if (error) {
    setFeedback({
     status: "error",
     message: `Lyrics could not load: ${error.message}`
    });
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
 }, [navigate, language]);

 useEffect(() => {
  return () => {
   if (advanceTimerRef.current) {
    window.clearTimeout(
     advanceTimerRef.current
    );
   }
   if (triviaTimerRef.current) {
    window.clearTimeout(triviaTimerRef.current);
   }
  };
 }, []);

 const current = questions[index];
 const currentOptions =
  getQuestionOptions(current);
 const feedbackMessage =
  typeof feedback === "string"
   ? feedback
   : feedback?.message || "";
 const showResult =
  feedback &&
  feedback.status !== "error";

 const getOptionClassName = (option) => {
  const base =
   "bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-left font-bold disabled:opacity-80";

  if (!showResult || !current) {
   return base;
  }

  const isCorrectOption =
   normalizeAnswer(option) ===
   normalizeAnswer(current.answer);
  const isSubmittedOption =
   normalizeAnswer(option) ===
   normalizeAnswer(feedback.submittedAnswer);

  if (isCorrectOption) {
   return `${base} bg-emerald-500/15 border-emerald-400 text-emerald-100`;
  }

  if (
   feedback.status === "incorrect" &&
   isSubmittedOption
  ) {
   return `${base} bg-red-500/15 border-red-400 text-red-100`;
  }

  return `${base} opacity-60`;
 };

 const goNext = () => {
  const next = index + 1;

  setAnswer("");
  setFeedback(null);
  setTrivia(null);
  setTimeLeft(QUESTION_TIME);
  lockedRef.current = false;
  setLocked(false);

  if (next >= questions.length) {
   setFinished(true);
   return;
  }

  setIndex(next);
 };

 const beginTrivia = (question) => {
  if (!triviaEnabledRef.current) {
   advanceTimerRef.current =
    window.setTimeout(goNext, 1200);
   return;
  }

  const fact =
   question?.trivia_fact ||
   `Complete the lyrics answer: ${question?.answer || ""}`;

  setTrivia({
   answer: question?.answer || "",
   fact,
   posterUrl: question?.poster_url || null
  });

  triviaTimerRef.current = window.setTimeout(
   goNext,
   TRIVIA_DURATION_MS
  );
 };

 const skipTrivia = () => {
  if (triviaTimerRef.current) {
   window.clearTimeout(triviaTimerRef.current);
   triviaTimerRef.current = null;
  }
  goNext();
 };

 const turnOffTrivia = () => {
  triviaEnabledRef.current = false;
  setTriviaEnabled(false);
  skipTrivia();
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

  setFeedback({
   status: timedOut
    ? "timeout"
    : correct
     ? "correct"
     : "incorrect",
   answer: current.answer,
   submittedAnswer: value
  });

  advanceTimerRef.current = window.setTimeout(() => {
   beginTrivia(current);
  }, 1200);
 };

 useEffect(() => {
  if (
   !current ||
   finished ||
   locked ||
   trivia ||
   !language
  ) {
   return;
  }

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
 }, [index, current?.id, finished, locked, language, trivia]);

 if (showLanguageModal) {
  return (
   <LyricsLanguageModal
    open
    dismissable={false}
    onClose={() => navigate("/categories")}
    onSelect={(value) => startGame(value)}
   />
  );
 }

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
      No lyrics for {language || "this language"}
     </h1>
     {feedback && (
      <p className="text-red-200 bg-red-500/10 border border-red-500/40 rounded-lg p-4 mb-4 max-w-xl">
       {feedbackMessage || "Lyrics could not load."}
      </p>
     )}
     <div className="flex gap-3 justify-center flex-wrap">
      <button
       onClick={() => setShowLanguageModal(true)}
       className="bg-yellow-400 text-black px-6 py-3 rounded-lg font-bold"
      >
       Pick another language
      </button>
      <button
       onClick={() => navigate("/categories")}
       className="bg-zinc-800 px-6 py-3 rounded-lg font-bold"
      >
       Back
      </button>
     </div>
    </div>
   </div>
  );
 }

 if (finished) {
  return (
   <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 text-center">
    <DonateModal
     open={showDonate}
     onClose={() => setShowDonate(false)}
    />
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-xl w-full">
     <h1 className="text-4xl font-bold mb-4">
      Lyrics Finished
     </h1>
     <p className="text-zinc-300 mb-6">
      Score: {score} / {questions.length}
     </p>
     <p className="text-zinc-500 text-sm mb-6 capitalize">
      Language: {language}
     </p>
     <div className="grid gap-3">
      <button
       onClick={() => setShowDonate(true)}
       className="bg-yellow-400 text-black px-6 py-3 rounded-lg font-bold"
      >
       Buy us a chai - Donate
      </button>
      <button
       onClick={() => setShowLanguageModal(true)}
       className="bg-white text-black px-6 py-3 rounded-lg font-bold"
      >
       Play another language
      </button>
      <button
       onClick={() => navigate("/categories")}
       className="bg-zinc-800 px-6 py-3 rounded-lg font-bold"
      >
       Back to Categories
      </button>
     </div>
    </div>
   </div>
  );
 }

 return (
  <div className="min-h-screen bg-black text-white p-6 flex items-center justify-center">
   {trivia && (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-6 overflow-y-auto">
     <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden max-w-2xl w-full">
      {trivia.posterUrl && (
       <img
        src={trivia.posterUrl}
        alt={trivia.answer}
        className="w-full h-64 sm:h-[420px] object-cover"
       />
      )}
      <div className="p-5 sm:p-8">
       <p className="text-yellow-400 uppercase tracking-[0.25em] text-xs mb-3">
        Trivia
       </p>
       <h2 className="text-3xl sm:text-4xl font-bold mb-4">
        {trivia.answer}
       </h2>
       <p className="text-zinc-300 text-lg mb-8 leading-relaxed">
        {trivia.fact}
       </p>
       <div className="flex gap-3 flex-wrap">
        <button
         onClick={skipTrivia}
         className="bg-yellow-400 text-black px-6 py-3 rounded-lg font-bold"
        >
         Skip
        </button>
        <button
         onClick={turnOffTrivia}
         className="bg-zinc-700 px-6 py-3 rounded-lg font-bold"
        >
         Turn Off Trivia
        </button>
       </div>
      </div>
     </div>
    </div>
   )}

   <div className="w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8">
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
     <div>
      <h1 className="text-2xl sm:text-3xl font-bold">
       Complete the Lyrics
      </h1>
      <p className="text-zinc-400 mt-2">
       Question {index + 1} / {questions.length}
       <span className="ml-3 capitalize text-yellow-300">
        ({language})
       </span>
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
        className={getOptionClassName(option)}
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

    {showResult && (
     <div
      className={`mt-5 rounded-2xl border p-5 text-center ${
       feedback.status === "correct"
        ? "border-emerald-400/50 bg-emerald-500/10"
        : "border-red-400/50 bg-red-500/10"
      }`}
     >
      <p
       className={`text-3xl font-bold mb-3 ${
        feedback.status === "correct"
         ? "text-emerald-300"
         : "text-red-300"
       }`}
      >
       {feedback.status === "correct"
        ? "Correct!"
        : feedback.status === "timeout"
         ? "Time's up!"
         : "Wrong!"}
      </p>

      {feedback.status !== "correct" && (
       <>
        <p className="text-zinc-400 mb-2">
         Correct Answer:
        </p>
        <p className="text-2xl font-bold text-yellow-300">
         {feedback.answer}
        </p>
       </>
      )}
     </div>
    )}

    {!triviaEnabled && (
     <p className="text-zinc-500 text-xs mt-4">
      Trivia screen turned off for this run.
     </p>
    )}
   </div>
  </div>
 );
}

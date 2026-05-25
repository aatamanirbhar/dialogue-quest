import React, {
 useEffect,
 useRef,
 useState
} from "react";
import {
 useNavigate,
 useParams,
 useSearchParams
} from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
 getAccount,
 recordPlayHistory
} from "../lib/account";
import {
 getInsight,
 getRandomCompliment
} from "../lib/playerStats";
import { playSoundEffect } from "../lib/audio";
import DonateModal from "../components/DonateModal";

const QUESTION_TIME = 30;
const TRIVIA_DURATION_MS = 5000;
const DEFAULT_MIX_CATEGORIES = [
 "hollywood",
 "tvshows"
];

const normalizeCategory = (value) =>
 String(value || "")
  .toLowerCase()
  .replaceAll("-", " ")
  .trim();

const normalizeAnswer = (value) =>
 String(value || "")
  .toLowerCase()
  .replace(/[^a-z0-9]/g, "");

const isMixCategory = (value) =>
 normalizeCategory(value).replace(/\s+/g, "") ===
 "mix";

const isLyricsCategory = (value) =>
 normalizeCategory(value).replace(/\s+/g, "") ===
 "lyrics";

const parseMixCategories = (value) => {
 const categories = String(value || "")
  .split(",")
  .map((item) =>
   normalizeCategory(item).replace(/\s+/g, "")
  )
  .filter(Boolean);

 return categories.length
  ? categories
  : DEFAULT_MIX_CATEGORIES;
};

const categoryMatches = (
 quoteCategory,
 selectedCategory
) => {
 const normalizedQuote =
  normalizeCategory(quoteCategory).replace(
   /\s+/g,
   ""
  );
 const normalizedSelected =
  normalizeCategory(selectedCategory).replace(
   /\s+/g,
   ""
  );

 return (
  normalizedQuote === normalizedSelected ||
  (
   normalizedSelected === "tvshows" &&
   normalizedQuote === "tvseries"
  ) ||
  (
   normalizedSelected === "tvseries" &&
   normalizedQuote === "tvshows"
  )
 );
};

export default function SoloGame() {
 const navigate = useNavigate();
 const { category } = useParams();
 const [searchParams] = useSearchParams();

 const [quotes, setQuotes] = useState([]);
 const [loading, setLoading] = useState(true);
 const [account, setAccount] = useState(null);
 const [currentIndex, setCurrentIndex] =
  useState(0);
 const [answer, setAnswer] = useState("");
 const [score, setScore] = useState(0);
 const [showResult, setShowResult] =
  useState(false);
 const [isCorrect, setIsCorrect] =
  useState(false);
 const [gameFinished, setGameFinished] =
  useState(false);
 const [timeLeft, setTimeLeft] =
  useState(QUESTION_TIME);
 const [activeMixCategories, setActiveMixCategories] =
  useState(DEFAULT_MIX_CATEGORIES);
 const [finishNote, setFinishNote] =
  useState(null);
 const [historyRecorded, setHistoryRecorded] =
  useState(false);
 const [trivia, setTrivia] = useState(null);
 const [triviaEnabled, setTriviaEnabled] = useState(true);
 const [showDonate, setShowDonate] = useState(false);
 const triviaEnabledRef = useRef(true);
 const advanceTimerRef = useRef(null);
 const triviaTimerRef = useRef(null);

 useEffect(() => {
  loadQuotes();
 }, [category, searchParams]);

 useEffect(() => {
  return () => {
   if (advanceTimerRef.current) {
    window.clearTimeout(advanceTimerRef.current);
   }
   if (triviaTimerRef.current) {
    window.clearTimeout(triviaTimerRef.current);
   }
  };
 }, []);

 async function loadQuotes() {
  setLoading(true);
  setCurrentIndex(0);
  setScore(0);
  setAnswer("");
  setShowResult(false);
  setGameFinished(false);
  setFinishNote(null);
  setHistoryRecorded(false);
  setTrivia(null);
  triviaEnabledRef.current = true;
  setTriviaEnabled(true);

  const nextAccount = await getAccount();
  setAccount(nextAccount);

  if (isLyricsCategory(category)) {
   navigate("/lyrics", {
    replace: true
   });
   return;
  }

  const normalizedCategory =
   normalizeCategory(category);
  const mixCategories =
   parseMixCategories(searchParams.get("mix"));
  setActiveMixCategories(mixCategories);
  const query = supabase
   .from("quotes")
   .select("*")
   .limit(100);

  const { data, error } =
   isMixCategory(category)
    ? await query
    : await query.ilike(
       "category",
       normalizedCategory
      );

  if (error) {
   console.error("SUPABASE ERROR:", error);
   setLoading(false);
   return;
  }

  if (!data || data.length === 0) {
   console.log(
    "No quotes found for category:",
    normalizedCategory
   );
   setQuotes([]);
   setLoading(false);
   return;
  }

  const filteredData = isMixCategory(category)
   ? data.filter((quote) =>
      mixCategories.some((selected) =>
       categoryMatches(
        quote.category,
        selected
       )
      )
     )
   : data;

  if (!filteredData.length) {
   setQuotes([]);
   setLoading(false);
   return;
  }

  const shuffled = [...filteredData].sort(
   () => Math.random() - 0.5
  );

  setQuotes(shuffled);
  setLoading(false);
 }

 const currentQuestion =
  quotes[currentIndex];

 useEffect(() => {
  if (quotes.length === 0) return;
  if (gameFinished) return;
  if (showResult || trivia) return;

  setTimeLeft(QUESTION_TIME);

  const interval = setInterval(() => {
   setTimeLeft((prev) => {
    if (prev <= 1) {
     clearInterval(interval);

     setTimeout(() => {
      handleTimeout();
     }, 100);

     return 0;
    }

    return prev - 1;
   });
  }, 1000);

  return () => clearInterval(interval);
 }, [currentIndex, quotes.length, showResult, trivia, gameFinished]);

function handleTimeout() {
  if (showResult) return;
  setShowResult(true);
  setIsCorrect(false);
  playSoundEffect("incorrect");

  advanceTimerRef.current = setTimeout(() => {
   beginTrivia(currentQuestion);
  }, 1500);
 }

 function submitAnswer() {
  if (!currentQuestion || showResult) return;

  const correct =
   normalizeAnswer(answer) ===
   normalizeAnswer(currentQuestion.answer);

  setIsCorrect(correct);
  setShowResult(true);
  playSoundEffect(
   correct ? "correct" : "incorrect"
  );

  if (correct) {
   setScore((prev) => prev + 1);
  }

  advanceTimerRef.current = setTimeout(() => {
   beginTrivia(currentQuestion);
  }, 1500);
 }

 function beginTrivia(question) {
  if (!triviaEnabledRef.current) {
   nextQuestion();
   return;
  }

  const fact =
   question?.trivia_fact ||
   `Did you know? The answer was: ${question?.answer || ""}`;

  setTrivia({
   answer: question?.answer || "",
   fact,
   posterUrl: question?.poster_url || null
  });

  triviaTimerRef.current = setTimeout(
   nextQuestion,
   TRIVIA_DURATION_MS
  );
 }

 function skipTrivia() {
  if (triviaTimerRef.current) {
   clearTimeout(triviaTimerRef.current);
   triviaTimerRef.current = null;
  }
  nextQuestion();
 }

 function turnOffTrivia() {
  triviaEnabledRef.current = false;
  setTriviaEnabled(false);
  skipTrivia();
 }

 function nextQuestion() {
  setShowResult(false);
  setAnswer("");
  setTrivia(null);

  if (currentIndex + 1 >= quotes.length) {
   setGameFinished(true);
   return;
  }

  setCurrentIndex((prev) => prev + 1);
 }

 function restartGame() {
  setCurrentIndex(0);
  setScore(0);
  setAnswer("");
  setShowResult(false);
  setGameFinished(false);
  setFinishNote(null);
  setHistoryRecorded(false);
  setTrivia(null);
  triviaEnabledRef.current = true;
  setTriviaEnabled(true);

  const reshuffled = [...quotes].sort(
   () => Math.random() - 0.5
  );
  setQuotes(reshuffled);
 }

 useEffect(() => {
  if (
   !gameFinished ||
   historyRecorded ||
   !quotes.length
  ) {
   return;
  }

  const result =
   score / Math.max(1, quotes.length) >= 0.5
    ? "win"
    : "loss";

  setHistoryRecorded(true);
  recordPlayHistory({
   mode: "solo",
   category: isMixCategory(category)
    ? "mix"
    : category,
   score,
   totalQuestions: quotes.length,
   result,
   metadata: {
    mixCategories: activeMixCategories
   }
  });
  setFinishNote({
   result,
   compliment: getRandomCompliment(),
   insight: getInsight([
    {
     category: isMixCategory(category)
      ? "mix"
      : category,
     result
    }
   ])
  });
 }, [
  gameFinished,
  historyRecorded,
  quotes.length,
  score,
  category,
  activeMixCategories
 ]);

 if (loading) {
  return (
   <div className="min-h-screen flex items-center justify-center bg-black text-white text-2xl">
    Loading Quotes...
   </div>
  );
 }

 if (!quotes.length) {
  return (
   <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4 px-4 text-center">
    <h1 className="text-3xl font-bold">
     No Quotes Found
    </h1>

    <p>
     Your database has no quotes for category:
     <span className="text-yellow-400 ml-2">
      {category}
     </span>
    </p>

    <button
     onClick={() => navigate("/categories")}
     className="bg-white text-black px-6 py-3 rounded-xl font-bold"
    >
     Back to Categories
    </button>
   </div>
  );
 }

 if (gameFinished) {
  return (
   <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4 text-center">
    <DonateModal
     open={showDonate}
     onClose={() => setShowDonate(false)}
    />
    <h1 className="text-5xl font-bold mb-6">
     Game Finished
    </h1>

    <p className="text-2xl mb-8">
     Your Score: {score} / {quotes.length}
    </p>

    {finishNote && (
     <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-8 max-w-xl">
      <p className="text-yellow-300 uppercase tracking-[0.25em] text-sm mb-3">
       {finishNote.compliment}
      </p>
      <p className="text-zinc-300">
       {finishNote.result === "win"
        ? "That was a clean solo win."
        : "Good run. The comeback arc is warming up."}
      </p>
      <p className="text-zinc-500 mt-2">
       {finishNote.insight}
      </p>
     </div>
    )}

    <div className="flex gap-4 flex-wrap justify-center">
     <button
      onClick={() => setShowDonate(true)}
      className="bg-yellow-400 text-black px-6 py-3 rounded-xl font-bold"
     >
      Buy us a chai - Donate
     </button>
     <button
      onClick={restartGame}
      className="bg-green-500 px-6 py-3 rounded-xl font-bold"
     >
      Play Again
     </button>

     <button
      onClick={() => navigate("/")}
      className="bg-white text-black px-6 py-3 rounded-xl font-bold"
     >
      Home
     </button>
    </div>
   </div>
  );
 }

 return (
  <div className="min-h-screen bg-black text-white px-4 py-10 flex justify-center items-center">
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

   <div className="w-full max-w-3xl bg-zinc-900 rounded-2xl p-8 border border-zinc-700">
    <div className="flex justify-between items-center mb-6">
     <div>
      <h2 className="text-xl font-bold capitalize">
       {isMixCategory(category)
        ? "Premium Mix"
        : category}
      </h2>
      {isMixCategory(category) && (
       <p className="text-yellow-300 mt-2 text-sm">
        {activeMixCategories.join(" + ")}
       </p>
      )}
      <p className="text-zinc-400">
       Question {currentIndex + 1} / {quotes.length}
      </p>
     </div>

     <div className="text-right">
      <p className="text-yellow-400 font-bold text-xl">
       {timeLeft}s
      </p>
      <p className="text-green-400">
       Score: {score}
      </p>
     </div>
    </div>

    <div className="bg-zinc-800 rounded-2xl p-6 mb-6 min-h-[180px] flex items-center justify-center text-center">
     <p className="text-2xl leading-relaxed">
      "{currentQuestion.dialogue}"
     </p>
    </div>

    {!showResult ? (
     <>
      <input
       type="text"
       value={answer}
       onChange={(e) =>
        setAnswer(e.target.value)
       }
       placeholder="Enter movie/show name"
       className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-4 text-lg outline-none"
       onKeyDown={(e) => {
        if (e.key === "Enter") {
         submitAnswer();
        }
       }}
      />

      <button
       onClick={submitAnswer}
       className="w-full mt-4 bg-white text-black py-4 rounded-xl font-bold text-lg hover:scale-[1.02] transition"
      >
       Submit Answer
      </button>
     </>
    ) : (
     <div className="text-center py-4">
      {isCorrect ? (
       <div>
        <h2 className="text-4xl font-bold text-green-400 mb-4">
         Correct!
        </h2>
       </div>
      ) : (
       <div>
        <h2 className="text-4xl font-bold text-red-400 mb-4">
         Wrong!
        </h2>

        <p className="text-xl text-zinc-300">
         Correct Answer:
        </p>

        <p className="text-2xl font-bold mt-2 text-yellow-400">
         {currentQuestion.answer}
        </p>
       </div>
      )}
     </div>
    )}

    {!triviaEnabled && (
     <p className="text-zinc-500 text-xs mt-4 text-center">
      Trivia screen turned off for this run.
     </p>
    )}
   </div>
  </div>
 );
}

import React, {
 useEffect,
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
 isPremium,
 isPremiumPlus,
 recordPlayHistory
} from "../lib/account";
import {
 getInsight,
 getRandomCompliment
} from "../lib/playerStats";

const QUESTION_TIME = 30;
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
 const [premiumBlocked, setPremiumBlocked] =
  useState(false);
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

 useEffect(() => {
  loadQuotes();
 }, [category, searchParams]);

 async function loadQuotes() {
  setLoading(true);
  setPremiumBlocked(false);
  setCurrentIndex(0);
  setScore(0);
  setAnswer("");
  setShowResult(false);
  setGameFinished(false);
  setFinishNote(null);
  setHistoryRecorded(false);

  const nextAccount = await getAccount();
  setAccount(nextAccount);

  if (
   isMixCategory(category) &&
   !isPremium(nextAccount)
  ) {
   setQuotes([]);
   setPremiumBlocked(true);
   setLoading(false);
   return;
  }

  if (
   normalizeCategory(category).replace(/\s+/g, "") ===
    "trivia" &&
   !isPremium(nextAccount)
  ) {
   setQuotes([]);
   setPremiumBlocked(true);
   setLoading(false);
   return;
  }

  if (
   normalizeCategory(category).replace(/\s+/g, "") ===
    "premiumplus" &&
   !isPremiumPlus(nextAccount)
  ) {
   setQuotes([]);
   setPremiumBlocked(true);
   setLoading(false);
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
 }, [currentIndex, quotes.length]);

 function handleTimeout() {
  setShowResult(true);
  setIsCorrect(false);

  setTimeout(() => {
   nextQuestion();
  }, 2000);
 }

 function submitAnswer() {
  if (!currentQuestion) return;

  const correct =
   normalizeAnswer(answer) ===
   normalizeAnswer(currentQuestion.answer);

  setIsCorrect(correct);
  setShowResult(true);

  if (correct) {
   setScore((prev) => prev + 1);
  }

  setTimeout(() => {
   nextQuestion();
  }, 2000);
 }

 function nextQuestion() {
  setShowResult(false);
  setAnswer("");

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

 if (premiumBlocked) {
  return (
   <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 text-center">
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-lg">
     <p className="text-yellow-400 uppercase tracking-[0.25em] text-xs mb-4">
      Premium Mix
     </p>
     <h1 className="text-4xl font-bold mb-4">
      Want to play different categories at the same time?
     </h1>
      <p className="text-zinc-400 leading-relaxed mb-8">
      Upgrade to Premium to choose multiple categories and play them together in solo and multiplayer.
     </p>
     <div className="grid gap-3">
      <button
       onClick={() => navigate("/payment")}
       className="bg-yellow-400 text-black px-6 py-3 rounded-lg font-bold"
      >
       Upgrade to Premium
      </button>
      <button
       onClick={() => navigate("/categories")}
       className="bg-zinc-800 px-6 py-3 rounded-lg font-bold"
      >
       Choose Another Category
      </button>
     </div>
    </div>
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
   </div>
  </div>
 );
}

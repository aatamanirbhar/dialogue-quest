import React from "react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function SoloGame() {

  const navigate = useNavigate();
  const { category } = useParams();

  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentIndex, setCurrentIndex] = useState(0);

  const [answer, setAnswer] = useState("");

  const [score, setScore] = useState(0);

  const [showResult, setShowResult] = useState(false);

  const [isCorrect, setIsCorrect] = useState(false);

  const [gameFinished, setGameFinished] = useState(false);

  const QUESTION_TIME = 15;

  const [timeLeft, setTimeLeft] =
    useState(QUESTION_TIME);

  // MIX CATEGORY SELECTION
  const [selectedCategories, setSelectedCategories] =
    useState([]);

  const [mixStarted, setMixStarted] =
    useState(category !== "mix");

  const allCategories = [
    "Hollywood",
    "Tvshows",
    "Anime",
    "Bollywood"
  ];

  // LOAD NORMAL CATEGORIES AUTOMATICALLY
  useEffect(() => {

    if (category !== "mix") {
      loadQuotes();
    }

  }, [category]);

  async function loadQuotes() {

    setLoading(true);

    let query = supabase
      .from("quotes")
      .select("*");

    // MIX CATEGORY
    if (category === "mix") {

      query = query.in(
        "category",
        selectedCategories
      );

    } else {

      const normalizedCategory =
        category
          ?.toLowerCase()
          ?.replaceAll("-", " ")
          ?.trim();

      query = query.ilike(
        "category",
        normalizedCategory
      );

    }

    const { data, error } =
      await query.limit(100);

    if (error) {

      console.error(error);

      setLoading(false);

      return;

    }

    if (!data || data.length === 0) {

      setQuotes([]);

      setLoading(false);

      return;

    }

    const shuffled =
      [...data].sort(
        () => Math.random() - 0.5
      );

    setQuotes(shuffled);

    setCurrentIndex(0);

    setScore(0);

    setAnswer("");

    setShowResult(false);

    setGameFinished(false);

    setLoading(false);

  }

  function toggleCategory(cat) {

    setSelectedCategories((prev) => {

      if (prev.includes(cat)) {

        return prev.filter(
          (c) => c !== cat
        );

      }

      return [...prev, cat];

    });

  }

  const currentQuestion =
    quotes[currentIndex];

  // TIMER
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

  function normalize(str) {

    return str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  }

  function submitAnswer() {

    if (!currentQuestion) return;

    const userAnswer =
      normalize(answer);

    const correctAnswer =
      normalize(currentQuestion.answer);

    const correct =
      userAnswer === correctAnswer;

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

    const reshuffled =
      [...quotes].sort(
        () => Math.random() - 0.5
      );

    setQuotes(reshuffled);

    setCurrentIndex(0);

    setScore(0);

    setAnswer("");

    setShowResult(false);

    setGameFinished(false);

  }

  // MIX SELECTION SCREEN
  if (
    category === "mix" &&
    !mixStarted
  ) {

    return (

      <div className="
        min-h-screen
        bg-black
        text-white
        flex
        flex-col
        items-center
        justify-center
        px-4
      ">

        <h1 className="
          text-4xl
          font-bold
          mb-8
        ">
          Create Your Mix
        </h1>

        <div className="
          flex
          flex-wrap
          gap-4
          justify-center
          mb-8
        ">

          {allCategories.map((cat) => {

            const active =
              selectedCategories.includes(cat);

            return (

              <button
                key={cat}

                onClick={() =>
                  toggleCategory(cat)
                }

                className={`
                  px-5 py-3 rounded-xl
                  font-bold capitalize transition

                  ${active
                    ? "bg-white text-black"
                    : "bg-zinc-800 text-white border border-zinc-700"
                  }
                `}
              >
                {cat}
              </button>

            );

          })}

        </div>

        <button

          disabled={
            selectedCategories.length === 0
          }

          onClick={async () => {

            await loadQuotes();

            setMixStarted(true);

          }}

          className="
            bg-white
            text-black
            px-8
            py-4
            rounded-2xl
            font-bold
            text-lg
            disabled:opacity-50
          "
        >
          Start Mix
        </button>

      </div>

    );

  }

  if (loading) {

    return (

      <div className="
        min-h-screen
        flex
        items-center
        justify-center
        bg-black
        text-white
        text-2xl
      ">
        Loading Quotes...
      </div>

    );

  }

  if (!quotes.length) {

    return (

      <div className="
        min-h-screen
        bg-black
        text-white
        flex
        flex-col
        items-center
        justify-center
        gap-4
        px-4
        text-center
      ">

        <h1 className="
          text-3xl
          font-bold
        ">
          No Quotes Found
        </h1>

        <button

          onClick={() => navigate("/")}

          className="
            bg-white
            text-black
            px-6
            py-3
            rounded-xl
            font-bold
          "
        >
          Go Home
        </button>

      </div>

    );

  }

  if (gameFinished) {

    return (

      <div className="
        min-h-screen
        bg-black
        text-white
        flex
        flex-col
        items-center
        justify-center
        px-4
        text-center
      ">

        <h1 className="
          text-5xl
          font-bold
          mb-6
        ">
          Game Finished
        </h1>

        <p className="
          text-2xl
          mb-8
        ">
          Your Score:
          {" "}
          {score}
          {" / "}
          {quotes.length}
        </p>

        <div className="
          flex
          gap-4
          flex-wrap
          justify-center
        ">

          <button

            onClick={restartGame}

            className="
              bg-green-500
              px-6
              py-3
              rounded-xl
              font-bold
            "
          >
            Play Again
          </button>

          <button

            onClick={() => navigate("/")}

            className="
              bg-white
              text-black
              px-6
              py-3
              rounded-xl
              font-bold
            "
          >
            Home
          </button>

        </div>

      </div>

    );

  }

  return (

    <div className="
      min-h-screen
      bg-black
      text-white
      px-4
      py-10
      flex
      justify-center
      items-center
    ">

      <div className="
        w-full
        max-w-3xl
        bg-zinc-900
        rounded-3xl
        p-8
        border
        border-zinc-700
      ">

        <div className="
          flex
          justify-between
          items-center
          mb-6
        ">

          <div>

            <h2 className="
              text-xl
              font-bold
              capitalize
            ">
              {category}
            </h2>

            <p className="
              text-zinc-400
            ">
              Question
              {" "}
              {currentIndex + 1}
              {" / "}
              {quotes.length}
            </p>

          </div>

          <div className="
            text-right
          ">

            <p className="
              text-yellow-400
              font-bold
              text-xl
            ">
              {timeLeft}s
            </p>

            <p className="
              text-green-400
            ">
              Score:
              {" "}
              {score}
            </p>

          </div>

        </div>

        <div className="
          bg-zinc-800
          rounded-2xl
          p-6
          mb-6
          min-h-[180px]
          flex
          items-center
          justify-center
          text-center
        ">

          <p className="
            text-2xl
            leading-relaxed
          ">
            “{currentQuestion.dialogue}”
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

              placeholder="
                Enter movie/show name
              "

              className="
                w-full
                bg-zinc-800
                border
                border-zinc-700
                rounded-xl
                px-4
                py-4
                text-lg
                outline-none
              "

              onKeyDown={(e) => {

                if (e.key === "Enter") {
                  submitAnswer();
                }

              }}

            />

            <button

              onClick={submitAnswer}

              className="
                w-full
                mt-4
                bg-white
                text-black
                py-4
                rounded-xl
                font-bold
                text-lg
                hover:scale-[1.02]
                transition
              "
            >
              Submit Answer
            </button>

          </>

        ) : (

          <div className="
            text-center
            py-4
          ">

            {isCorrect ? (

              <div>

                <h2 className="
                  text-4xl
                  font-bold
                  text-green-400
                  mb-4
                ">
                  Correct!
                </h2>

              </div>

            ) : (

              <div>

                <h2 className="
                  text-4xl
                  font-bold
                  text-red-400
                  mb-4
                ">
                  Wrong!
                </h2>

                <p className="
                  text-xl
                  text-zinc-300
                ">
                  Correct Answer:
                </p>

                <p className="
                  text-2xl
                  font-bold
                  mt-2
                  text-yellow-400
                ">
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
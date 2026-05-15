import React, {
 useEffect,
 useMemo,
 useRef,
 useState
} from "react";

import {
 useNavigate,
 useParams
} from "react-router-dom";

import { supabase } from "../lib/supabase";
import { getPlayerId } from "../lib/player";

const DEFAULT_QUESTION_DURATION = 15;
const TRIVIA_DURATION = 5000;
const ENDLESS_BATCH_SIZE = 50;

const parseSupabaseTime = (value) => {
 if (!value) return null;

 if (value instanceof Date) {
  return value.getTime();
 }

 const text = String(value).trim();
 const hasTimezone =
  /(?:z|[+-]\d{2}:?\d{2})$/i.test(text);
 const isoLikeText =
  text.includes("T")
   ? text
   : text.replace(" ", "T");
 const normalized =
  hasTimezone
   ? isoLikeText
   : `${isoLikeText}Z`;
 const time = new Date(normalized).getTime();

 return Number.isNaN(time) ? null : time;
};

const toSupabaseTime = (date = new Date()) => {
 return date.toISOString();
};

const getQuestionDuration = (room) => {
 const duration = Number(room?.question_duration);

 if (duration === 0) return null;

 return duration || DEFAULT_QUESTION_DURATION;
};

const getRemainingTime = (room, currentTime) => {
 const duration = getQuestionDuration(room);

 if (!duration) return null;

 if (!room?.question_started_at) {
  return duration;
 }

 const startedAt =
  parseSupabaseTime(
   room.question_started_at
  );

 if (!startedAt) return duration;

 const elapsed =
  (currentTime - startedAt) / 1000;

 return Math.max(
  0,
  Math.ceil(duration - elapsed)
 );
};

const hasQuestionExpired = (room) => {
 const remaining =
  getRemainingTime(room, Date.now());

 return remaining !== null && remaining <= 0;
};

const normalizeAnswer = (text) => {
 return String(text || "")
  .toLowerCase()
  .replace(/\s+/g, "")
  .replace(/[^a-z0-9]/g, "");
};

const normalizeCategory = (value) => {
 return String(value || "")
  .toLowerCase()
  .replace(/[^a-z0-9]/g, "");
};

const getWinnerText = (players) => {
 if (!players?.length) return "No Winner";

 const sorted =
  [...players].sort(
   (a, b) => (b.score || 0) - (a.score || 0)
  );
 const highScore = sorted[0]?.score || 0;
 const leaders =
  sorted.filter(
   (player) => (player.score || 0) === highScore
  );

 if (leaders.length > 1) {
  return `Tie: ${leaders
   .map((player) => player.username)
   .join(", ")}`;
 }

 return sorted[0]?.username || "No Winner";
};

export default function Room() {
 const navigate = useNavigate();
 const { code } = useParams();
 const playerId = getPlayerId();

 const [room, setRoom] = useState(null);
 const [players, setPlayers] = useState([]);
 const [quote, setQuote] = useState(null);
 const [message, setMessage] = useState("");
 const [loading, setLoading] = useState(true);
 const [notice, setNotice] = useState("");
 const [now, setNow] = useState(Date.now());

 const advancingRef = useRef(false);

 const me = useMemo(() => {
  return players.find(
   (player) => player.player_id === playerId
  );
 }, [players, playerId]);

 const isHost = room?.host_id === playerId;

 const fetchRoom = async () => {
  const { data } = await supabase
   .from("rooms")
   .select("*")
   .eq("room_code", code)
   .maybeSingle();

  setRoom(data || null);
 };

 const fetchPlayers = async () => {
  const { data } = await supabase
   .from("room_players")
   .select("*")
   .eq("room_code", code)
   .order("score", {
    ascending: false
   });

  setPlayers(data || []);
 };

 const deleteRoom = async () => {
  await supabase
   .from("room_questions")
   .delete()
   .eq("room_code", code);

  await supabase
   .from("room_players")
   .delete()
   .eq("room_code", code);

  await supabase
   .from("rooms")
   .delete()
   .eq("room_code", code);
 };

 const fetchCurrentQuote = async () => {
  if (!room?.game_started) {
   setQuote(null);
   return;
  }

  const { data: roomQuestion } =
   await supabase
    .from("room_questions")
    .select("*")
    .eq("room_code", code)
    .eq(
     "question_order",
     room.current_question || 0
    )
    .maybeSingle();

  if (!roomQuestion) {
   setQuote(null);
   return;
  }

  const { data: quoteData } =
   await supabase
    .from("quotes")
    .select("*")
    .eq("id", roomQuestion.quote_id)
    .maybeSingle();

  setQuote(quoteData || null);
 };

 const generateQuestions = async (sourceRoom) => {
 const { data: quotes } =
   await supabase
    .from("quotes")
    .select("id, category");

  const requestedCategory =
   normalizeCategory(sourceRoom.category);

  const matchingQuotes =
   (quotes || []).filter((quoteItem) => {
    const quoteCategory =
     normalizeCategory(quoteItem.category);

    return (
     quoteCategory === requestedCategory ||
     (
      requestedCategory === "tvshows" &&
      quoteCategory === "tvseries"
     ) ||
     (
      requestedCategory === "tvseries" &&
      quoteCategory === "tvshows"
     )
    );
   });

  if (!matchingQuotes.length) return null;

  const targetCount =
   sourceRoom.endless_mode
    ? Math.max(
       matchingQuotes.length,
       ENDLESS_BATCH_SIZE
      )
    : Math.max(
       1,
       Number(sourceRoom.total_rounds) || 1
      );

  const selected = [];

  while (selected.length < targetCount) {
   const shuffled =
    [...matchingQuotes].sort(
     () => 0.5 - Math.random()
    );

   selected.push(...shuffled);
  }

  const inserts =
   selected
    .slice(0, targetCount)
    .map((quoteItem, index) => ({
     room_code: code,
     quote_id: quoteItem.id,
     question_order: index
    }));

  await supabase
   .from("room_questions")
   .insert(inserts);

  return inserts[0]?.quote_id || null;
 };

 useEffect(() => {
  const init = async () => {
   await Promise.all([
    fetchRoom(),
    fetchPlayers()
   ]);

   setLoading(false);
  };

  init();
 }, []);

 useEffect(() => {
  fetchCurrentQuote();
 }, [
  room?.current_question,
  room?.current_quote_id,
  room?.game_started,
  room?.game_finished
 ]);

 useEffect(() => {
  const channel = supabase
   .channel(`room-${code}`)
   .on(
    "postgres_changes",
    {
     event: "*",
     schema: "public",
     table: "rooms",
     filter: `room_code=eq.${code}`
    },
    () => {
     fetchRoom();
    }
   )
   .on(
    "postgres_changes",
    {
     event: "*",
     schema: "public",
     table: "room_players",
     filter: `room_code=eq.${code}`
    },
    () => {
     fetchPlayers();
    }
   )
   .subscribe();

  return () => {
   supabase.removeChannel(channel);
  };
 }, []);

 useEffect(() => {
  const interval = setInterval(
   () => setNow(Date.now()),
   1000
  );

  return () => clearInterval(interval);
 }, []);

 const startGame = async () => {
  if (!room || !isHost) return;

  setNotice("");

  await supabase
   .from("room_questions")
   .delete()
   .eq("room_code", code);

  const firstQuoteId =
   await generateQuestions(room);

  if (!firstQuoteId) {
   setNotice(
    "No questions found for this category."
   );
   return;
  }

  await supabase
   .from("room_players")
   .update({
    score: 0,
    answered_current: false,
    current_answer_correct: null
   })
   .eq("room_code", code);

  const { data } = await supabase
   .from("rooms")
   .update({
    game_started: true,
    game_finished: false,
    winner: null,
    current_question: 0,
    current_quote_id: firstQuoteId,
    question_started_at:
     toSupabaseTime(),
    trivia_active: false,
    trivia_ends_at: null,
    processing_answer: false
   })
   .eq("room_code", code)
   .select()
   .single();

  if (data) setRoom(data);
 };

 const remainingTime =
  useMemo(() => {
   return getRemainingTime(
    room,
    now
   );
  }, [
   room?.question_started_at,
   room?.question_duration,
   now
  ]);

 useEffect(() => {
  if (
   !room?.game_started ||
   room?.game_finished ||
   room?.trivia_active ||
   !room?.question_started_at ||
   !isHost ||
   getQuestionDuration(room) === null
  ) {
   return;
  }

  const durationMs =
   getQuestionDuration(room) * 1000;
  const startedAt =
   parseSupabaseTime(
    room.question_started_at
   );

  if (!startedAt) return;

  const delay = Math.max(
   0,
   startedAt + durationMs - Date.now()
  );

  const timeout = setTimeout(
   () => nextQuestion(),
   delay
  );

  return () => clearTimeout(timeout);
 }, [
  room?.game_started,
  room?.game_finished,
  room?.trivia_active,
  room?.question_started_at,
  room?.question_duration,
  isHost
 ]);

 useEffect(() => {
  if (
   !room?.trivia_active ||
   !room?.trivia_ends_at ||
   !isHost
  ) {
   return;
  }

  const endsAt =
   parseSupabaseTime(room.trivia_ends_at);

  if (!endsAt) return;

  const timeout = setTimeout(
   () => endTrivia(),
   Math.max(0, endsAt - Date.now())
  );

  return () => clearTimeout(timeout);
 }, [
  room?.trivia_active,
  room?.trivia_ends_at,
  isHost
 ]);

 const finishGame = async (lockedRoom) => {
  const { data: freshPlayers } =
   await supabase
    .from("room_players")
    .select("*")
    .eq("room_code", code)
    .order("score", {
     ascending: false
    });

  const { data } = await supabase
   .from("rooms")
   .update({
    game_finished: true,
    winner: getWinnerText(
     freshPlayers || []
    ),
    trivia_active: false,
    trivia_ends_at: null,
    processing_answer: false
   })
   .eq("room_code", code)
   .eq(
    "current_question",
    lockedRoom.current_question
   )
   .select()
   .single();

  if (data) setRoom(data);
 };

 const nextQuestion = async ({
  force = false
 } = {}) => {
  if (!room || advancingRef.current) return;

  advancingRef.current = true;

  try {
   const { data: latestRoom } =
    await supabase
     .from("rooms")
     .select("*")
     .eq("room_code", code)
     .maybeSingle();

   if (
    !latestRoom ||
    latestRoom.game_finished ||
    (
     !force &&
     !hasQuestionExpired(latestRoom)
    )
   ) {
    return;
   }

   const { data: lockedRoom } =
    await supabase
     .from("rooms")
     .update({
      processing_answer: true
     })
     .eq("room_code", code)
     .eq(
      "current_question",
      latestRoom.current_question
     )
     .eq("processing_answer", false)
     .select("*")
     .maybeSingle();

   if (!lockedRoom) return;

   if (
    !force &&
    lockedRoom.show_trivia
   ) {
    const { data } = await supabase
     .from("rooms")
     .update({
      trivia_active: true,
      trivia_ends_at:
       toSupabaseTime(
        new Date(
         Date.now() + TRIVIA_DURATION
        )
       ),
      processing_answer: false
     })
     .eq("room_code", code)
     .eq(
      "current_question",
      lockedRoom.current_question
     )
     .select()
     .single();

    if (data) setRoom(data);
    return;
   }

   const nextIndex =
    lockedRoom.current_question + 1;

   if (
    !lockedRoom.endless_mode &&
    nextIndex >=
     (Number(lockedRoom.total_rounds) || 1)
   ) {
    await finishGame(lockedRoom);
    return;
   }

   const { data: nextRoomQuestion } =
    await supabase
     .from("room_questions")
     .select("*")
     .eq("room_code", code)
     .eq(
      "question_order",
      nextIndex
     )
     .maybeSingle();

   if (!nextRoomQuestion) {
    await finishGame(lockedRoom);
    return;
   }

   await supabase
    .from("room_players")
    .update({
     answered_current: false,
     current_answer_correct: null
    })
    .eq("room_code", code);

   const { data } = await supabase
    .from("rooms")
    .update({
     current_question: nextIndex,
     current_quote_id:
      nextRoomQuestion.quote_id,
     question_started_at:
      toSupabaseTime(),
     trivia_active: false,
     trivia_ends_at: null,
     processing_answer: false
    })
    .eq("room_code", code)
    .eq(
     "current_question",
     lockedRoom.current_question
    )
    .select()
    .single();

   if (data) setRoom(data);
  } finally {
   advancingRef.current = false;
  }
 };

 const endTrivia = async () => {
  await supabase
   .from("rooms")
   .update({
    trivia_active: false
   })
   .eq("room_code", code);

  await nextQuestion({
   force: true
  });
 };

 const disableTrivia = async () => {
  await supabase
   .from("rooms")
   .update({
    show_trivia: false,
    trivia_active: false
   })
   .eq("room_code", code);

  await nextQuestion({
   force: true
  });
 };

 const submitAnswer = async () => {
  if (
   !quote ||
   !message.trim() ||
   room?.game_finished
  ) {
   return;
  }

  const isCorrect =
   normalizeAnswer(message) ===
   normalizeAnswer(quote.answer);

  const { data: answeredPlayer } =
   await supabase
    .from("room_players")
    .update({
     answered_current: true,
     current_answer_correct:
      isCorrect
    })
    .eq("player_id", playerId)
    .eq("room_code", code)
    .eq("answered_current", false)
    .select("*")
    .maybeSingle();

  if (!answeredPlayer) {
   setMessage("");
   return;
  }

  if (isCorrect) {
   await supabase
    .from("room_players")
    .update({
     score:
      (answeredPlayer.score || 0) + 1
    })
    .eq("player_id", playerId)
    .eq("room_code", code);
  }

  setMessage("");
 };

 const leaveRoom = async () => {
  if (isHost) {
   await deleteRoom();
   navigate("/multiplayer");
   return;
  }

  await supabase
   .from("room_players")
   .delete()
   .eq("player_id", playerId)
   .eq("room_code", code);

  const { data: remainingPlayers } =
   await supabase
    .from("room_players")
    .select("id")
    .eq("room_code", code);

  if (!remainingPlayers?.length) {
   await deleteRoom();
  }

  navigate("/multiplayer");
 };

 const closeRoom = async () => {
  await deleteRoom();
  navigate("/multiplayer");
 };

 if (loading) {
  return (
   <div className="min-h-screen bg-black text-white p-10">
    Loading...
   </div>
  );
 }

 if (!room) {
  return (
   <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 text-center">
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-lg">
     <h1 className="text-4xl font-bold mb-4">
      Room closed
     </h1>
     <p className="text-zinc-400 mb-8">
      This room has ended or was disposed by the host.
     </p>
     <button
      onClick={() => navigate("/multiplayer")}
      className="bg-yellow-400 text-black px-6 py-3 rounded-lg font-bold"
     >
      Back to Multiplayer
     </button>
    </div>
   </div>
  );
 }

 if (!me && players.length > 0) {
  return (
   <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 text-center">
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-lg">
     <h1 className="text-4xl font-bold mb-4">
      Access ended
     </h1>
     <p className="text-zinc-400 mb-8">
      You are not in this room. Join from the lobby before the game starts.
     </p>
     <button
      onClick={() => navigate("/multiplayer")}
      className="bg-yellow-400 text-black px-6 py-3 rounded-lg font-bold"
     >
      Open Lobby
     </button>
    </div>
   </div>
  );
 }

 return (
  <div className="min-h-screen bg-black text-white p-6 lg:p-10">
   {room.game_finished && (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center p-6">
     <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center max-w-2xl w-full">
      <div className="text-sm uppercase tracking-[0.3em] text-yellow-400 mb-4">
       Final Result
      </div>

      <h2 className="text-5xl font-bold mb-4">
       {room.winner || "No Winner"}
      </h2>

      <p className="text-zinc-400 mb-8">
       The room is locked to current players. The host can play again here or close it.
      </p>

      <div className="space-y-3 mb-8">
       {players.map((player, index) => (
        <div
         key={player.id}
         className="flex justify-between bg-zinc-800 rounded-lg p-4"
        >
         <span>
          #{index + 1} {player.username}
         </span>
         <span className="font-bold text-yellow-400">
          {player.score}
         </span>
        </div>
       ))}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
       {isHost && (
        <>
         <button
          onClick={startGame}
          className="bg-yellow-400 text-black px-6 py-3 rounded-lg font-bold"
         >
          Play Again
         </button>

         <button
          onClick={closeRoom}
          className="bg-red-500 px-6 py-3 rounded-lg font-bold"
         >
          Close Room
         </button>
        </>
       )}

       <button
        onClick={leaveRoom}
        className="bg-zinc-800 px-6 py-3 rounded-lg font-bold"
       >
        Leave Room
       </button>
      </div>
     </div>
    </div>
   )}

   {room.trivia_active && quote && (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-6">
     <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden max-w-2xl w-full">
      {quote.poster_url && (
       <img
        src={quote.poster_url}
        alt={quote.answer}
        className="w-full h-[420px] object-cover"
       />
      )}

      <div className="p-8">
       <h1 className="text-4xl font-bold mb-4">
        {quote.answer}
       </h1>

       <p className="text-zinc-300 text-lg mb-8 leading-relaxed">
        {quote.trivia_fact}
       </p>

       <div className="flex gap-4 flex-wrap">
        {isHost && (
         <>
          <button
           onClick={endTrivia}
           className="bg-yellow-400 text-black px-6 py-3 rounded-lg font-bold"
          >
           Skip
          </button>

          <button
           onClick={disableTrivia}
           className="bg-zinc-700 px-6 py-3 rounded-lg font-bold"
          >
           Turn Off Trivia
          </button>
         </>
        )}
       </div>
      </div>
     </div>
    </div>
   )}

   <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6 mb-10">
    <div>
     <h1 className="text-5xl font-bold mb-2">
      Room {code}
     </h1>

     <p className="text-zinc-400 capitalize">
      {room.category}{" "}
      {!room.endless_mode &&
       `- ${room.total_rounds} rounds`}
     </p>
    </div>

    <div className="flex flex-wrap items-center gap-3">
     {room.game_started && (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-4 text-center">
       <div className="text-zinc-400 mb-1">
        Time Left
       </div>

       <div className="text-4xl font-bold text-yellow-400">
        {remainingTime === null
         ? "Timeless"
         : remainingTime}
       </div>
      </div>
     )}

     <button
      onClick={leaveRoom}
      className="bg-zinc-800 hover:bg-zinc-700 px-5 py-3 rounded-lg font-bold"
     >
      {isHost ? "Close Room" : "Leave Room"}
     </button>
    </div>
   </div>

   {notice && (
    <div className="bg-red-500/10 border border-red-500/40 text-red-200 rounded-xl p-4 mb-6">
     {notice}
    </div>
   )}

   {!room.game_started ? (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
     <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
      <div>
       <h2 className="text-3xl font-bold mb-2">
        Waiting Room
       </h2>
       <p className="text-zinc-400">
        Timer:{" "}
        {getQuestionDuration(room) === null
         ? "Timeless"
         : `${getQuestionDuration(room)} seconds`}
       </p>
      </div>

      {isHost ? (
       <button
        onClick={startGame}
        className="bg-yellow-400 text-black px-8 py-4 rounded-lg font-bold"
       >
        Start Competition
       </button>
      ) : (
       <p className="text-zinc-400">
        Waiting for host...
       </p>
      )}
     </div>

     <div className="grid md:grid-cols-2 gap-4">
      {players.map((player) => (
       <div
        key={player.id}
        className="bg-zinc-800 p-5 rounded-lg"
       >
        {player.username}
        {player.player_id === room.host_id && (
         <span className="ml-3 text-xs uppercase text-yellow-400">
          Host
         </span>
        )}
       </div>
      ))}
     </div>
    </div>
   ) : (
    <div className="grid lg:grid-cols-3 gap-6">
     <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
      {quote ? (
       <>
        <div className="flex justify-between items-center mb-8 text-zinc-400">
         <div>
          Question {room.current_question + 1}
          {!room.endless_mode &&
           ` / ${room.total_rounds}`}
         </div>

         <div>
          Score: {me?.score || 0}
         </div>
        </div>

        <p className="text-4xl leading-relaxed mb-10">
         "{quote.dialogue}"
        </p>

        <input
         value={message}
         onChange={(event) =>
          setMessage(event.target.value)
         }
         onKeyDown={(event) => {
          if (event.key === "Enter") {
           submitAnswer();
          }
         }}
         placeholder="Guess movie or TV series"
         disabled={me?.answered_current}
         className="w-full bg-zinc-800 border border-zinc-700 p-5 rounded-lg mb-5 disabled:opacity-60"
        />

        <div className="flex flex-wrap gap-3">
         <button
          onClick={submitAnswer}
          disabled={me?.answered_current}
          className="bg-yellow-400 disabled:bg-zinc-700 disabled:text-zinc-400 text-black px-8 py-4 rounded-lg font-bold"
         >
          Submit Answer
         </button>

         {isHost && (
          <button
           onClick={() =>
            nextQuestion({
             force: true
            })
           }
           className="bg-zinc-800 px-8 py-4 rounded-lg font-bold"
          >
           End Question
          </button>
         )}
        </div>
       </>
      ) : (
       <p className="text-zinc-400">
        Loading question...
       </p>
      )}
     </div>

     <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
      <h2 className="text-3xl font-bold mb-8">
       Leaderboard
      </h2>

      <div className="space-y-4">
       {players.map((player) => (
        <div
         key={player.id}
         className="bg-zinc-800 rounded-lg p-5"
        >
         <div className="flex justify-between items-center mb-2">
          <span>{player.username}</span>
          <span>{player.score}</span>
         </div>

         {player.answered_current && (
          <div
           className={`text-sm ${
            player.current_answer_correct
             ? "text-green-400"
             : "text-red-400"
           }`}
          >
           {player.current_answer_correct
            ? "Answered Correct"
            : "Answered Incorrect"}
          </div>
         )}
        </div>
       ))}
      </div>
     </div>
    </div>
   )}
  </div>
 );
}

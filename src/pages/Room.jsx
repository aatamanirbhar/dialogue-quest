import React, {
 useEffect,
 useMemo,
 useRef,
 useState
} from "react";

import { useParams } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { getPlayerId } from "../lib/player";

const DEFAULT_QUESTION_DURATION = 15;
const TRIVIA_DURATION = 5000;

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
 return (
  Number(room?.question_duration) ||
  DEFAULT_QUESTION_DURATION
 );
};

const getRemainingTime = (room, currentTime) => {
 if (!room?.question_started_at) {
 return DEFAULT_QUESTION_DURATION;
 }

 const startedAt =
  parseSupabaseTime(
   room.question_started_at
  );

 if (!startedAt) {
  return DEFAULT_QUESTION_DURATION;
 }

 const elapsed =
  (currentTime - startedAt) / 1000;

 return Math.max(
  0,
  Math.ceil(
   getQuestionDuration(room) -
    elapsed
  )
 );
};

const hasQuestionExpired = (room) => {
 return (
  getRemainingTime(room, Date.now()) <=
  0
 );
};

const normalizeAnswer = (text) => {
 return text
  ?.toLowerCase()
  .replace(/\s+/g, "")
  .replace(/[^a-z0-9]/g, "");
};

export default function Room() {

 const { code } = useParams();

 const playerId = getPlayerId();

 const [room, setRoom] = useState(null);
 const [players, setPlayers] = useState([]);
 const [quote, setQuote] = useState(null);
 const [message, setMessage] = useState("");
 const [loading, setLoading] = useState(true);
 const [now, setNow] = useState(Date.now());

 const advancingRef = useRef(false);

 const me = useMemo(() => {
  return players.find(
   (p) => p.player_id === playerId
  );
 }, [players, playerId]);

 const isHost =
  room?.host_id === playerId;

 // FETCH ROOM

 const fetchRoom = async () => {

  const { data } = await supabase
   .from("rooms")
   .select("*")
   .eq("room_code", code)
   .single();

  if (data) {
   setRoom(data);
  }
 };

 // FETCH PLAYERS

 const fetchPlayers = async () => {

  const { data } = await supabase
   .from("room_players")
   .select("*")
   .eq("room_code", code)
   .order("score", {
    ascending: false
   });

  if (data) {
   setPlayers(data);
  }
 };

 // FETCH CURRENT QUOTE

 const fetchCurrentQuote = async () => {

  const { data: roomQuestion } =
   await supabase
    .from("room_questions")
    .select("*")
    .eq("room_code", code)
    .eq(
      "question_order",
      room?.current_question || 0
    )
    .single();

  if (!roomQuestion) return;

  const { data: quoteData } =
   await supabase
    .from("quotes")
    .select("*")
    .eq("id", roomQuestion.quote_id)
    .single();

  if (quoteData) {
   setQuote(quoteData);
  }
 };

 // GENERATE QUESTIONS

 const generateQuestions = async () => {

  const { data: quotes } =
   await supabase
    .from("quotes")
    .select("id")
    .eq(
      "category",
      room.category
    );

  if (!quotes?.length) return;

  const shuffled =
   [...quotes].sort(
    () => 0.5 - Math.random()
   );

  const selected =
   room.endless_mode
    ? shuffled
    : shuffled.slice(
       0,
       room.total_rounds
      );

  const inserts = selected.map(
   (quote, index) => ({
    room_code: code,
    quote_id: quote.id,
    question_order: index
   })
  );

  await supabase
   .from("room_questions")
   .insert(inserts);

  const firstQuoteId =
   selected[0]?.id;

  const { data } = await supabase
   .from("rooms")
   .update({
    current_quote_id:
     firstQuoteId
   })
   .eq("room_code", code)
   .select()
   .single();

  if (data) {
   setRoom(data);
  }

  return firstQuoteId;
 };

 // INITIAL LOAD

 useEffect(() => {

  const init = async () => {

   await fetchRoom();
   await fetchPlayers();

   setLoading(false);
  };

  init();

 }, []);

 // FETCH QUOTE WHEN QUESTION CHANGES

 useEffect(() => {

  if (room) {
   fetchCurrentQuote();
  }

 }, [
  room?.current_question,
  room?.current_quote_id,
  room?.game_started
 ]);

 // REALTIME

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

 // LOCAL CLOCK

 useEffect(() => {

  const interval = setInterval(
   () => setNow(Date.now()),
   1000
  );

  return () => clearInterval(interval);

 }, []);

 // START GAME

 const startGame = async () => {

  const { data: existing } =
   await supabase
    .from("room_questions")
     .select("*")
     .eq("room_code", code);

  let firstQuoteId =
   existing?.find(
    (question) =>
     question.question_order === 0
   )?.quote_id;

  if (!existing?.length) {
   firstQuoteId =
    await generateQuestions();
  }

  if (!firstQuoteId) {
   const { data: firstQuestion } =
    await supabase
     .from("room_questions")
     .select("quote_id")
     .eq("room_code", code)
     .eq("question_order", 0)
     .single();

   firstQuoteId =
    firstQuestion?.quote_id;
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
    game_started: true,

    current_question: 0,

    current_quote_id:
     firstQuoteId,

    question_started_at:
     toSupabaseTime(),

    trivia_active: false,

    trivia_ends_at: null,

    processing_answer: false
   })
   .eq("room_code", code)
   .select()
   .single();

  if (data) {
   setRoom(data);
  }
 };

 // TIMER

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

 // TIMER

 useEffect(() => {

  if (
   !room?.game_started ||
   room?.game_finished ||
   room?.trivia_active ||
   !room?.question_started_at ||
   !isHost
  ) {
   return;
  }

  const durationMs =
   getQuestionDuration(room) *
   1000;

  const startedAt =
   parseSupabaseTime(
    room.question_started_at
   );

  if (!startedAt) {
   return;
  }

  const delay = Math.max(
   0,
   startedAt + durationMs - Date.now()
  );

  const timeout = setTimeout(
   () => {
    nextQuestion();
   },
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

 // TRIVIA TIMER

 useEffect(() => {

  if (
   !room?.trivia_active ||
   !room?.trivia_ends_at ||
   !isHost
  ) {
   return;
  }

  const endsAt =
   parseSupabaseTime(
    room.trivia_ends_at
   );

  if (!endsAt) {
   return;
  }

  const delay = Math.max(
   0,
   endsAt - Date.now()
  );

  const timeout = setTimeout(
   () => {
    endTrivia();
   },
   delay
  );

  return () => clearTimeout(timeout);

 }, [
  room?.trivia_active,
  room?.trivia_ends_at,
  isHost
 ]);

 // NEXT QUESTION

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
     .single();

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

    if (data) {
     setRoom(data);
    }

    return;
   }

   const nextIndex =
    lockedRoom.current_question + 1;

   // GAME FINISHED

   if (
    !lockedRoom.endless_mode &&
    nextIndex >=
     lockedRoom.total_rounds
   ) {

    const sorted =
     [...players].sort(
      (a, b) =>
       b.score - a.score
     );

    const { data } = await supabase
     .from("rooms")
     .update({
       game_finished: true,

       winner:
        sorted[0]?.username ||
        "No Winner",

       processing_answer: false
     })
     .eq("room_code", code)
     .eq(
      "current_question",
      lockedRoom.current_question
     )
     .select()
     .single();

    if (data) {
     setRoom(data);
    }

    return;
   }

   // FETCH NEXT QUESTION

   const {
    data: nextRoomQuestion
   } = await supabase
    .from("room_questions")
    .select("*")
    .eq("room_code", code)
    .eq(
      "question_order",
      nextIndex
    )
    .single();

   if (!nextRoomQuestion) {
    await supabase
     .from("rooms")
     .update({
      processing_answer: false
     })
     .eq("room_code", code);

    return;
   }

   // RESET ANSWER STATES

   await supabase
    .from("room_players")
    .update({
     answered_current: false,
     current_answer_correct: null
    })
    .eq("room_code", code);

   // UPDATE ROOM

   const { data } = await supabase
    .from("rooms")
    .update({

     current_question:
      nextIndex,

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

   if (data) {
    setRoom(data);
   }

  } finally {
   advancingRef.current = false;
  }
 };

 // START TRIVIA

 const startTrivia = async () => {

  await supabase
   .from("rooms")
   .update({

    trivia_active: true,

    trivia_ends_at:
     toSupabaseTime(
      new Date(
       Date.now() + TRIVIA_DURATION
      )
     )

   })
   .eq("room_code", code);
 };

 // END TRIVIA

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

 // SKIP TRIVIA

 const skipTrivia = async () => {
  await endTrivia();
 };

 // DISABLE TRIVIA

 const disableTrivia =
  async () => {

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

 // SUBMIT ANSWER

 const submitAnswer = async () => {

  if (!quote) return;

  const isCorrect =
   normalizeAnswer(message) ===
   normalizeAnswer(
    quote.answer
   );

  // SHOW ANSWERED STATUS

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

  // CORRECT ANSWER

  if (isCorrect) {

   const newScore =
    (answeredPlayer.score || 0) + 1;

   await supabase
    .from("room_players")
    .update({
      score: newScore
    })
    .eq(
      "player_id",
      playerId
    )
    .eq("room_code", code);

   // Keep the question open until the timer ends so every player
   // gets the same answer window.
  }

  setMessage("");
 };

 // LOADING

 if (loading) {

  return (
   <div className="min-h-screen bg-black text-white p-10">
    Loading...
   </div>
  );
 }

 return (

  <div className="min-h-screen bg-black text-white p-6 lg:p-10">

   {/* WINNER SCREEN */}

   {room?.game_finished && (

    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center p-6">

     <div className="bg-zinc-900 rounded-3xl p-10 text-center max-w-xl w-full">

      <h1 className="text-6xl mb-6">
       🎬
      </h1>

      <h2 className="text-5xl font-bold mb-6">
       {room.winner}
      </h2>

      <p className="text-2xl text-yellow-400">
       You Are A True Movie Rockstar
      </p>

     </div>
    </div>
   )}

   {/* TRIVIA */}

   {room?.trivia_active &&
    quote && (

    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-6">

     <div className="bg-zinc-900 rounded-3xl overflow-hidden max-w-2xl w-full">

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

        <button
         onClick={skipTrivia}
         className="bg-yellow-400 text-black px-6 py-3 rounded-xl font-bold"
        >
         Skip
        </button>

        <button
         onClick={disableTrivia}
         className="bg-zinc-700 px-6 py-3 rounded-xl font-bold"
        >
         I Don't Want Trivia
        </button>

       </div>
      </div>
     </div>
    </div>
   )}

   {/* HEADER */}

   <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6 mb-10">

    <div>

     <h1 className="text-5xl font-bold mb-2">
      Room {code}
     </h1>

     <p className="text-zinc-400">
      {room?.category}
     </p>

    </div>

    {room?.game_started && (

     <div className="text-center">

      <div className="text-zinc-400 mb-2">
       Time Left
      </div>

      <div className="text-5xl font-bold text-yellow-400">
       {remainingTime}
      </div>

     </div>
    )}
   </div>

   {/* WAITING ROOM */}

   {!room?.game_started ? (

    <div className="bg-zinc-900 rounded-3xl p-10">

     <h2 className="text-3xl font-bold mb-8">
      Waiting Room
     </h2>

     <div className="space-y-4 mb-8">

      {players.map((player) => (

       <div
        key={player.id}
        className="bg-zinc-800 p-5 rounded-xl"
       >
        {player.username}
       </div>
      ))}
     </div>

     {isHost ? (

      <button
       onClick={startGame}
       className="bg-yellow-400 text-black px-8 py-4 rounded-xl font-bold"
      >
       Start Competition
      </button>

     ) : (

      <p className="text-zinc-400">
       Waiting for host...
      </p>
     )}
    </div>

   ) : (

    <div className="grid lg:grid-cols-3 gap-6">

     {/* QUESTION */}

     <div className="lg:col-span-2 bg-zinc-900 rounded-3xl p-8">

      {quote && (

       <>

        <div className="flex justify-between items-center mb-8">

         <div>
          Question {room.current_question + 1}
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
         onChange={(e) =>
          setMessage(e.target.value)
         }
         placeholder="Guess movie or TV series"
         className="w-full bg-zinc-800 p-5 rounded-xl mb-5"
        />

        <button
         onClick={submitAnswer}
         className="bg-yellow-400 text-black px-8 py-4 rounded-xl font-bold"
        >
         Submit Answer
        </button>

       </>
      )}
     </div>

     {/* LEADERBOARD */}

     <div className="bg-zinc-900 rounded-3xl p-8">

      <h2 className="text-3xl font-bold mb-8">
       Leaderboard
      </h2>

      <div className="space-y-4">

       {players.map((player) => (

        <div
         key={player.id}
         className="bg-zinc-800 rounded-xl p-5"
        >

         <div className="flex justify-between items-center mb-2">

          <span>
           {player.username}
          </span>

          <span>
           {player.score}
          </span>

         </div>

         {player.answered_current && (

          <div
           className={`text-sm ${
            player.current_answer_correct
             ? "text-green-400"
             : "text-red-400"
           }`}
          >
           <span className="hidden">
           Answered ✓
           </span>
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

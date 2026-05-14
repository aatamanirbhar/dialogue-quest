import React, {
 useEffect,
 useMemo,
 useState
} from "react";

import { useParams } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { getPlayerId } from "../lib/player";

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

  await supabase
   .from("rooms")
   .update({
    current_quote_id:
     selected[0].id
   })
   .eq("room_code", code);
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

 }, [room?.current_question]);

 // REALTIME

 useEffect(() => {

  const channel = supabase
   .channel(`room-${code}`)

   .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "rooms"
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
      table: "room_players"
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

 // START GAME

 const startGame = async () => {

  const { data: existing } =
   await supabase
    .from("room_questions")
    .select("*")
    .eq("room_code", code);

  if (!existing?.length) {
   await generateQuestions();
  }

  await supabase
   .from("rooms")
   .update({
    game_started: true,

    current_question: 0,

    question_started_at:
     new Date().toISOString()
   })
   .eq("room_code", code);
 };

 // TIMER

 const remainingTime =
  useMemo(() => {

  if (!room?.question_started_at)
 return room?.question_duration || 15;
   

   const elapsed =
    (Date.now() -
     new Date(
      room.question_started_at
     ).getTime()) /
    1000;

   return Math.max(
    0,
    Math.ceil(
     room.question_duration -
      elapsed
    )
   );

  }, [room]);

 // TIMER + TRIVIA CHECKS

useEffect(() => {

 const interval = setInterval(async () => {

  if (!room) return;

  // NO TIMER MODE

  if (room.question_duration === 0) {
   return;
  }

  // TRIVIA ACTIVE

  if (room.trivia_active) {

   if (!room.trivia_ends_at) return;

   const triviaEnded =
    Date.now() >=
    new Date(
     room.trivia_ends_at
    ).getTime();

   if (
    triviaEnded &&
    isHost
   ) {
    await endTrivia();
   }

   return;
  }

  // QUESTION TIMER

  const startTime =
   new Date(
    room.question_started_at
   ).getTime();

  const elapsed =
   (Date.now() - startTime) /
   1000;

  if (
   elapsed >=
   room.question_duration
  ) {

   if (isHost) {
    await nextQuestion();
   }
  }

 }, 1000);

 return () =>
  clearInterval(interval);

}, [room]);

 // NEXT QUESTION

 const nextQuestion = async () => {

  const nextIndex =
   room.current_question + 1;

  // GAME FINISHED

  if (
   !room.endless_mode &&
   nextIndex >=
    room.total_rounds
  ) {

   const sorted =
    [...players].sort(
     (a, b) =>
      b.score - a.score
    );

   await supabase
    .from("rooms")
    .update({
      game_finished: true,

      winner:
       sorted[0]?.username ||
       "No Winner"
    })
    .eq("room_code", code);

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

  if (!nextRoomQuestion) return;

  // RESET ANSWER STATES

  await supabase
   .from("room_players")
   .update({
    answered_current: false
   })
   .eq("room_code", code);

  // UPDATE ROOM

  await supabase
   .from("rooms")
   .update({

    current_question:
     nextIndex,

    current_quote_id:
     nextRoomQuestion.quote_id,

    question_started_at:
     new Date().toISOString(),

    trivia_active: false

   })
   .eq("room_code", code);
 };

 // START TRIVIA

 const startTrivia = async () => {

  await supabase
   .from("rooms")
   .update({

    trivia_active: true,

    trivia_ends_at:
     new Date(
      Date.now() + 5000
     ).toISOString()

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

  await nextQuestion();
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

   await nextQuestion();
  };

 // SUBMIT ANSWER

 const submitAnswer = async () => {

  if (room.trivia_active) return;

  if (!quote) return;

  // SHOW ANSWERED STATUS

  await supabase
   .from("room_players")
   .update({
    answered_current: true
   })
   .eq("player_id", playerId)
   .eq("room_code", code);

  // CORRECT ANSWER

  if (

   normalizeAnswer(message) ===
   normalizeAnswer(
    quote.answer
   )

  ) {

   const newScore =
    (me?.score || 0) + 1;

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

   // TRIVIA

   if (room.show_trivia) {

    await startTrivia();

   } else {

    await nextQuestion();

   }
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

   {room?.game_started &&
 room.question_duration !== 0 && (

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

          <div className="text-green-400 text-sm">
           Answered ✓
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
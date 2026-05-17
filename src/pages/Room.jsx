import React, {
 useEffect,
 useMemo,
 useRef,
 useState
} from "react";

import {
 useNavigate,
 useParams,
 useSearchParams
} from "react-router-dom";

import { supabase } from "../lib/supabase";
import { getPlayerId } from "../lib/player";
import {
 getAccount,
 isPremium,
 isPremiumPlus,
 onAccountChange,
 recordPlayHistory
} from "../lib/account";
import {
 getRandomCompliment
} from "../lib/playerStats";

const DEFAULT_QUESTION_DURATION = 15;
const TRIVIA_DURATION = 5000;
const ENDLESS_BATCH_SIZE = 50;
const FAST_BONUS_SECONDS = 8;
const CORRECT_POINTS = 10;
const FAST_BONUS_POINTS = 5;
const WRONG_PENALTY_POINTS = 3;
const POPCORN_EMOJI = "🍿";
const DEFAULT_MIX_CATEGORIES = [
 "hollywood",
 "tvshows"
];

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

const getRemainingTime = (
 room,
 currentTime
) => {
 const duration =
  getQuestionDuration(room);

 if (!duration) return null;

 if (!room?.question_started_at) {
  return duration;
 }

 const startedAt =
  parseSupabaseTime(
   room.question_started_at
  );

 if (!startedAt) {
  return duration;
//fgsdfbdrfbhdrfhntdrf
 const endTime =
  startedAt + duration * 1000;

return Math.max(
 0,
 Math.floor(
   (endTime - currentTime + 999) /
   1000
 )
);

const hasQuestionExpired = (
 room
) => {
 const remaining =
  getRemainingTime(
   room,
   Date.now()
  );

 return (
  remaining !== null &&
  remaining <= 0
 );
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

const isMixCategory = (value) =>
 normalizeCategory(value) === "mix";

const getMixCategories = (value) => {
 if (Array.isArray(value) && value.length) {
  return value.map(normalizeCategory);
 }

 if (typeof value === "string" && value) {
  return value
   .split(",")
   .map(normalizeCategory)
   .filter(Boolean);
 }

 return DEFAULT_MIX_CATEGORIES;
};

const categoryMatches = (
 quoteCategory,
 selectedCategory
) => {
 const quote = normalizeCategory(quoteCategory);
 const selected =
  normalizeCategory(selectedCategory);

 return (
  quote === selected ||
  (
   selected === "tvshows" &&
   quote === "tvseries"
  ) ||
  (
   selected === "tvseries" &&
   quote === "tvshows"
  )
 );
};

const isLyricsCategory = (value) =>
 normalizeCategory(value) === "lyrics";

const mapLyricsQuestionToQuote = (question) => ({
 ...question,
 dialogue:
  question.prompt ||
  question.dialogue ||
  "Complete the missing lyrics",
 answer: question.answer,
 trivia_fact:
  question.trivia_fact ||
  `Complete the lyrics answer: ${question.answer}`,
 poster_url: question.poster_url || null,
 source_table: "lyrics_questions"
});

const fetchActiveLyricsQuestions = async () => {
 let response = await supabase
  .from("lyrics_questions")
  .select("id, category")
  .eq("is_active", true);

 if (
  response.error &&
  /is_active|schema cache|column/i.test(
   response.error.message || ""
  )
 ) {
  response = await supabase
   .from("lyrics_questions")
   .select("id, category");
 }

 return response;
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
 const [searchParams] = useSearchParams();
 const playerId = getPlayerId();

 const [room, setRoom] = useState(null);
 const [players, setPlayers] = useState([]);
 const [quote, setQuote] = useState(null);
 const [message, setMessage] = useState("");
 const [loading, setLoading] = useState(true);
 const [notice, setNotice] = useState("");
 const [activityNotices, setActivityNotices] =
  useState([]);
 const [account, setAccount] = useState(null);
 const [now, setNow] = useState(Date.now());
 const [roomClosedNotice, setRoomClosedNotice] =
  useState(false);
 const [finalNote, setFinalNote] =
  useState(null);
 const [playAgainNotice, setPlayAgainNotice] =
  useState("");
 const [replayRequests, setReplayRequests] =
  useState([]);

 const advancingRef = useRef(false);
 const previousPlayersRef = useRef([]);
 const recordedFinishedRoomRef =
  useRef(null);

 const me = useMemo(() => {
  return players.find(
   (player) => player.player_id === playerId
  );
 }, [players, playerId]);

 const isHost = room?.host_id === playerId;
 const premiumPlusHost =
  isHost && isPremiumPlus(account);
 const canUseQuestionControls = isHost;
 const premiumMixEnabled =
  isPremium(account) &&
  isMixCategory(room?.category);

 useEffect(() => {
  let active = true;

  const loadAccount = async () => {
   const nextAccount = await getAccount();

   if (active) {
    setAccount(nextAccount);
   }
  };

  loadAccount();

  const unsubscribe = onAccountChange(
   (nextAccount) => {
    if (active) setAccount(nextAccount);
   }
  );

  return () => {
   active = false;
   unsubscribe();
  };
 }, []);

 const pushActivityNotice = (text) => {
  const id = crypto.randomUUID();

  setActivityNotices((current) => [
   ...current.slice(-2),
   { id, text }
  ]);

  setTimeout(() => {
   setActivityNotices((current) =>
    current.filter((item) => item.id !== id)
   );
  }, 2800);
 };

 const playArenaSound = (kind = "applause") => {
  const AudioContextCtor =
   window.AudioContext ||
   window.webkitAudioContext;
  if (!AudioContextCtor) return;

  const context = new AudioContextCtor();
  const gain = context.createGain();
  gain.gain.value = 0.0001;
  gain.connect(context.destination);

  const tone =
   kind === "applause" ? 880 : 520;
  const oscillator = context.createOscillator();
  oscillator.type = "square";
  oscillator.frequency.value = tone;
  oscillator.connect(gain);
  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(
   0.02,
   context.currentTime + 0.02
  );
  gain.gain.exponentialRampToValueAtTime(
   0.0001,
   context.currentTime + 0.3
  );
  oscillator.stop(context.currentTime + 0.32);
 };

 const fetchRoom = async () => {
  const { data } = await supabase
   .from("rooms")
   .select("*")
   .eq("room_code", code)
   .maybeSingle();

  if (room && !data) {
   setRoomClosedNotice(true);
  }

  setRoom(data || null);

  if (data?.play_again_requester_names?.length) {
   setReplayRequests(
    data.play_again_requester_names
   );
  } else {
   setReplayRequests([]);
  }
 };

 const finishWithRemainingWinner = async (
  remainingPlayers
 ) => {
  const winner =
   remainingPlayers?.[0]?.username ||
   "No Winner";

  await supabase
   .from("rooms")
   .update({
    game_finished: true,
    winner,
    trivia_active: false,
    trivia_ends_at: null,
    processing_answer: false
   })
   .eq("room_code", code);
 };

 const fetchPlayers = async () => {
  const { data } = await supabase
   .from("room_players")
   .select("*")
   .eq("room_code", code)
   .order("score", {
   ascending: false
   });

  const nextPlayers = data || [];
  const previousPlayers =
   previousPlayersRef.current;

  if (previousPlayers.length) {
   previousPlayers.forEach((previous) => {
    const stillHere = nextPlayers.some(
     (player) => player.id === previous.id
    );

    if (!stillHere) {
     pushActivityNotice(
      `${previous.username} chickened out.`
     );
    }
   });

  nextPlayers.forEach((player) => {
    const previous = previousPlayers.find(
     (item) => item.id === player.id
    );

    if (
     !previous ||
     previous.answered_current ||
     !player.answered_current
    ) {
     return;
    }

    if (player.current_answer_correct) {
     const bonus =
      Number(player.last_answer_bonus || 0);

     pushActivityNotice(
      `${player.username} answered correctly${
       bonus > 0
        ? ` and earned a +${bonus} superfast bonus`
        : ""
      }.`
     );
     playArenaSound("applause");
     return;
    }

    pushActivityNotice(
     `${player.username} answered "${
      player.last_answer_text || "unknown"
     }" - incorrect -${WRONG_PENALTY_POINTS}.`
    );
    playArenaSound("popcorn");
   });
  }

  previousPlayersRef.current =
   nextPlayers;
  setPlayers(nextPlayers);
 };

 const deleteRoom = async () => {
  await supabase
   .from("rooms")
   .update({
    game_finished: true,
    winner: "Room closed by host",
    trivia_active: false,
    trivia_ends_at: null,
    processing_answer: false
   })
   .eq("room_code", code);

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

  if (isLyricsCategory(room.category)) {
   const { data: lyricData } =
    await supabase
     .from("lyrics_questions")
     .select("*")
     .eq("id", roomQuestion.quote_id)
     .maybeSingle();

   setQuote(
    lyricData
     ? mapLyricsQuestionToQuote(lyricData)
     : null
   );
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
 if (isLyricsCategory(sourceRoom.category)) {
  const {
   data: lyricsQuestions,
   error: lyricsError
  } = await fetchActiveLyricsQuestions();

  if (lyricsError) {
   console.error(lyricsError);
   return null;
  }

  const matchingLyrics =
   lyricsQuestions || [];

  if (!matchingLyrics.length) return null;

  const targetCount =
   sourceRoom.endless_mode
    ? Math.max(
       matchingLyrics.length,
       ENDLESS_BATCH_SIZE
      )
    : Math.max(
       1,
       Number(sourceRoom.total_rounds) || 1
      );

  const selected = [];

  while (selected.length < targetCount) {
   const shuffled =
    [...matchingLyrics].sort(
     () => 0.5 - Math.random()
    );

   selected.push(...shuffled);
  }

  const inserts =
   selected
    .slice(0, targetCount)
    .map((questionItem, index) => ({
     room_code: code,
     quote_id: questionItem.id,
     question_order: index
    }));

  await supabase
   .from("room_questions")
   .insert(inserts);

  return inserts[0]?.quote_id || null;
 }

 const { data: quotes } =
   await supabase
    .from("quotes")
    .select("id, category");

  const requestedCategory =
   normalizeCategory(sourceRoom.category);
  const selectedMixCategories =
   getMixCategories(
    sourceRoom.mix_categories
   );

  const matchingQuotes =
   (quotes || []).filter((quoteItem) => {
    const quoteCategory =
     normalizeCategory(quoteItem.category);

    if (requestedCategory === "mix") {
     return selectedMixCategories.some(
      (selected) =>
       categoryMatches(
        quoteCategory,
        selected
       )
     );
    }

    return (
     categoryMatches(
      quoteCategory,
      requestedCategory
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
  () => {
   setNow(Date.now());
  },
  100
 );

 return () =>
  clearInterval(interval);
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
   current_answer_correct: null,
   last_answer_bonus: 0,
   last_score_change: 0,
   last_answer_text: null
  })
   .eq("room_code", code);

  const duration = getQuestionDuration(room);

  const { data } = await supabase
   .from("rooms")
   .update({
    game_started: true,
    game_finished: false,
    winner: null,
    play_again_requesters: [],
    play_again_requester_names: [],
    play_again_requested_at: null,
    current_question: 0,
    current_quote_id: firstQuoteId,
    question_started_at:
     toSupabaseTime(),
    timer_seconds_left:
     duration === null ? null : duration,
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
  !isHost
 ) {
  return;
 }

 if (
  hasQuestionExpired(room)
 ) {
  nextQuestion();
 }
}, [
 remainingTime,
 room?.game_started,
 room?.game_finished,
 room?.trivia_active,
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
    processing_answer: false,
    play_again_requesters: [],
    play_again_requester_names: [],
    play_again_requested_at: null
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

 useEffect(() => {
  if (
   !room?.game_finished ||
   !players.length ||
   recordedFinishedRoomRef.current ===
    room.room_code
  ) {
   return;
  }

  const playerAccountId =
   searchParams.get("account") ||
   account?.id;
  const myPlayer = players.find(
   (player) =>
    player.player_id === playerId ||
    player.account_id === playerAccountId
  );

  if (!myPlayer || !account) return;

  const sorted = [...players].sort(
   (a, b) => Number(b.score || 0) -
    Number(a.score || 0)
  );
  const topScore = Number(
   sorted[0]?.score || 0
  );
  const leaders = sorted.filter(
   (player) =>
    Number(player.score || 0) === topScore
  );
  const tied = leaders.length > 1;
  const won = leaders.some(
   (player) => player.id === myPlayer.id
  );
  const result = tied
   ? "tie"
   : won
    ? "win"
    : "loss";

  recordedFinishedRoomRef.current =
   room.room_code;
  recordPlayHistory({
   mode: "multiplayer",
   category: room.category,
   roomCode: room.room_code,
   score: myPlayer.score,
   totalQuestions:
    Number(room.total_rounds || 0),
   result,
   opponentCount:
    Math.max(0, players.length - 1),
   winnerName: room.winner,
   metadata: {
    playerName: myPlayer.username,
    players: players.map((player) => ({
     name: player.username,
     score: player.score
    }))
   }
  });
  setFinalNote({
   result,
   compliment: getRandomCompliment(tied)
  });
 }, [
  room?.game_finished,
  room?.room_code,
  room?.category,
  room?.total_rounds,
  room?.winner,
  players,
  account,
  searchParams,
  playerId
 ]);

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
   current_answer_correct: null,
   last_answer_bonus: 0,
   last_score_change: 0,
   last_answer_text: null
  })
    .eq("room_code", code);

   const duration =
    getQuestionDuration(lockedRoom);

   const { data } = await supabase
    .from("rooms")
    .update({
     current_question: nextIndex,
     current_quote_id:
      nextRoomQuestion.quote_id,
     question_started_at:
      toSupabaseTime(),
     timer_seconds_left:
      duration === null ? null : duration,
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

  const duration =
   getQuestionDuration(room);
  const remaining =
   getRemainingTime(room, Date.now());
  const fastBonus =
   isCorrect &&
   duration &&
   remaining !== null &&
   remaining >=
    Math.max(
     FAST_BONUS_SECONDS,
     Math.ceil(duration * 0.5)
    )
    ? FAST_BONUS_POINTS
    : 0;
  const scoreChange =
   isCorrect
    ? CORRECT_POINTS + fastBonus
    : -WRONG_PENALTY_POINTS;
  const nextScore =
   Number(me?.score || 0) + scoreChange;

  const { data: answeredPlayer } =
   await supabase
    .from("room_players")
    .update({
     answered_current: true,
     current_answer_correct:
      isCorrect,
     last_answer_bonus: fastBonus,
     last_score_change: scoreChange,
     last_answer_text: message.trim(),
     score: nextScore
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

  playArenaSound(isCorrect ? "applause" : "popcorn");
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
    .select("*")
    .eq("room_code", code);

  if (!remainingPlayers?.length) {
   await deleteRoom();
  } else if (
   remainingPlayers.length === 1 &&
   room?.game_started &&
   !room?.game_finished
  ) {
   await finishWithRemainingWinner(
    remainingPlayers
   );
  }

  navigate("/multiplayer");
 };

 const closeRoom = async () => {
  setRoomClosedNotice(true);
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
      {roomClosedNotice
       ? "Room closed by host"
       : "Room closed"}
     </h1>
     <p className="text-zinc-400 mb-8">
      {roomClosedNotice
       ? "The host closed this session."
       : "This room has ended or was disposed by the host."}
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
    <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto p-4 sm:p-6">
     <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 text-center max-w-3xl w-full mx-auto my-4 sm:my-8">
      <div className="text-xs uppercase tracking-[0.3em] text-yellow-400 mb-3">
       Final Result
      </div>

      <h2 className="text-3xl sm:text-4xl font-bold mb-4">
       {room.winner || "No Winner"}
      </h2>

      {finalNote && (
       <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 mb-4">
        <p className="text-yellow-300 uppercase tracking-[0.25em] text-xs mb-2">
         {finalNote.compliment}
        </p>
        <p className="text-zinc-300 text-sm">
         {finalNote.result === "tie"
          ? "Nobody blinked. That tie had serious final-round energy."
          : finalNote.result === "win"
           ? "Winner energy. That one goes in the history."
           : "Not your round, but definitely useful data for the comeback."}
       </p>
      </div>
      )}

      <p className="text-zinc-400 text-sm mb-5">
       Everyone in this room can see the winner and final scorecard.
      </p>

      {replayRequests.length > 0 && (
       <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl p-4 mb-4 text-left">
        <p className="text-yellow-300 font-bold mb-2">
         Play again requests
        </p>
        <p className="text-zinc-200">
         {replayRequests.join(", ")} want another round.
        </p>
       </div>
      )}

      {playAgainNotice && (
       <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 mb-4 text-left">
        {playAgainNotice}
       </div>
      )}

      <div className="text-left mb-5">
       <h3 className="text-xl font-bold mb-3">
        Final Scorecard
       </h3>
       <div className="grid gap-2 max-h-[38vh] overflow-auto pr-1">
       {players.map((player, index) => (
        <div
         key={player.id}
         className="flex items-center justify-between gap-3 bg-zinc-800 rounded-lg p-3"
        >
         <span className="flex items-center gap-3 min-w-0">
          <span className="text-yellow-300 font-bold">
           #{index + 1}
          </span>
          {player.avatar_url ? (
           <img
            src={player.avatar_url}
            alt={player.username}
            className="h-9 w-9 rounded-full object-cover"
           />
          ) : (
           <span className="h-9 w-9 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold">
            {player.username?.charAt(0)?.toUpperCase() ||
             "P"}
           </span>
          )}
          <span className="truncate">
           {player.username}
          </span>
          {player.player_id === room.host_id && (
           <span className="text-xs uppercase text-yellow-400">
            Host
           </span>
          )}
         </span>
         <span className="font-bold text-yellow-400">
          {player.score}
         </span>
        </div>
       ))}
       </div>
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
        className="w-full h-64 sm:h-[420px] object-cover"
       />
      )}

      <div className="p-5 sm:p-8">
       <h1 className="text-3xl sm:text-4xl font-bold mb-4">
        {quote.answer}
       </h1>

       <p className="text-zinc-300 text-lg mb-8 leading-relaxed">
        {quote.trivia_fact}
       </p>

       <div className="flex gap-4 flex-wrap">
        {canUseQuestionControls && (
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

  <div className="fixed top-4 left-4 right-4 z-40 grid gap-2 pointer-events-none sm:left-auto sm:right-6 sm:w-96">
    {activityNotices.map((item) => (
     <div
      key={item.id}
      className="bg-zinc-900/95 border border-zinc-700 rounded-xl px-4 py-3 text-sm shadow-xl"
     >
      {item.text}
     </div>
    ))}
   </div>

  <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6 mb-8 sm:mb-10">
    <div>
     <h1 className="text-4xl sm:text-5xl font-bold mb-2">
      Room {code}
     </h1>

       <p className="text-zinc-400 capitalize">
      {room.category === "mix"
       ? "Premium Mix"
       : room.category === "lyrics"
        ? "Complete the Lyrics"
        : room.category}{" "}
      {!room.endless_mode &&
       `- ${room.total_rounds} rounds`}
     </p>
    </div>

    <div className="flex flex-wrap items-center gap-3">
     {room.game_started && (
     <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 sm:px-6 py-4 text-center">
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
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8">
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
     <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8">
      {quote ? (
       <>
        {premiumMixEnabled && (
         <div className="mb-5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-yellow-100">
          Premium Mix is active. Questions come from: {getMixCategories(room.mix_categories).join(", ")}.
         </div>
        )}

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

        <p className="text-2xl sm:text-4xl leading-relaxed mb-8 sm:mb-10">
         {isLyricsCategory(room.category)
          ? quote.dialogue
          : `"${quote.dialogue}"`}
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
         placeholder={
          isLyricsCategory(room.category)
           ? "Type the missing lyrics"
           : "Guess movie or TV series"
         }
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

         {canUseQuestionControls && (
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

     <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8">
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
          <span className="flex items-center gap-2">
           {player.avatar_url ? (
            <img
             src={player.avatar_url}
             alt={player.username}
             className="h-8 w-8 rounded-full object-cover"
            />
           ) : (
            <span className="h-8 w-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold">
             {player.username?.charAt(0)?.toUpperCase() ||
              "P"}
            </span>
           )}
           {player.username}
          </span>
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
            ? `Answered Correct${
               Number(player.last_answer_bonus || 0) > 0
                ? ` +${player.last_answer_bonus} Fast Bonus`
                : ""
              }`
            : `Answered "${player.last_answer_text || "unknown"}" Incorrect -${WRONG_PENALTY_POINTS} Penalty`}
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

import React, {
 useEffect,
 useState
} from "react";
import {
 useNavigate,
 useSearchParams
} from "react-router-dom";

import { supabase } from "../lib/supabase";
import { getPlayerId } from "../lib/player";
import {
 PLANS,
 createAccount,
 getAccount,
 getTrialCreditsLeft,
 isPremium,
 isPremiumPlus,
 onAccountChange,
 signInAccount,
 signOutAccount,
 useTrialCredit
} from "../lib/account";

const getPlanLabel = (plan) => {
 if (plan === PLANS.PREMIUM_PLUS) {
  return "Premium Plus";
 }

 if (plan === PLANS.PREMIUM) {
  return "Premium";
 }

 return "Free Trial";
};

export default function MultiplayerLobby() {
 const navigate = useNavigate();
 const [searchParams] = useSearchParams();

 const [account, setAccount] = useState(null);
 const [authMode, setAuthMode] =
  useState("signin");
 const [authLoading, setAuthLoading] =
  useState(true);
 const [accountName, setAccountName] =
  useState("");
 const [accountEmail, setAccountEmail] =
  useState("");
 const [accountPassword, setAccountPassword] =
  useState("");
 const [username, setUsername] = useState("");
 const [roomCode, setRoomCode] = useState("");
 const [selectedCategory, setSelectedCategory] =
  useState("hollywood");

 const [selectedRounds, setSelectedRounds] =
  useState(10);

 const [questionDuration, setQuestionDuration] =
  useState(30);

 const [endlessMode, setEndlessMode] =
  useState(false);

 const [maxPlayers, setMaxPlayers] =
  useState(2);

 useEffect(() => {
  const codeParam =
   searchParams.get("room");
  const usernameParam =
   searchParams.get("username");
  const authParam =
   searchParams.get("auth");

  if (codeParam) {
   setRoomCode(codeParam.toUpperCase());
  }

  if (usernameParam) {
   setUsername(usernameParam);
  }

  if (
   authParam === "signin" ||
   authParam === "signup"
  ) {
   setAuthMode(authParam);
  }
 }, [searchParams]);

 useEffect(() => {
  let active = true;

  const loadAccount = async () => {
   try {
    const nextAccount = await getAccount();

    if (active) {
     setAccount(nextAccount);
    }
   } catch (error) {
    console.error(error);
    if (active) {
     setAccount(null);
    }
   } finally {
    if (active) {
     setAuthLoading(false);
    }
   }
  };

  loadAccount();

  const unsubscribe = onAccountChange(
   (nextAccount) => {
    if (active) {
     setAccount(nextAccount);
     setAuthLoading(false);
    }
   }
  );

  return () => {
   active = false;
   unsubscribe();
  };
 }, []);

 useEffect(() => {
  if (account?.name && !username) {
   setUsername(account.name);
  }
 }, [account, username]);

 const trialCreditsLeft =
  getTrialCreditsLeft(account);
 const hasPremium = isPremium(account);
 const hasPremiumPlus = isPremiumPlus(account);

 const handleAuth = async (event) => {
  event.preventDefault();

  if (
   !accountEmail.trim() ||
   !accountPassword
  ) {
   alert("Enter email and password");
   return;
  }

  if (
   authMode === "signup" &&
   !accountName.trim()
  ) {
   alert("Enter your name");
   return;
  }

  setAuthLoading(true);

  try {
   const nextAccount =
    authMode === "signup"
     ? await createAccount({
        name: accountName,
        email: accountEmail,
        password: accountPassword
       })
     : await signInAccount({
        email: accountEmail,
        password: accountPassword
       });

   setAccount(nextAccount);
   setUsername(
    nextAccount?.name || accountName.trim()
   );
  } catch (error) {
   alert(error.message);
  } finally {
   setAuthLoading(false);
  }
 };

 const handleLobbyKeyDown = (event) => {
  if (event.key !== "Enter") return;

  if (roomCode.trim()) {
   joinRoom();
   return;
  }

  createRoom();
 };

 const createRoom = async () => {
  try {
   if (!account) {
    alert(
     "Login or create an account to use multiplayer."
    );
    return;
   }

   if (
    !hasPremium &&
    trialCreditsLeft <= 0
   ) {
    alert(
     "Your 2 free multiplayer rooms are used. Upgrade to Premium for unlimited room creation."
    );
    navigate("/payment");
    return;
   }

   if (!username) {
    alert("Enter username");
    return;
   }

   const code = Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();

   const playerId = getPlayerId();

   const { error } = await supabase
    .from("rooms")
    .insert({
     room_code: code,

     host_id: playerId,

     current_question: 0,

     game_started: false,

     category: selectedCategory,

     total_rounds: selectedRounds,

     endless_mode: endlessMode,

     question_duration:
      questionDuration,

     game_finished: false,

     show_trivia: true,

     processing_answer: false,

     max_players:
      hasPremiumPlus ? maxPlayers : 2,

     plan_required:
      hasPremiumPlus
       ? PLANS.PREMIUM_PLUS
       : hasPremium
        ? PLANS.PREMIUM
        : PLANS.FREE
    });

   if (error) throw error;

   const { error: playerError } =
    await supabase
     .from("room_players")
     .insert({
      room_code: code,

      player_id: playerId,

      username,

      score: 0
     });

   if (playerError) throw playerError;

   if (!hasPremium) {
    const nextAccount =
     await useTrialCredit(account);
    setAccount(nextAccount);
   }

   navigate(`/room/${code}`);
  } catch (error) {
   console.error(error);
   alert(
    `Could not create room: ${error.message}`
   );
  }
 };

 const joinRoom = async () => {
  if (!account) {
   alert(
    "Login or create an account to join multiplayer."
   );
   return;
  }

  if (!username) {
   alert("Enter username");
   return;
  }

  const playerId = getPlayerId();

  const upperCode = roomCode.toUpperCase();

  const { data: room } = await supabase
   .from("rooms")
   .select("*")
   .eq("room_code", upperCode)
   .single();

  if (!room) {
   alert("Room not found");
   return;
  }

  if (room.game_finished) {
   alert("This room has already ended");
   return;
  }

  const { data: existing } = await supabase
   .from("room_players")
   .select("*")
   .eq("room_code", upperCode)
   .eq("player_id", playerId)
   .maybeSingle();

  const { count: playerCount } =
   await supabase
    .from("room_players")
    .select("*", {
     count: "exact",
     head: true
    })
   .eq("room_code", upperCode);

  if (
   !existing &&
   playerCount >=
   Number(room.max_players || 2)
  ) {
   alert("This room is full");
   return;
  }

  if (!existing) {
   await supabase
    .from("room_players")
    .insert({
      room_code: upperCode,

      player_id: playerId,

      username,

      score: 0
    });
  }

  navigate(`/room/${upperCode}`);
 };

 return (
  <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 sm:p-6">

   <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-5 sm:gap-6 w-full max-w-6xl">

    {authLoading ? (
     <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8">
      <p className="text-zinc-400">
       Checking account...
      </p>
     </div>
    ) : !account ? (
     <form
      onSubmit={handleAuth}
      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8"
     >
      <p className="text-yellow-400 uppercase tracking-[0.25em] text-sm mb-3">
       Account Required
      </p>

      <h1 className="text-4xl sm:text-5xl font-bold mb-5">
       {authMode === "signup"
        ? "Create an account"
        : "Login to multiplayer"}
      </h1>

      <p className="text-zinc-400 leading-relaxed mb-8">
       Multiplayer includes 2 free hosted rooms. After that, Premium unlocks unlimited game room creation and playing with friends.
      </p>

      {authMode === "signup" && (
       <input
        value={accountName}
        onChange={(e) =>
         setAccountName(e.target.value)
        }
        placeholder="Name"
        className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5"
       />
      )}

      <input
       value={accountEmail}
       onChange={(e) =>
        setAccountEmail(e.target.value)
       }
       placeholder="Email"
       type="email"
       className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5"
      />

      <input
       value={accountPassword}
       onChange={(e) =>
        setAccountPassword(e.target.value)
       }
       placeholder="Password"
       type="password"
       className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5"
      />

      <button
       type="submit"
       className="w-full bg-yellow-400 text-black p-4 rounded-lg font-bold"
      >
       {authMode === "signup"
        ? "Create Account"
        : "Login"}
      </button>

      <button
       type="button"
       onClick={() =>
        setAuthMode(
         authMode === "signup"
          ? "signin"
          : "signup"
        )
       }
       className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg font-bold mt-4"
      >
       {authMode === "signup"
        ? "I already have an account"
        : "Create a new account"}
      </button>
     </form>
    ) : (
    <div
     onKeyDown={handleLobbyKeyDown}
     className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8"
    >

     <div className="mb-8">
      <p className="text-yellow-400 uppercase tracking-[0.25em] text-sm mb-3">
       Realtime Arena
      </p>
      <h1 className="text-4xl sm:text-5xl font-bold">
       Multiplayer
      </h1>
      <p className="text-zinc-400 mt-4">
       {account.name || account.email} -{" "}
       {getPlanLabel(account.plan)}
       {account.plan === PLANS.FREE &&
        ` - ${trialCreditsLeft} free room${
         trialCreditsLeft === 1 ? "" : "s"
        } left`}
      </p>
      <button
       onClick={async () => {
        await signOutAccount();
        setAccount(null);
       }}
       className="mt-4 bg-zinc-800 border border-zinc-700 px-4 py-2 rounded-lg font-bold"
      >
       Sign Out
      </button>
     </div>

    <input
     value={username}
     onChange={(e) =>
      setUsername(e.target.value)
     }
     placeholder="Username"
     className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5"
    />

    <select
     value={selectedCategory}
     onChange={(e) =>
      setSelectedCategory(e.target.value)
     }
     className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5"
    >
      <option value="hollywood">Hollywood</option>
      <option value="bollywood">Bollywood</option>
      <option value="tvshows">TV Series</option>
      <option value="mix">Mixed</option>
      <option value="anime">Anime</option>
    </select>

    <select
     value={selectedRounds}
     onChange={(e) =>
      setSelectedRounds(
       Number(e.target.value)
      )
     }
     className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5"
    >
      <option value={5}>
        5 Rounds
      </option>

      <option value={10}>
        10 Rounds
      </option>

      <option value={20}>
        20 Rounds
      </option>
    </select>

    <select
     value={questionDuration}
     onChange={(e) =>
      setQuestionDuration(
       Number(e.target.value)
      )
     }
     className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5"
    >
      <option value={15}>
        15 Seconds
      </option>
      <option value={30}>
        30 Seconds
      </option>
      <option value={45}>
        45 Seconds
      </option>
      <option value={60}>
        60 Seconds
      </option>
      <option value={0}>
        Timeless
      </option>
    </select>

    <button
     onClick={() =>
      setEndlessMode(!endlessMode)
     }
     className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5"
    >
      {endlessMode
       ? "Endless Mode Enabled"
      : "Enable Endless Mode"}
    </button>

    {hasPremiumPlus && (
     <select
      value={maxPlayers}
      onChange={(e) =>
       setMaxPlayers(
        Number(e.target.value)
       )
      }
      className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5"
     >
      {Array.from(
       { length: 19 },
       (_, index) => index + 2
      ).map((count) => (
       <option
        key={count}
        value={count}
       >
        Up to {count} Players
       </option>
      ))}
     </select>
    )}

    <button
     onClick={createRoom}
     className="w-full bg-yellow-400 text-black p-4 rounded-lg font-bold mb-6"
    >
      Create Room
    </button>

    <div className="flex items-center gap-3 mb-5">
     <div className="h-px bg-zinc-800 flex-1" />
     <span className="text-zinc-500 text-sm">
      or join a friend's room
     </span>
     <div className="h-px bg-zinc-800 flex-1" />
    </div>

    <input
     value={roomCode}
     onChange={(e) =>
      setRoomCode(e.target.value)
     }
     placeholder="Enter Room Code"
     className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5 uppercase"
    />

    <button
     onClick={joinRoom}
     className="w-full bg-white text-black p-4 rounded-lg font-bold"
    >
     Join Room
    </button>
    </div>
    )}

    <div className="bg-white text-black rounded-2xl p-5 sm:p-8 flex flex-col justify-between">
     <div>
      <p className="uppercase tracking-[0.25em] text-sm text-zinc-500 mb-4">
       Premium Wall Ready
      </p>

      <h2 className="text-4xl font-bold mb-5">
       Premium unlocks the full arena.
      </h2>

      <p className="text-zinc-600 leading-relaxed mb-8">
       Start with 2 free hosted rooms. Upgrade once for unlimited multiplayer, or choose Premium Plus for large rooms and host controls.
      </p>

      <div className="grid gap-3 mb-8">
       {[
        "Premium: $15 one-time payment",
        "Unlimited room creation and friend play",
        "Premium Plus: up to 20 players",
        "Premium Plus: skip/end questions and future games"
       ].map((feature) => (
        <div
         key={feature}
         className="border border-zinc-200 rounded-lg p-4 font-medium"
        >
         {feature}
        </div>
       ))}
      </div>
     </div>

     <button
      onClick={() => navigate("/payment")}
      className="bg-black text-white p-4 rounded-lg font-bold"
     >
      View Premium Plans
     </button>
    </div>
   </div>
  </div>
 );
}

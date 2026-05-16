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

const mixCategoryOptions = [
 {
  value: "hollywood",
  label: "Hollywood Movies"
 },
 {
  value: "bollywood",
  label: "Bollywood Movies"
 },
 {
  value: "tvshows",
  label: "TV Shows"
 },
 {
  value: "anime",
  label: "Anime"
 }
];

const DEFAULT_MIX_CATEGORIES = [
 "hollywood",
 "tvshows"
];

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
 const [selectedMixCategories, setSelectedMixCategories] =
  useState(DEFAULT_MIX_CATEGORIES);

 const [selectedRounds, setSelectedRounds] =
  useState(10);

 const [questionDuration, setQuestionDuration] =
  useState(30);

 const [endlessMode, setEndlessMode] =
  useState(false);

 const [maxPlayers, setMaxPlayers] =
  useState(2);
 const [gateNotice, setGateNotice] =
  useState(null);

 useEffect(() => {
  const codeParam =
   searchParams.get("room");
  const usernameParam =
   searchParams.get("username");
  const authParam =
   searchParams.get("auth");
  const categoryParam =
   searchParams.get("category");
  const mixParam = searchParams.get("mix");

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

  if (categoryParam) {
   setSelectedCategory(
    categoryParam.toLowerCase()
   );
  }

  if (mixParam) {
   const mixCategories = mixParam
    .split(",")
    .map((item) =>
     item.trim().toLowerCase()
    )
    .filter(Boolean);

   if (mixCategories.length) {
    setSelectedMixCategories(
     mixCategories
    );
   }
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

 const showEmailGate = () => {
  setGateNotice({
   eyebrow: "Email confirmation required",
   title: "Confirm your email to create rooms.",
   body:
    "Room hosting opens after your email is verified. Check your inbox for the Supabase confirmation link, then come back and create your room.",
   primaryLabel: "Got it",
   onPrimary: () => setGateNotice(null)
  });
 };

 const showRoomLimitGate = () => {
  setGateNotice({
   eyebrow: "Free trial complete",
   title:
    "You have used your 2 free hosted rooms.",
   body:
    "Upgrade once to keep creating rooms, invite friends without trial limits, and unlock the full multiplayer hosting experience.",
   primaryLabel: "View Premium Plans",
   secondaryLabel: "Maybe later",
   onPrimary: () => navigate("/payment"),
   onSecondary: () => setGateNotice(null)
  });
 };

 const showMixPremiumGate = () => {
  setGateNotice({
   eyebrow: "Premium Mix",
   title:
    "Want to play different categories at the same time?",
   body:
    "Upgrade to Premium to choose multiple categories and play them together in multiplayer and solo.",
   primaryLabel: "Upgrade to Premium",
   secondaryLabel: "Choose another category",
   onPrimary: () => navigate("/payment"),
   onSecondary: () => {
    setSelectedCategory("hollywood");
    setGateNotice(null);
   }
  });
 };

 const toggleMixCategory = (value) => {
  setSelectedMixCategories((current) => {
   if (current.includes(value)) {
    if (current.length === 1) return current;

    return current.filter(
     (item) => item !== value
    );
   }

   return [...current, value];
  });
 };

 const showCreateRoomError = (error) => {
  const message = String(
   error?.message || ""
  );

  if (
   /row-level security|violates row-level security|profiles/i.test(
    message
   )
  ) {
   showEmailGate();
   return;
  }

  setGateNotice({
   eyebrow: "Room could not be created",
   title: "Something blocked this room.",
   body:
    "Please try again in a moment. If this keeps happening, refresh the page and sign in again.",
   primaryLabel: "Close",
   onPrimary: () => setGateNotice(null)
  });
 };

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
    setGateNotice({
     eyebrow: "Account required",
     title: "Sign in to host a room.",
     body:
      "Your account keeps room credits, premium status, and host access attached to you.",
     primaryLabel: "Close",
     onPrimary: () => setGateNotice(null)
    });
    return;
   }

   if (!account.emailConfirmed) {
    showEmailGate();
    return;
   }

   if (
    !hasPremium &&
    trialCreditsLeft <= 0
   ) {
    showRoomLimitGate();
    return;
   }

   if (
    selectedCategory === "mix" &&
    !hasPremium
   ) {
    showMixPremiumGate();
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

     mix_categories:
      selectedCategory === "mix"
       ? selectedMixCategories
       : null,

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
   showCreateRoomError(error);
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
   {gateNotice && (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
     <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
      <p className="text-yellow-400 uppercase tracking-[0.25em] text-xs mb-4">
       {gateNotice.eyebrow}
      </p>
      <h2 className="text-3xl font-bold leading-tight mb-4">
       {gateNotice.title}
      </h2>
      <p className="text-zinc-400 leading-relaxed mb-6">
       {gateNotice.body}
      </p>

      <div className="grid gap-3">
       <button
        onClick={gateNotice.onPrimary}
        className="bg-yellow-400 text-black p-4 rounded-lg font-bold"
       >
        {gateNotice.primaryLabel}
       </button>

       {gateNotice.secondaryLabel && (
        <button
         onClick={gateNotice.onSecondary}
         className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg font-bold"
        >
         {gateNotice.secondaryLabel}
        </button>
       )}
      </div>
     </div>
    </div>
   )}

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
      {!account.emailConfirmed && (
       <p className="text-yellow-300 mt-3">
        Confirm your email before creating rooms.
       </p>
      )}
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
     onChange={(e) => {
      if (
       e.target.value === "mix" &&
       !hasPremium
      ) {
       showMixPremiumGate();
       return;
      }

      setSelectedCategory(e.target.value);
     }}
     className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5"
    >
      <option value="hollywood">Hollywood</option>
      <option value="bollywood">Bollywood</option>
      <option value="tvshows">TV Series</option>
      <option value="mix">Mixed</option>
      <option value="anime">Anime</option>
    </select>

    {selectedCategory === "mix" && (
     <div className="border border-yellow-500/40 bg-yellow-500/10 text-yellow-100 rounded-lg p-4 mb-5">
      <p className="font-bold mb-3">
       Choose Mix Categories
      </p>
      <div className="flex flex-wrap gap-2">
       {mixCategoryOptions.map((option) => {
        const active =
         selectedMixCategories.includes(
          option.value
         );

        return (
         <button
          key={option.value}
          type="button"
          onClick={() =>
           toggleMixCategory(option.value)
          }
          className={`px-4 py-2 rounded-lg border font-bold ${
           active
            ? "bg-yellow-400 text-black border-yellow-400"
            : "bg-zinc-950 text-zinc-300 border-zinc-700"
          }`}
         >
          {option.label}
         </button>
        );
       })}
      </div>
     </div>
    )}

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
       Premium Hosting
      </p>

      <h2 className="text-4xl font-bold mb-5">
       Keep the party moving after your free rooms.
      </h2>

      <p className="text-zinc-600 leading-relaxed mb-8">
       Start with 2 hosted rooms. Premium removes the hosting cap forever. Premium Plus adds big-room capacity and host controls for faster, cleaner games.
      </p>

      <div className="grid gap-3 mb-8">
       {[
        "Premium: lifetime unlimited hosted rooms",
        "Premium Mix: all categories in one game",
        "Premium Plus: rooms for up to 20 players",
        "Premium Plus: host skip, end-question, and early modes"
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

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
 getPlanBenefits,
 getPlanLabel,
 getPlayHistory,
 refreshAccount,
 getTrialCreditsLeft,
 isPremium,
 isPremiumPlus,
 onAccountChange,
 requestPasswordReset,
 resendConfirmationEmail,
 signInAccount,
 signOutAccount,
 updateEmail,
 updatePassword,
 updateProfile,
 uploadAvatar,
 useTrialCredit
} from "../lib/account";
import {
 getInsight,
 getPlayerTitle
} from "../lib/playerStats";
import { playSoundEffect } from "../lib/audio";

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
 },
 {
  value: "trivia",
  label: "Trivia"
 }
];

const standardCategoryOptions = [
 {
  value: "hollywood",
  label: "Hollywood"
 },
 {
  value: "bollywood",
  label: "Bollywood"
 },
 {
  value: "tvshows",
  label: "TV Series"
 },
 {
  value: "mix",
  label: "Mixed"
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

const insertRoomPlayer = async (payload) => {
 const { error } = await supabase
  .from("room_players")
  .insert(payload);

 if (
  error &&
  /account_id|schema cache|column/i.test(
   error.message || ""
  )
 ) {
  const {
   account_id: _accountId,
   ...fallbackPayload
  } = payload;

  return supabase
   .from("room_players")
   .insert(fallbackPayload);
 }

 return { error };
};

export default function MultiplayerLobby() {
 const navigate = useNavigate();
 const [searchParams] = useSearchParams();

 const [account, setAccount] = useState(null);
 const [authMode, setAuthMode] =
  useState("signin");
 const [authLoading, setAuthLoading] =
  useState(true);
 const [authSubmitting, setAuthSubmitting] =
  useState(false);
 const [authMessage, setAuthMessage] =
  useState("");
 const [showResetPrompt, setShowResetPrompt] =
  useState(false);
 const [accountName, setAccountName] =
  useState("");
 const [accountEmail, setAccountEmail] =
  useState("");
 const [accountPassword, setAccountPassword] =
  useState("");
 const [recoveryPassword, setRecoveryPassword] =
  useState("");
 const [recoveryPasswordConfirm, setRecoveryPasswordConfirm] =
  useState("");
 const [recoveryLoading, setRecoveryLoading] =
  useState(false);
 const [recoveryMessage, setRecoveryMessage] =
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
 const [profileOpen, setProfileOpen] =
  useState(false);
 const [profileName, setProfileName] =
  useState("");
 const [profileEmail, setProfileEmail] =
  useState("");
 const [profilePassword, setProfilePassword] =
  useState("");
 const [profileAvatarUrl, setProfileAvatarUrl] =
  useState("");
 const [profileMessage, setProfileMessage] =
  useState("");
 const [avatarUploading, setAvatarUploading] =
  useState(false);
 const [playHistory, setPlayHistory] =
  useState([]);

 useEffect(() => {
  window.scrollTo({
   top: 0,
   left: 0,
   behavior: "auto"
  });
 }, [authMode]);

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
   authParam === "signup" ||
   authParam === "recovery"
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
  if (searchParams.get("auth") !== "confirmed") {
   return;
  }

  let active = true;

  const confirmEmail = async () => {
   try {
    const nextAccount =
     await refreshAccount();

    if (!active) return;

    if (nextAccount) {
     setAccount(nextAccount);
    }

    setGateNotice({
     eyebrow: "Email confirmed",
     title: "Congratulations, your email is confirmed.",
     body: "Enjoy. Room creation is unlocked in this browser too.",
     primaryLabel: "Continue",
     onPrimary: () => setGateNotice(null)
    });
   } catch (error) {
    if (!active) return;
    setGateNotice({
     eyebrow: "Email confirmation",
     title: "We could not refresh your confirmation yet.",
     body: error.message,
     primaryLabel: "Close",
     onPrimary: () => setGateNotice(null)
    });
   }
  };

  confirmEmail();

  return () => {
   active = false;
  };
 }, [searchParams]);

 useEffect(() => {
  if (searchParams.get("auth") !== "recovery") {
   return;
  }

  setAuthMode("recovery");
  setAuthMessage("");
  setRecoveryMessage(
   "Enter a new password for your account."
  );
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
  if (account) {
   setProfileName(account.name || "");
   setProfileEmail(account.email || "");
   setProfileAvatarUrl(
    account.avatarUrl || ""
   );
  }
 }, [account, username]);

 useEffect(() => {
  let active = true;

  const loadHistory = async () => {
   if (!account) {
    setPlayHistory([]);
    return;
   }

   const history = await getPlayHistory();

   if (active) {
    setPlayHistory(history);
   }
  };

  loadHistory();

  return () => {
   active = false;
  };
 }, [account]);

 const trialCreditsLeft =
  getTrialCreditsLeft(account);
 const hasPremium = isPremium(account);
 const hasPremiumPlus = isPremiumPlus(account);
 const playerTitle = getPlayerTitle(playHistory);
 const playerInsight = getInsight(playHistory);
 const planLabel = getPlanLabel(
  account?.plan || PLANS.FREE
 );
 const planBenefits = getPlanBenefits(
  account?.plan || PLANS.FREE
 );
 const winCount = playHistory.filter(
  (item) => item.result === "win"
 ).length;
 const tieCount = playHistory.filter(
  (item) => item.result === "tie"
 ).length;
 const lossCount = playHistory.filter(
  (item) => item.result === "loss"
 ).length;

 const saveProfile = async (event) => {
  event.preventDefault();
  setProfileMessage("");

  try {
   let nextAccount = await updateProfile({
    name: profileName,
    avatarUrl: profileAvatarUrl
   });

   if (
    profileEmail.trim() &&
    profileEmail.trim() !== account.email
   ) {
    nextAccount = await updateEmail(
     profileEmail
    );
    setProfileMessage(
     "Profile saved. Check your new email inbox to confirm the email change."
    );
   } else {
    setProfileMessage("Profile saved.");
   }

   if (profilePassword) {
    await updatePassword(profilePassword);
    setProfilePassword("");
    setProfileMessage(
     "Profile saved and password updated."
    );
   }

   setAccount(nextAccount);
   setUsername(nextAccount?.name || username);
  } catch (error) {
   setProfileMessage(error.message);
  }
 };

 const handleAvatarUpload = async (event) => {
  const file = event.target.files?.[0];

  if (!file) return;

  setAvatarUploading(true);
  setProfileMessage("");

  try {
   const publicUrl = await uploadAvatar(file);
   setProfileAvatarUrl(publicUrl);
   const nextAccount = await updateProfile({
    name: profileName,
    avatarUrl: publicUrl
   });
   setAccount(nextAccount);
   setProfileMessage(
    "Profile picture uploaded."
   );
  } catch (error) {
   setProfileMessage(error.message);
  } finally {
   setAvatarUploading(false);
   event.target.value = "";
  }
 };

 const showEmailGate = () => {
  setGateNotice({
   eyebrow: "Email confirmation required",
   title: "Confirm your email to create rooms.",
   body:
    "Room hosting opens after your email is verified. Check your inbox and spam folder for the Supabase confirmation link.",
   primaryLabel: "Resend Email",
   secondaryLabel: "Got it",
   onPrimary: async () => {
    try {
     await resendConfirmationEmail(
      account.email
     );
     setGateNotice({
      eyebrow: "Email sent",
      title: "Check your inbox.",
      body:
       "We asked Supabase to send another confirmation email. Also check spam or promotions.",
      primaryLabel: "Close",
      onPrimary: () => setGateNotice(null)
     });
    } catch (error) {
     setGateNotice({
      eyebrow: "Email not sent",
      title: "Supabase rejected the resend.",
      body: error.message,
      primaryLabel: "Close",
      onPrimary: () => setGateNotice(null)
     });
    }
   },
   onSecondary: () => setGateNotice(null)
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

 const showLyricsPremiumPlusGate = () => {
  setGateNotice({
   eyebrow: "Premium Plus",
   title: "Complete the Lyrics is locked.",
   body:
    "Premium Plus unlocks early access to the Complete the Lyrics game section in solo and multiplayer.",
   primaryLabel: "Upgrade to Premium Plus",
   secondaryLabel: "Maybe later",
   onPrimary: () => navigate("/payment"),
   onSecondary: () => setGateNotice(null)
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
   body: message
    ? `Supabase says: ${message}`
    : "Please try again in a moment. If this keeps happening, refresh the page and sign in again.",
   primaryLabel: "Close",
   onPrimary: () => setGateNotice(null)
  });
 };

 const handleAuth = async (event) => {
  event.preventDefault();

  if (authMode === "recovery") {
   if (!recoveryPassword) {
    setRecoveryMessage(
     "Enter your new password."
    );
    return;
   }

   if (
    recoveryPassword !==
    recoveryPasswordConfirm
   ) {
    setRecoveryMessage(
     "Both password fields must match."
    );
    return;
   }

   setRecoveryLoading(true);
   setRecoveryMessage("");

   try {
    await updatePassword(recoveryPassword);
    setRecoveryPassword("");
    setRecoveryPasswordConfirm("");
    setAuthMode("signin");
    setAuthMessage(
     "Password updated. You can log in now."
    );
    navigate("/multiplayer?auth=signin", {
     replace: true
    });
   } catch (error) {
    setRecoveryMessage(error.message);
   } finally {
    setRecoveryLoading(false);
   }

   return;
  }

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

  setAuthSubmitting(true);
  setAuthMessage("");

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
   if (
    authMode === "signup" &&
    !nextAccount?.emailConfirmed
   ) {
    setAuthMessage(
     "Account created. Check your inbox and spam folder for the confirmation email before creating rooms."
    );
   }
  } catch (error) {
   const message = String(error.message || "");
   if (
    /already registered|already has an account|email.*exists|user already exists/i.test(
     message
    )
   ) {
    setShowResetPrompt(true);
    setAuthMessage(
     "This email is already in use. Please log in or reset your password."
    );
   } else {
    setShowResetPrompt(false);
    setAuthMessage(message);
    if (/invalid login credentials/i.test(message)) {
     setShowResetPrompt(true);
    }
   }
  } finally {
   setAuthSubmitting(false);
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

 const goHome = () => {
  navigate("/");
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

  if (
   selectedCategory === "lyrics" &&
   !hasPremiumPlus
  ) {
    showLyricsPremiumPlusGate();
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
    await insertRoomPlayer({
     room_code: code,

     player_id: playerId,

     account_id: account.id,

     avatar_url: account.avatarUrl || null,

     username,

     score: 0
     });

   if (playerError) throw playerError;

   if (!hasPremium) {
    const nextAccount =
     await useTrialCredit(account);
    setAccount(nextAccount);
   }

   playSoundEffect("roomCreate");
   navigate(
    `/room/${code}?account=${account.id}`
   );
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

   if (
    selectedCategory === "trivia" &&
    !hasPremium
   ) {
    showMixPremiumGate();
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
   const { error: playerError } =
    await insertRoomPlayer({
      room_code: upperCode,

      player_id: playerId,

      account_id: account.id,

      avatar_url: account.avatarUrl || null,

      username,

      score: 0
    });

   if (playerError) {
    console.error(playerError);
    alert(playerError.message);
    return;
   }
  }

  playSoundEffect("roomJoin");
  navigate(
   `/room/${upperCode}?account=${account.id}`
  );
 };

 return (
  <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 sm:p-6">
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

   <div className="w-full max-w-6xl mb-4 sm:mb-6">
    <button
     onClick={goHome}
     className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-lg font-bold"
    >
     Home
    </button>
   </div>

   <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-5 sm:gap-6 w-full max-w-6xl">

    {authLoading ? (
     <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8">
      <p className="text-zinc-400">
       Checking account...
      </p>
     </div>
    ) : !account || authMode === "recovery" ? (
     <form
      onSubmit={handleAuth}
      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8"
     >
      {authSubmitting && authMode === "signup" && (
       <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-center shadow-2xl">
         <p className="text-yellow-400 uppercase tracking-[0.25em] text-xs mb-4">
          Getting things ready for you
         </p>
         <h2 className="text-2xl font-bold mb-3">
          Creating your account
         </h2>
         <p className="text-zinc-400">
          Hang tight while we set up your profile and confirmation email.
         </p>
        </div>
       </div>
      )}

      <p className="text-yellow-400 uppercase tracking-[0.25em] text-sm mb-3">
       {authMode === "recovery"
        ? "Reset Password"
        : "Account Required"}
      </p>

      <h1 className="text-4xl sm:text-5xl font-bold mb-5">
       {authMode === "recovery"
        ? "Choose a new password"
        : authMode === "signup"
         ? "Create an account"
         : "Login to multiplayer"}
      </h1>

      <p className="text-zinc-400 leading-relaxed mb-8">
       {authMode === "recovery"
        ? "Your reset link is active. Set a fresh password to continue."
        : "Multiplayer includes 2 free hosted rooms. After that, Premium unlocks unlimited game room creation and playing with friends."}
      </p>

      {authMessage && (
       <div className="border border-yellow-500/40 bg-yellow-500/10 text-yellow-100 rounded-lg p-4 mb-5">
        {authMessage}
       </div>
      )}

      {authMode === "recovery" ? (
       <>
        {recoveryMessage && (
         <div className="border border-yellow-500/40 bg-yellow-500/10 text-yellow-100 rounded-lg p-4 mb-5">
          {recoveryMessage}
         </div>
        )}

        <input
         value={recoveryPassword}
         onChange={(event) =>
          setRecoveryPassword(
           event.target.value
          )
         }
         placeholder="New password"
         type="password"
         className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5"
        />

        <input
         value={recoveryPasswordConfirm}
         onChange={(event) =>
          setRecoveryPasswordConfirm(
           event.target.value
          )
         }
         placeholder="Confirm new password"
         type="password"
         className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5"
        />

        <button
         type="submit"
         disabled={recoveryLoading}
         className="w-full bg-yellow-400 text-black p-4 rounded-lg font-bold disabled:opacity-60"
        >
         {recoveryLoading
          ? "Updating..."
          : "Update Password"}
        </button>

        <button
         type="button"
         onClick={() => {
          setAuthMode("signin");
          setRecoveryMessage("");
          navigate(
           "/multiplayer?auth=signin",
           { replace: true }
          );
         }}
         className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg font-bold mt-4"
        >
         Back to login
        </button>
       </>
      ) : (
       <>

      {(showResetPrompt || authMode === "signin") && (
       <button
        type="button"
        onClick={async () => {
         if (!accountEmail.trim()) {
          setAuthMessage(
           "Enter your email first."
          );
          return;
         }

         try {
          await requestPasswordReset(
           accountEmail
          );
          setAuthMessage(
           "Password reset email sent. Check your inbox."
          );
         } catch (error) {
          setAuthMessage(error.message);
         }
        }}
        className="w-full bg-zinc-950 border border-zinc-700 p-4 rounded-lg font-bold mb-5"
       >
        Reset password
       </button>
      )}

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
       disabled={authSubmitting}
       className="w-full bg-yellow-400 text-black p-4 rounded-lg font-bold"
      >
       {authSubmitting
        ? "Working..."
        : authMode === "signup"
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

      {authMode === "signup" &&
       accountEmail.trim() && (
        <button
         type="button"
         onClick={async () => {
          try {
           await resendConfirmationEmail(
            accountEmail
           );
           setAuthMessage(
            "Confirmation email requested again. Check inbox, spam, and promotions."
           );
          } catch (error) {
           setAuthMessage(error.message);
          }
         }}
         className="w-full bg-zinc-950 border border-zinc-700 p-4 rounded-lg font-bold mt-4"
        >
         Resend confirmation email
        </button>
       )}
       </>
      )}
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
      <p className="text-white text-xl mt-4">
       Welcome back, {account.name || "Player"}.
      </p>
     <p className="text-zinc-400 mt-4">
       {account.name || account.email} -{" "}
       {getPlanLabel(account.plan)}
       {account.plan === PLANS.FREE &&
        ` - ${trialCreditsLeft} free room${
         trialCreditsLeft === 1 ? "" : "s"
        } left`}
      </p>
      {!account.emailConfirmed && (
       <div className="text-yellow-300 mt-3">
        <p>
         Confirm your email before creating rooms.
        </p>
        <button
         onClick={async () => {
          try {
           await resendConfirmationEmail(
            account.email
           );
           setGateNotice({
            eyebrow: "Email sent",
            title: "Check your inbox.",
            body:
             "We asked Supabase to send another confirmation email. Also check spam or promotions.",
            primaryLabel: "Close",
            onPrimary: () =>
             setGateNotice(null)
           });
          } catch (error) {
           setGateNotice({
            eyebrow: "Email not sent",
            title:
             "Supabase rejected the resend.",
            body: error.message,
            primaryLabel: "Close",
            onPrimary: () =>
             setGateNotice(null)
           });
          }
         }}
         className="mt-3 bg-zinc-800 border border-zinc-700 px-4 py-2 rounded-lg font-bold text-white"
        >
         Resend confirmation email
        </button>
       </div>
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
      <button
       onClick={() =>
        setProfileOpen((open) => !open)
       }
       className="mt-4 ml-3 bg-yellow-400 text-black border border-yellow-400 px-4 py-2 rounded-lg font-bold"
      >
       Profile
      </button>
     </div>

     {profileOpen && (
      <div className="border border-zinc-700 bg-zinc-950 rounded-2xl p-5 mb-6">
       <div className="flex items-center gap-4 mb-5">
        <div className="h-16 w-16 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center text-2xl font-bold">
         {profileAvatarUrl ? (
          <img
           src={profileAvatarUrl}
           alt={profileName || "Profile"}
           className="h-full w-full object-cover"
          />
         ) : (
          (profileName || account.email || "P")
           .charAt(0)
           .toUpperCase()
         )}
        </div>
        <div>
         <p className="text-yellow-300 font-bold">
          {playerTitle}
         </p>
         <p className="text-zinc-400 text-sm">
          {playerInsight}
         </p>
         <div className="flex flex-wrap gap-2 mt-3">
          <span className="rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-yellow-300">
           {planLabel}
          </span>
          {isPremiumPlus(account) && (
           <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-300">
            Premium Plus badge
           </span>
          )}
          {isPremium(account) &&
           !isPremiumPlus(account) && (
            <span className="rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-yellow-300">
             Premium badge
            </span>
           )}
         </div>
        </div>
       </div>

       <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
         <p className="text-zinc-400 text-xs uppercase tracking-[0.2em] mb-2">
          Wins
         </p>
         <p className="text-3xl font-bold text-yellow-300">
          {winCount}
         </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
         <p className="text-zinc-400 text-xs uppercase tracking-[0.2em] mb-2">
          Ties
         </p>
         <p className="text-3xl font-bold text-yellow-300">
          {tieCount}
         </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
         <p className="text-zinc-400 text-xs uppercase tracking-[0.2em] mb-2">
          Losses
         </p>
         <p className="text-3xl font-bold text-yellow-300">
          {lossCount}
         </p>
        </div>
       </div>

       <div className="mb-6">
        <h3 className="text-lg font-bold mb-3">
         Your plan benefits
        </h3>
        <div className="grid gap-2">
         {planBenefits.map((benefit) => (
          <div
           key={benefit}
           className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300"
          >
           {benefit}
          </div>
         ))}
        </div>
       </div>

       <form
        onSubmit={saveProfile}
        className="grid gap-3 mb-6"
       >
        <input
         value={profileName}
         onChange={(event) =>
          setProfileName(event.target.value)
         }
         placeholder="Display name"
         className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg"
        />
        <input
         type="file"
         accept="image/*"
         onChange={handleAvatarUpload}
         disabled={avatarUploading}
         className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg disabled:opacity-60"
        />
        {avatarUploading && (
         <p className="text-zinc-400">
          Uploading profile picture...
         </p>
        )}
        <input
         value={profileEmail}
         onChange={(event) =>
          setProfileEmail(event.target.value)
         }
         placeholder="Email"
         type="email"
         className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg"
        />
        <input
         value={profilePassword}
         onChange={(event) =>
          setProfilePassword(
           event.target.value
          )
         }
         placeholder="New password"
         type="password"
         className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg"
        />
        <button className="bg-yellow-400 text-black p-4 rounded-lg font-bold">
         Save Profile
        </button>
        {profileMessage && (
         <p className="text-zinc-300">
          {profileMessage}
         </p>
        )}
       </form>

       {playHistory.length > 0 && (
        <div className="grid gap-3 max-h-72 overflow-auto pr-1">
         {playHistory.map((item) => (
          <div
           key={item.id}
           className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
          >
           <div className="flex justify-between gap-3">
            <span className="capitalize font-bold">
             {item.mode} {item.category}
            </span>
            <span className="text-yellow-300 capitalize">
             {item.result}
            </span>
           </div>
           <p className="text-zinc-400 text-sm mt-2">
            Score {item.score} /{" "}
            {item.total_questions || "-"}
            {item.opponent_count !== undefined
             ? ` - ${item.opponent_count} opponents`
             : ""}
            {item.room_code
             ? ` - Room ${item.room_code}`
             : ""}
           </p>
         </div>
        ))}
        </div>
       )}
      </div>
     )}

    <input
     value={username}
     onChange={(e) =>
      setUsername(e.target.value)
     }
     placeholder="Username"
     className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5"
    />

    <div className="grid gap-3 mb-5">
     <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
      Category
     </p>
     <div className="grid sm:grid-cols-2 gap-3">
      {standardCategoryOptions.map((option) => {
       const active =
        selectedCategory === option.value;

       return (
        <button
         key={option.value}
         type="button"
         onClick={() => {
          if (
           (option.value === "mix" ||
            option.value === "trivia") &&
           !hasPremium
          ) {
           showMixPremiumGate();
           return;
          }

          setSelectedCategory(option.value);
         }}
         className={`border p-4 rounded-lg font-bold text-left ${
          active
           ? "bg-yellow-400 text-black border-yellow-400"
           : "bg-zinc-800 text-white border-zinc-700"
         }`}
        >
         {option.label}
        </button>
       );
      })}
     </div>
    </div>

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

    <div className="border border-yellow-500/40 bg-zinc-950 rounded-2xl p-5 mt-6">
     <div className="flex items-start justify-between gap-4 mb-4">
      <div>
       <h2 className="text-2xl font-bold">
        Complete the Lyrics
       </h2>
       <p className="text-zinc-400 mt-2">
        {hasPremiumPlus
         ? "Premium Plus early access unlocked."
         : "Locked until Premium Plus is active."}
       </p>
      </div>
      <span className={`text-xs uppercase tracking-[0.2em] rounded-full px-3 py-1 border ${
       hasPremiumPlus
        ? "text-cyan-300 border-cyan-400/40 bg-cyan-400/10"
        : "text-yellow-300 border-yellow-500/40"
      }`}>
       {hasPremiumPlus ? "Unlocked" : "Premium Plus"}
      </span>
     </div>
     <button
      type="button"
      onClick={() => {
       if (!hasPremiumPlus) {
       showLyricsPremiumPlusGate();
       return;
      }
       setSelectedCategory("lyrics");
      }}
      className="bg-yellow-400 text-black px-5 py-3 rounded-lg font-bold"
     >
      {hasPremiumPlus
       ? selectedCategory === "lyrics"
        ? "Lyrics Selected"
        : "Select Lyrics Multiplayer"
       : "Unlock Lyrics Multiplayer"}
     </button>
    </div>
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

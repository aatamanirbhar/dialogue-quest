import React, {
 useEffect,
 useState
} from "react";
import { useNavigate } from "react-router-dom";
import {
 getAccount,
 getPlanBenefits,
 getPlanLabel,
 getPlayHistory,
 isPremium,
 isPremiumPlus,
 requestPasswordReset,
 signInAccount
} from "../lib/account";
import {
 getInsight,
 getPlayerTitle
} from "../lib/playerStats";

const categories = [
 "hollywood",
 "tvshows",
 "mix",
 "bollywood",
 "anime",
 "trivia"
];

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

const getLabel = (category) => {
 if (category === "tvshows") return "TV Shows";
 if (category === "mix") return "Mix";
 if (category === "trivia") return "Trivia";
 return category;
};

export default function Categories() {
 const navigate = useNavigate();
 const [account, setAccount] = useState(null);
 const [loadingAccount, setLoadingAccount] =
  useState(true);
 const [loginOpen, setLoginOpen] =
  useState(false);
 const [profileOpen, setProfileOpen] =
  useState(false);
 const [loginEmail, setLoginEmail] =
  useState("");
 const [loginPassword, setLoginPassword] =
  useState("");
 const [loginMessage, setLoginMessage] =
  useState("");
 const [loginLoading, setLoginLoading] =
  useState(false);
 const [showReset, setShowReset] =
  useState(false);
 const [playHistory, setPlayHistory] =
  useState([]);
 const [premiumNotice, setPremiumNotice] =
  useState(false);
 const [lyricsNotice, setLyricsNotice] =
  useState(false);
 const [selectedMixCategories, setSelectedMixCategories] =
  useState(["hollywood", "tvshows"]);

 useEffect(() => {
  let active = true;

  const loadAccount = async () => {
   try {
    const nextAccount = await getAccount();

    if (active) setAccount(nextAccount);
   } catch (error) {
    console.error(error);
   } finally {
    if (active) setLoadingAccount(false);
   }
  };

  loadAccount();

  return () => {
   active = false;
  };
 }, []);

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

 const hasPremium = isPremium(account);
 const hasPremiumPlus = isPremiumPlus(account);
 const planLabel = getPlanLabel(
  account?.plan || "free"
 );
 const planBenefits = getPlanBenefits(
  account?.plan || "free"
 );
 const wins = playHistory.filter(
  (item) => item.result === "win"
 ).length;
 const ties = playHistory.filter(
  (item) => item.result === "tie"
 ).length;
 const losses = playHistory.filter(
  (item) => item.result === "loss"
 ).length;

 const loginFromOverlay = async (event) => {
  event.preventDefault();
  setLoginLoading(true);
  setLoginMessage("");
  setShowReset(false);

  try {
   const nextAccount = await signInAccount({
    email: loginEmail,
    password: loginPassword
   });
   setAccount(nextAccount);
   setLoginOpen(false);
   setProfileOpen(true);
   setLoginPassword("");
  } catch (error) {
   const message = String(error.message || "");
   setLoginMessage(message);
   if (
    /invalid login credentials|already in use|already has an account|already registered/i.test(
     message
    )
   ) {
    setShowReset(true);
   }
  } finally {
   setLoginLoading(false);
  }
 };

 const sendReset = async () => {
  if (!loginEmail.trim()) {
   setLoginMessage("Enter your email first.");
   return;
  }

  try {
   await requestPasswordReset(loginEmail);
   setLoginMessage(
    "Password reset email sent. Check your inbox."
   );
   setShowReset(false);
  } catch (error) {
   setLoginMessage(error.message);
  }
 };

 const openLyricsGate = () => {
  setLyricsNotice(true);
 };

 const openPremiumMixNotice = () => {
  setPremiumNotice(true);
 };

 const playSolo = (category) => {
  if (
   (category === "mix" ||
    category === "trivia") &&
   !hasPremium
  ) {
   openPremiumMixNotice();
   return;
  }

  if (category === "mix") {
   const mix = selectedMixCategories.join(",");
   navigate(`/solo/mix?mix=${mix}`);
   return;
  }

  navigate(`/solo/${category}`);
 };

 const playMultiplayer = (category) => {
  if (
   (category === "mix" ||
    category === "trivia") &&
   !hasPremium
  ) {
   openPremiumMixNotice();
   return;
  }

  if (category === "mix") {
   const mix = selectedMixCategories.join(",");
   navigate(
    `/multiplayer?category=mix&mix=${mix}`
   );
   return;
  }

  navigate(`/multiplayer?category=${category}`);
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

 return (
  <div className="min-h-screen bg-black text-white p-5 sm:p-10">
   {premiumNotice && (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
     <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
      <p className="text-yellow-400 uppercase tracking-[0.25em] text-xs mb-4">
       Premium Mix
      </p>
      <h2 className="text-3xl font-bold leading-tight mb-4">
       Want to play different categories at the same time?
      </h2>
      <p className="text-zinc-400 leading-relaxed mb-6">
       Upgrade to Premium to play across all categories in one mixed game, in both solo and multiplayer.
      </p>

      <div className="grid gap-3">
       <button
        onClick={() => navigate("/payment")}
        className="bg-yellow-400 text-black p-4 rounded-lg font-bold"
       >
        Upgrade to Premium
       </button>
       <button
        onClick={() =>
         setPremiumNotice(false)
        }
        className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg font-bold"
       >
        Keep Browsing
       </button>
      </div>
    </div>
   </div>
   )}

   {lyricsNotice && (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
     <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
      <p className="text-yellow-400 uppercase tracking-[0.25em] text-xs mb-4">
       Premium Plus
      </p>
      <h2 className="text-3xl font-bold leading-tight mb-4">
       Complete the Lyrics is locked.
      </h2>
      <p className="text-zinc-400 leading-relaxed mb-6">
       This section opens with Premium Plus early access for solo and multiplayer.
      </p>

      <div className="grid gap-3">
       <button
        onClick={() => navigate("/payment")}
        className="bg-yellow-400 text-black p-4 rounded-lg font-bold"
       >
        Upgrade to Premium Plus
       </button>
       <button
        onClick={() =>
         setLyricsNotice(false)
        }
        className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg font-bold"
       >
        Keep Browsing
       </button>
      </div>
     </div>
    </div>
   )}

   <div className="max-w-5xl mx-auto">
    <div className="flex justify-between items-center gap-3 mb-8">
     <button
      onClick={() => navigate("/")}
      className="bg-zinc-900 border border-zinc-800 px-5 py-3 rounded-lg font-bold"
     >
      Back
     </button>

     {account ? (
      <button
       onClick={() => setProfileOpen(true)}
       className="h-12 w-12 rounded-full bg-zinc-900 border border-zinc-700 overflow-hidden flex items-center justify-center font-bold"
       title="Open profile"
      >
       {account.avatarUrl ? (
        <img
         src={account.avatarUrl}
         alt={account.name || "Profile"}
         className="h-full w-full object-cover"
        />
       ) : (
        (account.name || account.email || "P")
         .charAt(0)
         .toUpperCase()
       )}
      </button>
     ) : (
      <button
       onClick={() => setLoginOpen(true)}
       className="bg-yellow-400 text-black px-5 py-3 rounded-lg font-bold"
      >
       Login
      </button>
     )}
    </div>

   <h1 className="text-5xl font-bold mb-4">
     Choose Category
    </h1>
    <p className="text-zinc-400 mb-10">
     {loadingAccount
      ? "Checking premium access..."
      : hasPremium
       ? "Premium active. Mix pulls questions from every category."
       : "Mix is a Premium category where you choose which categories play together."}
    </p>

    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6 flex items-center justify-between gap-4">
     <div>
      <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 mb-2">
       Login
      </p>
      <p className="text-zinc-400 text-sm">
       Use your account to open profile, edit details, and keep your history.
      </p>
     </div>
     <button
      onClick={() =>
       account ? setProfileOpen(true) : setLoginOpen(true)
      }
      className="bg-yellow-400 text-black px-5 py-3 rounded-lg font-bold"
     >
      {account ? "Open Profile" : "Login"}
     </button>
    </div>

    <div className="grid md:grid-cols-2 gap-6">
     {categories.map((item) => {
      const locked =
       (item === "mix" ||
        item === "trivia") &&
       !hasPremium;

      return (
       <div
        key={item}
        className={`bg-zinc-900 border rounded-2xl p-6 sm:p-8 ${
         locked
          ? "border-yellow-500/40"
          : "border-zinc-800"
        }`}
       >
        <div className="flex items-start justify-between gap-4 mb-6">
         <div>
          <h2 className="text-3xl capitalize font-bold">
           {getLabel(item)}
          </h2>
          {item === "mix" && (
           <p className="text-zinc-400 mt-3">
            {locked
             ? "Premium unlock: choose the categories you want in one run."
             : "Unlocked: choose exactly which categories can appear."}
           </p>
          )}
          {item === "trivia" && (
           <p className="text-zinc-400 mt-3">
            {locked
             ? "Premium unlock: poster-backed trivia questions in solo and Premium Plus accounts."
             : "Unlocked: poster-backed trivia questions are ready to play."}
           </p>
          )}
         </div>

         {locked && (
          <span className="text-xs uppercase tracking-[0.2em] text-yellow-300 border border-yellow-500/40 rounded-full px-3 py-1">
           Premium
          </span>
         )}
        </div>

        {item === "mix" && hasPremium && (
         <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500 mb-3">
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

        <div className="flex gap-4 flex-wrap">
         <button
          onClick={() => playSolo(item)}
          className="bg-white text-black px-5 py-3 rounded-lg font-bold"
         >
          Solo
         </button>

         <button
          onClick={() =>
           playMultiplayer(item)
          }
          className="bg-yellow-400 text-black px-5 py-3 rounded-lg font-bold"
         >
          Multiplayer
         </button>
       </div>
      </div>
      );
     })}

     <div className="bg-zinc-900 border border-yellow-500/40 rounded-2xl p-6 sm:p-8 md:col-span-2">
      <div className="flex items-start justify-between gap-4 mb-4">
       <div>
        <h2 className="text-3xl font-bold">
         Complete the Lyrics
        </h2>
        <p className="text-zinc-400 mt-3">
         {hasPremiumPlus
          ? "Premium Plus early access is unlocked. Play solo or host a lyrics room."
          : "Premium Plus early access. Unlock this section to play the lyrics game in solo and multiplayer."}
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

      <div className="flex gap-4 flex-wrap">
       <button
        onClick={() => {
         if (!hasPremiumPlus) {
          openLyricsGate();
          return;
         }
         navigate("/lyrics");
        }}
        className="bg-white text-black px-5 py-3 rounded-lg font-bold"
       >
        {hasPremiumPlus ? "Solo" : "Unlock Premium Plus"}
       </button>

       <button
        onClick={() => {
         if (!hasPremiumPlus) {
          openLyricsGate();
          return;
         }
         navigate("/multiplayer?category=lyrics");
        }}
        className="bg-yellow-400 text-black px-5 py-3 rounded-lg font-bold"
       >
        Multiplayer
       </button>
      </div>
     </div>
    </div>
  </div>

   {loginOpen && (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
     <form
      onSubmit={loginFromOverlay}
      className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl"
     >
      <p className="text-yellow-400 uppercase tracking-[0.25em] text-xs mb-4">
       Account Login
      </p>
      <h2 className="text-3xl font-bold mb-5">
       Login
      </h2>

      {loginMessage && (
       <div className="border border-yellow-500/40 bg-yellow-500/10 text-yellow-100 rounded-lg p-4 mb-4">
        {loginMessage}
       </div>
      )}

      <input
       value={loginEmail}
       onChange={(event) =>
        setLoginEmail(event.target.value)
       }
       type="email"
       placeholder="Email"
       className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-4"
      />
      <input
       value={loginPassword}
       onChange={(event) =>
        setLoginPassword(event.target.value)
       }
       type="password"
       placeholder="Password"
       className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-4"
      />
      <button
       disabled={loginLoading}
       className="w-full bg-yellow-400 text-black p-4 rounded-lg font-bold disabled:opacity-60"
      >
       {loginLoading ? "Logging in..." : "Login"}
      </button>

      <button
       type="button"
       onClick={sendReset}
       className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-lg font-bold mt-3"
      >
       Forgot / reset password
      </button>

      {showReset && (
       <p className="text-yellow-200 text-sm mt-3">
        Use reset password if the email already exists or if login failed.
       </p>
      )}

      <button
       type="button"
       onClick={() => setLoginOpen(false)}
       className="w-full bg-zinc-800 p-4 rounded-lg font-bold mt-3"
      >
       Close
      </button>
     </form>
    </div>
   )}

   {profileOpen && account && (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto p-4">
     <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl mx-auto my-6">
      <div className="flex items-center gap-4 mb-5">
       <div className="h-16 w-16 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center text-2xl font-bold">
        {account.avatarUrl ? (
         <img
          src={account.avatarUrl}
          alt={account.name || "Profile"}
          className="h-full w-full object-cover"
         />
        ) : (
         (account.name || account.email || "P")
          .charAt(0)
          .toUpperCase()
        )}
       </div>
       <div>
        <p className="text-yellow-300 font-bold">
         {getPlayerTitle(playHistory)}
        </p>
        <p className="text-zinc-400 text-sm">
         {getInsight(playHistory)}
        </p>
        <p className="text-zinc-300 text-sm mt-2">
         {planLabel}
        </p>
       </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-5">
       {[
        ["Wins", wins],
        ["Ties", ties],
        ["Losses", losses]
       ].map(([label, value]) => (
        <div
         key={label}
         className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
        >
         <p className="text-zinc-400 text-xs uppercase tracking-[0.2em] mb-2">
          {label}
         </p>
         <p className="text-3xl font-bold text-yellow-300">
          {value}
         </p>
        </div>
       ))}
      </div>

      <div className="grid gap-2 mb-5">
       {planBenefits.map((benefit) => (
        <div
         key={benefit}
         className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300"
        >
         {benefit}
        </div>
       ))}
      </div>

      <div className="flex flex-wrap gap-3">
       <button
        onClick={() => navigate("/profile/edit")}
        className="bg-yellow-400 text-black px-5 py-3 rounded-lg font-bold"
       >
        Edit my profile
       </button>
       <button
        onClick={() => setProfileOpen(false)}
        className="bg-zinc-800 px-5 py-3 rounded-lg font-bold"
       >
        Close
       </button>
      </div>
     </div>
    </div>
   )}
  </div>
 );
}

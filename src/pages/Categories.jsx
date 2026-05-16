import React, {
 useEffect,
 useState
} from "react";
import { useNavigate } from "react-router-dom";
import {
 getAccount,
 isPremium
} from "../lib/account";

const categories = [
 "hollywood",
 "tvshows",
 "mix",
 "bollywood",
 "anime"
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
 return category;
};

export default function Categories() {
 const navigate = useNavigate();
 const [account, setAccount] = useState(null);
 const [loadingAccount, setLoadingAccount] =
  useState(true);
 const [premiumNotice, setPremiumNotice] =
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

 const hasPremium = isPremium(account);

 const openPremiumMixNotice = () => {
  setPremiumNotice(true);
 };

 const playSolo = (category) => {
  if (
   category === "mix" &&
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
   category === "mix" &&
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

   <div className="max-w-5xl mx-auto">
    <button
     onClick={() => navigate("/")}
     className="bg-zinc-900 border border-zinc-800 px-5 py-3 rounded-lg font-bold mb-8"
    >
     Back
    </button>

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

    <div className="grid md:grid-cols-2 gap-6">
     {categories.map((item) => {
      const locked =
       item === "mix" && !hasPremium;

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
    </div>
   </div>
  </div>
 );
}

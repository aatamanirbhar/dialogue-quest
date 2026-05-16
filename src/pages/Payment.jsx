import React, {
 useEffect,
 useState
} from "react";
import { useNavigate } from "react-router-dom";
import {
 PLANS,
 getAccount,
 upgradeAccount
} from "../lib/account";

const plans = [
 {
  name: "Premium",
  price: "$15",
  period: "one-time payment",
  features: [
   "Unlimited multiplayer room creation",
   "Play with friends without trial limits",
   "Premium account status",
   "Private rooms and invite codes"
  ],
  highlight: true,
  plan: PLANS.PREMIUM
 },
 {
  name: "Premium Plus",
  price: "$29",
  period: "one-time upgrade",
  features: [
   "Create rooms for up to 20 players",
   "Choose player limit from a dropdown",
   "Host can skip/end current question",
   "Access to upcoming features like fill in the song lyrics"
  ],
  plan: PLANS.PREMIUM_PLUS
 }
];

export default function Payment() {
 const navigate = useNavigate();
 const [account, setAccount] = useState(null);
 const [loading, setLoading] =
  useState(true);
 const [upgradingPlan, setUpgradingPlan] =
  useState(null);

 useEffect(() => {
  let active = true;

  const loadAccount = async () => {
   const nextAccount = await getAccount();

   if (active) {
    setAccount(nextAccount);
    setLoading(false);
   }
  };

  loadAccount();

  return () => {
   active = false;
  };
 }, []);

 const handleUpgrade = async (plan) => {
  if (!account) {
   alert(
    "Login or create an account before upgrading."
   );
   navigate("/multiplayer");
   return;
  }

  setUpgradingPlan(plan);

  try {
   await upgradeAccount(plan);
   navigate("/multiplayer");
  } catch (error) {
   alert(error.message);
  } finally {
   setUpgradingPlan(null);
  }
 };

 return (
  <div className="min-h-screen bg-black text-white">
   <div className="max-w-6xl mx-auto px-6 py-10">
    <button
     onClick={() => navigate("/multiplayer")}
     className="bg-zinc-900 border border-zinc-800 px-5 py-3 rounded-lg font-bold mb-10"
    >
     Back
    </button>

    <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
     <section className="pt-4">
      <p className="text-yellow-400 uppercase tracking-[0.3em] text-sm mb-5">
       Premium Multiplayer
      </p>

      <h1 className="text-6xl font-bold leading-tight mb-6">
       Put a polished paywall in front of your best rooms.
      </h1>

      <p className="text-zinc-400 text-lg leading-relaxed mb-8">
       Premium is a one-time $15 payment that makes the account premium forever. Premium Plus adds large rooms, host question controls, and upcoming feature access.
      </p>

      <p className="text-zinc-500 mb-8">
       {loading
        ? "Checking account..."
        : account
         ? `Signed in as ${account.email}. Current plan: ${account.plan}.`
         : "You need to login before upgrading."}
      </p>

      <button
       onClick={() =>
        handleUpgrade(PLANS.PREMIUM)
       }
       disabled={loading || upgradingPlan}
       className="bg-yellow-400 text-black px-8 py-4 rounded-lg font-bold"
      >
       {upgradingPlan === PLANS.PREMIUM
        ? "Storing Payment..."
        : "Pay $15 and Unlock Premium"}
      </button>
     </section>

     <section className="grid gap-5">
      {plans.map((plan) => (
       <article
        key={plan.name}
        className={`rounded-2xl p-6 border ${
         plan.highlight
          ? "bg-white text-black border-white"
          : "bg-zinc-900 border-zinc-800"
        }`}
       >
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5 mb-6">
         <div>
          <h2 className="text-3xl font-bold mb-2">
           {plan.name}
          </h2>
          <p
           className={
            plan.highlight
             ? "text-zinc-600"
             : "text-zinc-400"
           }
          >
           {plan.period}
          </p>
         </div>

         <div className="text-5xl font-bold">
          {plan.price}
        </div>
       </div>

       <button
       onClick={() =>
        handleUpgrade(plan.plan)
       }
       disabled={loading || upgradingPlan}
       className={`w-full mb-5 p-4 rounded-lg font-bold ${
         plan.highlight
          ? "bg-black text-white"
          : "bg-yellow-400 text-black"
       }`}
      >
        {upgradingPlan === plan.plan
         ? "Storing Payment..."
         : `Upgrade to ${plan.name}`}
       </button>

        <div className="grid md:grid-cols-2 gap-3">
         {plan.features.map((feature) => (
          <div
           key={feature}
           className={`rounded-lg p-4 ${
            plan.highlight
             ? "bg-zinc-100"
             : "bg-zinc-800"
           }`}
          >
           {feature}
          </div>
         ))}
        </div>
       </article>
      ))}
     </section>
    </div>
   </div>
  </div>
 );
}

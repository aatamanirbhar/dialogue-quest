import React from "react";
import { useNavigate } from "react-router-dom";

const plans = [
 {
  name: "Host Pass",
  price: "$5",
  period: "lifetime starter",
  features: [
   "Private multiplayer rooms",
   "Custom timers",
   "Replay in the same room",
   "Room cleanup controls"
  ],
  highlight: true
 },
 {
  name: "Event Night",
  price: "$19",
  period: "per event",
  features: [
   "Bigger room package",
   "Long-form competitions",
   "Premium categories",
   "Sponsor-ready leaderboard"
  ]
 },
 {
  name: "Creator Club",
  price: "$49",
  period: "monthly",
  features: [
   "Custom quote packs",
   "Featured room branding",
   "Priority game templates",
   "Future analytics hooks"
  ]
 }
];

export default function Payment() {
 const navigate = useNavigate();

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
       This page is ready for a real checkout provider. Drop in Stripe, PayPal, or your own entitlement check when you are ready to enforce access.
      </p>

      <a
       href="https://www.paypal.com/paypalme/vikasdubey3811/5"
       target="_blank"
       rel="noreferrer"
       className="inline-block bg-yellow-400 text-black px-8 py-4 rounded-lg font-bold"
      >
       Unlock Lifetime Premium
      </a>
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

import React, {
 useEffect,
 useState
} from "react";
import { useNavigate } from "react-router-dom";
import {
 PLANS,
 getAccount
} from "../lib/account";
import { supabase } from "../lib/supabase";

const SUPPORT_EMAIL = "jkjkjkheyhey@gmail.com";
const PAYPAL_TARGET = "paypal.me/vikas117";
const UPI_ID = "8949720403@ptyes";

const plans = [
 {
  name: "Premium",
  price: "$15",
  amount: 15,
  upiPrice: "UPI",
  upiAmount: 15,
  period: "lifetime account upgrade",
  audience: "Best for friend groups who host often.",
  paypalLink: "https://paypal.me/vikas117",
  features: [
   "Unlimited hosted multiplayer rooms",
   "Keep playing after the 2 free-room trial",
   "Invite-code rooms for your friend circle",
   "Endless mode and custom timers stay unlocked"
  ],
  highlight: true,
  plan: PLANS.PREMIUM
 },
 {
  name: "Premium Plus",
  price: "$15",
  amount: 15,
  upiPrice: "UPI",
  upiAmount: 15,
  period: "lifetime host upgrade",
  audience: "Made for parties, classrooms, and bigger game nights.",
  paypalLink: "https://paypal.me/vikas117",
  features: [
   "Host rooms for up to 20 players",
   "Choose the exact player cap before hosting",
   "Skip trivia or end questions as the host",
   "Only hosts can replay, skip trivia, or end questions",
   "Early access to Complete the Lyrics game categories"
  ],
  plan: PLANS.PREMIUM_PLUS
 }
];

const getErrorMessage = (error) => {
 if (!error) return "Something went wrong.";

 return (
  error.message ||
  error.details?.[0]?.description ||
  "Something went wrong."
 );
};

const getUpiLink = (plan) => {
 const params = new URLSearchParams({
  pa: UPI_ID,
  pn: "Vikas Dubey",
  am: String(plan.upiAmount),
  cu: "INR",
  tn: `Dialogue Quest ${plan.name}`
 });

 return `upi://pay?${params.toString()}`;
};

export default function Payment() {
 const navigate = useNavigate();
 const [account, setAccount] = useState(null);
 const [loading, setLoading] =
  useState(true);
 const [selectedPlan, setSelectedPlan] =
  useState(plans[0]);
 const [transactionId, setTransactionId] =
  useState("");
 const [payerName, setPayerName] =
  useState("");
 const [contact, setContact] = useState("");
 const [note, setNote] = useState("");
 const [submitting, setSubmitting] =
  useState(false);
 const [paymentMessage, setPaymentMessage] =
  useState("");
 const [paymentMethod, setPaymentMethod] =
  useState("paypal");
 const [showUpiQr, setShowUpiQr] =
  useState(false);
 const [proofFile, setProofFile] =
  useState(null);
 const [proofPreview, setProofPreview] =
  useState("");

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

 const getManualPaymentMessage = (method) => {
  if (method === "upi") {
   return `Send the money to UPI ID ${UPI_ID} or scan the QR code below, then fill the form above with your transaction details. We will verify your details manually and it can take up to 1 day to give you your premium account access. For any troubles you can mail us at ${SUPPORT_EMAIL}.`;
  }

  return `Send the money to ${PAYPAL_TARGET} and fill the form above with your transaction details. We will verify your details manually and it can take up to 1 day to give you your premium account access. For any troubles you can mail us at ${SUPPORT_EMAIL}.`;
 };

 const showManualPaymentPopup = (method) => {
  const message =
   getManualPaymentMessage(method);
  setPaymentMessage(message);
  window.alert(message);
 };

 const openPaymentLink = (
  plan,
  method = "paypal"
 ) => {
  if (!account) {
   navigate("/multiplayer");
   return;
  }

  setSelectedPlan(plan);
  setPaymentMethod(method);
  setShowUpiQr(method === "upi");

  if (method === "upi") {
   showManualPaymentPopup("upi");
   window.open(
    getUpiLink(plan),
    "_blank",
    "noopener,noreferrer"
   );
   return;
  }

  showManualPaymentPopup("paypal");

  window.open(
   plan.paypalLink,
   "_blank",
   "noopener,noreferrer"
  );
 };

 const uploadPaymentProof = async () => {
  if (!proofFile || !account) return "";

  const extension =
   proofFile.name
    ?.split(".")
    .pop()
    ?.toLowerCase() || "jpg";
  const filePath = `${account.id}/${Date.now()}-${selectedPlan.plan}.${extension}`;

  const { error: uploadError } =
   await supabase.storage
    .from("payment-proofs")
    .upload(filePath, proofFile, {
     cacheControl: "3600",
     upsert: true
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
   .from("payment-proofs")
   .getPublicUrl(filePath);

  return data.publicUrl;
 };

 const savePaymentSubmission = async (
  proofUrl = ""
 ) => {
  const submission = {
   user_id: account.id,
   email: account.email,
   name: account.name || null,
   current_plan: account.plan || PLANS.FREE,
   requested_plan: selectedPlan.plan,
   requested_plan_name: selectedPlan.name,
   amount: Number(selectedPlan.amount),
   upi_amount: Number(selectedPlan.upiAmount),
   payment_method: paymentMethod,
   transaction_id: transactionId.trim(),
   payer_name: payerName.trim() || null,
   contact: contact.trim() || null,
   note: note.trim() || null,
   proof_url: proofUrl || null,
   status: "pending_review"
  };

  const { error: insertError } =
   await supabase
    .from("payment_submissions")
    .insert(submission);

  if (
   insertError &&
   /relation|schema cache|payment_submissions/i.test(
    insertError.message || ""
   )
  ) {
   const { error: profileError } =
    await supabase
     .from("profiles")
     .upsert({
      id: account.id,
      email: account.email,
      name: account.name || null,
      payment_status: "pending_review",
      paid_plan: selectedPlan.plan,
      paid_amount: Number(selectedPlan.amount),
      payment_provider:
       paymentMethod === "upi"
        ? "upi_manual"
        : "paypal_manual",
      payment_order_id:
       transactionId.trim(),
      payment_note: [
       `Requested plan: ${selectedPlan.name}`,
       `Method: ${paymentMethod}`,
       `Payer: ${payerName || "Not provided"}`,
       `Contact: ${contact || "Not provided"}`,
       `Proof: ${proofUrl || "Not uploaded"}`,
       `Note: ${note || "None"}`
      ].join("\n")
     }, {
      onConflict: "id"
     });

   if (profileError) throw profileError;
   return;
  }

  if (insertError) throw insertError;
 };

 const notifyPaymentApi = async (
  proofUrl = ""
 ) => {
  try {
   await fetch(
    "/api/payment-notify",
    {
     method: "POST",
     headers: {
      "Content-Type": "application/json"
     },
     body: JSON.stringify({
      userId: account.id,
      email: account.email,
      name: account.name,
      currentPlan: account.plan,
      requestedPlan: selectedPlan.plan,
      requestedPlanName:
       selectedPlan.name,
      amount: selectedPlan.amount,
      upiAmount: selectedPlan.upiAmount,
      paymentMethod,
      transactionId,
      payerName,
      contact,
      note,
      proofUrl
     })
    }
   );
  } catch (error) {
   console.error(error);
  }
 };

 const submitPaymentReview = async (
  event
 ) => {
  event.preventDefault();

  if (!account) {
   navigate("/multiplayer");
   return;
  }

  if (!transactionId.trim()) {
   setPaymentMessage(
    "Add the PayPal transaction ID, UPI reference ID, receipt number, or the email/name used for payment."
   );
   return;
  }

  setSubmitting(true);
  setPaymentMessage("");

  try {
   const proofUrl =
    await uploadPaymentProof();
   await savePaymentSubmission(proofUrl);
   notifyPaymentApi(proofUrl);

   setPaymentMessage(
    "Payment details submitted. Hang tight while we confirm your payment details."
   );
   window.alert(
    "Payment details submitted. Hang tight while we confirm your payment details."
   );
   setTransactionId("");
   setPayerName("");
   setContact("");
   setNote("");
   setProofFile(null);
   setProofPreview("");
  } catch (error) {
   setPaymentMessage(
    getErrorMessage(error)
   );
   console.error(error);
  } finally {
   setSubmitting(false);
  }
 };

 return (
  <div className="min-h-screen bg-black text-white">
   <div className="max-w-6xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
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

      <h1 className="text-5xl sm:text-6xl font-bold leading-tight mb-6">
       Host every game night without hitting limits.
      </h1>

      <p className="text-zinc-400 text-lg leading-relaxed mb-6">
       Pay with PayPal.me or UPI, then submit your transaction details below. Premium access is reviewed manually and can take up to 1 day to activate.
      </p>

      <div className="border border-yellow-500/40 bg-yellow-500/10 text-yellow-100 rounded-lg p-4 mb-8">
       Premium features are not instant on this manual payment method. We verify the payment first, then activate the account.
      </div>

      <p className="text-zinc-500 mb-8">
       {loading
        ? "Checking account..."
        : account
         ? `Signed in as ${account.email}. Current plan: ${account.plan}.`
         : "You need to login before upgrading."}
      </p>

      {paymentMessage && (
       <div className="border border-zinc-700 bg-zinc-900 text-zinc-100 rounded-lg p-4 mb-6">
        {paymentMessage}
       </div>
      )}

      {showUpiQr && (
       <div className="border border-zinc-800 bg-zinc-900 rounded-2xl p-5 mb-6">
        <p className="text-yellow-300 uppercase tracking-[0.25em] text-xs mb-3">
         UPI QR
        </p>
        <img
         src="/upi-qr.jpeg"
         alt="UPI QR code for Vikas Dubey"
         className="w-full max-w-sm rounded-lg border border-zinc-700 bg-white"
        />
        <p className="text-zinc-400 mt-4">
         UPI ID: {UPI_ID}
        </p>
       </div>
      )}

      <form
       onSubmit={submitPaymentReview}
       className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 grid gap-4"
      >
       <div>
        <label className="block text-sm text-zinc-400 mb-2">
         Plan you paid for
        </label>
        <select
         value={selectedPlan.plan}
         onChange={(event) => {
          const nextPlan = plans.find(
           (plan) =>
            plan.plan ===
            event.target.value
          );
          setSelectedPlan(nextPlan);
         }}
         className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg"
        >
         {plans.map((plan) => (
          <option
           key={plan.plan}
           value={plan.plan}
          >
           {plan.name} - {plan.price}
          </option>
         ))}
        </select>
       </div>

       <div>
        <label className="block text-sm text-zinc-400 mb-2">
         Payment method used
        </label>
        <select
         value={paymentMethod}
         onChange={(event) =>
          setPaymentMethod(event.target.value)
         }
         className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg"
        >
         <option value="paypal">PayPal</option>
         <option value="upi">UPI</option>
        </select>
       </div>

       <input
        value={transactionId}
        onChange={(event) =>
         setTransactionId(
          event.target.value
         )
        }
        placeholder="Transaction ID, UPI reference, or receipt ID"
        className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg"
       />

       <input
        value={payerName}
        onChange={(event) =>
         setPayerName(event.target.value)
        }
        placeholder="Name, PayPal account, or UPI name used for payment"
        className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg"
       />

       <input
        value={contact}
        onChange={(event) =>
         setContact(event.target.value)
        }
        placeholder="Contact email or phone for follow-up"
        className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg"
       />

       <textarea
        value={note}
        onChange={(event) =>
         setNote(event.target.value)
        }
        placeholder="Optional note"
        rows={3}
        className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg resize-none"
       />

       <div>
        <label className="block text-sm text-zinc-400 mb-2">
         Upload payment screenshot / receipt
        </label>
        <input
         type="file"
         accept="image/*"
         onChange={(event) => {
          const file =
           event.target.files?.[0] || null;
          setProofFile(file);
          setProofPreview(
           file ? URL.createObjectURL(file) : ""
          );
         }}
         className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg"
        />
        {proofPreview && (
         <img
          src={proofPreview}
          alt="Payment proof preview"
          className="mt-3 w-full max-w-xs rounded-lg border border-zinc-700"
         />
        )}
       </div>

       <button
        disabled={loading || submitting}
        className="bg-yellow-400 text-black p-4 rounded-lg font-bold disabled:opacity-60"
       >
        {submitting
         ? "Submitting..."
         : "Submit Payment Details"}
       </button>
      </form>
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
          <p
           className={`mt-3 ${
            plan.highlight
             ? "text-zinc-600"
             : "text-zinc-400"
           }`}
          >
           {plan.audience}
          </p>
         </div>

         <div className="text-5xl font-bold">
          {plan.price}
         </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
         <button
          onClick={() =>
           openPaymentLink(
            plan,
            "paypal"
           )
          }
          disabled={loading || submitting}
          className={`w-full p-4 rounded-lg font-bold disabled:opacity-60 ${
           plan.highlight
            ? "bg-black text-white"
            : "bg-yellow-400 text-black"
          }`}
         >
          PayPal - {plan.price}
         </button>

         <button
          onClick={() =>
           openPaymentLink(plan, "upi")
          }
          disabled={loading || submitting}
          className={`w-full p-4 rounded-lg font-bold border disabled:opacity-60 ${
           plan.highlight
            ? "border-zinc-300 text-black"
            : "border-zinc-700 text-white"
          }`}
         >
          UPI
         </button>
        </div>

        <p
         className={`text-sm mb-5 ${
          plan.highlight
           ? "text-zinc-600"
           : "text-zinc-400"
         }`}
        >
         Activation can take up to 1 day after payment review.
        </p>

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

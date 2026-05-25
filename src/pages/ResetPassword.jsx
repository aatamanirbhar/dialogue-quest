import React, {
 useEffect,
 useState
} from "react";
import { useNavigate } from "react-router-dom";
import {
 signOutAccount,
 updatePassword
} from "../lib/account";
import {
 supabase,
 consumeAuthCodeFromUrl
} from "../lib/supabase";

const getUrlAuthMessage = () => {
 const searchParams = new URLSearchParams(
  window.location.search
 );
 const hashParams = new URLSearchParams(
  window.location.hash.replace(/^#/, "")
 );

 return (
  searchParams.get("error_description") ||
  hashParams.get("error_description") ||
  searchParams.get("error") ||
  hashParams.get("error") ||
  ""
 );
};

export default function ResetPassword() {
 const navigate = useNavigate();
 const [loading, setLoading] = useState(true);
 const [ready, setReady] = useState(false);
 const [password, setPassword] = useState("");
 const [confirmPassword, setConfirmPassword] =
  useState("");
 const [message, setMessage] = useState("");
 const [submitting, setSubmitting] =
  useState(false);
 const [success, setSuccess] = useState(false);

 useEffect(() => {
  let active = true;
  const urlMessage = getUrlAuthMessage();

  if (urlMessage) {
   setMessage(urlMessage);
   setLoading(false);
   return () => {
    active = false;
   };
  }

  const markReady = (nextMessage) => {
   if (!active) return;

   setReady(true);
   setMessage(
    nextMessage ||
     "Reset link verified. Choose a new password."
   );
   setLoading(false);
  };

  const verifyLink = async () => {
   try {
    const { session } =
     await consumeAuthCodeFromUrl();

    if (!active) return;

    if (session) {
     markReady();
     return;
    }
   } catch (error) {
    if (!active) return;

    setMessage(
     error.message ||
      "This reset link is no longer valid. Request a new one and try again."
    );
    setLoading(false);
    return;
   }

   const { data, error } =
    await supabase.auth.getSession();

   if (!active) return;

   if (error) {
    setMessage(error.message);
    setLoading(false);
    return;
   }

   if (data.session) {
    markReady();
    return;
   }

   setMessage(
    "Open the password reset link from your email to continue."
   );
   setLoading(false);
  };

  const { data: authListener } =
   supabase.auth.onAuthStateChange(
    (event, session) => {
     if (!active) return;

     if (event === "PASSWORD_RECOVERY") {
      markReady(
       "Reset link verified. Choose a new password."
      );
      return;
     }

     if (
      (event === "INITIAL_SESSION" ||
       event === "SIGNED_IN") &&
      session
     ) {
      markReady();
     }
    }
   );

  verifyLink();

  return () => {
   active = false;
   authListener.subscription.unsubscribe();
  };
 }, []);

 const submitReset = async (event) => {
  event.preventDefault();

  if (!ready) {
   setMessage(
    "Open the password reset link from your email to continue."
   );
   return;
  }

  if (!password) {
   setMessage("Enter your new password.");
   return;
  }

  if (password.length < 6) {
   setMessage(
    "Use at least 6 characters for your new password."
   );
   return;
  }

  if (password !== confirmPassword) {
   setMessage("Both password fields must match.");
   return;
  }

  setSubmitting(true);
  setMessage("");

  try {
   await updatePassword(password);
   await signOutAccount();
   setPassword("");
   setConfirmPassword("");
   setSuccess(true);
   setMessage(
    "Password updated. Log in with your new password."
   );
  } catch (error) {
   setMessage(error.message);
  } finally {
   setSubmitting(false);
  }
 };

 return (
  <div className="min-h-screen bg-black text-white flex items-center justify-center p-5">
   <div className="w-full max-w-lg">
    <button
     type="button"
     onClick={() => navigate("/")}
     className="bg-zinc-900 border border-zinc-800 px-5 py-3 rounded-lg font-bold mb-6"
    >
     Home
    </button>

    <form
     onSubmit={submitReset}
     className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8"
    >
     <p className="text-yellow-400 uppercase tracking-[0.25em] text-sm mb-3">
      Password Reset
     </p>

     <h1 className="text-4xl sm:text-5xl font-bold mb-5">
      Choose a new password
     </h1>

     <p className="text-zinc-400 leading-relaxed mb-6">
      Use the reset link from your email, then set a fresh password for your Dialogue Quest account.
     </p>

     {message && (
      <div
       className={`border rounded-lg p-4 mb-5 ${
        success
         ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
         : "border-yellow-500/40 bg-yellow-500/10 text-yellow-100"
       }`}
      >
       {message}
      </div>
     )}

     {loading ? (
      <p className="text-zinc-400">
       Checking reset link...
      </p>
     ) : success ? (
      <button
       type="button"
       onClick={() =>
        navigate("/multiplayer?auth=signin", {
         replace: true
        })
       }
       className="w-full bg-yellow-400 text-black p-4 rounded-lg font-bold"
      >
       Go to Login
      </button>
     ) : (
      <>
       <input
        value={password}
        onChange={(event) =>
         setPassword(event.target.value)
        }
        placeholder="New password"
        type="password"
        disabled={!ready || submitting}
        className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5 disabled:opacity-60"
       />

       <input
        value={confirmPassword}
        onChange={(event) =>
         setConfirmPassword(
          event.target.value
         )
        }
        placeholder="Confirm new password"
        type="password"
        disabled={!ready || submitting}
        className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-5 disabled:opacity-60"
       />

       <button
        type="submit"
        disabled={!ready || submitting}
        className="w-full bg-yellow-400 text-black p-4 rounded-lg font-bold disabled:opacity-60"
       >
        {submitting
         ? "Updating..."
         : "Update Password"}
       </button>

       <button
        type="button"
        onClick={() =>
         navigate("/multiplayer?auth=signin")
        }
        className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg font-bold mt-4"
       >
        Back to Login
       </button>
      </>
     )}
    </form>
   </div>
  </div>
 );
}

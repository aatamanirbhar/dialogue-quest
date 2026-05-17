import React, {
 useEffect,
 useState
} from "react";
import { useNavigate } from "react-router-dom";
import {
 getAccount,
 updateEmail,
 updatePassword,
 updateProfile,
 uploadAvatar
} from "../lib/account";

export default function ProfileEdit() {
 const navigate = useNavigate();
 const [account, setAccount] = useState(null);
 const [name, setName] = useState("");
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [avatarUrl, setAvatarUrl] = useState("");
 const [message, setMessage] = useState("");
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [uploading, setUploading] = useState(false);

 useEffect(() => {
  let active = true;

  const loadAccount = async () => {
   const nextAccount = await getAccount();

   if (!active) return;

   if (!nextAccount) {
    navigate("/multiplayer?auth=signin");
    return;
   }

   setAccount(nextAccount);
   setName(nextAccount.name || "");
   setEmail(nextAccount.email || "");
   setAvatarUrl(nextAccount.avatarUrl || "");
   setLoading(false);
  };

  loadAccount();

  return () => {
   active = false;
  };
 }, [navigate]);

 const saveProfile = async (event) => {
  event.preventDefault();
  setSaving(true);
  setMessage("");

  try {
   let nextAccount = await updateProfile({
    name,
    avatarUrl
   });

   if (
    email.trim() &&
    email.trim() !== account.email
   ) {
    nextAccount = await updateEmail(email);
    setMessage(
     "Profile saved. Check your new email inbox to confirm the email change."
    );
   } else {
    setMessage("Profile saved.");
   }

   if (password) {
    await updatePassword(password);
    setPassword("");
    setMessage(
     "Profile saved and password updated."
    );
   }

   setAccount(nextAccount);
  } catch (error) {
   setMessage(error.message);
  } finally {
   setSaving(false);
  }
 };

 const uploadProfileAvatar = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  setUploading(true);
  setMessage("");

  try {
   const publicUrl = await uploadAvatar(file);
   setAvatarUrl(publicUrl);
   setMessage("Profile picture ready. Save to keep it.");
  } catch (error) {
   setMessage(error.message);
  } finally {
   setUploading(false);
   event.target.value = "";
  }
 };

 if (loading) {
  return (
   <div className="min-h-screen bg-black text-white flex items-center justify-center">
    Loading profile...
   </div>
  );
 }

 return (
  <div className="min-h-screen bg-black text-white p-5 sm:p-10">
   <div className="max-w-2xl mx-auto">
    <button
     onClick={() => navigate(-1)}
     className="bg-zinc-900 border border-zinc-800 px-5 py-3 rounded-lg font-bold mb-8"
    >
     Back
    </button>

    <form
     onSubmit={saveProfile}
     className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8"
    >
     <p className="text-yellow-400 uppercase tracking-[0.25em] text-sm mb-3">
      Edit Profile
     </p>
     <h1 className="text-4xl font-bold mb-6">
      Your details
     </h1>

     <div className="flex items-center gap-4 mb-6">
      <div className="h-20 w-20 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center text-3xl font-bold">
       {avatarUrl ? (
        <img
         src={avatarUrl}
         alt={name || "Profile"}
         className="h-full w-full object-cover"
        />
       ) : (
        (name || email || "P")
         .charAt(0)
         .toUpperCase()
       )}
      </div>
      <input
       type="file"
       accept="image/*"
       onChange={uploadProfileAvatar}
       disabled={uploading}
       className="flex-1 bg-zinc-800 border border-zinc-700 p-4 rounded-lg disabled:opacity-60"
      />
     </div>

     <input
      value={name}
      onChange={(event) =>
       setName(event.target.value)
      }
      placeholder="Display name"
      className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-4"
     />
     <input
      value={email}
      onChange={(event) =>
       setEmail(event.target.value)
      }
      type="email"
      placeholder="Email"
      className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-4"
     />
     <input
      value={password}
      onChange={(event) =>
       setPassword(event.target.value)
      }
      type="password"
      placeholder="New password"
      className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg mb-4"
     />

     <button
      disabled={saving}
      className="w-full bg-yellow-400 text-black p-4 rounded-lg font-bold disabled:opacity-60"
     >
      {saving ? "Saving..." : "Save profile"}
     </button>

     {message && (
      <p className="text-zinc-300 mt-4">
       {message}
      </p>
     )}
    </form>
   </div>
  </div>
 );
}

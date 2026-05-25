import React, {
 useEffect,
 useState
} from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getAccount } from "../lib/account";
import { LYRICS_LANGUAGES } from "../components/LyricsLanguageModal";

const EMPTY_FORM = {
 prompt: "",
 answer: "",
 fetch_by: "english",
 options: "",
 trivia_fact: "",
 sort_order: "",
 is_active: true,
 poster_url: ""
};

const formatOptionsForEdit = (rawOptions) => {
 if (!rawOptions) return "";

 if (Array.isArray(rawOptions)) {
  return rawOptions.join("\n");
 }

 if (typeof rawOptions === "string") {
  try {
   const parsed = JSON.parse(rawOptions);
   if (Array.isArray(parsed)) {
    return parsed.join("\n");
   }
  } catch {
   return rawOptions.split("|").join("\n");
  }
 }

 return "";
};

const entryToForm = (entry) => ({
 prompt: entry.prompt || entry.dialogue || "",
 answer: entry.answer || "",
 fetch_by: entry.fetch_by || "english",
 options: formatOptionsForEdit(entry.options),
 trivia_fact: entry.trivia_fact || "",
 sort_order:
  entry.sort_order === null ||
  entry.sort_order === undefined
   ? ""
   : String(entry.sort_order),
 is_active: entry.is_active !== false,
 poster_url: entry.poster_url || ""
});

const uploadPoster = async (
 file,
 { userId }
) => {
 if (!file) return "";

 const extension =
  (file.name?.split(".").pop() || "jpg")
   .toLowerCase();
 const safeUser = userId || "anon";
 const stamp = Date.now();
 const filePath = `${safeUser}/${stamp}.${extension}`;

 const { error: uploadError } =
  await supabase.storage
   .from("posters")
   .upload(filePath, file, {
    cacheControl: "3600",
    upsert: true,
    contentType:
     file.type || "image/jpeg"
   });

 if (uploadError) throw uploadError;

 const { data } = supabase.storage
  .from("posters")
  .getPublicUrl(filePath);

 return data?.publicUrl || "";
};

const parseOptions = (rawOptions) => {
 const trimmed = String(rawOptions || "").trim();

 if (!trimmed) return null;

 const parts = trimmed
  .split(/\r?\n|\|/)
  .map((value) => value.trim())
  .filter(Boolean);

 if (!parts.length) return null;

 return parts;
};

export default function LyricsAdmin() {
 const navigate = useNavigate();
 const [account, setAccount] = useState(null);
 const [loadingAccount, setLoadingAccount] =
  useState(true);
 const [form, setForm] = useState(EMPTY_FORM);
 const [editingId, setEditingId] = useState(null);
 const [posterFile, setPosterFile] =
  useState(null);
 const [posterPreview, setPosterPreview] =
  useState("");
 const [submitting, setSubmitting] =
  useState(false);
 const [statusMessage, setStatusMessage] =
  useState(null);
 const [entries, setEntries] = useState([]);
 const [entriesLoading, setEntriesLoading] =
  useState(true);
 const [filterLanguage, setFilterLanguage] =
  useState("all");

 useEffect(() => {
  let active = true;

  const load = async () => {
   const nextAccount = await getAccount();
   if (!active) return;
   setAccount(nextAccount);
   setLoadingAccount(false);
  };

  load();

  return () => {
   active = false;
  };
 }, []);

 useEffect(() => {
  return () => {
   if (posterPreview?.startsWith("blob:")) {
    URL.revokeObjectURL(posterPreview);
   }
  };
 }, [posterPreview]);

 const loadEntries = async () => {
  setEntriesLoading(true);

  let query = supabase
   .from("lyrics_questions")
   .select("*")
   .order("created_at", {
    ascending: false
   })
   .limit(100);

  if (filterLanguage !== "all") {
   query = query.eq("fetch_by", filterLanguage);
  }

  let { data, error } = await query;

  if (
   error &&
   /created_at|schema cache|column/i.test(
    error.message || ""
   )
  ) {
   const fallback = await (
    filterLanguage === "all"
     ? supabase
        .from("lyrics_questions")
        .select("*")
        .limit(100)
     : supabase
        .from("lyrics_questions")
        .select("*")
        .eq("fetch_by", filterLanguage)
        .limit(100)
   );

   data = fallback.data;
   error = fallback.error;
  }

  if (error) {
   console.error(error);
   setStatusMessage({
    tone: "error",
    text: `Could not load entries: ${error.message}`
   });
   setEntries([]);
  } else {
   setEntries(data || []);
  }

  setEntriesLoading(false);
 };

 useEffect(() => {
  loadEntries();
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
 }, [filterLanguage]);

 const onField = (field, value) => {
  setForm((current) => ({
   ...current,
   [field]: value
  }));
 };

 const onPosterChange = (event) => {
  const file = event.target.files?.[0] || null;

  setPosterFile(file);
  setPosterPreview(
   file ? URL.createObjectURL(file) : ""
  );
 };

 const resetForm = () => {
  setForm(EMPTY_FORM);
  setPosterFile(null);
  setPosterPreview("");
  setEditingId(null);
 };

 const startEdit = (entry) => {
  setForm(entryToForm(entry));
  setPosterFile(null);
  setPosterPreview("");
  setEditingId(entry.id);
  setStatusMessage(null);
  window.scrollTo({ top: 0, behavior: "smooth" });
 };

 const handleSubmit = async (event) => {
  event.preventDefault();
  setStatusMessage(null);

  if (!form.prompt.trim()) {
   setStatusMessage({
    tone: "error",
    text: "Prompt is required."
   });
   return;
  }

  if (!form.answer.trim()) {
   setStatusMessage({
    tone: "error",
    text: "Answer is required."
   });
   return;
  }

  setSubmitting(true);

  try {
   let posterUrl = form.poster_url.trim();

   if (posterFile) {
    posterUrl = await uploadPoster(posterFile, {
     userId: account?.id
    });
   }

   const payload = {
    prompt: form.prompt.trim(),
    answer: form.answer.trim(),
    fetch_by: form.fetch_by,
    options: parseOptions(form.options),
    trivia_fact:
     form.trivia_fact.trim() || null,
    sort_order: form.sort_order
     ? Number(form.sort_order)
     : null,
    is_active: Boolean(form.is_active),
    poster_url: posterUrl || null
   };

   if (editingId) {
    const { error } = await supabase
     .from("lyrics_questions")
     .update(payload)
     .eq("id", editingId);

    if (error) throw error;

    setStatusMessage({
     tone: "success",
     text: "Lyrics question updated."
    });
   } else {
    const { error } = await supabase
     .from("lyrics_questions")
     .insert(payload);

    if (error) throw error;

    setStatusMessage({
     tone: "success",
     text: "Lyrics question added."
    });
   }

   resetForm();
   loadEntries();
  } catch (error) {
   console.error(error);
   setStatusMessage({
    tone: "error",
    text:
     error.message ||
     "Could not save the entry."
   });
  } finally {
   setSubmitting(false);
  }
 };

 const toggleActive = async (entry) => {
  const { error } = await supabase
   .from("lyrics_questions")
   .update({
    is_active: !entry.is_active
   })
   .eq("id", entry.id);

  if (error) {
   setStatusMessage({
    tone: "error",
    text: `Toggle failed: ${error.message}`
   });
   return;
  }

  loadEntries();
 };

 const deleteEntry = async (entry) => {
  if (
   !window.confirm(
    `Delete "${entry.prompt?.slice(0, 60) || ""}"?`
   )
  ) {
   return;
  }

  const { error } = await supabase
   .from("lyrics_questions")
   .delete()
   .eq("id", entry.id);

  if (error) {
   setStatusMessage({
    tone: "error",
    text: `Delete failed: ${error.message}`
   });
   return;
  }

  loadEntries();
 };

 if (loadingAccount) {
  return (
   <div className="min-h-screen bg-black text-white flex items-center justify-center">
    Loading admin...
   </div>
  );
 }

 if (!account) {
  return (
   <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 text-center">
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-lg">
     <h1 className="text-3xl font-bold mb-4">
      Sign in required
     </h1>
     <p className="text-zinc-400 mb-6">
      You need an account to add lyrics entries.
     </p>
     <button
      onClick={() => navigate("/multiplayer?auth=signin")}
      className="bg-yellow-400 text-black px-6 py-3 rounded-lg font-bold"
     >
      Login
     </button>
    </div>
   </div>
  );
 }

 return (
  <div className="min-h-screen bg-black text-white p-5 sm:p-8">
   <div className="max-w-5xl mx-auto">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
     <div>
      <p className="text-yellow-400 uppercase tracking-[0.25em] text-xs mb-2">
       Admin
      </p>
      <h1 className="text-4xl sm:text-5xl font-bold">
       Lyrics Questions
      </h1>
      <p className="text-zinc-400 mt-2">
       Add entries, upload posters, control the playable catalog.
      </p>
     </div>
     <button
      onClick={() => navigate("/categories")}
      className="bg-zinc-900 border border-zinc-800 px-5 py-3 rounded-lg font-bold"
     >
      Back
     </button>
    </div>

    {statusMessage && (
     <div
      className={`rounded-lg p-4 mb-6 border ${
       statusMessage.tone === "success"
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
        : "border-red-500/40 bg-red-500/10 text-red-100"
      }`}
     >
      {statusMessage.text}
     </div>
    )}

    <form
     onSubmit={handleSubmit}
     className="grid gap-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 mb-10"
    >
     <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-2xl font-bold">
       {editingId ? "Edit entry" : "Add a new entry"}
      </h2>
      {editingId && (
       <span className="text-xs uppercase tracking-[0.2em] text-yellow-300 border border-yellow-500/40 rounded-full px-3 py-1">
        Editing #{String(editingId).slice(0, 8)}
       </span>
      )}
     </div>
     <div className="grid sm:grid-cols-[1fr_180px] gap-4">
      <div>
       <label className="block text-sm uppercase tracking-[0.2em] text-zinc-500 mb-2">
        Prompt / lyric line
       </label>
       <textarea
        value={form.prompt}
        onChange={(event) =>
         onField("prompt", event.target.value)
        }
        rows={3}
        placeholder="Example: Tum hi ho, ab tum hi ho, ____"
        className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg resize-none"
       />
      </div>
      <div>
       <label className="block text-sm uppercase tracking-[0.2em] text-zinc-500 mb-2">
        Language (fetch_by)
       </label>
       <select
        value={form.fetch_by}
        onChange={(event) =>
         onField("fetch_by", event.target.value)
        }
        className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg capitalize"
       >
        {LYRICS_LANGUAGES.map((language) => (
         <option key={language} value={language}>
          {language}
         </option>
        ))}
       </select>
      </div>
     </div>

     <div className="grid sm:grid-cols-2 gap-4">
      <div>
       <label className="block text-sm uppercase tracking-[0.2em] text-zinc-500 mb-2">
        Answer
       </label>
       <input
        value={form.answer}
        onChange={(event) =>
         onField("answer", event.target.value)
        }
        placeholder="Correct answer"
        className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg"
       />
      </div>
      <div>
       <label className="block text-sm uppercase tracking-[0.2em] text-zinc-500 mb-2">
        Sort order
       </label>
       <input
        value={form.sort_order}
        onChange={(event) =>
         onField(
          "sort_order",
          event.target.value
         )
        }
        type="number"
        placeholder="Optional, lower = earlier"
        className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg"
       />
      </div>
     </div>

     <div>
      <label className="block text-sm uppercase tracking-[0.2em] text-zinc-500 mb-2">
       Options (one per line, or pipe-separated)
      </label>
      <textarea
       value={form.options}
       onChange={(event) =>
        onField("options", event.target.value)
       }
       rows={3}
       placeholder="Option A\nOption B\nOption C\nOption D"
       className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg resize-none"
      />
      <p className="text-zinc-500 text-xs mt-2">
       Leave empty to use a free-text input instead of multiple choice.
      </p>
     </div>

     <div>
      <label className="block text-sm uppercase tracking-[0.2em] text-zinc-500 mb-2">
       Trivia fact
      </label>
      <textarea
       value={form.trivia_fact}
       onChange={(event) =>
        onField(
         "trivia_fact",
         event.target.value
        )
       }
       rows={2}
       placeholder="Shown on the trivia screen after the answer."
       className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg resize-none"
      />
     </div>

     <div className="grid sm:grid-cols-2 gap-4">
      <div>
       <label className="block text-sm uppercase tracking-[0.2em] text-zinc-500 mb-2">
        Poster upload (bucket: posters)
       </label>
       <input
        type="file"
        accept="image/*"
        onChange={onPosterChange}
        className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg"
       />
       {posterPreview && (
        <img
         src={posterPreview}
         alt="Poster preview"
         className="mt-3 w-full max-w-xs rounded-lg border border-zinc-700"
        />
       )}
      </div>
      <div>
       <label className="block text-sm uppercase tracking-[0.2em] text-zinc-500 mb-2">
        Or paste poster URL
       </label>
       <input
        value={form.poster_url}
        onChange={(event) =>
         onField(
          "poster_url",
          event.target.value
         )
        }
        placeholder="https://..."
        className="w-full bg-zinc-800 border border-zinc-700 p-4 rounded-lg"
       />
       <p className="text-zinc-500 text-xs mt-2">
        If you upload a file, the public URL replaces this value.
       </p>
      </div>
     </div>

     <label className="flex items-center gap-3">
      <input
       type="checkbox"
       checked={form.is_active}
       onChange={(event) =>
        onField(
         "is_active",
         event.target.checked
        )
       }
       className="h-5 w-5"
      />
      <span className="text-zinc-300">
       Active (playable in the game)
      </span>
     </label>

     <div className="flex flex-wrap gap-3">
      <button
       type="submit"
       disabled={submitting}
       className="bg-yellow-400 text-black px-6 py-3 rounded-lg font-bold disabled:opacity-60"
      >
       {submitting
        ? "Saving..."
        : editingId
         ? "Update Entry"
         : "Save Entry"}
      </button>
      <button
       type="button"
       onClick={resetForm}
       className="bg-zinc-800 border border-zinc-700 px-6 py-3 rounded-lg font-bold"
      >
       {editingId ? "Cancel Edit" : "Reset"}
      </button>
     </div>
    </form>

    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
     <h2 className="text-2xl font-bold">
      Existing entries ({entries.length})
     </h2>
     <select
      value={filterLanguage}
      onChange={(event) =>
       setFilterLanguage(event.target.value)
      }
      className="bg-zinc-800 border border-zinc-700 p-3 rounded-lg capitalize"
     >
      <option value="all">All languages</option>
      {LYRICS_LANGUAGES.map((language) => (
       <option key={language} value={language}>
        {language}
       </option>
      ))}
     </select>
    </div>

    {entriesLoading ? (
     <p className="text-zinc-400">Loading...</p>
    ) : entries.length === 0 ? (
     <p className="text-zinc-500">
      No entries yet for this filter.
     </p>
    ) : (
     <div className="grid gap-3">
      {entries.map((entry) => (
       <div
        key={entry.id}
        className={`bg-zinc-900 border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 ${
         editingId === entry.id
          ? "border-yellow-400"
          : "border-zinc-800"
        }`}
       >
        {entry.poster_url && (
         <img
          src={entry.poster_url}
          alt={entry.answer || "Poster"}
          className="h-24 w-24 object-cover rounded-lg border border-zinc-700"
         />
        )}
        <div className="flex-1 min-w-0">
         <div className="flex flex-wrap gap-2 mb-2">
          <span className="text-xs uppercase tracking-[0.2em] text-yellow-300 border border-yellow-500/40 rounded-full px-3 py-1 capitalize">
           {entry.fetch_by || "no language"}
          </span>
          <span
           className={`text-xs uppercase tracking-[0.2em] rounded-full px-3 py-1 border ${
            entry.is_active
             ? "text-emerald-300 border-emerald-500/40"
             : "text-zinc-400 border-zinc-700"
           }`}
          >
           {entry.is_active ? "Active" : "Hidden"}
          </span>
         </div>
         <p className="font-bold text-lg break-words">
          {entry.prompt}
         </p>
         <p className="text-yellow-300 text-sm mt-1">
          Answer: {entry.answer}
         </p>
         {entry.trivia_fact && (
          <p className="text-zinc-400 text-sm mt-2">
           {entry.trivia_fact}
          </p>
         )}
        </div>
        <div className="flex sm:flex-col gap-2">
         <button
          onClick={() => startEdit(entry)}
          className="bg-yellow-400 text-black px-4 py-2 rounded-lg font-bold text-sm"
         >
          Edit
         </button>
         <button
          onClick={() => toggleActive(entry)}
          className="bg-zinc-800 border border-zinc-700 px-4 py-2 rounded-lg font-bold text-sm"
         >
          {entry.is_active ? "Hide" : "Activate"}
         </button>
         <button
          onClick={() => deleteEntry(entry)}
          className="bg-red-500/20 border border-red-500/40 text-red-200 px-4 py-2 rounded-lg font-bold text-sm"
         >
          Delete
         </button>
        </div>
       </div>
      ))}
     </div>
    )}
   </div>
  </div>
 );
}

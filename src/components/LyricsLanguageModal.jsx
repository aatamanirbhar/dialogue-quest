import React from "react";

const LANGUAGES = [
 {
  value: "english",
  label: "English",
  hint: "International lyrics catalog",
  accent: "from-amber-300 to-yellow-500"
 },
 {
  value: "hindi",
  label: "Hindi",
  hint: "Bollywood and indie Hindi tracks",
  accent: "from-rose-400 to-orange-500"
 },
 {
  value: "punjabi",
  label: "Punjabi",
  hint: "Punjabi pop, folk and rap",
  accent: "from-emerald-400 to-cyan-500"
 }
];

export default function LyricsLanguageModal({
 open,
 onClose,
 onSelect,
 title = "Pick your lyrics language",
 subtitle = "Questions will be fetched from that language only.",
 dismissable = true
}) {
 if (!open) return null;

 return (
  <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
   <div className="w-full max-w-xl bg-zinc-950 border border-yellow-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl my-6">
    <div className="flex items-start justify-between gap-3 mb-5">
     <div>
      <p className="text-yellow-400 uppercase tracking-[0.25em] text-xs mb-2">
       Complete the Lyrics
      </p>
      <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
       {title}
      </h2>
      <p className="text-zinc-400 mt-3">
       {subtitle}
      </p>
     </div>
     {dismissable && (
      <button
       onClick={onClose}
       className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-700 font-bold"
       aria-label="Close"
      >
       x
      </button>
     )}
    </div>

    <div className="grid gap-3">
     {LANGUAGES.map((language) => (
      <button
       key={language.value}
       type="button"
       onClick={() => onSelect(language.value)}
       className={`group relative overflow-hidden rounded-2xl p-5 text-left bg-gradient-to-r ${language.accent} text-black font-bold shadow-lg`}
      >
       <div className="flex items-center justify-between gap-3">
        <div>
         <span className="block text-2xl sm:text-3xl">
          {language.label}
         </span>
         <span className="block text-sm font-medium opacity-80 mt-1">
          {language.hint}
         </span>
        </div>
        <span className="text-2xl">{">"}</span>
       </div>
      </button>
     ))}
    </div>

    <p className="text-zinc-500 text-xs mt-5">
     You can pick another language any time by starting a new game.
    </p>
   </div>
  </div>
 );
}

export const LYRICS_LANGUAGES = LANGUAGES.map(
 (item) => item.value
);

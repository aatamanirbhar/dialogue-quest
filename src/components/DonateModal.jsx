import React from "react";
import qrCodeUrl from "/qr.jpeg?url";

const PAYPAL_TARGET = "paypal.me/vikas117";
const PAYPAL_LINK = `https://${PAYPAL_TARGET}`;
const UPI_ID = "8949720403@ptyes";
const SUPPORT_EMAIL = "jkjkjkheyhey@gmail.com";

export default function DonateModal({ open, onClose }) {
 if (!open) return null;

 const copyUpi = async () => {
  try {
   await navigator.clipboard.writeText(UPI_ID);
  } catch {
   /* ignore */
  }
 };

 return (
  <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
   <div className="w-full max-w-lg bg-zinc-950 border border-yellow-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl my-6">
    <div className="flex items-center justify-between gap-3 mb-5">
     <div>
      <p className="text-yellow-400 uppercase tracking-[0.25em] text-xs mb-2">
       Support the game
      </p>
      <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
       Buy us a chai
      </h2>
     </div>
     <button
      onClick={onClose}
      className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-700 font-bold"
      aria-label="Close donate"
     >
      x
     </button>
    </div>

    <p className="text-zinc-400 leading-relaxed mb-6">
     Dialogue Quest is free for everyone. If it made you smile, drop a tip - it keeps the servers up and the new categories coming.
    </p>

    <div className="grid gap-4 mb-5">
     <a
      href={PAYPAL_LINK}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-yellow-400 text-black p-4 rounded-xl font-bold flex items-center justify-between gap-3"
     >
      <span>PayPal</span>
      <span className="text-sm font-normal text-zinc-700">
       {PAYPAL_TARGET}
      </span>
     </a>

     <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
       <span className="font-bold">UPI</span>
       <button
        onClick={copyUpi}
        type="button"
        className="text-xs uppercase tracking-[0.2em] bg-zinc-800 border border-zinc-700 rounded-full px-3 py-1 font-bold"
       >
        Copy ID
       </button>
      </div>
      <p className="text-yellow-300 font-bold break-all mb-3">
       {UPI_ID}
      </p>
      <img
       src={qrCodeUrl}
       alt="UPI QR code"
       className="w-full max-w-[220px] mx-auto rounded-lg border border-zinc-700 bg-white"
      />
     </div>
    </div>

    <p className="text-zinc-500 text-xs">
     Any trouble? Mail {SUPPORT_EMAIL}.
    </p>
   </div>
  </div>
 );
}

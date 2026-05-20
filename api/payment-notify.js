import {
 createClient
} from "@supabase/supabase-js";

const readBody = async (request) => {
 const chunks = [];

 for await (const chunk of request) {
  chunks.push(chunk);
 }

 const text = Buffer.concat(chunks).toString();

 try {
  return text ? JSON.parse(text) : {};
 } catch {
  const error = new Error(
   "Invalid payment submission format."
  );
  error.statusCode = 400;
  throw error;
 }
};

const sendJson = (response, status, body) => {
 response.statusCode = status;
 response.setHeader(
  "Content-Type",
  "application/json"
 );
 response.end(JSON.stringify(body));
};

const getSupabase = (authHeader = "") => {
 const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;
 const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;
 const anonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;
 const key = serviceRoleKey || anonKey;

 if (!supabaseUrl || !key) {
  return null;
 }

 const options = {
  auth: {
   persistSession: false
  }
 };

 if (!serviceRoleKey && authHeader) {
  options.global = {
   headers: {
    Authorization: authHeader
   }
  };
 }

 return createClient(supabaseUrl, key, options);
};

const sendTelegramNotification = async (
 text
) => {
 const botToken =
  (process.env.TELEGRAM_BOT_TOKEN || "").trim();
 const chatId =
  (process.env.TELEGRAM_CHAT_ID || "").trim();

 if (!botToken || !chatId) {
  return {
   sent: false,
   reason: "Telegram is not configured."
  };
 }

 const telegramResponse = await fetch(
  `https://api.telegram.org/bot${botToken}/sendMessage`,
  {
   method: "POST",
   headers: {
    "Content-Type": "application/json"
   },
   body: JSON.stringify({
    chat_id: chatId,
    text
   })
  }
 );

 if (!telegramResponse.ok) {
  const responseText =
   await telegramResponse.text();
  let payload = {};

  try {
   payload = responseText
    ? JSON.parse(responseText)
    : {};
  } catch {
   payload = {};
  }

  throw new Error(
   payload.description ||
    responseText ||
    "Telegram notification failed."
  );
 }

 return {
  sent: true
 };
};

export default async function handler(
 request,
 response
) {
 response.setHeader(
  "Access-Control-Allow-Origin",
  "*"
 );
 response.setHeader(
  "Access-Control-Allow-Methods",
  "POST, OPTIONS"
 );
 response.setHeader(
  "Access-Control-Allow-Headers",
  "Content-Type, Authorization"
 );

 if (request.method === "OPTIONS") {
  sendJson(response, 200, {
   ok: true
  });
  return;
 }

 if (request.method !== "POST") {
  sendJson(response, 405, {
   message: "Method not allowed"
  });
  return;
 }

 try {
  const body = await readBody(request);

  if (
   !body.userId ||
   !body.email ||
   !body.requestedPlan ||
   !body.transactionId
  ) {
   sendJson(response, 400, {
    message:
     "Missing payment submission details."
   });
   return;
  }

  const note = [
   `Requested plan: ${body.requestedPlanName}`,
   `Amount: $${body.amount}`,
   `UPI amount: Rs ${body.upiAmount || "N/A"}`,
   `Method: ${body.paymentMethod || "paypal"}`,
   `Transaction: ${body.transactionId}`,
   `Payer: ${body.payerName || "Not provided"}`,
   `Contact: ${body.contact || "Not provided"}`,
   body.proofUploadError
    ? `Proof upload failed: ${body.proofUploadError}`
    : "",
   `Note: ${body.note || "None"}`
  ].filter(Boolean).join("\n");
  const supabase = getSupabase(
   request.headers.authorization ||
    request.headers.Authorization
  );
  let serverSave = {
   saved: false,
   reason:
    "Supabase server credentials are not configured."
  };

  if (supabase) {
   const submission = {
    id: body.submissionId || undefined,
    user_id: body.userId,
    email: body.email,
    name: body.name || null,
    current_plan: body.currentPlan || null,
    requested_plan: body.requestedPlan,
    requested_plan_name:
     body.requestedPlanName || null,
    amount: Number(body.amount || 0),
    upi_amount: Number(body.upiAmount || 0),
    payment_method:
     body.paymentMethod || "paypal",
    transaction_id: body.transactionId,
    payer_name: body.payerName || null,
    contact: body.contact || null,
    note: [
     body.note || "",
     body.proofUploadError
      ? `Proof upload failed: ${body.proofUploadError}`
      : ""
    ].filter(Boolean).join("\n") || null,
    proof_url: body.proofUrl || null,
    status: "pending_review"
   };

   const { error: submissionError } =
    await supabase
     .from("payment_submissions")
     .insert(submission);

   if (
    submissionError &&
    !/duplicate key/i.test(
     submissionError.message || ""
    )
   ) {
    serverSave = {
     saved: false,
     reason: submissionError.message
    };
   } else {
    serverSave = {
     saved: true,
     table: "payment_submissions"
    };
   }

   const { error } = await supabase
    .from("profiles")
    .upsert({
     id: body.userId,
     email: body.email,
     name: body.name || null,
     payment_status: "pending_review",
     paid_plan: body.requestedPlan,
     paid_amount: Number(body.amount),
     payment_provider:
      body.paymentMethod === "upi"
       ? "upi_manual"
       : "paypal_manual",
     payment_order_id:
      body.transactionId,
     payment_note: note
    }, {
     onConflict: "id"
    });

   if (error) {
    serverSave = {
     ...serverSave,
     profileSaved: false,
     profileReason: error.message
    };
   } else {
    serverSave = {
     ...serverSave,
     profileSaved: true
    };
   }
  }

  const notificationText = [
   "New premium payment submitted",
   `Name: ${body.name || "Unknown"}`,
   `Email: ${body.email}`,
   `User ID: ${body.userId}`,
   `Current plan: ${body.currentPlan || "unknown"}`,
   `Requested plan: ${body.requestedPlanName}`,
   `Amount: $${body.amount}`,
   `UPI amount: Rs ${body.upiAmount || "N/A"}`,
   `Method: ${body.paymentMethod || "paypal"}`,
   `Transaction: ${body.transactionId}`,
   `Payer: ${body.payerName || "Not provided"}`,
   `Contact: ${body.contact || "Not provided"}`,
   `Proof: ${body.proofUrl || "Not uploaded"}`,
   body.proofUploadError
    ? `Proof upload failed: ${body.proofUploadError}`
    : "",
   `Note: ${body.note || "None"}`,
   "",
   "Approve in Supabase by setting plan/payment_status to paid."
  ].filter(Boolean).join("\n");
  let telegram = {
   sent: false
  };

  try {
   telegram = await sendTelegramNotification(
    notificationText
   );
  } catch (telegramError) {
   console.error(telegramError);
   telegram = {
    sent: false,
    reason: telegramError.message
   };
  }

  sendJson(response, 200, {
   ok: true,
   telegram,
   serverSave
  });
 } catch (error) {
  sendJson(response, error.statusCode || 500, {
   message: error.message
  });
 }
}

const {
 createClient
} = require("@supabase/supabase-js");

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

const getSupabase = () => {
 const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;
 const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

 if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
   "Supabase server credentials are missing."
  );
 }

 return createClient(
  supabaseUrl,
  serviceRoleKey,
  {
   auth: {
    persistSession: false
   }
  }
 );
};

const sendTelegramNotification = async (
 text
) => {
 const botToken =
  process.env.TELEGRAM_BOT_TOKEN;
 const chatId =
  process.env.TELEGRAM_CHAT_ID;

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
  const payload =
   await telegramResponse.json();
  throw new Error(
   payload.description ||
    "Telegram notification failed."
  );
 }

  return {
   sent: true
  };
};

const normalizeAmount = (value, fallback = 0) => {
 const number = Number(value);
 return Number.isFinite(number) ? number : fallback;
};

module.exports = async (request, response) => {
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
  "Content-Type"
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

  const amount = normalizeAmount(body.amount);
  const upiAmount = normalizeAmount(body.upiAmount);
  const note = [
   `Requested plan: ${body.requestedPlanName}`,
   `Amount: $${amount}`,
   `UPI amount: Rs ${upiAmount || "N/A"}`,
   `Method: ${body.paymentMethod || "paypal"}`,
   `Transaction: ${body.transactionId}`,
   `Payer: ${body.payerName || "Not provided"}`,
   `Contact: ${body.contact || "Not provided"}`,
   `Note: ${body.note || "None"}`
  ].join("\n");
  const supabase = getSupabase();
  const { error } = await supabase
   .from("profiles")
   .upsert({
    id: body.userId,
    email: body.email,
    name: body.name || null,
    payment_status: "pending_review",
    paid_plan: body.requestedPlan,
    paid_amount: amount,
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

  if (error) throw error;

  const notificationText = [
   "Payment details submitted",
   `Name: ${body.name || "Unknown"}`,
   `Email: ${body.email}`,
   `User ID: ${body.userId}`,
   `Current plan: ${body.currentPlan || "unknown"}`,
   `Requested plan: ${body.requestedPlanName}`,
   `Amount: $${amount}`,
   `UPI amount: Rs ${upiAmount || "N/A"}`,
   `Method: ${body.paymentMethod || "paypal"}`,
   `Transaction: ${body.transactionId}`,
   `Payer: ${body.payerName || "Not provided"}`,
   `Contact: ${body.contact || "Not provided"}`,
   `Note: ${body.note || "None"}`,
   `Proof: ${body.proofUrl || "Not uploaded"}`,
   "",
   "Approve in Supabase by setting payment_status to paid and updating the plan if needed."
  ].join("\n");
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
   telegram
  });
 } catch (error) {
  sendJson(response, error.statusCode || 500, {
   message: error.message
  });
 }
};

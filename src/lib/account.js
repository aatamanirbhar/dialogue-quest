import { supabase } from "./supabase";

const TRIAL_LIMIT = 2;
const HISTORY_TABLE = "play_history";
const LEGACY_HISTORY_TABLE = "match_history";
const ACCOUNT_SYNC_KEY = "dq-account-sync";
const LOCAL_HISTORY_PREFIX = "dq-play-history:";
const HISTORY_SCHEMA_ERROR =
 /relation|table|schema cache|column|does not exist/i;

export const PLANS = {
 FREE: "free",
 PREMIUM: "premium",
 PREMIUM_PLUS: "premium_plus"
};

export function getPlanLabel(plan) {
 if (plan === PLANS.PREMIUM_PLUS) {
  return "Premium Plus";
 }

 if (plan === PLANS.PREMIUM) {
  return "Premium";
 }

 return "Free";
}

export function getPlanBenefits(plan) {
 if (plan === PLANS.PREMIUM_PLUS) {
  return [
   "Unlimited hosted multiplayer rooms",
   "Joiner play-again notifications",
   "Early access to Complete the Lyrics",
   "Premium badges and profile highlights"
  ];
 }

 if (plan === PLANS.PREMIUM) {
  return [
   "Unlimited hosted multiplayer rooms",
   "Mix categories across game modes",
   "Keep playing after the free-room trial",
   "Premium badge on your profile"
  ];
 }

 return [
  "2 free hosted rooms",
  "Basic profile and match history",
  "Upgrade anytime to unlock more"
 ];
}

const defaultProfile = {
 name: "",
 email: "",
 plan: PLANS.FREE,
 roomsCreated: 0,
 paidAt: null,
 emailConfirmed: false,
 avatarUrl: ""
};

const notifyAccountChange = (type = "account") => {
 window.dispatchEvent(
  new Event("dq-account-change")
 );

 try {
  window.localStorage.setItem(
   ACCOUNT_SYNC_KEY,
   JSON.stringify({
    type,
    at: Date.now()
   })
  );
 } catch (error) {
  console.error(error);
 }
};

const mapProfile = (profile, user) => ({
 ...defaultProfile,
 id: user?.id || profile?.id,
name:
  profile?.name ||
  user?.user_metadata?.name ||
  "",
 email: profile?.email || user?.email || "",
 plan:
  profile?.plan ||
  (profile?.is_premium
   ? PLANS.PREMIUM
   : PLANS.FREE),
 roomsCreated:
  Number(profile?.rooms_created || 0),
 paidAt: profile?.paid_at || null,
 emailConfirmed:
  Boolean(
   profile?.email_confirmed_at ||
    user?.email_confirmed_at ||
    user?.confirmed_at
  ),
 avatarUrl:
  profile?.avatar_url ||
  user?.user_metadata?.avatar_url ||
  ""
});

const getLocalHistoryKey = (userId) =>
 `${LOCAL_HISTORY_PREFIX}${userId}`;

const readLocalHistory = (userId) => {
 try {
  return JSON.parse(
   window.localStorage.getItem(
    getLocalHistoryKey(userId)
   ) || "[]"
  );
 } catch (error) {
  console.error(error);
  return [];
 }
};

const writeLocalHistory = (userId, entry) => {
 try {
 const history = readLocalHistory(userId);
  const fallbackId =
   [
    entry.created_at,
    entry.mode,
    entry.category,
    entry.room_code,
    entry.result
   ]
    .filter(Boolean)
    .join(":") || crypto.randomUUID();
  const nextHistory = [
   {
    id:
     entry.id || fallbackId,
    created_at:
     entry.created_at ||
     new Date().toISOString(),
    ...entry
   },
   ...history
  ].slice(0, 50);

  window.localStorage.setItem(
   getLocalHistoryKey(userId),
   JSON.stringify(nextHistory)
  );
 } catch (error) {
  console.error(error);
 }
};

export async function getSession() {
 const { data, error } =
  await supabase.auth.getSession();

 if (error) throw error;

 return data.session;
}

export async function getAccount() {
 const session = await getSession();
 const user = session?.user;

 if (!user) return null;

 return ensureProfile(user);
}

async function getFreshAccount() {
 const session = await getSession();
 const user = session?.user;

 if (!user) return null;

 const { data: refreshedUser } =
  await supabase.auth.getUser();

 return ensureProfile(
  refreshedUser?.user || user
 );
}

export async function ensureProfile(user) {
 const { data: profile, error: selectError } =
  await supabase
  .from("profiles")
  .select("*")
  .eq("id", user.id)
  .maybeSingle();

 if (selectError) {
  console.error(selectError);
  return mapProfile(null, user);
 }

 if (profile) {
  return mapProfile(profile, user);
 }

 const { data: createdProfile, error } =
  await supabase
   .from("profiles")
   .upsert({
    id: user.id,
    email: user.email,
    name:
     user.user_metadata?.name ||
     user.email?.split("@")[0] ||
     "Player",
    plan: PLANS.FREE,
    is_premium: false,
    rooms_created: 0
   }, {
    onConflict: "id"
   })
   .select("*")
   .single();

 if (error) {
  console.error(error);
  return mapProfile(null, user);
 }

 return mapProfile(createdProfile, user);
}

export async function refreshAccount() {
 const account = await getFreshAccount();

 notifyAccountChange("refresh");

 return account;
}

export async function createAccount({
 name,
 email,
 password
}) {
 const cleanName = name.trim();
 const cleanEmail = email.trim();
 const { data, error } =
  await supabase.auth.signUp({
   email: cleanEmail,
   password,
   options: {
    emailRedirectTo:
     `${window.location.origin}/multiplayer?auth=confirmed`,
    data: {
     name: cleanName
    }
   }
  });

 if (error) throw error;

 if (!data.user) return null;

 if (
  Array.isArray(data.user.identities) &&
  data.user.identities.length === 0
 ) {
  throw new Error(
   "This email is already in use. Please log in or reset your password."
  );
 }

 return mapProfile(
  null,
  {
   ...data.user,
   email: data.user.email || cleanEmail,
   user_metadata: {
    ...(data.user.user_metadata || {}),
    name: cleanName
   }
  }
 );
}

export async function resendConfirmationEmail(email) {
 const cleanEmail = email.trim();
 const { error } = await supabase.auth.resend({
  type: "signup",
  email: cleanEmail,
  options: {
   emailRedirectTo:
    `${window.location.origin}/multiplayer?auth=confirmed`
  }
 });

 if (error) throw error;
}

export async function signInAccount({
 email,
 password
}) {
 const { data, error } =
  await supabase.auth.signInWithPassword({
   email: email.trim(),
   password
  });

 if (error) throw error;

 return ensureProfile(data.user);
}

export async function updateProfile({
 name,
 avatarUrl
}) {
 const session = await getSession();
 const user = session?.user;

 if (!user) return null;

 const updates = {};

 if (typeof name === "string") {
  updates.name = name.trim();
 }

 if (typeof avatarUrl === "string") {
  updates.avatar_url = avatarUrl.trim();
 }

 const { data, error } = await supabase
  .from("profiles")
  .upsert({
   id: user.id,
   email: user.email,
   ...updates,
   updated_at: new Date().toISOString()
  }, {
   onConflict: "id"
  })
  .select("*")
  .single();

 if (error) throw error;

 if (updates.name || updates.avatar_url) {
  await supabase.auth.updateUser({
   data: {
    ...(updates.name
     ? { name: updates.name }
     : {}),
    ...(updates.avatar_url
     ? { avatar_url: updates.avatar_url }
     : {})
   }
  });
 }

 notifyAccountChange("profile");

 return mapProfile(data, user);
}

export async function uploadAvatar(file) {
 const session = await getSession();
 const user = session?.user;

 if (!user) return null;
 if (!file) return null;

 const extension =
  file.name?.split(".").pop()?.toLowerCase() ||
  "jpg";
 const path = `${user.id}/avatar-${Date.now()}.${extension}`;

 const { error: uploadError } =
  await supabase.storage
   .from("avatars")
   .upload(path, file, {
    cacheControl: "3600",
    upsert: true
   });

 if (uploadError) throw uploadError;

 const { data } = supabase.storage
  .from("avatars")
  .getPublicUrl(path);

 return data.publicUrl;
}

export async function updateEmail(email) {
 const cleanEmail = email.trim();
 const { data, error } =
  await supabase.auth.updateUser({
   email: cleanEmail
  });

 if (error) throw error;

 return ensureProfile(data.user);
}

export async function updatePassword(password) {
 const { error } = await supabase.auth.updateUser({
  password
 });

 if (error) throw error;

 notifyAccountChange("password");
}

export async function requestPasswordReset(email) {
 const cleanEmail = email.trim();
 const { error } = await supabase.auth.resetPasswordForEmail(
  cleanEmail,
  {
   redirectTo:
    `${window.location.origin}/multiplayer?auth=recovery`
  }
 );

 if (error) throw error;
}

export async function signOutAccount() {
 await supabase.auth.signOut();
 notifyAccountChange("signout");
}

export function onAccountChange(callback) {
 let active = true;

 const refresh = async () => {
  try {
   callback(await getFreshAccount());
  } catch (error) {
   console.error(error);
   callback(null);
  }
 };

 const handleLocalChange = () => {
  if (active) refresh();
 };

 const handleStorage = (event) => {
  if (
   active &&
   event.key === ACCOUNT_SYNC_KEY
  ) {
   refresh();
  }
 };

 window.addEventListener(
  "dq-account-change",
  handleLocalChange
 );
 window.addEventListener(
  "storage",
  handleStorage
 );

 const {
  data: { subscription }
 } = supabase.auth.onAuthStateChange(
  (_event, session) => {
   if (!session?.user) {
    callback(null);
    return;
   }

   setTimeout(async () => {
    try {
     callback(
      await ensureProfile(session.user)
     );
    } catch (error) {
     console.error(error);
     callback(null);
    }
   }, 0);
  }
 );

 return () => {
  active = false;
  window.removeEventListener(
   "dq-account-change",
   handleLocalChange
  );
  window.removeEventListener(
   "storage",
   handleStorage
  );
  subscription.unsubscribe();
 };
}

export async function upgradeAccount(plan) {
 const session = await getSession();
 const user = session?.user;

 if (!user) return null;

  const paidAt = new Date().toISOString();
  const fullPaymentUpdate = {
   id: user.id,
   email: user.email,
   plan,
   is_premium: true,
   paid_at: paidAt,
   payment_status: "paid",
   paid_plan: plan,
   paid_amount: 0.1
  };
 const corePaymentUpdate = {
  id: user.id,
  email: user.email,
  plan,
  is_premium: true,
  rooms_created: 0
 };

 let { data, error } = await supabase
  .from("profiles")
  .upsert(fullPaymentUpdate, {
   onConflict: "id"
  })
  .select("*")
  .maybeSingle();

 if (
  error &&
  /schema cache|paid_amount|paid_at|paid_plan|payment_status/i.test(
   error.message || ""
  )
 ) {
  const fallback = await supabase
   .from("profiles")
   .upsert(corePaymentUpdate, {
    onConflict: "id"
   })
   .select("*")
   .maybeSingle();

  data = fallback.data;
  error = fallback.error;
 }

 if (error) throw error;

 notifyAccountChange("upgrade");

  return mapProfile(data, user);
}

export async function recordPlayHistory(entry) {
 const session = await getSession();
 const user = session?.user;

 if (!user) return null;

 const payload = {
  user_id: user.id,
  mode: entry.mode,
  category: entry.category || null,
  room_code: entry.roomCode || null,
  score: Number(entry.score || 0),
  total_questions:
   Number(entry.totalQuestions || 0),
  result: entry.result || null,
  opponent_count:
   Number(entry.opponentCount || 0),
  winner_name: entry.winnerName || null,
  metadata: entry.metadata || {}
 };

 const writeHistory = async (table, row) =>
  supabase
   .from(table)
   .insert(row)
   .select("*")
   .single();

 let response = await writeHistory(
  HISTORY_TABLE,
  payload
 );
 let { data, error } = response;

 if (
  error &&
  HISTORY_SCHEMA_ERROR.test(
   error.message || ""
  )
 ) {
  response = await writeHistory(
   LEGACY_HISTORY_TABLE,
   payload
  );
  data = response.data;
  error = response.error;
 }

 if (
  error &&
  HISTORY_SCHEMA_ERROR.test(
   error.message || ""
  )
 ) {
  response = await writeHistory(
   LEGACY_HISTORY_TABLE,
   {
    room_code: entry.roomCode || null,
    winner_player_id:
     entry.winnerPlayerId || null
   }
  );
  data = response.data;
  error = response.error;
 }

 if (error) {
  console.error(error);
  writeLocalHistory(user.id, payload);
  return null;
 }

 writeLocalHistory(user.id, data || payload);

 return data;
}

export async function getPlayHistory(limit = 30) {
 const session = await getSession();
 const user = session?.user;

 if (!user) return [];

 const readHistory = async (table) =>
  supabase
   .from(table)
   .select("*")
   .eq("user_id", user.id)
   .order("created_at", {
    ascending: false
   })
   .limit(limit);

 let response = await readHistory(
  HISTORY_TABLE
 );
 let { data, error } = response;

 if (
  error &&
  HISTORY_SCHEMA_ERROR.test(
   error.message || ""
  )
) {
  response = await supabase
   .from(LEGACY_HISTORY_TABLE)
   .select("*")
   .order("created_at", {
    ascending: false
   })
   .limit(limit);
  data = response.data;
  error = response.error;
 }

 if (error) {
  console.error(error);
  return readLocalHistory(user.id);
 }

 const remoteHistory = data || [];
 const localHistory = readLocalHistory(user.id);
 const seen = new Set();

 return [...remoteHistory, ...localHistory]
  .filter((item) => {
   const key =
    item.id ||
    [
     item.created_at,
     item.mode,
     item.category,
     item.room_code,
     item.result
    ].join(":");

   if (seen.has(key)) return false;
   seen.add(key);
   return true;
  })
  .slice(0, limit);
}

export async function useTrialCredit(account) {
 if (!account || account.plan !== PLANS.FREE) {
  return account;
 }

 const nextRoomsCreated =
  Number(account.roomsCreated || 0) + 1;

 const { data, error } = await supabase
  .from("profiles")
  .upsert({
   id: account.id,
   plan: account.plan || PLANS.FREE,
   rooms_created: nextRoomsCreated
  }, {
   onConflict: "id"
  })
  .select("*")
  .maybeSingle();

 if (error) throw error;

 if (!data) {
  return {
   ...account,
   roomsCreated: nextRoomsCreated
  };
 }

 return mapProfile(data, {
  id: account.id,
  email: account.email
 });
}

export function getTrialCreditsLeft(account) {
 if (!account) return 0;
 if (account.plan !== PLANS.FREE) {
  return Infinity;
 }

 return Math.max(
  0,
  TRIAL_LIMIT -
   Number(account.roomsCreated || 0)
 );
}

export function isPremium(account) {
 return (
  account?.plan === PLANS.PREMIUM ||
  account?.plan === PLANS.PREMIUM_PLUS
 );
}

export function isPremiumPlus(account) {
 return account?.plan === PLANS.PREMIUM_PLUS;
}

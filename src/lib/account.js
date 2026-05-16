import { supabase } from "./supabase";

const TRIAL_LIMIT = 2;

export const PLANS = {
 FREE: "free",
 PREMIUM: "premium",
 PREMIUM_PLUS: "premium_plus"
};

const defaultProfile = {
 name: "",
 email: "",
 plan: PLANS.FREE,
 roomsCreated: 0,
 paidAt: null
};

const mapProfile = (profile, user) => ({
 ...defaultProfile,
 id: user?.id || profile?.id,
 name:
  profile?.name ||
  user?.user_metadata?.name ||
  "",
 email: profile?.email || user?.email || "",
 plan: profile?.plan || PLANS.FREE,
 roomsCreated:
  Number(profile?.rooms_created || 0),
 paidAt: profile?.paid_at || null
});

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
   .insert({
    id: user.id,
    plan: PLANS.FREE,
    rooms_created: 0
   })
   .select("*")
   .single();

 if (error) {
  console.error(error);
  return mapProfile(null, user);
 }

 return mapProfile(createdProfile, user);
}

export async function createAccount({
 name,
 email,
 password
}) {
 const { data, error } =
  await supabase.auth.signUp({
   email: email.trim(),
   password,
   options: {
    emailRedirectTo:
     `${window.location.origin}/multiplayer?auth=signin`,
    data: {
     name: name.trim()
    }
   }
  });

 if (error) throw error;

 if (!data.user) return null;

 return ensureProfile(data.user);
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

export async function signOutAccount() {
 await supabase.auth.signOut();
 window.dispatchEvent(
  new Event("dq-account-change")
 );
}

export function onAccountChange(callback) {
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

 return () => subscription.unsubscribe();
}

export async function upgradeAccount(plan) {
 const session = await getSession();
 const user = session?.user;

 if (!user) return null;

 const { data, error } = await supabase
  .from("profiles")
  .upsert({
   id: user.id,
   plan,
   paid_at: new Date().toISOString(),
   payment_status: "paid",
   paid_plan: plan,
   paid_amount:
    plan === PLANS.PREMIUM ? 15 : 29
  }, {
   onConflict: "id"
  })
  .select("*")
  .maybeSingle();

 if (error) throw error;

 window.dispatchEvent(
  new Event("dq-account-change")
 );

 return mapProfile(data, user);
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

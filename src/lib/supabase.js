import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
      autoRefreshToken: true,
      persistSession: true,
    },
  },
);

const stripAuthArtifactsFromUrl = () => {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  const removableSearchKeys = [
    "code",
    "token",
    "token_hash",
    "type",
    "refresh_token",
    "access_token",
    "expires_in",
    "expires_at",
    "provider_token",
    "provider_refresh_token",
  ];

  let mutated = false;

  for (const key of removableSearchKeys) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      mutated = true;
    }
  }

  if (url.hash) {
    const hashParams = new URLSearchParams(
      url.hash.replace(/^#/, ""),
    );
    const hadAuthHash =
      hashParams.has("access_token") ||
      hashParams.has("refresh_token") ||
      hashParams.has("type") ||
      hashParams.has("error_description");

    if (hadAuthHash) {
      url.hash = "";
      mutated = true;
    }
  }

  if (mutated) {
    window.history.replaceState(
      {},
      document.title,
      `${url.pathname}${url.search}${url.hash}`,
    );
  }
};

export async function consumeAuthCodeFromUrl() {
  if (typeof window === "undefined") {
    return { exchanged: false, session: null };
  }

  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(
    window.location.hash.replace(/^#/, ""),
  );

  const errorDescription =
    search.get("error_description") ||
    hash.get("error_description") ||
    search.get("error") ||
    hash.get("error");

  if (errorDescription) {
    stripAuthArtifactsFromUrl();
    throw new Error(errorDescription);
  }

  const code = search.get("code");

  if (code) {
    const { data, error } =
      await supabase.auth.exchangeCodeForSession(code);

    stripAuthArtifactsFromUrl();

    if (error) throw error;

    return {
      exchanged: true,
      session: data?.session || null,
    };
  }

  const hasHashTokens =
    hash.get("access_token") || hash.get("refresh_token");

  if (hasHashTokens) {
    const { data } = await supabase.auth.getSession();

    stripAuthArtifactsFromUrl();

    return {
      exchanged: true,
      session: data?.session || null,
    };
  }

  return { exchanged: false, session: null };
}

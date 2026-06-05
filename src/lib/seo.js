import { useEffect } from "react";

const SITE_URL = "https://gamenights.live";
const DEFAULT_OG = `${SITE_URL}/og-image.png`;

const setMeta = (selector, attr, value) => {
 if (!value) return;
 let el = document.head.querySelector(selector);
 if (!el) {
  el = document.createElement("meta");
  const [, key, val] = selector.match(/\[(.+?)="(.+?)"\]/) || [];
  if (key && val) el.setAttribute(key, val);
  document.head.appendChild(el);
 }
 el.setAttribute(attr, value);
};

const setLink = (rel, href) => {
 if (!href) return;
 let el = document.head.querySelector(`link[rel="${rel}"]`);
 if (!el) {
  el = document.createElement("link");
  el.setAttribute("rel", rel);
  document.head.appendChild(el);
 }
 el.setAttribute("href", href);
};

export const useSEO = ({
 title,
 description,
 path = "",
 image = DEFAULT_OG,
 noindex = false
}) => {
 useEffect(() => {
  if (title) document.title = title;

  setMeta('meta[name="description"]', "content", description);
  setMeta('meta[property="og:title"]', "content", title);
  setMeta('meta[property="og:description"]', "content", description);
  setMeta('meta[property="og:url"]', "content", `${SITE_URL}${path}`);
  setMeta('meta[property="og:image"]', "content", image);
  setMeta('meta[name="twitter:title"]', "content", title);
  setMeta('meta[name="twitter:description"]', "content", description);
  setMeta('meta[name="twitter:image"]', "content", image);
  setMeta(
   'meta[name="robots"]',
   "content",
   noindex
    ? "noindex,nofollow"
    : "index,follow,max-image-preview:large,max-snippet:-1"
  );

  setLink("canonical", `${SITE_URL}${path}`);
 }, [title, description, path, image, noindex]);
};

export const SEO_PRESETS = {
 home: {
  title:
   "Dialogue Quest — Guess the Movie, TV, Anime Dialogues & Song Lyrics",
  description:
   "Free online multiplayer game. Guess Hollywood, Bollywood, TV show and anime dialogues, or song lyrics. Play solo or with friends in realtime rooms.",
  path: "/"
 },
 categories: {
  title:
   "Pick a Category — Hollywood, Bollywood, TV, Anime | Dialogue Quest",
  description:
   "Choose your category: Hollywood movies, Bollywood, TV shows, anime, or a mix. Guess the dialogue and rack up points.",
  path: "/categories"
 },
 soloHollywood: {
  title:
   "Guess the Hollywood Movie Dialogue — Solo Quiz | Dialogue Quest",
  description:
   "Test your Hollywood knowledge. Guess the movie from iconic dialogues — solo quiz mode, free to play.",
  path: "/solo/hollywood"
 },
 soloBollywood: {
  title:
   "Guess the Bollywood Movie Dialogue — Solo Quiz | Dialogue Quest",
  description:
   "Classic Bollywood dialogues. Guess the movie and beat your high score. Free online quiz.",
  path: "/solo/bollywood"
 },
 soloTv: {
  title:
   "Guess the TV Show from the Dialogue — Solo Quiz | Dialogue Quest",
  description:
   "From sitcoms to drama. Guess the TV show from the dialogue in this free online quiz.",
  path: "/solo/tvshows"
 },
 soloAnime: {
  title:
   "Guess the Anime from the Dialogue — Solo Quiz | Dialogue Quest",
  description:
   "Iconic anime quotes. Guess the anime — free online quiz for otaku fans.",
  path: "/solo/anime"
 },
 soloMix: {
  title:
   "Mixed Dialogues Quiz — Movies, TV, Anime | Dialogue Quest",
  description:
   "Mixed-category dialogue quiz. Hollywood, Bollywood, TV shows and anime in one round.",
  path: "/solo/mix"
 },
 lyrics: {
  title:
   "Guess the Song from the Lyrics — Free Lyrics Quiz | Dialogue Quest",
  description:
   "Identify the song from a snippet of its lyrics. Multi-language lyrics quiz, free to play.",
  path: "/lyrics"
 },
 multiplayer: {
  title:
   "Multiplayer Dialogue Game — Play With Friends | Dialogue Quest",
  description:
   "Create a room, share the code, play in realtime with friends. Free multiplayer movie & TV dialogue guessing game.",
  path: "/multiplayer"
 }
};

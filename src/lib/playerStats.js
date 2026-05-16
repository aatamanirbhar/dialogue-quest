const compliments = [
 "Brilliant",
 "Fearless",
 "Sharp",
 "Electric",
 "Legendary",
 "Clutch",
 "Radiant",
 "Mighty"
];

const tieCompliments = [
 "Balanced",
 "Epic",
 "Even",
 "Tactical"
];

export function getRandomCompliment(tie = false) {
 const list = tie ? tieCompliments : compliments;

 return list[
  Math.floor(Math.random() * list.length)
 ];
}

export function getPlayerTitle(history = []) {
 const wins = history.filter(
  (item) => item.result === "win"
 ).length;
 const losses = history.filter(
  (item) => item.result === "loss"
 ).length;
 const ties = history.filter(
  (item) => item.result === "tie"
 ).length;
 const total = history.length;

 if (wins >= 10) return "Dialogue Champion";
 if (wins >= 5) return "Quote Hunter";
 if (ties > wins && ties >= 3) return "Tie Breaker";
 if (losses > wins && total >= 4) return "Comeback Artist";
 if (total >= 1) return "Rising Player";

 return "New Challenger";
}

export function getInsight(history = []) {
 const categoryCounts = history.reduce(
  (counts, item) => {
   const category = item.category || "mix";
   counts[category] =
    (counts[category] || 0) + 1;
   return counts;
  },
  {}
 );

 const topCategory = Object.entries(
  categoryCounts
 ).sort((a, b) => b[1] - a[1])[0]?.[0];

 if (!topCategory) {
  return "Your story starts with the next match.";
 }

 if (topCategory === "anime") {
  return "You seem like a big anime fan.";
 }

 if (topCategory === "hollywood") {
  return "You seem like a big superhero fan.";
 }

 if (topCategory === "bollywood") {
  return "Your Bollywood radar is glowing.";
 }

 if (topCategory === "tvshows") {
  return "TV dialogue lives rent-free in your head.";
 }

 return "Mixed-category chaos suits you.";
}

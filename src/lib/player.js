export function getPlayerId() {
 let id = localStorage.getItem("dq_player_id");

 if (!id) {
  id = crypto.randomUUID();
  localStorage.setItem("dq_player_id", id);
 }

 return id;
}
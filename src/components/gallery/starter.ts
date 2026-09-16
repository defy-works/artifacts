/** Starter page for artifacts created in the browser: shows the runtime working. */
export const STARTER_HTML = (title: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title.replace(/[<&>]/g, "")}</title>
<style>
  :root { --bg: #0a0a0a; --fg: #fff; --muted: rgba(255,255,255,.6); --accent: #6366f1; }
  @media (prefers-color-scheme: light) { :root { --bg: #fafafa; --fg: #111; --muted: #666; } }
  body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: var(--bg); color: var(--fg); padding: 32px 16px; }
  main { max-width: 560px; margin: 0 auto; }
  h1 { font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; }
  p { color: var(--muted); }
  .row { display: flex; gap: 8px; margin: 24px 0; }
  input { flex: 1; padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(128,128,128,.4); background: transparent; color: inherit; font: inherit; }
  button { padding: 10px 16px; border-radius: 8px; border: 0; background: var(--accent); color: #fff; font: inherit; cursor: pointer; }
  ul { list-style: none; padding: 0; margin: 0; }
  li { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid rgba(128,128,128,.2); }
  li button { background: transparent; color: var(--muted); padding: 4px 8px; }
  .peers { font-size: 12px; color: var(--muted); }
</style>
</head>
<body>
<main>
  <h1>${title.replace(/[<&>]/g, "")}</h1>
  <p>A shared list. Everyone who can interact writes to the same database; it updates live.</p>
  <div class="row"><input id="text" placeholder="Add an item"><button id="add">Add</button></div>
  <ul id="list"></ul>
  <p class="peers" id="peers"></p>
</main>
<script>
(async () => {
  const list = document.getElementById("list");
  const input = document.getElementById("text");
  const db = await claude.use("db");
  if (!db) { list.innerHTML = "<li>Database unavailable in this view.</li>"; return; }
  const items = db.collection("items");
  items.orderBy("createdAt").onSnapshot((snap) => {
    list.innerHTML = "";
    for (const doc of snap.docs) {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.textContent = doc.data().text;
      const del = document.createElement("button");
      del.textContent = "×";
      del.onclick = () => items.doc(doc.id).delete();
      li.append(span, del);
      list.append(li);
    }
  });
  document.getElementById("add").onclick = async () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    await items.add({ text, createdAt: Date.now() });
  };
  const room = await claude.use("room");
  if (room) room.onPeers(({ peers }) => {
    document.getElementById("peers").textContent = peers.length + " here now";
  });
})();
</script>
</body>
</html>
`;

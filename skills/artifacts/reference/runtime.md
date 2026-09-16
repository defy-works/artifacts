# Page runtime: `window.claude`

Every published page is framed by the platform with a script that defines `window.claude` before any page code runs. The only member is `use`:

```js
const db = await claude.use("db"); // namespace, or null when this view cannot run it
```

`use()` resolves `null` when the capability is not declared for the artifact, not granted to this viewer (assets on a read-only view), or the page is opened outside the platform. It never rejects. It resolves later than the page's first synchronous run and is not ordered against `DOMContentLoaded`, so render the page first and light features up when the promise resolves. Namespaces are frozen; calls reject with `{code, message}` objects, never throw (except `db.doc()` / `db.collection()`, which throw `TypeError` for a malformed path).

Declare capabilities on publish (`--capabilities '{"db":{},"room":{}}'`). `permissions` and `user` are always available and never declared.

## db — shared JSON documents, live

```js
const db = await claude.use("db");
const tasks = db.collection("tasks");                // odd segment count = collection
const ref = db.doc("tasks/t1");                       // even = document; ref.id === "t1"
await ref.set({ title: "Ship", done: false });        // full replace, creates if absent
await ref.update({ done: true });                     // deep merge, requires existence
await ref.delete();
const snap = await ref.get();                         // snap.exists, snap.data(), snap.id
const q = tasks.where("done", "==", false).orderBy("createdAt", "desc").limit(50);
const qs = await q.get();                             // qs.docs, qs.size, qs.empty
const off = q.onSnapshot((qs) => render(qs.docs), (e) => console.warn(e.code));
const off2 = ref.onSnapshot((snap) => { ... });
const added = await tasks.add({ title: "New" });      // client-generated id
const lease = await db.doc("locks/editor").acquire({ holder: myId, ttlMs: 10000 }); // {acquired, expiresAt}
```

- Bodies are plain objects (no top-level arrays), ≤ 256 KiB, ≤ 32 levels deep; ≤ 5,000 documents per artifact.
- Segments: letters, digits, `_ - . ~ : @ +`; ≤ 16 segments per path.
- Operators: `==`, `!=`, `<`, `<=`, `>`, `>=`, `in`, `not-in` (≤ 30 values), `array-contains`. Up to 10 filters, one `orderBy`, limit 1–1000. Filters read top-level fields only.
- Snapshots and `data()` are frozen; unchanged docs are the same object across deliveries. `qs.docChanges()` lists `added` / `modified` / `removed`.
- Subscribe once (on startup or when a filter really changes) and keep the unsubscribe; never subscribe inside render.
- Writes are last-writer-wins; one write at a time per document; write on user actions, not timers.
- Error codes: `invalid_argument` (bad path/body or not allowed to write here), `quota_exceeded`, `resource_exhausted`, `not_granted`, `unavailable`.

**Access.** Defaults: everyone with view access reads shared documents; interact and above write them. `data/users/<id>/…` is private to that viewer (nobody else, the owner included, can read it). Change minimums with rules at publish:

```json
{"db":{"rules":[
  {"path":"","read":"view","write":"admin"},
  {"path":"votes/{self}","write":"interact"}
]}}
```

Levels in rules: `view` < `interact` < `admin` (edit) < `owner`. A rule covers its path and everything below; deeper rules override. `{self}` as the last segment names the viewer's own subtree.

## user — who is viewing

```js
const user = await claude.use("user");
const uid = await user.id();            // null when signed out
await user.canEdit();                   // edit or owner
await user.isOwner();
await user.can("data.write");           // interact or above
await user.profile();                   // {id, name, image} or null
```

Use `uid` to build per-viewer paths: `db.doc("data/users/" + uid + "/profile")`.

## room — who is here right now

```js
const room = await claude.use("room");
room.onPeers(({ peers, joined, left, updated }) => renderCursors(peers)); // peers[i] = {peer, by, isMe, sameTab, presence, updatedAt}
room.peers();                                       // synchronous snapshot
await room.presence({ cursor: [0.4, 0.3], color: "#6366f1", name: "Ada" });  // merged; null removes a field; ≤ 4 KiB
room.on("reaction", (msg) => burst(msg.data));      // msg = {topic, data, peer, by, isMe, sameTab}
await room.emit("reaction", "🎉");                  // ≤ 4 KiB; a few per second
room.connected(); room.onConnection((c) => ...);
```

Events are moments: never stored, never replayed. Topics are admin-only unless opened: `{"room":{"topics":{"reaction":"interact"}}}`. State a late joiner needs (current slide, revealed answer) belongs in a `db` document. `sendToClaudeSession` is not available on this platform (`canSendToClaudeSession()` resolves `"off"`).

## artifact — republish this page

```js
const artifact = await claude.use("artifact");
await artifact.publish(html);                        // complete document, doctype first → every open view reloads
await artifact.publish({ "data/rows.json": JSON.stringify(rows), "old.txt": null }); // files form: write/delete supporting files
```

Regenerate the HTML from your page's canonical state (a template function), never from the live DOM. `conflict` means someone published first and the view is reloading. Read-only viewers get `not_writer`. Live-doc `edit()` / `sync()` are not available.

## assets — uploads (editors only)

```js
const assets = await claude.use("assets");           // null on a read-only view: hide upload UI
const { id, url } = await assets.upload(file, { type: "image/png" }); // ≤ 20 MiB (SVG 2 MiB, CSS/JS 16 MiB)
await assets.list();                                  // {assets, usage}
await assets.delete(id);                              // irreversible
```

Store `id` in a `db` document; display with `"/_blob/" + id` from any view. Accepted: png, jpeg, gif, webp, svg (sanitized), mp4, webm, pdf, woff2/woff/ttf/otf, csv, markdown, json, plain text, css, javascript.

## downloads — hand the viewer a file

```js
const downloads = await claude.use("downloads");
await downloads.save({ filename: "report.csv", data: csvString }); // viewer confirms; rejects `declined`
```

Allowed extensions: gif png jpg jpeg webp mp4 webm txt json md docx pptx epub csv ttf html svg pdf xlsx zip.

## permissions

`(await claude.use("permissions")).state()` returns `{db: "granted", …}` for every available capability; `request()` never prompts on this platform (access follows the viewer's share level).

## Sandbox notes

Pages run on an opaque origin: no cookies, no `localStorage`/`sessionStorage` (they throw), no access to the host page. Relative URLs resolve against `/_files/<artifactId>/` when the artifact has supporting files. Popups and downloads are allowed; the frame may request clipboard, fullscreen, camera, microphone and geolocation.

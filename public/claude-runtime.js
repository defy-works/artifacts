/*
 * Artifacts runtime — injected as the first script of every published page.
 * Exposes `window.claude.use(name)` and forwards every capability call to
 * the host page over postMessage. The frame is sandboxed with an opaque
 * origin, so the host validates `event.source`, never an origin string.
 */
(function () {
  "use strict";
  if (window.claude) return;

  var parent = window.parent;
  var framed = !!parent && parent !== window;
  var seq = 0;
  var pending = new Map();
  var subs = new Map();
  var useCache = new Map();
  var me = { peer: null, uid: null };

  function post(msg) {
    if (!framed) return;
    msg.__claude = 1;
    parent.postMessage(msg, "*");
  }

  function call(ns, method, args) {
    return new Promise(function (resolve, reject) {
      if (!framed) return reject({ code: "not_granted", message: "not framed" });
      var id = ++seq;
      pending.set(id, { resolve: resolve, reject: reject });
      post({ type: "call", id: id, ns: ns, method: method, args: args || [] });
    });
  }

  function subscribe(ns, method, args, onEvent, onError) {
    var id = ++seq;
    subs.set(id, { onEvent: onEvent, onError: onError });
    post({ type: "subscribe", id: id, ns: ns, method: method, args: args || [] });
    var done = false;
    return function unsubscribe() {
      if (done) return;
      done = true;
      if (subs.delete(id)) post({ type: "unsubscribe", id: id });
    };
  }

  window.addEventListener("message", function (ev) {
    if (ev.source !== parent) return;
    var m = ev.data;
    if (!m || m.__claude !== 1) return;
    if (m.type === "result") {
      var p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.ok) p.resolve(m.value);
      else p.reject(m.error);
    } else if (m.type === "event") {
      var s = subs.get(m.id);
      if (!s) return;
      if (m.kind === "error") {
        subs.delete(m.id);
        if (s.onError) s.onError(m.payload);
      } else {
        s.onEvent(m.kind, m.payload);
      }
    } else if (m.type === "hello") {
      me = m.me || me;
    }
  });

  function freeze(o) {
    return Object.freeze(o);
  }
  function deepFreeze(o) {
    if (o && typeof o === "object" && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) {
        deepFreeze(o[k]);
      });
    }
    return o;
  }
  function typeError(msg) {
    throw new TypeError(msg);
  }

  /* ---------------- path grammar ---------------- */
  var SEG = /^[A-Za-z0-9_\-.~:@+]+$/;
  function segsOf(path) {
    if (typeof path !== "string") typeError("path must be a string");
    var t = path.replace(/^\/+|\/+$/g, "");
    if (!t) typeError("path is empty");
    var segs = t.split("/");
    if (segs.length > 16) typeError("path has more than 16 segments");
    segs.forEach(function (s) {
      if (s === "." || s === "..") typeError('invalid segment "' + s + '"');
      if (!SEG.test(s)) typeError('invalid characters in segment "' + s + '"');
      if (s.length > 200) typeError("segment exceeds 200 bytes");
    });
    if (t.length > 1000) typeError("path exceeds 1000 bytes");
    return segs;
  }
  function docPath(path) {
    var segs = segsOf(path);
    if (segs.length % 2 !== 0) typeError("document path must have an even number of segments (got " + segs.length + ")");
    return segs.join("/");
  }
  function colPath(path) {
    var segs = segsOf(path);
    if (segs.length % 2 !== 1) typeError("collection path must have an odd number of segments (got " + segs.length + ")");
    return segs.join("/");
  }
  function newId() {
    var a = "abcdefghijklmnopqrstuvwxyz0123456789";
    var out = "";
    var bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    for (var i = 0; i < 20; i++) out += a[bytes[i] % a.length];
    return out;
  }

  /* ---------------- db ---------------- */
  var META = freeze({ fromCache: false, hasPendingWrites: false });
  var snapCache = new Map();
  function docSnap(raw) {
    var key = raw.path + "|" + (raw.exists ? raw.version : "x");
    var cached = snapCache.get(raw.path);
    if (cached && cached.key === key) return cached.snap;
    var data = raw.exists ? deepFreeze(raw.data) : undefined;
    var snap = freeze({
      id: raw.id,
      exists: !!raw.exists,
      data: function () {
        return data;
      },
      metadata: META,
    });
    snapCache.set(raw.path, { key: key, snap: snap, version: raw.version });
    return snap;
  }
  function querySnap(docsRaw, prev) {
    var docs = docsRaw.map(docSnap);
    var changes = [];
    var prevIndex = new Map();
    if (prev) prev.docs.forEach(function (d, i) { prevIndex.set(d.id, { d: d, i: i }); });
    var nowIds = new Set();
    docs.forEach(function (d, i) {
      nowIds.add(d.id);
      var p = prevIndex.get(d.id);
      if (!p) changes.push({ type: "added", doc: d, oldIndex: -1, newIndex: i });
      else if (p.d !== d) changes.push({ type: "modified", doc: d, oldIndex: p.i, newIndex: i });
    });
    if (prev) {
      prev.docs.forEach(function (d, i) {
        if (!nowIds.has(d.id)) changes.push({ type: "removed", doc: d, oldIndex: i, newIndex: -1 });
      });
    }
    var frozenChanges = deepFreeze(changes.map(freeze));
    return freeze({
      docs: freeze(docs),
      size: docs.length,
      empty: docs.length === 0,
      docChanges: function () {
        return frozenChanges;
      },
      metadata: META,
    });
  }

  function makeQuery(collection, filters, orderBy, limit) {
    var spec = { collection: collection, filters: filters, orderBy: orderBy, limit: limit };
    return {
      where: function (field, op, value) {
        if (filters.length >= 10) typeError("at most 10 filters");
        return makeQuery(collection, filters.concat([{ field: field, op: op, value: value }]), orderBy, limit);
      },
      orderBy: function (field, dir) {
        if (orderBy) typeError("at most one orderBy");
        return makeQuery(collection, filters, { field: field, dir: dir === "desc" ? "desc" : "asc" }, limit);
      },
      limit: function (n) {
        if (typeof n !== "number" || n < 1 || n > 1000) typeError("limit must be 1-1000");
        return makeQuery(collection, filters, orderBy, Math.floor(n));
      },
      get: function () {
        return call("db", "query", [spec]).then(function (r) {
          return querySnap(r.docs, null);
        });
      },
      onSnapshot: function (next, error) {
        if (typeof next !== "function") typeError("onSnapshot needs a function");
        var prev = null;
        return subscribe("db", "query", [spec], function (kind, payload) {
          if (kind !== "snapshot") return;
          prev = querySnap(payload.docs, prev);
          next(prev);
        }, error);
      },
    };
  }

  function makeDoc(path) {
    var segs = path.split("/");
    var id = segs[segs.length - 1];
    return freeze({
      id: id,
      path: path,
      get: function () {
        return call("db", "get", [path]).then(docSnap);
      },
      set: function (data) {
        return call("db", "set", [path, data]);
      },
      update: function (data) {
        return call("db", "update", [path, data]);
      },
      delete: function () {
        return call("db", "delete", [path]);
      },
      acquire: function (options) {
        return call("db", "acquire", [path, options]);
      },
      onSnapshot: function (next, error) {
        if (typeof next !== "function") typeError("onSnapshot needs a function");
        return subscribe("db", "doc", [path], function (kind, payload) {
          if (kind === "snapshot") next(docSnap(payload));
        }, error);
      },
      collection: function (sub) {
        return makeCollection(colPath(path + "/" + sub));
      },
    });
  }

  function makeCollection(path) {
    var q = makeQuery(path, [], null, null);
    q.path = path;
    q.doc = function (id) {
      if (id === undefined) id = newId();
      return makeDoc(docPath(path + "/" + id));
    };
    q.add = function (data) {
      var ref = q.doc();
      return ref.set(data).then(function () {
        return ref;
      });
    };
    return freeze(q);
  }

  var dbNs = freeze({
    doc: function (path) {
      return makeDoc(docPath(path));
    },
    collection: function (path) {
      return makeCollection(colPath(path));
    },
  });

  /* ---------------- room ---------------- */
  var roomState = {
    peers: freeze([]),
    connected: false,
    joined: false,
    listeners: new Set(),
    connListeners: new Set(),
    topicListeners: new Map(),
    presence: {},
    unsubscribe: null,
    error: null,
  };
  function ensureRoom() {
    if (roomState.joined) return;
    roomState.joined = true;
    roomState.unsubscribe = subscribe("room", "join", [], function (kind, payload) {
      if (kind === "hello") {
        me = payload.me || me;
      } else if (kind === "peers") {
        applyPeers(payload.peers);
      } else if (kind === "room") {
        var msg = freeze(sender(payload, { topic: payload.topic, data: deepFreeze(payload.data) }));
        var set = roomState.topicListeners.get(payload.topic);
        if (set) set.forEach(function (fn) { try { fn(msg); } catch (e) { console.error(e); } });
      } else if (kind === "connection") {
        roomState.connected = !!payload.connected;
        roomState.connListeners.forEach(function (fn) { try { fn(roomState.connected); } catch (e) { console.error(e); } });
      }
    }, function (err) {
      roomState.error = err;
      roomState.connected = false;
      roomState.peers = freeze([]);
      roomState.listeners.forEach(function (l) { if (l.onError) l.onError(err); });
      roomState.connListeners.forEach(function () {});
    });
  }
  function sender(p, extra) {
    var out = extra || {};
    out.peer = p.peer;
    out.by = p.by || null;
    out.isMe = (!!p.by && p.by === me.uid) || p.peer === me.peer;
    out.sameTab = p.peer === me.peer;
    out.kind = p.kind || "viewer";
    return out;
  }
  var peerCache = new Map();
  function applyPeers(list) {
    var prevList = roomState.peers;
    var prevById = new Map();
    prevList.forEach(function (p) { prevById.set(p.peer, p); });
    var joined = [], updated = [], nextList = [];
    var seen = new Set();
    list.forEach(function (raw) {
      seen.add(raw.peer);
      var key = JSON.stringify(raw.presence) + "|" + raw.by;
      var cached = peerCache.get(raw.peer);
      var peer;
      if (cached && cached.key === key) {
        peer = cached.peer;
      } else {
        peer = freeze(sender(raw, { presence: deepFreeze(raw.presence || {}), updatedAt: Date.now() }));
        peerCache.set(raw.peer, { key: key, peer: peer });
        if (cached) updated.push(peer);
      }
      if (!prevById.has(raw.peer)) joined.push(peer);
      nextList.push(peer);
    });
    var left = prevList.filter(function (p) { return !seen.has(p.peer); });
    left.forEach(function (p) { peerCache.delete(p.peer); });
    if (!joined.length && !left.length && !updated.length) return;
    roomState.peers = freeze(nextList);
    var change = freeze({ peers: roomState.peers, joined: freeze(joined), left: freeze(left), updated: freeze(updated) });
    roomState.listeners.forEach(function (l) { try { l.fn(change); } catch (e) { console.error(e); } });
  }
  var presenceTimer = null;
  var presencePending = null;
  function flushPresence() {
    presenceTimer = null;
    var patch = presencePending;
    presencePending = null;
    if (patch) call("room", "presence", [patch]).catch(function () {});
  }
  var roomNs = freeze({
    emit: function (topic, data) {
      ensureRoom();
      return call("room", "emit", [topic, data]);
    },
    on: function (topic, handler, onError) {
      if (typeof handler !== "function") typeError("handler must be a function");
      ensureRoom();
      var set = roomState.topicListeners.get(topic);
      if (!set) { set = new Set(); roomState.topicListeners.set(topic, set); }
      set.add(handler);
      if (roomState.error && onError) Promise.resolve().then(function () { onError(roomState.error); });
      return function () { set.delete(handler); };
    },
    presence: function (patch) {
      ensureRoom();
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        return Promise.reject({ code: "invalid_argument", message: "patch must be an object" });
      }
      var next = Object.assign({}, roomState.presence);
      Object.keys(patch).forEach(function (k) {
        if (patch[k] === null) delete next[k]; else next[k] = patch[k];
      });
      if (JSON.stringify(next).length > 4096) {
        return Promise.reject({ code: "invalid_argument", message: "presence exceeds 4 KiB" });
      }
      roomState.presence = next;
      presencePending = Object.assign(presencePending || {}, patch);
      if (!presenceTimer) presenceTimer = setTimeout(flushPresence, 33);
      return Promise.resolve();
    },
    peers: function () {
      ensureRoom();
      return roomState.peers;
    },
    onPeers: function (handler, onError) {
      if (typeof handler !== "function") typeError("handler must be a function");
      ensureRoom();
      var l = { fn: handler, onError: onError };
      roomState.listeners.add(l);
      Promise.resolve().then(function () {
        if (!roomState.listeners.has(l)) return;
        if (roomState.error) { if (onError) onError(roomState.error); return; }
        if (roomState.peers.length) {
          handler(freeze({ peers: roomState.peers, joined: roomState.peers, left: freeze([]), updated: freeze([]) }));
        }
      });
      return function () { roomState.listeners.delete(l); };
    },
    connected: function () {
      return roomState.connected;
    },
    onConnection: function (handler) {
      ensureRoom();
      roomState.connListeners.add(handler);
      Promise.resolve().then(function () { if (roomState.connListeners.has(handler)) handler(roomState.connected); });
      return function () { roomState.connListeners.delete(handler); };
    },
    sendToClaudeSession: function () {
      return Promise.reject({ code: "claude_unavailable", message: "No Claude session is open beside this page" });
    },
    canSendToClaudeSession: function () {
      return Promise.resolve("off");
    },
  });

  /* ---------------- artifact ---------------- */
  var artifactNs = freeze({
    publish: function (arg) {
      return call("artifact", "publish", [arg]);
    },
    edit: function () {
      return Promise.reject({ code: "invalid_content", message: "This artifact is not a live doc" });
    },
    sync: function () {
      return Promise.reject({ code: "invalid_content", message: "This artifact is not a live doc" });
    },
  });

  /* ---------------- assets / downloads / permissions ---------------- */
  var assetsNs = freeze({
    upload: function (blob, options) {
      return call("assets", "upload", [blob, options]);
    },
    list: function () {
      return call("assets", "list", []);
    },
    delete: function (ref) {
      return call("assets", "delete", [ref]);
    },
  });
  var downloadsNs = freeze({
    save: function (request) {
      return call("downloads", "save", [request]);
    },
  });
  var permissionsNs = freeze({
    state: function (name) {
      return call("permissions", "state", [name]);
    },
    request: function (names) {
      return call("permissions", "request", [names]);
    },
  });

  /* ---------------- user ---------------- */
  var userNs = freeze({
    id: function () { return call("user", "id", []); },
    canEdit: function () { return call("user", "canEdit", []); },
    isOwner: function () { return call("user", "isOwner", []); },
    can: function (what) { return call("user", "can", [what]); },
    profile: function () { return call("user", "profile", []); },
    profiles: function (ids) { return call("user", "profiles", [ids]); },
  });

  var NAMESPACES = {
    db: dbNs, room: roomNs, artifact: artifactNs, self: artifactNs, assets: assetsNs,
    downloads: downloadsNs, permissions: permissionsNs, user: userNs,
  };

  function use(name) {
    if (typeof name !== "string" || !(name in NAMESPACES)) return Promise.resolve(null);
    var key = name === "self" ? "artifact" : name;
    if (useCache.has(key)) return useCache.get(key);
    var p = new Promise(function (resolve) {
      if (!framed) return resolve(null);
      var id = ++seq;
      var timer = setTimeout(function () {
        pending.delete(id);
        resolve(null);
      }, 10000);
      pending.set(id, {
        resolve: function (v) {
          clearTimeout(timer);
          if (v && v.me) me = v.me;
          resolve(v && v.available ? NAMESPACES[key] : null);
        },
        reject: function () {
          clearTimeout(timer);
          resolve(null);
        },
      });
      post({ type: "use", id: id, name: key });
    });
    useCache.set(key, p);
    return p;
  }

  window.claude = freeze({ use: use });
  post({ type: "ready" });
})();

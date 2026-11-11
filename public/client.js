"use strict";

// The token stays in memory only. Strip it from the address bar immediately.
const pageUrl = new URL(location.href);
const token = pageUrl.searchParams.get("session");
if (token) {
    pageUrl.searchParams.delete("session");
    history.replaceState(null, "", pageUrl.pathname + pageUrl.search + pageUrl.hash);
}

const $ = (id) => document.getElementById(id);
const ui = {
    app: $("app"), noToken: $("no-token"), expired: $("expired"),
    searchBox: $("search-box"), search: $("search-input"), results: $("search-results"),
    guildIcon: $("guild-icon"), guildFallback: $("guild-icon-fallback"), guildName: $("guild-name"),
    avatar: $("user-avatar"), avatarFallback: $("user-avatar-fallback"),
    art: $("art"), artFallback: $("art-fallback"), title: $("track-title"), author: $("track-author"),
    nowThumb: $("now-thumb"), nowThumbFallback: $("now-thumb-fallback"), nowTitle: $("now-title"),
    nowAuthor: $("now-author"), playPause: $("play-pause"), skip: $("skip"), stop: $("stop"),
    progress: $("progress"),
    fill: $("progress-fill"), elapsed: $("elapsed"), total: $("total"), queueToggle: $("queue-toggle"),
    queueCount: $("queue-count"), queuePanel: $("queue-panel"), queueList: $("queue-list"),
    queueMore: $("queue-more"), queueClose: $("queue-close"),
    filtersToggle: $("filters-toggle"), filtersDot: $("filters-dot"), filtersPanel: $("filters-panel"),
    filtersList: $("filters-list"), filtersHint: $("filters-hint"), filtersClear: $("filters-clear"),
    filtersClose: $("filters-close"), toast: $("toast")
};

const state = {
    current: null, totalMs: 0, elapsedBase: 0, anchor: 0, paused: false, timer: null,
    searchSeq: 0, searchTimer: null, queueSeq: 0, queueRefresh: null, toastTimer: null,
    filters: new Set(), filtersAvailable: [], filtersLoaded: false, filtersBusy: false,
    expired: false, socket: null
};

/* -------------------------------------------------------------------- API */

const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { status });

async function api(path, options = {}) {
    const headers = { Authorization: `Bearer ${token}` };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(path, { ...options, headers });
    if (response.status === 401) { expireSession(); throw httpError(401); }
    if (!response.ok) throw httpError(response.status);
    return response.status === 204 ? null : response.json();
}

function expireSession() {
    if (state.expired) return;
    state.expired = true;
    state.current = null;
    stopTicking();
    if (state.socket) state.socket.disconnect();
    ui.app.hidden = true; ui.noToken.hidden = true; ui.expired.hidden = false;
}

/* ----------------------------------------------------------------- helpers */

function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function toast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 3200);
}

function clock(ms) {
    const total = Math.max(0, Math.floor(Number(ms) / 1000) || 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = String(total % 60).padStart(2, "0");
    return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

function trackData(payload) {
    if (!payload || typeof payload !== "object") return null;
    return payload.data && typeof payload.data === "object" ? payload.data : payload;
}

function setImage(image, fallback, source) {
    image.onerror = () => { image.hidden = true; fallback.hidden = false; };
    const valid = typeof source === "string" && source;
    if (valid) image.src = source; else image.removeAttribute("src");
    image.hidden = !valid;
    fallback.hidden = Boolean(valid);
}

function thumb(source, className) {
    const box = node("div", className);
    const image = node("img");
    image.alt = "";
    image.loading = "lazy";
    if (typeof source === "string" && source) {
        image.src = source;
        image.addEventListener("error", () => { image.remove(); box.classList.add("thumb-empty"); });
        box.append(image);
    } else {
        box.classList.add("thumb-empty");
    }
    return box;
}

function initial(name) {
    const text = typeof name === "string" ? name.trim() : "";
    return text ? text[0].toUpperCase() : "?";
}

/* ------------------------------------------------------------ guild / user */

async function loadMeta() {
    try {
        const [me, guild] = await Promise.all([api("/api/me"), api("/api/guild")]);
        const name = me.global_name || me.username || "";
        ui.avatar.alt = name ? `${name}'s avatar` : "User avatar";
        ui.avatarFallback.textContent = initial(name);
        setImage(ui.avatar, ui.avatarFallback, me.userAvatarURL);
        ui.guildName.textContent = guild.name || "Discord server";
        ui.guildIcon.alt = guild.name ? `${guild.name} icon` : "";
        setImage(ui.guildIcon, ui.guildFallback, guild.guildIconURL);
    } catch (error) {
        if (error.status !== 401) toast("Could not load your Discord profile.");
    }
}

/* ------------------------------------------------------------------ search */

function hideResults() {
    state.searchSeq += 1;
    ui.results.hidden = true;
    ui.results.replaceChildren();
}

function renderResults(tracks) {
    ui.results.replaceChildren();
    const rows = Array.isArray(tracks) ? tracks : [];
    if (rows.length === 0) ui.results.append(node("div", "search-empty", "No tracks found"));
    else for (const track of rows) ui.results.append(resultRow(track));
    ui.results.hidden = false;
}

function resultRow(track) {
    const data = trackData(track) || {};
    const row = node("button", "result");
    row.type = "button";
    const meta = node("div", "result-meta");
    meta.append(node("div", "result-title", data.title || "Unknown title"));
    meta.append(node("div", "result-author", data.author || "Unknown artist"));
    row.append(thumb(data.thumbnail, "result-thumb"), meta,
        node("span", "result-duration", data.durationMS ? clock(data.durationMS) : "—"));
    row.addEventListener("click", () => addToQueue(track));
    return row;
}

async function runSearch(query) {
    const sequence = ++state.searchSeq;
    try {
        const tracks = await api(`/api/search?query=${encodeURIComponent(query)}`);
        if (sequence === state.searchSeq) renderResults(tracks);
    } catch (error) {
        if (sequence !== state.searchSeq || error.status === 401) return;
        hideResults();
        toast("Search failed. Please try again.");
    }
}

async function addToQueue(track) {
    hideResults();
    ui.search.value = "";
    try {
        const result = await api("/api/queue", { method: "POST", body: JSON.stringify(track) });
        const position = result && typeof result.position === "number" ? result.position : null;
        toast(position === null ? "Added to queue" : `Added to queue · position ${position}`);
        scheduleQueueRefresh();
    } catch (error) {
        if (error.status === 404) toast("The bot isn't in a voice channel yet. Use /play first.");
        else if (error.status !== 401) toast("Could not add that track.");
    }
}

/* ------------------------------------------------------------------- queue */

function queueRow(track) {
    const data = trackData(track) || {};
    const item = node("li", "queue-item");
    const body = node("div", "queue-item-body");
    body.append(node("div", "queue-title", data.title || "Unknown title"));
    body.append(node("div", "queue-author", data.author || "Unknown artist"));
    item.append(thumb(data.thumbnail, "queue-thumb"), body);
    return item;
}

function renderQueue(tracks, size) {
    ui.queueList.replaceChildren();
    if (tracks.length === 0) ui.queueList.append(node("li", "queue-empty", "Queue is empty"));
    else for (const track of tracks) ui.queueList.append(queueRow(track));
    const total = Number(size) || 0;
    const more = Math.max(0, total - tracks.length);
    ui.queueMore.hidden = more === 0;
    ui.queueMore.textContent = `+${more} more`;
    ui.queueCount.hidden = total === 0;
    ui.queueCount.textContent = total > 0 ? String(total) : "";
}

async function refreshQueue() {
    const sequence = ++state.queueSeq;
    try {
        const queue = await api("/api/queue?offset=0");
        if (sequence !== state.queueSeq) return;
        renderQueue(Array.isArray(queue.tracks) ? queue.tracks : [], queue.size);
    } catch (error) {
        if (sequence !== state.queueSeq || error.status === 401) return;
        renderQueue([], 0);
    }
}

function scheduleQueueRefresh() {
    clearTimeout(state.queueRefresh);
    state.queueRefresh = setTimeout(refreshQueue, 250);
}

function setQueueOpen(open) {
    ui.queuePanel.classList.toggle("open", open);
    ui.queuePanel.setAttribute("aria-hidden", String(!open));
    ui.queueToggle.setAttribute("aria-expanded", String(open));
    if (open) {
        setFiltersOpen(false);
        refreshQueue();
    }
}

/* ----------------------------------------------------------------- filters */

const FILTERS_OFF = "Off";

// Accepts `{ filtersEnabled }`, `{ enabled }`, or a bare array of names.
function filterNames(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return null;
    if (Array.isArray(payload.filtersEnabled)) return payload.filtersEnabled;
    if (Array.isArray(payload.enabled)) return payload.enabled;
    return null;
}

function renderFilters() {
    ui.filtersList.replaceChildren();
    const names = state.filtersAvailable;
    const locked = state.current === null || state.filtersBusy;

    if (names.length === 0) {
        ui.filtersList.append(node("div", "filters-empty",
            state.filtersLoaded ? "No filters available" : "Loading filters…"));
    } else {
        for (const name of names) {
            const chip = node("button", "filter-chip", name);
            chip.type = "button";
            chip.setAttribute("aria-pressed", String(state.filters.has(name)));
            chip.disabled = locked;
            chip.addEventListener("click", () => void toggleFilter(name));
            ui.filtersList.append(chip);
        }
    }

    const count = state.filters.size;
    ui.filtersDot.hidden = count === 0;
    ui.filtersClear.hidden = count === 0;
    ui.filtersClear.disabled = locked;
    ui.filtersHint.hidden = state.current !== null;
}

function applyFilters(list) {
    state.filters = new Set(Array.isArray(list) ? list : []);
    renderFilters();
}

function setFiltersOpen(open) {
    ui.filtersPanel.hidden = !open;
    ui.filtersToggle.setAttribute("aria-expanded", String(open));
    if (open) {
        setQueueOpen(false);
        void loadFilters();
    }
}

async function loadFilters() {
    try {
        const data = await api("/api/queue/filters");
        state.filtersAvailable = Array.isArray(data.available) ? data.available : [];
        applyFilters(data.enabled);
    } catch (error) {
        if (error.status !== 401) toast("Could not load the audio filters.");
    } finally {
        state.filtersLoaded = true;
        renderFilters();
    }
}

async function sendFilters(filter, successMessage) {
    if (state.filtersBusy) return;
    state.filtersBusy = true;
    renderFilters();
    try {
        const result = await api("/api/queue/filters", {
            method: "POST",
            body: JSON.stringify({ filter })
        });
        applyFilters(result && result.filtersEnabled);
        toast(successMessage);
    } catch (error) {
        if (error.status === 404) toast("The bot isn't in a voice channel right now.");
        else if (error.status === 409) toast("There is no track to apply filters to.");
        else if (error.status !== 401) toast("Could not change the audio filters.");
    } finally {
        state.filtersBusy = false;
        renderFilters();
    }
}

function toggleFilter(name) {
    const enabling = !state.filters.has(name);
    return sendFilters(name, enabling ? `Enabled the ${name} filter.` : `Disabled the ${name} filter.`);
}

function clearFilters() {
    return sendFilters(FILTERS_OFF, "Turned off all audio filters.");
}

/* ------------------------------------------------------------------ player */

function setPlaying(playing) {
    ui.playPause.disabled = ui.skip.disabled = ui.stop.disabled = !playing;
}

function renderPlayPause() {
    const paused = state.paused;
    ui.playPause.classList.toggle("is-paused", paused);
    ui.playPause.title = paused ? "Resume" : "Pause";
    ui.playPause.setAttribute("aria-label", paused ? "Resume playback" : "Pause playback");
}

function updateProgress(elapsed) {
    const total = state.totalMs;
    const value = total > 0 ? Math.min(Math.max(elapsed, 0), total) : Math.max(elapsed, 0);
    const percent = total > 0 ? (value / total) * 100 : 0;
    ui.fill.style.width = `${percent}%`;
    ui.elapsed.textContent = clock(value);
    ui.total.textContent = clock(total);
    ui.progress.setAttribute("aria-valuenow", String(Math.round(percent)));
}

function stopTicking() {
    if (state.timer !== null) { clearInterval(state.timer); state.timer = null; }
}

function tick() {
    if (!state.current) return;
    const elapsed = state.paused ? state.elapsedBase : state.elapsedBase + (performance.now() - state.anchor);
    updateProgress(elapsed);
}

function startTicking() {
    stopTicking();
    state.timer = setInterval(tick, 250);
    tick();
}

function renderTrack(data) {
    const title = data.title || "Unknown title";
    const author = data.author || "Unknown artist";
    ui.title.textContent = ui.nowTitle.textContent = title;
    ui.author.textContent = ui.nowAuthor.textContent = author;
    ui.title.classList.remove("is-idle");
    setImage(ui.art, ui.artFallback, data.thumbnail);
    setImage(ui.nowThumb, ui.nowThumbFallback, data.thumbnail);
}

function setTrack(track, startMs = 0, totalMs = 0) {
    const data = trackData(track);
    if (!data) return;
    state.current = track;
    state.totalMs = Math.max(0, Number(data.durationMS) || Number(totalMs) || 0);
    state.elapsedBase = Math.max(0, Number(startMs) || 0);
    state.anchor = performance.now();
    state.paused = false;
    renderTrack(data);
    renderPlayPause();
    setPlaying(true);
    renderFilters();
    startTicking();
}

function setIdle() {
    Object.assign(state, { current: null, totalMs: 0, paused: false });
    stopTicking();
    renderPlayPause();
    ui.title.textContent = "Nothing playing. Search a track to start";
    ui.title.classList.add("is-idle");
    ui.author.textContent = "";
    ui.nowTitle.textContent = "Nothing playing";
    ui.nowAuthor.textContent = "Use /play or search above";
    setImage(ui.art, ui.artFallback, null);
    setImage(ui.nowThumb, ui.nowThumbFallback, null);
    setPlaying(false);
    applyFilters([]);
    updateProgress(0);
}

function applyPlayback(payload, paused) {
    if (!state.current) return;
    const ms = payload && payload.current ? Number(payload.current.value) : NaN;
    if (Number.isFinite(ms)) state.elapsedBase = Math.max(0, ms);
    else if (paused && !state.paused) state.elapsedBase += performance.now() - state.anchor;
    state.paused = paused;
    renderPlayPause();
    if (paused) { stopTicking(); updateProgress(state.elapsedBase); }
    else { state.anchor = performance.now(); startTicking(); }
}

async function loadCurrent() {
    try {
        const current = await api("/api/queue/current");
        const timestamp = current.timestamp || {};
        setTrack(current.track, timestamp.current?.value ?? 0, timestamp.total?.value ?? 0);
    } catch (error) {
        if (error.status === 404) setIdle();
        else if (error.status !== 401) toast("Could not load the current track.");
    }
}

/* ------------------------------------------------------------------- socket */

function connectSocket() {
    if (typeof io !== "function") return;
    const socket = io({ auth: { token } });
    state.socket = socket;
    socket.on("playerStart", (track) => { setTrack(track); scheduleQueueRefresh(); });
    socket.on("emptyQueue", () => { setIdle(); renderQueue([], 0); });
    socket.on("playerPause", (payload) => applyPlayback(payload, true));
    socket.on("playerResume", (payload) => applyPlayback(payload, false));
    socket.on("audioFiltersUpdate", (payload) => {
        const names = filterNames(payload);
        if (names) applyFilters(names);
        else void loadFilters();
    });
    for (const event of ["audioTrackAdd", "audioTracksAdd", "audioTrackRemove", "audioTracksRemove"]) {
        socket.on(event, scheduleQueueRefresh);
    }
}

/* -------------------------------------------------------------------- boot */

ui.search.addEventListener("input", () => {
    clearTimeout(state.searchTimer);
    state.searchSeq += 1;
    const query = ui.search.value.trim();
    if (!query) { hideResults(); return; }
    state.searchTimer = setTimeout(() => runSearch(query), 400);
});

document.addEventListener("click", (event) => {
    if (!ui.searchBox.contains(event.target)) hideResults();
    if (!ui.filtersPanel.hidden
        && !ui.filtersPanel.contains(event.target)
        && !ui.filtersToggle.contains(event.target)) {
        setFiltersOpen(false);
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { hideResults(); setQueueOpen(false); setFiltersOpen(false); }
});

ui.queueToggle.addEventListener("click", () => setQueueOpen(!ui.queuePanel.classList.contains("open")));
ui.queueClose.addEventListener("click", () => setQueueOpen(false));

ui.filtersToggle.addEventListener("click", () => setFiltersOpen(ui.filtersPanel.hidden));
ui.filtersClose.addEventListener("click", () => setFiltersOpen(false));
ui.filtersClear.addEventListener("click", () => void clearFilters());

async function runQueueCommand(path, notFound, failed) {
    try {
        await api(path, { method: "POST" });
        scheduleQueueRefresh();
        return true;
    } catch (error) {
        if (error.status === 404) toast(notFound);
        else if (error.status === 409) toast("There is no track to skip.");
        else if (error.status !== 401) toast(failed);
        return false;
    }
}

ui.playPause.addEventListener("click", async () => {
    if (!state.current) return;
    ui.playPause.disabled = true;
    try {
        const result = await api("/api/queue/toggle-pause", { method: "POST" });
        const paused = result && result.playbackState === "paused";
        applyPlayback(null, paused);
        toast(paused ? "Playback paused." : "Playback resumed.");
    } catch (error) {
        if (error.status === 404) toast("The bot isn't in a voice channel right now.");
        else if (error.status === 409) toast("There is no track to pause.");
        else if (error.status !== 401) toast("Could not change the playback state.");
    } finally {
        ui.playPause.disabled = state.current === null;
    }
});

ui.skip.addEventListener("click", () => {
    void runQueueCommand("/api/queue/skip", "The bot isn't in a voice channel right now.", "Could not skip the track.");
});

ui.stop.addEventListener("click", async () => {
    const stopped = await runQueueCommand("/api/queue/stop", "Nothing is playing right now.", "Could not stop playback.");
    if (!stopped) return;
    setIdle();
    renderQueue([], 0);
    toast("Playback stopped.");
});

if (!token) {
    ui.noToken.hidden = false;
} else {
    ui.app.hidden = false;
    setIdle();
    renderQueue([], 0);
    connectSocket();
    void Promise.allSettled([loadMeta(), loadCurrent(), refreshQueue(), loadFilters()]);
}

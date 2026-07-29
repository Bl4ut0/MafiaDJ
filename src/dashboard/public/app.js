/* MafiaDJ Web Player — Client Script */
'use strict';

let user = null;
let state = null;
let ws = null;
let isDJ = false;
let searchSource = 'youtube';
let csrfToken = '';

function jsonHeaders() {
    return {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
    };
}

async function refreshCsrfToken() {
    const response = await fetch('/api/me', { cache: 'no-store' });
    if (!response.ok) return false;

    const sessionUser = await response.json();
    csrfToken = sessionUser.csrfToken || '';
    if (user) user = { ...user, ...sessionUser };
    return csrfToken.length > 0;
}

async function csrfFetch(input, init = {}, allowRetry = true) {
    const headers = new Headers(init.headers || {});
    headers.set('X-CSRF-Token', csrfToken);

    const response = await fetch(input, { ...init, headers });
    if (!allowRetry || response.status !== 403) return response;

    const data = await response.clone().json().catch(() => null);
    if (data?.error !== 'Invalid request token. Refresh the page and try again.') {
        return response;
    }

    return await refreshCsrfToken()
        ? csrfFetch(input, init, false)
        : response;
}

// ── Progress interpolation ──────────────────────────────────────────────────
let serverElapsed = 0;
let serverTime = 0;
let progressInterval = null;

function startProgressTick() {
    clearInterval(progressInterval);
    progressInterval = setInterval(() => {
        if (!state?.currentTrack || state.isPaused || state.currentTrack.duration === 0) return;
        const now = Date.now();
        const elapsed = serverElapsed + (now - serverTime) / 1000;
        updateProgressUI(elapsed, state.currentTrack.duration);
    }, 500);
}

function updateProgressUI(elapsed, duration) {
    const pct = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('time-elapsed').textContent = fmtTime(elapsed);
    document.getElementById('time-total').textContent = duration > 0 ? fmtTime(duration) : '—';
}

function fmtTime(secs) {
    if (typeof secs === 'string' && secs.includes(':')) return secs;
    if (isNaN(secs)) return '0:00';
    secs = Math.max(0, Math.floor(secs));
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Apply state to UI ──────────────────────────────────────────────────────
function applyState(s) {
    state = s;

    // Background blur
    const backgroundImage = getSafeImageUrl(s.currentTrack?.thumbnail);
    if (backgroundImage) {
        document.getElementById('bg-blur').style.backgroundImage = `url("${backgroundImage}")`;
    } else {
        document.getElementById('bg-blur').style.backgroundImage = '';
    }

    // Jam banner
    const jamBanner = document.getElementById('jam-banner');
    if (s.spotifyAutoplay) jamBanner.classList.add('visible');
    else jamBanner.classList.remove('visible');

    // Artwork wrap jam glow
    const artworkWrap = document.getElementById('artwork-wrap');
    if (s.spotifyAutoplay) artworkWrap.classList.add('jam-active');
    else artworkWrap.classList.remove('jam-active');

    // Playing vs Idle
    const idle = document.getElementById('idle-state');
    const playing = document.getElementById('playing-state');
    const joinArea = document.getElementById('join-area');
    
    // Spotify Tab Visibility
    const spotifyTab = document.getElementById('src-spotify');
    if (spotifyTab) {
        spotifyTab.style.display = s.spotifyEnabled ? 'block' : 'none';
        if (!s.spotifyEnabled && searchSource === 'spotify') {
            setSearchSource('youtube');
        }
    }
    
    // Settings Tab Sync
    const jamToggle = document.getElementById('toggle-spotify-jam');
    if (jamToggle) {
        jamToggle.checked = s.spotifyAutoplay;
        jamToggle.disabled = !s.spotifyEnabled || !s.spotifyOwnerSyncEnabled;
    }
    
    const playbackToggle = document.getElementById('toggle-spotify-playback');
    if (playbackToggle) {
        playbackToggle.checked = s.spotifyOwnerSyncEnabled;
        playbackToggle.disabled = !s.spotifyOwnerSyncAvailable || !s.spotifyOwnerSyncRiskAcknowledged;
    }
    
    if (isDJ && !s.isConnected) {
        joinArea.style.display = 'block';
    } else {
        joinArea.style.display = 'none';
    }

    if (!s.currentTrack || !s.isConnected) {
        idle.classList.remove('hidden');
        playing.classList.add('hidden');
        clearInterval(progressInterval);
        return;
    }
    idle.classList.add('hidden');
    playing.classList.remove('hidden');

    const t = s.currentTrack;

    // Artwork
    const img = document.getElementById('artwork-img');
    const fallback = document.getElementById('artwork-fallback');
    if (t.thumbnail) {
        img.src = t.thumbnail;
        img.style.display = 'block';
        fallback.style.display = 'none';
    } else {
        img.style.display = 'none';
        fallback.style.display = 'flex';
    }

    // Source badge
    const badge = document.getElementById('source-badge');
    const sourceLabels = { youtube: 'YouTube', spotify: 'Spotify', soundcloud: 'SoundCloud', direct: 'Direct' };
    badge.textContent = sourceLabels[t.source] || t.source;
    badge.className = `source-badge source-${t.source}`;

    // Track info
    document.getElementById('track-title').textContent = t.title || 'Unknown';
    document.getElementById('track-artist').textContent = t.artist || '';
    document.getElementById('track-requester').textContent = t.requesterName
        ? `Added by ${t.requesterName}` : '';

    // Pause button
    document.getElementById('btn-playpause').textContent = s.isPaused ? '▶' : '⏸';

    // Loop button style
    const loopBtn = document.getElementById('btn-loop');
    if (s.loopMode === 'track') { loopBtn.textContent = '🔂'; loopBtn.classList.add('active'); }
    else if (s.loopMode === 'queue') { loopBtn.textContent = '🔁'; loopBtn.classList.add('active'); }
    else { loopBtn.textContent = '🔁'; loopBtn.classList.remove('active'); }

    // Volume
    const vol = s.volume ?? 50;
    document.getElementById('volume-slider').value = vol;
    document.getElementById('volume-label').textContent = vol;
    document.getElementById('volume-icon').textContent = vol === 0 ? '🔇' : vol < 50 ? '🔉' : '🔊';

    // Progress — sync server elapsed + record local time
    serverElapsed = s.elapsedSeconds ?? 0;
    serverTime = Date.now();
    updateProgressUI(serverElapsed, t.duration);
    startProgressTick();

    // Queue
    renderQueue(s.queue);

    // Server info
    const topbarServer = document.getElementById('topbar-server');
    const serverNameEl = document.getElementById('server-name');
    const serverIconEl = document.getElementById('server-icon');

    if (s.serverName || s.serverIcon) {
        if (topbarServer) topbarServer.style.display = 'flex';
        if (s.serverName && serverNameEl) {
            serverNameEl.textContent = s.serverName;
            serverNameEl.style.display = 'inline';
        }
        if (s.serverIcon && serverIconEl) {
            serverIconEl.src = s.serverIcon;
            serverIconEl.style.display = 'block';
        } else if (serverIconEl) {
            serverIconEl.style.display = 'none';
        }
    } else if (topbarServer) {
        topbarServer.style.display = 'none';
    }

    // Sync settings toggles
    const togglePlayback = document.getElementById('toggle-spotify-playback');
    if (togglePlayback) togglePlayback.checked = !!s.spotifyOwnerSyncEnabled;
    const toggleJam = document.getElementById('toggle-spotify-jam');
    if (toggleJam) toggleJam.checked = !!s.spotifyAutoplay;

    checkFavoriteStatus();
}

async function checkFavoriteStatus() {
    if (!state?.currentTrack) return;
    try {
        const res = await fetch(`/api/favorites/check?url=${encodeURIComponent(state.currentTrack.url)}`);
        const { isFavorite } = await res.json();
        const btn = document.getElementById('btn-like');
        if (isFavorite) {
            btn.classList.add('favorited');
            btn.textContent = '❤️';
        } else {
            btn.classList.remove('favorited');
            btn.textContent = '🤍';
        }
    } catch {}
}

async function toggleFavorite() {
    if (!state?.currentTrack) return;
    try {
        const res = await csrfFetch('/api/favorites/toggle', {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify(state.currentTrack)
        });
        if (res.ok) {
            checkFavoriteStatus();
            if (document.getElementById('panel-library').classList.contains('active')) {
                loadFavorites();
            }
        }
    } catch {}
}

function renderQueue(queue) {
    const list = document.getElementById('queue-list');
    const empty = document.getElementById('queue-empty');
    if (!queue || queue.length === 0) {
        empty.style.display = 'block'; list.innerHTML = ''; return;
    }
    empty.style.display = 'none';
    const sourceLabels = { youtube: 'YT', spotify: 'SP', soundcloud: 'SC', direct: '🔗' };
    list.innerHTML = queue.map((t, i) => `
        <div class="queue-item">
          <img class="queue-thumb" src="${escAttr(t.thumbnail)}" alt="" onerror="this.style.display='none'">
          <div class="queue-info">
            <div class="queue-title">${escHtml(t.title)}</div>
            <div class="queue-sub">${escHtml(t.artist || '')} • ${fmtTime(t.duration)}</div>
          </div>
          <span class="queue-source source-${t.source}">${sourceLabels[t.source] || '?'}</span>
          ${(isDJ || t.requesterId === user?.userId) ? `<button class="btn-remove-queue" onclick="removeFromQueue(${i})" title="Remove">✕</button>` : ''}
        </div>
    `).join('');
}

// ── WebSocket ───────────────────────────────────────────────────────────────
function connectWS() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onmessage = e => {
        try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'stateUpdate') applyState(msg.data);
            if (msg.type === 'favoritesUpdated' && user && msg.userId === user.userId) {
                checkFavoriteStatus();
                if (document.getElementById('panel-library').classList.contains('active')) {
                    loadFavorites();
                }
            }
        } catch {}
    };
    ws.onclose = () => setTimeout(connectWS, 3000); // auto-reconnect
    ws.onerror = () => ws.close();
}

// ── Auth / Init ─────────────────────────────────────────────────────────────
async function init() {
    try {
        const res = await fetch('/api/me');
        if (!res.ok) {
            // Not logged in — show login screen
            document.getElementById('login-screen').style.display = 'flex';
            return;
        }
        user = await res.json();
        csrfToken = user.csrfToken || '';
        isDJ = user.role === 'dj' || user.role === 'admin';

        // Update UI with user info
        document.getElementById('user-name').textContent = user.username;
        const av = document.getElementById('user-avatar');
        if (user.avatar) {
            av.src = `https://cdn.discordapp.com/avatars/${user.userId}/${user.avatar}.png?size=64`;
        } else {
            av.style.display = 'none';
        }
        const badge = document.getElementById('role-badge');
        badge.textContent = user.role === 'admin' ? 'Admin' : user.role === 'dj' ? 'DJ' : 'Member';
        badge.className = `role-badge role-${user.role}`;

        // Gate DJ-only controls
        if (!isDJ) {
            document.querySelectorAll('.dj-only').forEach(el => el.classList.add('no-dj'));
        }

        // Show app
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app').style.display = 'flex';

        // Load initial state
        const stateRes = await fetch('/api/state');
        if (stateRes.ok) applyState(await stateRes.json());

        // Connect WebSocket
        connectWS();

        // Load Library
        await loadPlaylists();
        await loadFavorites();
        await loadHistory();
        
        // Load voice channels
        if (isDJ) {
            loadChannels();
        }

        // Check YouTube Auth Status
        checkYouTubeAuthStatus();

    } catch (err) {
        console.error('[MafiaDJ] Init error:', err);
    }
}

async function logout() {
    try {
        await csrfFetch('/auth/logout', {
            method: 'POST',
            headers: { 'X-CSRF-Token': csrfToken },
        });
    } finally {
        location.href = '/';
    }
}

async function loadChannels() {
    try {
        const res = await fetch('/api/channels');
        const channels = await res.json();
        const select = document.getElementById('channel-select');
        select.innerHTML = '<option value="">Select a voice channel...</option>' + 
            channels.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
    } catch {}
}

async function joinSelectedChannel() {
    const select = document.getElementById('channel-select');
    const channelId = select.value;
    if (!channelId) return;
    await apiPost('/api/join', { channelId });
}

async function removeFromQueue(index) {
    try {
        const res = await csrfFetch('/api/queue/remove', {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({ index }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data.error) alert(data.error);
        } else {
            showToast("Removed from queue");
        }
    } catch (err) { console.error(err); }
}

async function toggleSpotifyJam(enabled) {
    if (!user || user.role !== 'admin') {
        showToast("🔒 Admin role required");
        const toggleJam = document.getElementById('toggle-spotify-jam');
        if (toggleJam) toggleJam.checked = !enabled;
        return;
    }
    try {
        const res = await csrfFetch('/api/settings/jam', {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({ enabled }),
        });
        if (res.ok) {
            showToast(enabled ? "Spotify Jam enabled" : "Spotify Jam disabled");
        } else {
            const data = await res.json().catch(() => ({}));
            showToast(data.error || "Failed to update settings");
            const toggleJam = document.getElementById('toggle-spotify-jam');
            if (toggleJam) toggleJam.checked = !enabled;
        }
    } catch (err) { console.error(err); }
}

async function toggleSpotifyPlayback(enabled) {
    if (!user || user.role !== 'admin') {
        showToast("🔒 Admin role required");
        const togglePlayback = document.getElementById('toggle-spotify-playback');
        if (togglePlayback) togglePlayback.checked = !enabled;
        return;
    }
    try {
        const res = await csrfFetch('/api/settings/spotify', {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({ enabled }),
        });
        if (res.ok) {
            showToast(enabled ? "Spotify Playback enabled" : "Spotify Playback disabled");
        } else {
            const data = await res.json().catch(() => ({}));
            showToast(data.error || "Failed to update settings");
            const togglePlayback = document.getElementById('toggle-spotify-playback');
            if (togglePlayback) togglePlayback.checked = !enabled;
        }
    } catch (err) { console.error(err); }
}

// ── YouTube Auth Handlers ──────────────────────────────────────────────────
let ytPollTimer = null;
window.isYtAuthenticated = false;

async function checkYouTubeAuthStatus() {
    try {
        const res = await fetch('/api/youtube/status');
        const data = await res.json();
        window.isYtAuthenticated = !!data.authenticated;
        
        const btn = document.getElementById('btn-yt-connect');
        const browserBtn = document.getElementById('btn-yt-browser');
        const desc = document.getElementById('yt-auth-desc');
        
        if (browserBtn) {
            browserBtn.disabled = !data.browserLaunchAvailable || !user || user.role !== 'admin';
            browserBtn.style.display = data.browserLaunchAvailable ? '' : 'none';
        }

        if (data.browserProfileAvailable) {
            if (btn) { btn.textContent = 'Fallback cookies'; btn.style.background = ''; btn.disabled = false; }
            if (desc) desc.textContent = 'A private server-side Chromium profile is available. Only Discord admins can open or replace this instance session.';
        } else if (data.authenticated) {
            if (btn) { btn.textContent = '✓ Playback cookies loaded'; btn.style.background = 'var(--green)'; btn.disabled = false; }
            if (desc) desc.textContent = 'Instance playback cookies are present. Only Discord admins can replace them.';
        } else {
            if (btn) { btn.textContent = 'Manage Playback Cookies'; btn.style.background = ''; btn.disabled = false; }
            if (desc) desc.textContent = 'No instance playback cookies are configured.';
        }
    } catch {}
}

function launchYouTubeBrowser() {
    if (!user || user.role !== 'admin') {
        showToast("Admin role required");
        return;
    }
    const session = window.open('/api/youtube/browser/launch', '_blank', 'noopener');
    if (!session) showToast('Allow pop-ups to open the private browser session.');
}

function startYouTubeAuth() {
    if (!user || user.role !== 'admin') {
        showToast("🔒 Admin role required");
        return;
    }
    document.getElementById('yt-auth-modal').classList.remove('hidden');
}

function closeYtAuthModal() {
    document.getElementById('yt-auth-modal').classList.add('hidden');
}

async function saveCookieContent(content) {
    try {
        const res = await csrfFetch('/api/youtube/cookies', {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({ cookiesContent: content })
        });
        const data = await res.json();
        if (res.ok && data.ok) {
            showToast('✅ YouTube Cookies Saved!');
            closeYtAuthModal();
            checkYouTubeAuthStatus();
        } else {
            alert(data.error || 'Failed to save cookies.');
        }
    } catch {
        alert('Failed to connect to server.');
    }
}

function handleCookieFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        if (content) saveCookieContent(content);
    };
    reader.readAsText(file);
}

function savePastedCookies() {
    const textarea = document.getElementById('yt-cookie-text');
    const content = textarea.value.trim();
    if (!content) {
        alert('Please paste valid cookies.txt content or upload a file.');
        return;
    }
    saveCookieContent(content);
}

// Explicitly export to global window scope so inline onclick handler works
window.startYouTubeAuth = startYouTubeAuth;
window.launchYouTubeBrowser = launchYouTubeBrowser;
window.closeYtAuthModal = closeYtAuthModal;
window.checkYouTubeAuthStatus = checkYouTubeAuthStatus;
window.handleCookieFileUpload = handleCookieFileUpload;
window.savePastedCookies = savePastedCookies;

// ── Controls ────────────────────────────────────────────────────────────────
async function apiPost(endpoint, body = {}) {
    if (!isDJ) return;
    try {
        const res = await csrfFetch(endpoint, {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data.error) {
                if (data.error.includes('Sign in') || data.error.includes('bot') || data.error.includes('yt-dlp')) {
                    if (!window.isYtAuthenticated && typeof window.startYouTubeAuth === 'function') {
                        if (confirm('YouTube authentication is required to play this track. Open Google Sign-In now?')) {
                            window.startYouTubeAuth();
                            return;
                        }
                    }
                }
                alert(data.error);
            }
        }
    } catch (err) { console.error(err); }
}

function togglePause() {
    if (!state || !isDJ) return;
    apiPost('/api/pause', { paused: !state.isPaused });
}

let volumeTimer = null;
function onVolumeChange(val) {
    document.getElementById('volume-label').textContent = val;
    document.getElementById('volume-icon').textContent = val == 0 ? '🔇' : val < 50 ? '🔉' : '🔊';
    clearTimeout(volumeTimer);
    volumeTimer = setTimeout(() => apiPost('/api/volume', { volume: parseInt(val) }), 200);
}

// ── Progress bar click-to-seek ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) progressBar.title = 'Seeking is not supported for streamed tracks.';
});

// ── Tabs ────────────────────────────────────────────────────────────────────
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.getElementById(`panel-${tab}`).classList.add('active');
}

function switchLibView(view) {
    document.querySelectorAll('.lib-tab').forEach(b => b.classList.remove('active'));
    const tabBtn = document.getElementById(`lib-tab-${view}`);
    if (tabBtn) tabBtn.classList.add('active');
    
    document.querySelectorAll('.lib-view').forEach(v => v.style.display = 'none');
    document.getElementById(`lib-view-${view}`).style.display = view === 'playlist-detail' ? 'flex' : 'block';
}

// ── Library (Favorites & Playlists) ─────────────────────────────────────────

async function loadFavorites() {
    const list = document.getElementById('favorites-list');
    try {
        const res = await fetch('/api/favorites');
        const data = await res.json();
        if (!data || data.length === 0) {
            list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">No favorites yet. Click the 🤍 icon on the player to add some.</div>';
            return;
        }
        const playlistOptions = libraryPlaylists
            .map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`)
            .join('');
        list.innerHTML = data.map(r => `
            <div class="result-item">
              <img class="result-thumb" src="${escAttr(r.thumbnail)}" alt="" onerror="this.style.display='none'">
              <div class="result-info" onclick="addToQueue(${jsArg(r.url)})">
                <div class="result-title">${escHtml(r.title)}</div>
                <div class="result-sub">${escHtml(r.artist)}</div>
              </div>
              <select aria-label="Add to playlist" style="max-width:140px;background:var(--surface);color:var(--text);border:1px solid var(--border);padding:6px" onchange="addFavoriteToPlaylist(${r.id}, this.value); this.value=''">
                <option value="">Add to playlist...</option>
                ${playlistOptions}
              </select>
              <span class="result-add" onclick="addToQueue(${jsArg(r.url)})">▶</span>
            </div>
        `).join('');
    } catch {
        list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--red)">Failed to load favorites.</div>';
    }
}

async function loadHistory() {
    const list = document.getElementById('history-list');
    try {
        const res = await fetch('/api/history');
        const data = await res.json();
        if (!data || data.length === 0) {
            list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">No playback history yet.</div>';
            return;
        }
        list.innerHTML = data.map(r => `
            <div class="result-item">
              <img class="result-thumb" src="${escAttr(r.thumbnail)}" alt="" onerror="this.style.display='none'">
              <div class="result-info" onclick="addToQueue(${jsArg(r.url)})">
                <div class="result-title">${escHtml(r.title)}</div>
                <div class="result-sub">${escHtml(r.artist || '')}</div>
              </div>
              <button class="result-add" onclick="addToQueue(${jsArg(r.url)})" title="Queue track">+</button>
            </div>
        `).join('');
    } catch {
        list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--red)">Failed to load history.</div>';
    }
}

let libraryPlaylists = [];

async function loadPlaylists() {
    const list = document.getElementById('playlists-list');
    try {
        const res = await fetch('/api/playlists');
        const data = await res.json();
        libraryPlaylists = Array.isArray(data) ? data : [];
        if (!data || data.length === 0) {
            list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">No playlists yet. Create one above!</div>';
            return;
        }
        list.innerHTML = data.map(p => `
            <div class="result-item" onclick="openPlaylist(${p.id}, ${jsArg(p.name)})">
              <div class="result-info">
                <div class="result-title" style="font-size:15px; font-weight:600;">📁 ${escHtml(p.name)}</div>
              </div>
              <span class="result-add">➔</span>
            </div>
        `).join('');
    } catch {
        list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--red)">Failed to load playlists.</div>';
    }
}

async function addFavoriteToPlaylist(favoriteId, playlistId) {
    if (!playlistId) return;
    const res = await csrfFetch(`/api/playlists/${playlistId}/add`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ favoriteId }),
    });
    const data = await res.json().catch(() => ({}));
    showToast(res.ok ? 'Added to playlist' : (data.error || 'Could not add to playlist'));
}

async function createPlaylist() {
    const input = document.getElementById('new-playlist-name');
    const name = input.value.trim();
    if (!name) return;
    try {
        await csrfFetch('/api/playlists', {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({ name })
        });
        input.value = '';
        await loadPlaylists();
        await loadFavorites();
    } catch (err) { alert('Failed to create playlist'); }
}

let currentPlaylistId = null;

async function openPlaylist(id, name) {
    currentPlaylistId = id;
    document.getElementById('lib-detail-title').textContent = name;
    switchLibView('playlist-detail');
    
    const list = document.getElementById('playlist-tracks-list');
    list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">Loading tracks...</div>';
    
    try {
        const res = await fetch(`/api/playlists/${id}/tracks`);
        const data = await res.json();
        if (!data || data.length === 0) {
            list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">Playlist is empty.</div>';
            return;
        }
        list.innerHTML = data.map(r => `
            <div class="result-item">
              <img class="result-thumb" src="${escAttr(r.thumbnail)}" alt="" onerror="this.style.display='none'">
              <div class="result-info" onclick="addToQueue(${jsArg(r.url)})">
                <div class="result-title">${escHtml(r.title)}</div>
                <div class="result-sub">${escHtml(r.artist)}</div>
              </div>
              <span class="result-add" onclick="addToQueue(${jsArg(r.url)})">▶</span>
            </div>
        `).join('');
    } catch {
        list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--red)">Failed to load tracks.</div>';
    }
}

async function playPlaylist() {
    if (!isDJ || !currentPlaylistId) return;
    // Play all tracks in the current playlist
    try {
        const res = await fetch(`/api/playlists/${currentPlaylistId}/tracks`);
        const data = await res.json();
        if (!data || data.length === 0) return;
        
        for (const track of data) {
            await apiPost('/api/play', { url: track.url });
        }
        showToast(`Added ${data.length} tracks to queue`);
        switchTab('queue');
    } catch {}
}

// ── Universal Search ────────────────────────────────────────────────────────
function openSearchModal() {
    const modal = document.getElementById('search-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('global-search-input')?.focus();
    }
}

function closeSearchModal() {
    const modal = document.getElementById('search-modal');
    if (modal) modal.classList.add('hidden');
}

async function doGlobalSearch() {
    const input = document.getElementById('global-search-input');
    const q = input.value.trim();
    if (!q) return;

    // If it's a direct URL, just add it to queue and close
    if (q.startsWith('http://') || q.startsWith('https://')) {
        addToQueue(q);
        input.value = '';
        closeSearchModal();
        return;
    }

    const resDiv = document.getElementById('universal-search-results');
    resDiv.innerHTML = '<div style="padding:32px;text-align:center;">Searching...</div>';

    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&source=all`);
        const data = await res.json();
        
        if (data.error) {
            resDiv.innerHTML = `<div style="padding:32px;text-align:center;color:var(--red)">${escHtml(data.error)}</div>`;
            return;
        }
        
        if (!data || data.length === 0) {
            resDiv.innerHTML = '<div style="padding:32px;text-align:center;">No results found.</div>';
            return;
        }

        let html = '';
        const youtubeResults = data.filter(r => r.source === 'youtube');
        const spotifyResults = data.filter(r => r.source === 'spotify');

        if (youtubeResults.length > 0) {
            html += `<h3 style="padding: 12px 16px; margin: 0; color: var(--text-sub); font-size: 14px; border-bottom: 1px solid var(--border);">YouTube</h3>`;
            html += youtubeResults.map(r => `
                <div class="result-item" onclick="addToQueue(${jsArg(r.url)}); closeSearchModal();">
                  <img class="result-thumb" src="${escAttr(r.thumbnail)}" alt="" onerror="this.style.display='none'">
                  <div class="result-info">
                    <div class="result-title">${escHtml(r.title)}</div>
                    <div class="result-sub">${escHtml(r.artist || '')} • ${fmtTime(r.duration)}</div>
                  </div>
                  <span class="result-add">+</span>
                </div>
            `).join('');
        }

        if (spotifyResults.length > 0) {
            html += `<h3 style="padding: 12px 16px; margin: 0; color: var(--text-sub); font-size: 14px; border-bottom: 1px solid var(--border); border-top: 4px solid var(--border);">Spotify</h3>`;
            html += spotifyResults.map(r => `
                <div class="result-item" onclick="addToQueue(${jsArg(r.url)}); closeSearchModal();">
                  <img class="result-thumb" src="${escAttr(r.thumbnail)}" alt="" onerror="this.style.display='none'">
                  <div class="result-info">
                    <div class="result-title">${escHtml(r.title)}</div>
                    <div class="result-sub">${escHtml(r.artist || '')} • ${fmtTime(r.duration)}</div>
                  </div>
                  <span class="result-add">+</span>
                </div>
            `).join('');
        }
        
        resDiv.innerHTML = html;
    } catch {
        resDiv.innerHTML = '<div style="padding:32px;text-align:center;color:var(--red)">Search failed</div>';
    }
}

async function addToQueue(url) {
    if (!isDJ) return;
    await apiPost('/api/play', { url });
    showToast("Added to queue");
    switchTab('queue');
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function escHtml(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function jsArg(value) {
    return escAttr(JSON.stringify(String(value ?? '')));
}
function getSafeImageUrl(value) {
    if (typeof value !== 'string') return false;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
        return null;
    }
}

function showToast(msg) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Export all onclick handlers to global window scope
window.addToQueue = addToQueue;
window.openSearchModal = openSearchModal;
window.createPlaylist = createPlaylist;
window.openPlaylist = openPlaylist;
window.playPlaylist = playPlaylist;
window.logout = logout;
window.addFavoriteToPlaylist = addFavoriteToPlaylist;

// ── Boot ─────────────────────────────────────────────────────────────────────
init();

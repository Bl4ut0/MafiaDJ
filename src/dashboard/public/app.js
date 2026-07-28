/* MafiaDJ Web Player — Client Script */
'use strict';

let user = null;
let state = null;
let ws = null;
let isDJ = false;
let searchSource = 'youtube';

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
    if (s.currentTrack?.thumbnail) {
        document.getElementById('bg-blur').style.backgroundImage = `url('${s.currentTrack.thumbnail}')`;
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
        jamToggle.disabled = !s.spotifyEnabled || !s.spotifyPlaybackEnabled;
    }
    
    const playbackToggle = document.getElementById('toggle-spotify-playback');
    if (playbackToggle) {
        playbackToggle.checked = s.spotifyPlaybackEnabled;
        playbackToggle.disabled = !s.spotifyEnabled;
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
    const serverNameEl = document.getElementById('server-name');
    if (s.serverName && s.serverName !== 'MafiaDJ') {
        serverNameEl.textContent = s.serverName;
    } else {
        serverNameEl.textContent = '';
    }
    if (s.serverIcon) {
        const icon = document.getElementById('server-icon');
        icon.src = s.serverIcon; icon.style.display = 'inline-block';
    }

    // Sync settings toggles
    const togglePlayback = document.getElementById('toggle-spotify-playback');
    if (togglePlayback) togglePlayback.checked = !!s.spotifyPlaybackEnabled;
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
    if (!state?.currentTrack || !isDJ) return;
    try {
        const res = await fetch('/api/favorites/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
          <img class="queue-thumb" src="${t.thumbnail || ''}" alt="" onerror="this.style.display='none'">
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
        loadFavorites();
        loadPlaylists();
        
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
        const res = await fetch('/api/queue/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        const res = await fetch('/api/settings/jam', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        const res = await fetch('/api/settings/spotify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

async function checkYouTubeAuthStatus() {
    try {
        const res = await fetch('/api/youtube/status');
        const data = await res.json();
        const btn = document.getElementById('btn-yt-connect');
        const desc = document.getElementById('yt-auth-desc');
        
        if (data.authenticated) {
            if (btn) { btn.textContent = '✓ Connected'; btn.style.background = 'var(--green)'; btn.disabled = true; }
            if (desc) desc.textContent = 'YouTube Account Active (Authenticated via Google)';
        } else {
            if (btn) { btn.textContent = 'Connect Account'; btn.style.background = ''; btn.disabled = false; }
            if (desc) desc.textContent = 'Authenticate with Google to bypass YouTube bot restrictions.';
        }
    } catch {}
}

async function startYouTubeAuth() {
    if (!user || user.role !== 'admin') {
        showToast("🔒 Admin role required");
        return;
    }
    try {
        const res = await fetch('/api/youtube/auth/init', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
            alert(data.error || 'Failed to start authentication');
            return;
        }

        document.getElementById('yt-user-code').textContent = data.user_code;
        const verifyLink = document.getElementById('yt-verify-link');
        verifyLink.href = data.verification_url;

        document.getElementById('yt-auth-modal').classList.remove('hidden');
        document.getElementById('yt-auth-status').textContent = 'Waiting for Google authorization...';

        // Start polling
        clearInterval(ytPollTimer);
        const intervalMs = (data.interval || 5) * 1000;
        ytPollTimer = setInterval(() => pollYouTubeAuth(data.device_code), intervalMs);

    } catch (err) {
        alert('Could not start YouTube authentication.');
    }
}

async function pollYouTubeAuth(deviceCode) {
    try {
        const res = await fetch('/api/youtube/auth/poll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceCode })
        });
        const data = await res.json();

        if (data.status === 'complete') {
            clearInterval(ytPollTimer);
            document.getElementById('yt-auth-status').textContent = '✅ Connected successfully!';
            showToast('YouTube Account Connected!');
            setTimeout(closeYtAuthModal, 1500);
            checkYouTubeAuthStatus();
        } else if (data.status === 'expired' || data.status === 'error') {
            clearInterval(ytPollTimer);
            document.getElementById('yt-auth-status').textContent = '❌ Authorization expired or failed.';
        }
    } catch {}
}

function closeYtAuthModal() {
    clearInterval(ytPollTimer);
    document.getElementById('yt-auth-modal').classList.add('hidden');
}

// ── Controls ────────────────────────────────────────────────────────────────
async function apiPost(endpoint, body = {}) {
    if (!isDJ) return;
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data.error) alert(data.error);
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
    document.getElementById('progress-bar').addEventListener('click', (e) => {
        if (!isDJ || !state?.currentTrack?.duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        const seconds = Math.floor(pct * state.currentTrack.duration);
        apiPost('/api/seek', { seconds });
    });
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
        list.innerHTML = data.map(r => `
            <div class="result-item">
              <img class="result-thumb" src="${r.thumbnail || ''}" alt="" onerror="this.style.display='none'">
              <div class="result-info" onclick="addToQueue('${escAttr(r.url)}')">
                <div class="result-title">${escHtml(r.title)}</div>
                <div class="result-sub">${escHtml(r.artist)}</div>
              </div>
              <span class="result-add" onclick="addToQueue('${escAttr(r.url)}')">▶</span>
            </div>
        `).join('');
    } catch {
        list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--red)">Failed to load favorites.</div>';
    }
}

async function loadPlaylists() {
    const list = document.getElementById('playlists-list');
    try {
        const res = await fetch('/api/playlists');
        const data = await res.json();
        if (!data || data.length === 0) {
            list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">No playlists yet. Create one above!</div>';
            return;
        }
        list.innerHTML = data.map(p => `
            <div class="result-item" onclick="openPlaylist(${p.id}, '${escAttr(p.name)}')">
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

async function createPlaylist() {
    const input = document.getElementById('new-playlist-name');
    const name = input.value.trim();
    if (!name) return;
    try {
        await fetch('/api/playlists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        input.value = '';
        loadPlaylists();
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
              <img class="result-thumb" src="${r.thumbnail || ''}" alt="" onerror="this.style.display='none'">
              <div class="result-info" onclick="addToQueue('${escAttr(r.url)}')">
                <div class="result-title">${escHtml(r.title)}</div>
                <div class="result-sub">${escHtml(r.artist)}</div>
              </div>
              <span class="result-add" onclick="addToQueue('${escAttr(r.url)}')">▶</span>
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
                <div class="result-item" onclick="addToQueue('${escAttr(r.url)}'); closeSearchModal();">
                  <img class="result-thumb" src="${r.thumbnail || ''}" alt="" onerror="this.style.display='none'">
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
                <div class="result-item" onclick="addToQueue('${escAttr(r.url)}'); closeSearchModal();">
                  <img class="result-thumb" src="${r.thumbnail || ''}" alt="" onerror="this.style.display='none'">
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
    return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

// ── Boot ─────────────────────────────────────────────────────────────────────
init();

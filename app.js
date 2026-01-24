// ============================================
// MULTIVIEW.VIDEO - Database-backed version
// Collaborative video watching platform
// ============================================

const { useState, useEffect, useRef, useCallback } = React;

// Configuration
const GOOGLE_CLIENT_ID = window.APP_CONFIG?.GOOGLE_CLIENT_ID || '';
const API_BASE = window.APP_CONFIG?.API_BASE || '/api';
const PRESENCE_UPDATE_INTERVAL = 10000;
const PRESENCE_TIMEOUT = 30000;

// ============================================
// API Client
// ============================================
const api = {
  getToken: () => localStorage.getItem('mv_token'),
  setToken: (token) => localStorage.setItem('mv_token', token),
  clearToken: () => localStorage.removeItem('mv_token'),
  
  getGuestId: () => {
    let guestId = localStorage.getItem('mv_guest_id');
    if (!guestId) {
      guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('mv_guest_id', guestId);
    }
    return guestId;
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    };

    const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  auth: {
    async register(email, username, password, displayName) {
      const data = await api.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, username, password, displayName })
      });
      api.setToken(data.token);
      return data.user;
    },
    async login(identifier, password) {
      const data = await api.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password })
      });
      api.setToken(data.token);
      return data.user;
    },
    async googleLogin(credential) {
      const data = await api.request('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential })
      });
      api.setToken(data.token);
      return data.user;
    },
    async logout() {
      try { await api.request('/auth/logout', { method: 'POST' }); } finally { api.clearToken(); }
    },
    async getCurrentUser() {
      if (!api.getToken()) return null;
      try {
        const data = await api.request('/auth/me');
        return data.user;
      } catch { api.clearToken(); return null; }
    },
    async updateProfile(updates) {
      const data = await api.request('/auth/profile', { method: 'PUT', body: JSON.stringify(updates) });
      return data.user;
    }
  },

  rooms: {
    async list() { return (await api.request('/rooms')).rooms; },
    async get(roomId) { return (await api.request(`/rooms/${roomId}`)).room; },
    async create(name) { return (await api.request('/rooms', { method: 'POST', body: JSON.stringify({ name }) })).room; },
    async update(roomId, updates) { return (await api.request(`/rooms/${roomId}`, { method: 'PUT', body: JSON.stringify(updates) })).room; },
    async delete(roomId) { await api.request(`/rooms/${roomId}`, { method: 'DELETE' }); },
    async join(roomId, displayName) {
      const guestId = api.getToken() ? null : api.getGuestId();
      await api.request(`/rooms/${roomId}/join`, { method: 'POST', body: JSON.stringify({ displayName, guestId }) });
    },
    async kick(roomId, visitorId, guestId) {
      await api.request(`/rooms/${roomId}/kick`, { method: 'POST', body: JSON.stringify({ visitorId, guestId }) });
    }
  },

  playlists: {
    async list(roomId) { return (await api.request(`/playlists?roomId=${roomId}`)).playlists || []; },
    async create(roomId, name) { return (await api.request('/playlists', { method: 'POST', body: JSON.stringify({ roomId, name }) })).playlist; },
    async update(playlistId, updates) { return (await api.request(`/playlists/${playlistId}`, { method: 'PUT', body: JSON.stringify(updates) })).playlist; },
    async delete(playlistId) { await api.request(`/playlists/${playlistId}`, { method: 'DELETE' }); },
    async addVideo(playlistId, video) { return (await api.request(`/playlists/${playlistId}/videos`, { method: 'POST', body: JSON.stringify(video) })).video; },
    async removeVideo(playlistId, videoId) { await api.request(`/playlists/${playlistId}/videos/${videoId}`, { method: 'DELETE' }); },
    async reorderVideos(playlistId, videoIds) { await api.request(`/playlists/${playlistId}/reorder`, { method: 'PUT', body: JSON.stringify({ videoIds }) }); }
  },

  presence: {
    async heartbeat(roomId, status = 'online') {
      const guestId = api.getToken() ? null : api.getGuestId();
      await api.request('/presence/heartbeat', { method: 'POST', body: JSON.stringify({ roomId, guestId, status }) });
    },
    async getMembers(roomId) { return (await api.request(`/presence/${roomId}`)).members || []; },
    async leave(roomId) {
      const guestId = api.getToken() ? null : api.getGuestId();
      await api.request('/presence/leave', { method: 'POST', body: JSON.stringify({ roomId, guestId }) });
    },
    async updateMember(roomId, visitorId, guestId, updates) {
      await api.request('/presence/member', { method: 'PUT', body: JSON.stringify({ roomId, visitorId, guestId, ...updates }) });
    }
  }
};

// ============================================
// Utilities
// ============================================
const parseVideoUrl = (url) => {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { type: 'youtube', id: ytMatch[1], url };
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { type: 'vimeo', id: vimeoMatch[1], url };
  const spotifyMatch = url.match(/spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/);
  if (spotifyMatch) return { type: 'spotify', contentType: spotifyMatch[1], id: spotifyMatch[2], url };
  if (url.includes('soundcloud.com')) return { type: 'soundcloud', url };
  if (url.match(/\.(mp4|webm|ogg|mp3|wav|m4a)(\?|$)/i)) return { type: 'direct', url };
  return null;
};

const getVideoTypeIcon = (type) => ({ youtube: '▶️', spotify: '🎵', vimeo: '🎬', soundcloud: '🔊', direct: '📹' }[type] || '📹');
const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const parseRoomUrl = () => {
  const match = window.location.hash.match(/#\/room\/([^\/]+)\/([^\/]+)/);
  return match ? { hostId: match[1], roomId: match[2] } : null;
};

// ============================================
// Presence Hook
// ============================================
const usePresence = (roomId, visitorId, displayName, isOwner) => {
  const [connectedUsers, setConnectedUsers] = useState([]);

  const refreshPresence = useCallback(async () => {
    if (!roomId) return;
    try {
      const members = await api.presence.getMembers(roomId);
      setConnectedUsers(members.map(m => ({
        visitorId: m.user_id || m.guest_id,
        displayName: m.display_name,
        color: m.color,
        status: m.status || 'offline',
        isYou: (m.user_id || m.guest_id) === visitorId,
        isOwner: m.is_owner
      })).sort((a, b) => {
        if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
        if (a.isYou !== b.isYou) return a.isYou ? -1 : 1;
        if (a.status !== b.status) return a.status === 'online' ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      }));
    } catch (err) { console.error('Presence fetch failed:', err); }
  }, [roomId, visitorId]);

  useEffect(() => {
    if (!roomId || !visitorId || !displayName) return;
    const update = async () => {
      try { await api.presence.heartbeat(roomId, 'online'); await refreshPresence(); } catch (err) { console.error('Presence update failed:', err); }
    };
    update();
    const interval = setInterval(update, PRESENCE_UPDATE_INTERVAL);
    return () => { clearInterval(interval); api.presence.leave(roomId).catch(() => {}); };
  }, [roomId, visitorId, displayName, refreshPresence]);

  return { connectedUsers, refreshPresence };
};

// ============================================
// Icon Component
// ============================================
const Icon = ({ name, size = 'md' }) => {
  const s = { sm: 14, md: 18, lg: 24 }[size] || 18;
  const icons = {
    play: <polygon points="5,3 19,12 5,21" />,
    pause: <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>,
    prev: <><polygon points="11,12 22,4 22,20"/><line x1="2" y1="4" x2="2" y2="20"/></>,
    next: <><polygon points="13,12 2,4 2,20"/><line x1="22" y1="4" x2="22" y2="20"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    trash: <><polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"/></>,
    edit: <><path d="M11,4H4a2,2,0,0,0-2,2v14a2,2,0,0,0,2,2h14a2,2,0,0,0,2-2v-7"/><path d="M18.5,2.5a2.121,2.121,0,0,1,3,3L12,15l-4,1,1-4Z"/></>,
    menu: <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4,15a1.65,1.65,0,0,0,.33,1.82l.06.06a2,2,0,0,1-2.83,2.83l-.06-.06a1.65,1.65,0,0,0-1.82-.33,1.65,1.65,0,0,0-1,1.51V21a2,2,0,0,1-4,0v-.09A1.65,1.65,0,0,0,9,19.4a1.65,1.65,0,0,0-1.82.33l-.06.06a2,2,0,0,1-2.83-2.83l.06-.06a1.65,1.65,0,0,0,.33-1.82,1.65,1.65,0,0,0-1.51-1H3a2,2,0,0,1,0-4h.09A1.65,1.65,0,0,0,4.6,9a1.65,1.65,0,0,0-.33-1.82l-.06-.06A2,2,0,0,1,7.04,4.29l.06.06a1.65,1.65,0,0,0,1.82.33H9a1.65,1.65,0,0,0,1-1.51V3a2,2,0,0,1,4,0v.09a1.65,1.65,0,0,0,1,1.51,1.65,1.65,0,0,0,1.82-.33l.06-.06a2,2,0,0,1,2.83,2.83l-.06.06a1.65,1.65,0,0,0-.33,1.82V9a1.65,1.65,0,0,0,1.51,1H21a2,2,0,0,1,0,4h-.09A1.65,1.65,0,0,0,19.4,15Z"/></>,
    logout: <><path d="M9,21H5a2,2,0,0,1-2-2V5a2,2,0,0,1,2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    upload: <><path d="M21,15v4a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
    share: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></>,
    users: <><path d="M17,21v-2a4,4,0,0,0-4-4H5a4,4,0,0,0-4,4v2"/><circle cx="9" cy="7" r="4"/><path d="M23,21v-2a4,4,0,0,0-3-3.87"/><path d="M16,3.13a4,4,0,0,1,0,7.75"/></>,
    home: <><path d="M3,9l9-7,9,7v11a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2Z"/><polyline points="9,22 9,12 15,12 15,22"/></>,
    enter: <><path d="M15,3h4a2,2,0,0,1,2,2v14a2,2,0,0,1-2,2h-4"/><polyline points="10,17 15,12 10,7"/><line x1="15" y1="12" x2="3" y2="12"/></>,
    grip: <><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></>,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icons[name]}</svg>;
};

// ============================================
// Dragon Fire (Embers)
// ============================================
const DragonFire = () => (
  <div className="dragon-fire-container">
    {[...Array(20)].map((_, i) => (
      <div key={i} className="ember" style={{
        left: `${Math.random() * 100}%`,
        animationDuration: `${2 + Math.random() * 3}s`,
        animationDelay: `${Math.random() * 2}s`,
        opacity: 0.3 + Math.random() * 0.5
      }} />
    ))}
  </div>
);

// ============================================
// Video Player
// ============================================
const VideoPlayer = ({ video, onEnded }) => {
  if (!video) return <div className="video-placeholder"><div className="dragon-logo">🐉</div><h2>Multiview</h2><p>Select a video to play</p></div>;
  const parsed = parseVideoUrl(video.url);
  if (!parsed) return <div className="video-error">Invalid video URL</div>;
  switch (parsed.type) {
    case 'youtube': return <iframe src={`https://www.youtube.com/embed/${parsed.id}?autoplay=1&rel=0`} allow="autoplay; encrypted-media" allowFullScreen className="video-frame" />;
    case 'vimeo': return <iframe src={`https://player.vimeo.com/video/${parsed.id}?autoplay=1`} allow="autoplay; fullscreen" allowFullScreen className="video-frame" />;
    case 'spotify': return <iframe src={`https://open.spotify.com/embed/${parsed.contentType}/${parsed.id}?theme=0`} allow="autoplay; encrypted-media" className="video-frame" style={{minHeight: '152px'}} />;
    case 'soundcloud': return <iframe src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(parsed.url)}&auto_play=true`} className="video-frame" style={{minHeight: '166px'}} />;
    case 'direct':
      if (video.url.match(/\.(mp3|wav|m4a)$/i)) return <div className="video-placeholder"><div style={{fontSize: '48px'}}>🎵</div><p>{video.title}</p><audio src={video.url} controls autoPlay onEnded={onEnded} style={{width: '80%', maxWidth: '400px'}} /></div>;
      return <video src={video.url} controls autoPlay onEnded={onEnded} className="video-frame" />;
    default: return <div className="video-error">Unsupported</div>;
  }
};

// ============================================
// Badge Colors
// ============================================
const BADGE_COLORS = [
  { name: 'Default', value: null }, { name: 'Ruby', value: '#dc2626' }, { name: 'Amber', value: '#d97706' },
  { name: 'Emerald', value: '#059669' }, { name: 'Sky', value: '#0284c7' }, { name: 'Violet', value: '#7c3aed' },
  { name: 'Pink', value: '#db2777' }, { name: 'Slate', value: '#475569' }, { name: 'Gold', value: '#d4a824' },
];

// ============================================
// Connected Users
// ============================================
const ConnectedUsers = ({ users, isHost, currentUserId, roomId, onKick, onRename, onRenameSelf, onColorChange }) => {
  const [contextMenu, setContextMenu] = useState(null);
  const [renameModal, setRenameModal] = useState(null);
  const [colorPickerFor, setColorPickerFor] = useState(null);
  const [newName, setNewName] = useState('');
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setContextMenu(null); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleContextMenu = (e, user) => {
    e.preventDefault();
    const isClickingOwnBadge = user.visitorId === currentUserId;
    let canKick = isHost && !user.isOwner;
    let canRename = isHost || isClickingOwnBadge;
    let canChangeColor = (isHost || isClickingOwnBadge) && user.status === 'online';
    if (!canKick && !canRename && !canChangeColor) return;
    setContextMenu({ x: e.clientX, y: e.clientY, user, isClickingOwnBadge, canKick, canRename, canChangeColor });
  };

  const handleKick = () => { if (contextMenu?.canKick) onKick(contextMenu.user.visitorId, contextMenu.user.displayName); setContextMenu(null); };
  const handleRenameClick = () => { setNewName(contextMenu.user.displayName); setRenameModal({ ...contextMenu.user, isClickingOwnBadge: contextMenu.isClickingOwnBadge }); setContextMenu(null); };
  const handleColorClick = () => { setColorPickerFor(contextMenu.user); setContextMenu(null); };
  const handleColorSelect = (color) => { if (colorPickerFor && onColorChange) onColorChange(colorPickerFor.visitorId, color); setColorPickerFor(null); };
  const handleRenameSubmit = () => { if (!newName.trim() || !renameModal) return; renameModal.isClickingOwnBadge ? onRenameSelf(newName.trim()) : onRename(renameModal.visitorId, newName.trim()); setRenameModal(null); setNewName(''); };

  return (
    <div className="connected-users-section">
      <div className="connected-header">
        <h4><Icon name="users" size="sm" /> Connected</h4>
        <span className="online-count"><span className="count">{users.filter(u => u.status === 'online').length}</span> online</span>
      </div>
      {users.length > 0 ? (
        <div className="users-list">
          {users.map(u => (
            <div key={u.visitorId} className={`user-badge ${u.isYou ? 'is-you' : ''} ${u.isOwner ? 'is-owner' : ''} ${u.status}`}
              style={u.color && u.status === 'online' ? { background: u.color } : {}}
              onContextMenu={(e) => handleContextMenu(e, u)} title="Right-click for options">
              {u.isOwner && <span className="owner-crown">👑</span>}
              <span className={`status-indicator ${u.status}`} />
              <span className="badge-name">{u.displayName}</span>
              {u.isYou && <span className="you-tag">(you)</span>}
            </div>
          ))}
        </div>
      ) : <div className="no-users">No users connected</div>}

      {contextMenu && (
        <div ref={menuRef} className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {contextMenu.canRename && <button className="context-menu-item" onClick={handleRenameClick}><Icon name="edit" size="sm" /> {contextMenu.isClickingOwnBadge ? 'Change My Name' : 'Rename'}</button>}
          {contextMenu.canChangeColor && <button className="context-menu-item" onClick={handleColorClick}><span style={{width:14,height:14,borderRadius:'50%',background:'linear-gradient(135deg,#dc2626,#059669,#0284c7)',display:'inline-block',marginRight:8}}/> Color</button>}
          {contextMenu.canKick && <button className="context-menu-item danger" onClick={handleKick}><Icon name="x" size="sm" /> Kick</button>}
        </div>
      )}

      {colorPickerFor && (
        <div className="modal-overlay" onClick={() => setColorPickerFor(null)}>
          <div className="modal color-picker-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setColorPickerFor(null)}>×</button>
            <h2>Choose Color</h2>
            <div className="color-grid">
              {BADGE_COLORS.map(c => (
                <button key={c.name} className={`color-option ${colorPickerFor.color === c.value ? 'selected' : ''}`}
                  style={{ background: c.value || 'rgba(255,255,255,0.1)' }} onClick={() => handleColorSelect(c.value)}>
                  {!c.value && '✕'}{colorPickerFor.color === c.value && c.value && '✓'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {renameModal && (
        <div className="modal-overlay" onClick={() => setRenameModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setRenameModal(null)}>×</button>
            <h2>{renameModal.isClickingOwnBadge ? 'Change Your Name' : 'Rename User'}</h2>
            <div className="modal-input-group"><label>Display Name</label><input type="text" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRenameSubmit()} autoFocus /></div>
            <div className="modal-actions"><button className="btn secondary" onClick={() => setRenameModal(null)}>Cancel</button><button className="btn primary" onClick={handleRenameSubmit}>Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// Playlist Item
// ============================================
const PlaylistItem = ({ playlist, isActive, onSelect, onRename, onDelete, onDragStart, onDragOver, onDrop, isDragging, isDragOver }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(playlist.name);
  const handleRename = () => { if (name.trim() && name !== playlist.name) onRename(playlist.id, name.trim()); setEditing(false); };

  return (
    <div className={`playlist-item ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      draggable onDragStart={e => onDragStart(e, playlist.id)} onDragOver={e => onDragOver(e, playlist.id)} onDrop={e => onDrop(e, playlist.id)}>
      <span className="drag-handle"><Icon name="grip" size="sm" /></span>
      {editing ? (
        <input className="playlist-edit-input" value={name} onChange={e => setName(e.target.value)} onBlur={handleRename}
          onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditing(false); }} autoFocus />
      ) : (
        <button className="playlist-select" onClick={() => onSelect(playlist)}>
          <span className="playlist-name">{playlist.name}</span>
          <span className="playlist-count">{playlist.videos?.length || 0}</span>
        </button>
      )}
      <div className="playlist-actions">
        <button className="icon-btn sm" onClick={() => { setName(playlist.name); setEditing(true); }}><Icon name="edit" size="sm" /></button>
        <button className="icon-btn sm danger" onClick={() => onDelete(playlist.id)}><Icon name="trash" size="sm" /></button>
      </div>
    </div>
  );
};

// ============================================
// User Menu
// ============================================
const UserMenu = ({ user, onSettings, onLogout, onHome }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-menu-trigger" onClick={() => setOpen(!open)}>
        <div className="avatar">{user.displayName?.charAt(0).toUpperCase() || '?'}</div>
        <span className="user-name">{user.displayName}</span>
      </button>
      {open && (
        <div className="user-menu-dropdown">
          {onHome && <button onClick={() => { onHome(); setOpen(false); }}><Icon name="home" size="sm" /> My Rooms</button>}
          <button onClick={() => { onSettings(); setOpen(false); }}><Icon name="settings" size="sm" /> Settings</button>
          <button onClick={onLogout}><Icon name="logout" size="sm" /> Log out</button>
        </div>
      )}
    </div>
  );
};

// ============================================
// Auth Screen
// ============================================
const AuthScreen = ({ onAuth }) => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (GOOGLE_CLIENT_ID && window.google) {
      google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleResponse });
    }
  }, []);

  const handleGoogleResponse = async (response) => {
    try { setLoading(true); const user = await api.auth.googleLogin(response.credential); onAuth(user); }
    catch (err) { setError(err.message || 'Google login failed'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (mode === 'register') {
        if (!displayName.trim()) throw new Error('Display name required');
        onAuth(await api.auth.register(email, username || null, password, displayName));
      } else { onAuth(await api.auth.login(email, password)); }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleGoogleClick = () => { window.google ? google.accounts.id.prompt() : setError('Google sign-in not available'); };

  return (
    <div className="auth-screen">
      <DragonFire />
      <div className="auth-container">
        <div className="auth-logo"><span className="dragon-icon">🐉</span><h1>Multiview</h1><p>Watch together, anywhere</p></div>
        <div className="auth-form-container">
          <form className="auth-form" onSubmit={handleSubmit}>
            <h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
            {error && <div className="error-message"><Icon name="x" size="sm" /> {error}</div>}
            {mode === 'register' && <div className="input-group"><label>Display Name</label><input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" required /></div>}
            <div className="input-group"><label>{mode === 'register' ? 'Email' : 'Email or Username'}</label><input type={mode === 'register' ? 'email' : 'text'} value={email} onChange={e => setEmail(e.target.value)} required /></div>
            {mode === 'register' && <div className="input-group"><label>Username (optional)</label><input type="text" value={username} onChange={e => setUsername(e.target.value)} /></div>}
            <div className="input-group"><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} /></div>
            <button type="submit" className="btn primary full" disabled={loading}>{loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
            <div className="auth-divider"><span>or</span></div>
            <button type="button" className="google-btn" onClick={handleGoogleClick}>
              <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>
            <div className="auth-links">
              {mode === 'login' ? <><span>New?</span><button type="button" onClick={() => setMode('register')}>Create account</button></> : <><span>Have account?</span><button type="button" onClick={() => setMode('login')}>Sign in</button></>}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Join Room Modal
// ============================================
const JoinRoomModal = ({ hostName, roomName, existingName, isGuest, onJoin, onCancel, onCreateAccount, onLogin }) => {
  const [displayName, setDisplayName] = useState(existingName || '');
  const [error, setError] = useState('');
  const handleJoin = () => { if (!displayName.trim()) { setError('Enter a display name'); return; } if (displayName.trim().length < 2) { setError('Name too short'); return; } onJoin(displayName.trim()); };

  return (
    <div className="modal-overlay">
      <div className="modal join-modal" onClick={e => e.stopPropagation()}>
        <div className="join-header"><span className="join-dragon">🐉</span><h2>Join {hostName}'s Room</h2>{roomName && <p className="join-room-name">{roomName}</p>}</div>
        <div className="join-content">
          {isGuest ? (
            <>
              <p className="join-description">Choose how you'd like to join:</p>
              <div className="join-option-card">
                <div className="join-option-header"><span className="join-option-icon">👤</span><div><strong>Continue as Guest</strong><span>Quick access</span></div></div>
                <div className="join-option-content">
                  <input type="text" value={displayName} onChange={e => { setDisplayName(e.target.value); setError(''); }} placeholder="Display name" autoFocus onKeyDown={e => e.key === 'Enter' && handleJoin()} />
                  {error && <div className="join-error">{error}</div>}
                  <button className="btn primary" onClick={handleJoin}><Icon name="enter" size="sm" /> Join as Guest</button>
                </div>
              </div>
              <div className="join-divider"><span>or</span></div>
              <div className="join-account-options">
                <button className="btn secondary" onClick={onCreateAccount}><Icon name="plus" size="sm" /> Create Account</button>
                <button className="btn ghost" onClick={onLogin}>Already have an account? <strong>Sign In</strong></button>
              </div>
            </>
          ) : (
            <>
              <div className="modal-input-group"><label>Display Name</label><input type="text" value={displayName} onChange={e => { setDisplayName(e.target.value); setError(''); }} autoFocus onKeyDown={e => e.key === 'Enter' && handleJoin()} /></div>
              {error && <div className="error-message"><Icon name="x" size="sm" /> {error}</div>}
              <div className="modal-actions"><button className="btn secondary" onClick={onCancel}>Cancel</button><button className="btn primary" onClick={handleJoin}><Icon name="enter" size="sm" /> Join</button></div>
            </>
          )}
        </div>
        <button className="join-cancel" onClick={onCancel}><Icon name="x" size="sm" /></button>
      </div>
    </div>
  );
};

// ============================================
// Settings Modal
// ============================================
const SettingsModal = ({ user, onClose, onUpdate }) => {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [saved, setSaved] = useState(false);
  const handleSave = async () => {
    if (displayName.trim() && displayName !== user.displayName) {
      try { const updated = await api.auth.updateProfile({ displayName: displayName.trim() }); onUpdate(updated); setSaved(true); setTimeout(() => setSaved(false), 2000); }
      catch { alert('Failed to update'); }
    }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Settings</h2>
        <div className="settings-section">
          <h3>Profile</h3>
          <div className="modal-input-group"><label>Display Name</label><input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} /></div>
          <div className="modal-input-group"><label>Email</label><input type="email" value={user.email} disabled /></div>
          <button className="btn primary" onClick={handleSave}>{saved ? '✓ Saved!' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Home Page
// ============================================
const HomePage = ({ user, onEnterRoom, onLogout, onUpdateUser }) => {
  const [rooms, setRooms] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [editingRoom, setEditingRoom] = useState(null);
  const [editName, setEditName] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [roomUsers, setRoomUsers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadRooms(); }, []);
  const loadRooms = async () => {
    try {
      let fetched = await api.rooms.list();
      if (!fetched || fetched.length === 0) { fetched = [await api.rooms.create('My Room')]; }
      setRooms(fetched);
    } catch (err) { console.error('Load rooms failed:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (rooms.length === 0) return;
    const update = async () => {
      const map = {};
      for (const r of rooms) { try { map[r.id] = (await api.presence.getMembers(r.id)).map(m => ({ visitorId: m.user_id || m.guest_id, displayName: m.display_name, color: m.color, isOwner: m.is_owner, status: m.status || 'offline' })); } catch { map[r.id] = []; } }
      setRoomUsers(map);
    };
    update(); const i = setInterval(update, 5000); return () => clearInterval(i);
  }, [rooms]);

  const showNotif = (msg, type = 'success') => { setNotification({ message: msg, type }); setTimeout(() => setNotification(null), 3000); };
  const createRoom = async () => { if (!newRoomName.trim()) return; try { const r = await api.rooms.create(newRoomName.trim()); setRooms([...rooms, r]); setNewRoomName(''); setShowCreate(false); showNotif('Room created!'); } catch { showNotif('Failed', 'error'); } };
  const renameRoom = async (id) => { if (!editName.trim()) return; try { await api.rooms.update(id, { name: editName.trim() }); setRooms(rooms.map(r => r.id === id ? { ...r, name: editName.trim() } : r)); setEditingRoom(null); showNotif('Renamed!'); } catch { showNotif('Failed', 'error'); } };
  const deleteRoom = async (id) => { if (!confirm('Delete room?')) return; try { await api.rooms.delete(id); setRooms(rooms.filter(r => r.id !== id)); showNotif('Deleted!', 'warning'); } catch { showNotif('Failed', 'error'); } };
  const copyShareLink = (id) => { navigator.clipboard.writeText(`${location.origin}${location.pathname}#/room/${user.id}/${id}`); showNotif('Link copied!'); };
  const kickUser = async (roomId, visitorId, name) => {
    if (!confirm(`Kick ${name}?`)) return;
    try { const isGuest = visitorId.startsWith('guest_'); await api.rooms.kick(roomId, isGuest ? null : visitorId, isGuest ? visitorId : null); setRoomUsers(prev => ({ ...prev, [roomId]: (await api.presence.getMembers(roomId)).map(m => ({ visitorId: m.user_id || m.guest_id, displayName: m.display_name, color: m.color, isOwner: m.is_owner, status: m.status || 'offline' })) })); showNotif('Kicked!'); }
    catch { showNotif('Failed', 'error'); }
  };

  if (loading) return <div className="home-page"><DragonFire /><div className="loading-screen"><div className="loading-dragon">🐉</div><div className="loading-text">Loading...</div></div></div>;

  return (
    <div className="home-page">
      <DragonFire />
      <header className="home-header"><div className="logo-small"><span className="dragon-icon">🐉</span><span>Multiview</span></div><UserMenu user={user} onSettings={() => setSettingsOpen(true)} onLogout={onLogout} /></header>
      <main className="home-content">
        <div className="home-welcome"><div className="welcome-glow" /><h1>Welcome, {user.displayName}</h1><p>Manage rooms and watch with friends</p></div>
        <div className="rooms-section">
          <div className="rooms-header"><h2><span className="section-icon">🚪</span>My Rooms<span className="room-count">{rooms.length}</span></h2><button className="btn primary glow" onClick={() => setShowCreate(true)}><Icon name="plus" size="sm" /> New</button></div>
          {showCreate && <div className="create-room-form"><input value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="Room name" autoFocus onKeyDown={e => e.key === 'Enter' && createRoom()} /><button className="btn primary" onClick={createRoom}>Create</button><button className="btn ghost" onClick={() => setShowCreate(false)}>Cancel</button></div>}
          {rooms.length > 0 ? (
            <div className="rooms-grid">
              {rooms.map(room => {
                const users = roomUsers[room.id] || [];
                const online = users.filter(u => u.status === 'online');
                return (
                  <div key={room.id} className="room-card">
                    <div className="room-card-bg" />
                    <div className="room-card-content">
                      <div className="room-card-header">
                        {editingRoom === room.id ? <input value={editName} onChange={e => setEditName(e.target.value)} onBlur={() => renameRoom(room.id)} onKeyDown={e => { if (e.key === 'Enter') renameRoom(room.id); if (e.key === 'Escape') setEditingRoom(null); }} autoFocus className="room-edit-input" /> : <h3>{room.name}</h3>}
                        <div className="room-status">{online.length > 0 && <span className="online-badge"><span className="pulse" />{online.length} online</span>}</div>
                      </div>
                      {users.length > 0 && <div className="room-users-preview">{users.slice(0, 5).map(u => (<div key={u.visitorId} className={`mini-user ${u.status}`} style={u.color && u.status === 'online' ? { background: u.color } : {}}>{u.isOwner && <span className="mini-crown">👑</span>}<span className="mini-name">{u.displayName}</span>{!u.isOwner && u.status !== 'offline' && <button className="mini-kick" onClick={e => { e.stopPropagation(); kickUser(room.id, u.visitorId, u.displayName); }}>×</button>}</div>))}{users.length > 5 && <span className="more-users">+{users.length - 5}</span>}</div>}
                      <div className="room-card-actions"><button className="btn primary enter-btn" onClick={() => onEnterRoom(room)}><Icon name="enter" size="sm" /> Enter</button><div className="room-tools"><button className="tool-btn" onClick={() => copyShareLink(room.id)} title="Share"><Icon name="share" size="sm" /></button><button className="tool-btn" onClick={() => { setEditingRoom(room.id); setEditName(room.name); }} title="Rename"><Icon name="edit" size="sm" /></button><button className="tool-btn danger" onClick={() => deleteRoom(room.id)} title="Delete"><Icon name="trash" size="sm" /></button></div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <div className="no-rooms"><div className="no-rooms-icon">🏰</div><h3>No Rooms</h3><p>Create one to start</p><button className="btn primary glow" onClick={() => setShowCreate(true)}><Icon name="plus" size="sm" /> Create</button></div>}
        </div>
      </main>
      {settingsOpen && <SettingsModal user={user} onClose={() => setSettingsOpen(false)} onUpdate={onUpdateUser} />}
      {notification && <div className={`notification ${notification.type}`}>{notification.message}</div>}
    </div>
  );
};

// ============================================
// Room
// ============================================
const Room = ({ user, room, hostId, visitorDisplayName, onHome, onLogout, onUpdateUser, onDisplayNameChange }) => {
  const [playlists, setPlaylists] = useState([]);
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [urlInput, setUrlInput] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [draggingPlaylist, setDraggingPlaylist] = useState(null);
  const [dragOverPlaylist, setDragOverPlaylist] = useState(null);
  const [draggingVideo, setDraggingVideo] = useState(null);
  const [dragOverVideo, setDragOverVideo] = useState(null);
  const [currentDisplayName, setCurrentDisplayName] = useState(visitorDisplayName);
  const [kickedOut, setKickedOut] = useState(false);
  const fileInputRef = useRef(null);

  const visitorId = user ? user.id : api.getGuestId();
  const isOwner = user && user.id === hostId;
  const displayName = currentDisplayName || (user ? user.displayName : 'Guest');
  const { connectedUsers, refreshPresence } = usePresence(room.id, visitorId, displayName, isOwner);

  useEffect(() => { api.playlists.list(room.id).then(p => { setPlaylists(p); if (p.length > 0) setActivePlaylist(p[0]); }).catch(console.error); }, [room.id]);
  useEffect(() => { api.rooms.join(room.id, displayName).catch(err => { if (err.message.includes('kicked')) setKickedOut(true); }); }, [room.id, displayName]);

  const showNotif = (msg, type = 'success') => { setNotification({ message: msg, type }); setTimeout(() => setNotification(null), 3000); };

  const handleKick = async (vid, name) => { if (!isOwner) return; try { const g = vid.startsWith('guest_'); await api.rooms.kick(room.id, g ? null : vid, g ? vid : null); refreshPresence(); showNotif(`${name} kicked`); } catch { showNotif('Failed', 'error'); } };
  const handleRename = async (vid, name) => { if (!isOwner) return; try { const g = vid.startsWith('guest_'); await api.presence.updateMember(room.id, g ? null : vid, g ? vid : null, { displayName: name }); refreshPresence(); showNotif('Renamed'); } catch { showNotif('Failed', 'error'); } };
  const handleRenameSelf = async (name) => { setCurrentDisplayName(name); try { const g = visitorId.startsWith('guest_'); await api.presence.updateMember(room.id, g ? null : visitorId, g ? visitorId : null, { displayName: name }); if (isOwner && user) { await api.auth.updateProfile({ displayName: name }); onUpdateUser?.({ ...user, displayName: name }); } onDisplayNameChange?.(name); refreshPresence(); showNotif('Updated!'); } catch { showNotif('Failed', 'error'); } };
  const handleColorChange = async (vid, color) => { try { const g = vid.startsWith('guest_'); await api.presence.updateMember(room.id, g ? null : vid, g ? vid : null, { color }); refreshPresence(); showNotif(color ? 'Color set' : 'Color cleared'); } catch { showNotif('Failed', 'error'); } };

  const createPlaylist = async () => { if (!isOwner || !newPlaylistName.trim()) return; try { const p = await api.playlists.create(room.id, newPlaylistName.trim()); setPlaylists(prev => [...prev, { ...p, videos: [] }]); setActivePlaylist({ ...p, videos: [] }); setNewPlaylistName(''); setShowCreatePlaylist(false); showNotif('Created!'); } catch { showNotif('Failed', 'error'); } };
  const renamePlaylist = async (id, name) => { if (!isOwner) return; try { await api.playlists.update(id, { name }); setPlaylists(p => p.map(pl => pl.id === id ? { ...pl, name } : pl)); if (activePlaylist?.id === id) setActivePlaylist(a => ({ ...a, name })); showNotif('Renamed!'); } catch { showNotif('Failed', 'error'); } };
  const deletePlaylist = async (id) => { if (!isOwner || !confirm('Delete?')) return; try { await api.playlists.delete(id); setPlaylists(p => p.filter(pl => pl.id !== id)); if (activePlaylist?.id === id) { setActivePlaylist(null); setCurrentVideo(null); } showNotif('Deleted!', 'warning'); } catch { showNotif('Failed', 'error'); } };

  const handleAddUrl = async () => { if (!activePlaylist || !urlInput.trim()) return; const p = parseVideoUrl(urlInput.trim()); if (!p) { showNotif('Invalid URL', 'error'); return; } try { const v = await api.playlists.addVideo(activePlaylist.id, { title: urlInput.trim(), url: urlInput.trim(), videoType: p.type }); setPlaylists(prev => prev.map(pl => pl.id === activePlaylist.id ? { ...pl, videos: [...(pl.videos || []), v] } : pl)); setActivePlaylist(a => ({ ...a, videos: [...(a.videos || []), v] })); setUrlInput(''); showNotif('Added!'); } catch { showNotif('Failed', 'error'); } };
  const playVideo = (v, i) => { setCurrentVideo(v); setCurrentIndex(i); };
  const playNow = () => { if (!urlInput.trim()) return; const p = parseVideoUrl(urlInput.trim()); if (!p) { showNotif('Invalid URL', 'error'); return; } setCurrentVideo({ id: 'temp', title: urlInput, url: urlInput.trim() }); setUrlInput(''); };
  const playPrev = () => { if (!activePlaylist || currentIndex <= 0) return; setCurrentVideo((activePlaylist.videos || [])[currentIndex - 1]); setCurrentIndex(currentIndex - 1); };
  const playNext = () => { if (!activePlaylist) return; const v = activePlaylist.videos || []; if (currentIndex < v.length - 1) { setCurrentVideo(v[currentIndex + 1]); setCurrentIndex(currentIndex + 1); } };
  const removeVideo = async (id) => { if (!activePlaylist) return; try { await api.playlists.removeVideo(activePlaylist.id, id); const nv = (activePlaylist.videos || []).filter(v => v.id !== id); setPlaylists(p => p.map(pl => pl.id === activePlaylist.id ? { ...pl, videos: nv } : pl)); setActivePlaylist(a => ({ ...a, videos: nv })); if (currentVideo?.id === id) setCurrentVideo(null); showNotif('Removed!'); } catch { showNotif('Failed', 'error'); } };
  const copyShareLink = () => { navigator.clipboard.writeText(`${location.origin}${location.pathname}#/room/${hostId}/${room.id}`); showNotif('Copied!'); setShareModalOpen(false); };

  const handlePlaylistDragStart = (e, id) => { if (!isOwner) return; setDraggingPlaylist(id); };
  const handlePlaylistDragOver = (e, id) => { if (!isOwner) return; e.preventDefault(); setDragOverPlaylist(id); };
  const handlePlaylistDrop = (e, tid) => { e.preventDefault(); if (!isOwner || !draggingPlaylist || draggingPlaylist === tid) { setDraggingPlaylist(null); setDragOverPlaylist(null); return; } const oi = playlists.findIndex(p => p.id === draggingPlaylist); const ni = playlists.findIndex(p => p.id === tid); const np = [...playlists]; const [m] = np.splice(oi, 1); np.splice(ni, 0, m); setPlaylists(np); setDraggingPlaylist(null); setDragOverPlaylist(null); };

  const handleVideoDragStart = (e, id) => { setDraggingVideo(id); };
  const handleVideoDragOver = (e, id) => { e.preventDefault(); setDragOverVideo(id); };
  const handleVideoDrop = async (e, tid) => { e.preventDefault(); if (!activePlaylist || !draggingVideo || draggingVideo === tid) { setDraggingVideo(null); setDragOverVideo(null); return; } const v = activePlaylist.videos || []; const oi = v.findIndex(x => x.id === draggingVideo); const ni = v.findIndex(x => x.id === tid); const nv = [...v]; const [m] = nv.splice(oi, 1); nv.splice(ni, 0, m); setActivePlaylist(a => ({ ...a, videos: nv })); setPlaylists(p => p.map(pl => pl.id === activePlaylist.id ? { ...pl, videos: nv } : pl)); try { await api.playlists.reorderVideos(activePlaylist.id, nv.map(x => x.id)); } catch {} setDraggingVideo(null); setDragOverVideo(null); };

  const handleFileUpload = (e) => { Array.from(e.target.files).forEach(f => { const url = URL.createObjectURL(f); const title = f.name.replace(/\.[^/.]+$/, ''); setCurrentVideo({ id: `local_${Date.now()}`, title, url, isAudio: f.type.startsWith('audio/') }); }); e.target.value = ''; };

  if (kickedOut) return <div className="kicked-screen"><DragonFire /><div className="kicked-content"><div className="kicked-icon">🚫</div><h1>You've Been Kicked</h1><p>The host removed you.</p>{onHome && <button className="btn primary" onClick={onHome}><Icon name="home" size="sm" /> Home</button>}</div></div>;

  return (
    <div className="dashboard">
      <DragonFire />
      <input type="file" ref={fileInputRef} className="hidden" accept="video/*,audio/*" multiple onChange={handleFileUpload} />
      <header className="dashboard-header">
        <div className="header-left">
          <button className="icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}><Icon name="menu" /></button>
          {onHome && <button className="icon-btn" onClick={onHome} title="Home"><Icon name="home" /></button>}
          <div className="room-info"><h1>{room.name}</h1></div>
        </div>
        <div className="header-center">
          <div className="url-bar">
            <input value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="Enter URL..." onKeyDown={e => e.key === 'Enter' && playNow()} />
            <button className="icon-btn primary" onClick={playNow}><Icon name="play" /></button>
            <button className="icon-btn" onClick={handleAddUrl} disabled={!activePlaylist}><Icon name="plus" /></button>
            <button className="icon-btn" onClick={() => fileInputRef.current?.click()}><Icon name="upload" /></button>
          </div>
        </div>
        <div className="header-right">
          <button className="btn secondary sm" onClick={() => setShareModalOpen(true)}><Icon name="share" size="sm" /> Share</button>
          {user ? <UserMenu user={user} onSettings={() => setSettingsOpen(true)} onLogout={onLogout} onHome={onHome} /> : <div className="guest-badge"><span className="guest-name">{displayName}</span><span className="guest-tag">Guest</span></div>}
        </div>
      </header>
      <div className="dashboard-content">
        <aside className={`sidebar ${sidebarOpen ? '' : 'closed'}`}>
          <div className="sidebar-header"><h3>Playlists</h3>{isOwner && <button className="icon-btn sm" onClick={() => setShowCreatePlaylist(true)}><Icon name="plus" size="sm" /></button>}</div>
          {isOwner && showCreatePlaylist && <div className="create-playlist-form"><input value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} placeholder="Name" onKeyDown={e => e.key === 'Enter' && createPlaylist()} autoFocus /><div className="form-actions"><button className="btn primary sm" onClick={createPlaylist}>Create</button><button className="btn sm" onClick={() => setShowCreatePlaylist(false)}>Cancel</button></div></div>}
          <div className="playlists-list">{playlists.length === 0 ? <div className="empty-playlists"><p>No playlists</p></div> : playlists.map(p => <PlaylistItem key={p.id} playlist={p} isActive={activePlaylist?.id === p.id} onSelect={setActivePlaylist} onRename={isOwner ? renamePlaylist : () => {}} onDelete={isOwner ? deletePlaylist : () => {}} onDragStart={handlePlaylistDragStart} onDragOver={handlePlaylistDragOver} onDrop={handlePlaylistDrop} isDragging={draggingPlaylist === p.id} isDragOver={dragOverPlaylist === p.id} />)}</div>
        </aside>
        <main className="main-content">
          <div className="queue-panel">
            <div className="queue-header"><h3>📜 {activePlaylist?.name || 'Select Playlist'}</h3></div>
            <div className="video-list">
              {activePlaylist && (activePlaylist.videos || []).map((v, i) => (
                <div key={v.id} className={`video-item ${currentVideo?.id === v.id ? 'playing' : ''} ${draggingVideo === v.id ? 'dragging' : ''} ${dragOverVideo === v.id ? 'drag-over' : ''}`} draggable onDragStart={e => handleVideoDragStart(e, v.id)} onDragOver={e => handleVideoDragOver(e, v.id)} onDrop={e => handleVideoDrop(e, v.id)}>
                  <div className="video-item-top">
                    <span className="drag-handle"><Icon name="grip" size="sm" /></span>
                    <span className="video-index">{i + 1}</span>
                    <span className="video-type-icon">{getVideoTypeIcon(parseVideoUrl(v.url)?.type)}</span>
                    <span className="video-title" onClick={() => playVideo(v, i)}>{v.title}</span>
                    <button className="icon-btn sm" onClick={() => removeVideo(v.id)}><Icon name="trash" size="sm" /></button>
                  </div>
                </div>
              ))}
              {activePlaylist && (activePlaylist.videos || []).length === 0 && <div className="empty-queue"><p>No videos</p></div>}
            </div>
          </div>
          <div className="video-section">
            <VideoPlayer video={currentVideo} onEnded={playNext} />
            <div className="video-controls">
              <button className="btn sm" onClick={playPrev} disabled={!activePlaylist || currentIndex <= 0}><Icon name="prev" size="sm" /> Prev</button>
              <div className="now-playing">{currentVideo ? <span className="playing-title"><span className="playing-label">Now:</span> {currentVideo.title}</span> : <span className="playing-label">Nothing</span>}</div>
              <button className="btn sm" onClick={playNext} disabled={!activePlaylist || currentIndex >= ((activePlaylist?.videos || []).length) - 1}>Next <Icon name="next" size="sm" /></button>
            </div>
            <ConnectedUsers users={connectedUsers} isHost={isOwner} currentUserId={visitorId} roomId={room.id} onKick={handleKick} onRename={handleRename} onRenameSelf={handleRenameSelf} onColorChange={handleColorChange} />
          </div>
        </main>
      </div>
      {shareModalOpen && <div className="modal-overlay" onClick={() => setShareModalOpen(false)}><div className="modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setShareModalOpen(false)}>×</button><h2>Share Room</h2><div className="share-link-box"><input value={`${location.origin}${location.pathname}#/room/${hostId}/${room.id}`} readOnly /><button className="btn primary" onClick={copyShareLink}>Copy</button></div></div></div>}
      {settingsOpen && user && <SettingsModal user={user} onClose={() => setSettingsOpen(false)} onUpdate={onUpdateUser} />}
      {notification && <div className={`notification ${notification.type}`}>{notification.message}</div>}
    </div>
  );
};

// ============================================
// Main App
// ============================================
const MultiviewApp = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('home');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomHostId, setRoomHostId] = useState(null);
  const [visitorDisplayName, setVisitorDisplayName] = useState(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [pendingJoinData, setPendingJoinData] = useState(null);

  useEffect(() => {
    const check = async () => {
      try { const u = await api.auth.getCurrentUser(); if (u) setUser(u); } catch {}
      finally { setLoading(false); }
    };
    const roomInfo = parseRoomUrl();
    if (roomInfo) check().then(() => handleJoinFromUrl(roomInfo.hostId, roomInfo.roomId));
    else check();
  }, []);

  useEffect(() => {
    const handle = () => {
      const r = parseRoomUrl();
      if (r) handleJoinFromUrl(r.hostId, r.roomId);
      else if (currentView === 'room') { setCurrentView('home'); setCurrentRoom(null); }
    };
    window.addEventListener('hashchange', handle);
    return () => window.removeEventListener('hashchange', handle);
  }, [currentView, user]);

  const handleJoinFromUrl = async (hostId, roomId) => {
    try {
      const room = await api.rooms.get(roomId);
      if (!room) { alert('Room not found'); window.location.hash = ''; return; }
      if (user && user.id === hostId) { setCurrentRoom(room); setRoomHostId(hostId); setVisitorDisplayName(user.displayName); setCurrentView('room'); return; }
      setPendingJoinData({ hostId, room, existingName: user?.displayName || localStorage.getItem(`mv_guest_name_${hostId}`) || '', isGuest: !user });
      setShowJoinModal(true);
    } catch { alert('Failed to load room'); window.location.hash = ''; }
  };

  const handleJoinRoom = (name) => {
    if (!pendingJoinData) return;
    if (!user) localStorage.setItem(`mv_guest_name_${pendingJoinData.hostId}`, name);
    setCurrentRoom(pendingJoinData.room); setRoomHostId(pendingJoinData.hostId); setVisitorDisplayName(name);
    setShowJoinModal(false); setPendingJoinData(null); setCurrentView('room');
  };

  const handleCancelJoin = () => { setShowJoinModal(false); setPendingJoinData(null); window.location.hash = ''; };
  const handleEnterRoom = (room) => { window.location.hash = `/room/${user.id}/${room.id}`; setCurrentRoom(room); setRoomHostId(user.id); setVisitorDisplayName(user.displayName); setCurrentView('room'); };
  const handleGoHome = () => { window.location.hash = ''; setCurrentView('home'); setCurrentRoom(null); };
  const handleLogout = async () => { await api.auth.logout(); setUser(null); setCurrentView('home'); setCurrentRoom(null); window.location.hash = ''; };
  const handleUpdateUser = (u) => setUser(u);

  if (loading) return <div className="loading-screen"><div className="loading-dragon">🐉</div><div className="loading-text">Awakening...</div></div>;

  if (showJoinModal && pendingJoinData) {
    return <div className="auth-screen"><DragonFire /><JoinRoomModal hostName="Host" roomName={pendingJoinData.room?.name} existingName={pendingJoinData.existingName} isGuest={pendingJoinData.isGuest} onJoin={handleJoinRoom} onCancel={handleCancelJoin} onCreateAccount={() => { setShowJoinModal(false); localStorage.setItem('mv_pending_room', JSON.stringify(pendingJoinData)); }} onLogin={() => { setShowJoinModal(false); localStorage.setItem('mv_pending_room', JSON.stringify(pendingJoinData)); }} /></div>;
  }

  if (!user) return <AuthScreen onAuth={(u) => { setUser(u); const pr = localStorage.getItem('mv_pending_room'); if (pr) { localStorage.removeItem('mv_pending_room'); const pd = JSON.parse(pr); handleJoinFromUrl(pd.hostId, pd.room?.id); } }} />;
  if (currentView === 'room' && currentRoom) return <Room user={user} room={currentRoom} hostId={roomHostId} visitorDisplayName={visitorDisplayName} onHome={handleGoHome} onLogout={handleLogout} onUpdateUser={handleUpdateUser} onDisplayNameChange={setVisitorDisplayName} />;
  return <HomePage user={user} onEnterRoom={handleEnterRoom} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />;
};

ReactDOM.createRoot(document.getElementById('app')).render(<MultiviewApp />);

// ============================================
// DRAGON PLAYLIST v6
// Home Page, Rooms, Guest Support
// ============================================

const { useState, useEffect, createContext, useContext, useRef, useCallback, useMemo } = React;

// ============================================
// Configuration
// ============================================
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const PRESENCE_UPDATE_INTERVAL = 3000;
const PRESENCE_TIMEOUT = 10000;

// ============================================
// Context
// ============================================
const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

// ============================================
// SVG Icons
// ============================================
const Icons = {
  menu: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>,
  play: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>,
  upload: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>,
  share: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  logout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  edit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  grip: <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>,
  prev: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>,
  next: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zm-10 0l8.5 6-8.5 6z"/></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  mail: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  refresh: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
  addToList: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 12H3M16 6H3M16 18H3M18 9v6M21 12h-6"/></svg>,
  alertTriangle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>,
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg>,
  door: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2z"/><path d="M15 12h.01"/></svg>,
  link: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  enter: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>,
};

const Icon = ({ name, size = 'md' }) => {
  const sizeClass = size === 'sm' ? 'icon sm' : size === 'lg' ? 'icon lg' : size === 'xl' ? 'icon xl' : 'icon';
  return <span className={sizeClass}>{Icons[name]}</span>;
};

// ============================================
// Storage
// ============================================
const storage = {
  // Users
  getUsers: () => JSON.parse(localStorage.getItem('dp_users') || '{}'),
  saveUsers: (users) => localStorage.setItem('dp_users', JSON.stringify(users)),
  getCurrentUser: () => {
    const user = JSON.parse(localStorage.getItem('dp_currentUser') || 'null');
    if (user && !user.id) {
      // Try to find id from users list
      const users = JSON.parse(localStorage.getItem('dp_users') || '{}');
      for (const [key, u] of Object.entries(users)) {
        if (u.email === user.email) {
          const fixedUser = { ...u, id: u.id || key };
          localStorage.setItem('dp_currentUser', JSON.stringify(fixedUser));
          return fixedUser;
        }
      }
    }
    return user;
  },
  setCurrentUser: (user) => localStorage.setItem('dp_currentUser', JSON.stringify(user)),
  clearCurrentUser: () => localStorage.removeItem('dp_currentUser'),
  
  // Rooms
  getUserRooms: (userId) => JSON.parse(localStorage.getItem(`dp_rooms_${userId}`) || '[]'),
  saveUserRooms: (userId, rooms) => localStorage.setItem(`dp_rooms_${userId}`, JSON.stringify(rooms)),
  
  // Playlists (now per room)
  getRoomPlaylists: (roomId) => JSON.parse(localStorage.getItem(`dp_playlists_${roomId}`) || '[]'),
  saveRoomPlaylists: (roomId, playlists) => localStorage.setItem(`dp_playlists_${roomId}`, JSON.stringify(playlists)),
  deleteRoomPlaylists: (roomId) => localStorage.removeItem(`dp_playlists_${roomId}`),
  
  // Guest data
  getGuestId: () => localStorage.getItem('dp_guest_id'),
  setGuestId: (id) => localStorage.setItem('dp_guest_id', id),
  getGuestData: () => JSON.parse(localStorage.getItem('dp_guest_data') || 'null'),
  setGuestData: (data) => localStorage.setItem('dp_guest_data', JSON.stringify(data)),
  
  // Visitor display names (logged-in users visiting other rooms)
  getVisitorName: (hostId, visitorId) => localStorage.getItem(`dp_visitor_${hostId}_${visitorId}`),
  setVisitorName: (hostId, visitorId, name) => localStorage.setItem(`dp_visitor_${hostId}_${visitorId}`, name),
  
  // Guest names for specific hosts
  getGuestNameForHost: (hostId, guestId) => localStorage.getItem(`dp_guest_name_${hostId}_${guestId}`),
  setGuestNameForHost: (hostId, guestId, name) => localStorage.setItem(`dp_guest_name_${hostId}_${guestId}`, name),
  
  // Presence
  getRoomPresence: (roomId) => JSON.parse(localStorage.getItem(`dp_presence_${roomId}`) || '{}'),
  updateUserPresence: (roomId, visitorId, status = 'online') => {
    const presence = JSON.parse(localStorage.getItem(`dp_presence_${roomId}`) || '{}');
    presence[visitorId] = { status, lastSeen: Date.now(), visitorId };
    localStorage.setItem(`dp_presence_${roomId}`, JSON.stringify(presence));
  },
  removeUserPresence: (roomId, visitorId) => {
    const presence = JSON.parse(localStorage.getItem(`dp_presence_${roomId}`) || '{}');
    if (presence[visitorId]) {
      presence[visitorId].status = 'offline';
      presence[visitorId].lastSeen = Date.now();
    }
    localStorage.setItem(`dp_presence_${roomId}`, JSON.stringify(presence));
  },
  
  // Room members
  getRoomMembers: (roomId) => JSON.parse(localStorage.getItem(`dp_room_members_${roomId}`) || '{}'),
  setRoomMember: (roomId, visitorId, displayName, isOwner = false, color = null) => {
    const members = JSON.parse(localStorage.getItem(`dp_room_members_${roomId}`) || '{}');
    members[visitorId] = { 
      visitorId, 
      displayName, 
      isOwner, 
      color: color || members[visitorId]?.color || null,
      joinedAt: members[visitorId]?.joinedAt || Date.now() 
    };
    localStorage.setItem(`dp_room_members_${roomId}`, JSON.stringify(members));
  },
  updateMemberName: (roomId, visitorId, displayName) => {
    const members = JSON.parse(localStorage.getItem(`dp_room_members_${roomId}`) || '{}');
    if (members[visitorId]) {
      members[visitorId].displayName = displayName;
      localStorage.setItem(`dp_room_members_${roomId}`, JSON.stringify(members));
    }
  },
  updateMemberColor: (roomId, visitorId, color) => {
    const members = JSON.parse(localStorage.getItem(`dp_room_members_${roomId}`) || '{}');
    if (members[visitorId]) {
      members[visitorId].color = color;
      localStorage.setItem(`dp_room_members_${roomId}`, JSON.stringify(members));
    }
  },
  removeRoomMember: (roomId, visitorId) => {
    const members = JSON.parse(localStorage.getItem(`dp_room_members_${roomId}`) || '{}');
    delete members[visitorId];
    localStorage.setItem(`dp_room_members_${roomId}`, JSON.stringify(members));
  },
  
  // Kicked users
  getKickedUsers: (roomId) => JSON.parse(localStorage.getItem(`dp_kicked_${roomId}`) || '[]'),
  kickUser: (roomId, visitorId) => {
    const kicked = JSON.parse(localStorage.getItem(`dp_kicked_${roomId}`) || '[]');
    if (!kicked.includes(visitorId)) {
      kicked.push(visitorId);
      localStorage.setItem(`dp_kicked_${roomId}`, JSON.stringify(kicked));
    }
  },
  isUserKicked: (roomId, visitorId) => {
    const kicked = JSON.parse(localStorage.getItem(`dp_kicked_${roomId}`) || '[]');
    return kicked.includes(visitorId);
  },
  unkickUser: (roomId, visitorId) => {
    let kicked = JSON.parse(localStorage.getItem(`dp_kicked_${roomId}`) || '[]');
    kicked = kicked.filter(id => id !== visitorId);
    localStorage.setItem(`dp_kicked_${roomId}`, JSON.stringify(kicked));
  },
};

// ============================================
// Utilities
// ============================================
const parseVideoUrl = (url) => {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { type: 'youtube', id: ytMatch[1] };
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) return { type: 'vimeo', id: vimeoMatch[1] };
  const spotifyMatch = url.match(/spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/);
  if (spotifyMatch) return { type: 'spotify', contentType: spotifyMatch[1], id: spotifyMatch[2] };
  if (url.includes('soundcloud.com')) return { type: 'soundcloud', url };
  if (url.match(/\.(mp4|webm|ogg|mp3|wav|m4a)(\?.*)?$/i) || url.startsWith('blob:')) return { type: 'direct', url };
  return null;
};

const generateCaptcha = () => {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const ops = [['+', num1 + num2], ['-', num1 - num2], ['×', num1 * num2]];
  const [op, answer] = ops[Math.floor(Math.random() * 3)];
  return { question: `${num1} ${op} ${num2} = ?`, answer: answer.toString() };
};

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const getVideoTypeIcon = (type) => {
  const icons = { youtube: '▶️', spotify: '🎵', vimeo: '🎬', soundcloud: '🔊', direct: '📹' };
  return icons[type] || '📹';
};

const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const parseRoomUrl = () => {
  const hash = window.location.hash;
  // Format: #/room/{hostId}/{roomId}
  const match = hash.match(/#\/room\/([^\/]+)\/([^\/]+)/);
  if (match) return { hostId: match[1], roomId: match[2] };
  return null;
};

// ============================================
// Presence Hook - Direct and Simple
// ============================================
const usePresence = (roomId, visitorId, displayName, isOwner) => {
  const [connectedUsers, setConnectedUsers] = useState([]);

  useEffect(() => {
    // Don't run if missing required data
    if (!roomId || !visitorId || !displayName) {
      return;
    }
    
    const updatePresence = () => {
      // Register this user
      storage.setRoomMember(roomId, visitorId, displayName, isOwner);
      storage.updateUserPresence(roomId, visitorId, 'online');
      
      // Get all data
      const presence = storage.getRoomPresence(roomId);
      const members = storage.getRoomMembers(roomId);
      const kicked = storage.getKickedUsers(roomId);
      const now = Date.now();
      
      // Build users list
      const users = Object.values(members)
        .filter(m => !kicked.includes(m.visitorId))
        .map(m => ({
          odisplayName: m.visitorId,
          displayName: m.displayName,
          color: m.color || null,
          status: (presence[m.visitorId] && (now - presence[m.visitorId].lastSeen) < PRESENCE_TIMEOUT) 
            ? (presence[m.visitorId].status === 'away' ? 'away' : 'online') 
            : 'offline',
          isYou: m.visitorId === visitorId,
          isOwner: m.isOwner === true
        }))
        .sort((a, b) => {
          if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
          if (a.isYou !== b.isYou) return a.isYou ? -1 : 1;
          if (a.status !== b.status) return a.status === 'online' ? -1 : 1;
          return a.displayName.localeCompare(b.displayName);
        });
      
      setConnectedUsers(users);
    };
    
    // Run immediately
    updatePresence();
    
    // Run on interval
    const interval = setInterval(updatePresence, PRESENCE_UPDATE_INTERVAL);
    
    // Visibility handler
    const onVisibility = () => {
      storage.updateUserPresence(roomId, visitorId, document.hidden ? 'away' : 'online');
      updatePresence();
    };
    document.addEventListener('visibilitychange', onVisibility);
    
    // Cleanup
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      storage.removeUserPresence(roomId, visitorId);
    };
  }, [roomId, visitorId, displayName, isOwner]);

  const refreshPresence = useCallback(() => {
    if (!roomId || !visitorId || !displayName) return;
    
    storage.setRoomMember(roomId, visitorId, displayName, isOwner);
    storage.updateUserPresence(roomId, visitorId, 'online');
    
    const presence = storage.getRoomPresence(roomId);
    const members = storage.getRoomMembers(roomId);
    const kicked = storage.getKickedUsers(roomId);
    const now = Date.now();
    
    const users = Object.values(members)
      .filter(m => !kicked.includes(m.visitorId))
      .map(m => ({
        odisplayName: m.visitorId,
        displayName: m.displayName,
        status: (presence[m.visitorId] && (now - presence[m.visitorId].lastSeen) < PRESENCE_TIMEOUT) 
          ? (presence[m.visitorId].status === 'away' ? 'away' : 'online') 
          : 'offline',
        isYou: m.visitorId === visitorId,
        isOwner: m.isOwner === true
      }))
      .sort((a, b) => {
        if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
        if (a.isYou !== b.isYou) return a.isYou ? -1 : 1;
        if (a.status !== b.status) return a.status === 'online' ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      });
    
    setConnectedUsers(users);
  }, [roomId, visitorId, displayName, isOwner]);

  return { connectedUsers, refreshPresence };
};

// ============================================
// Dragon Fire - Optimized
// ============================================
const DragonFire = () => (
  <div className="dragon-fire-container">
    {[...Array(12)].map((_, i) => (
      <div key={i} className="ember" style={{
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 4}s`,
        animationDuration: `${2.5 + Math.random() * 2}s`
      }} />
    ))}
  </div>
);

// ============================================
// Ornate Border
// ============================================
const OrnateBorder = ({ children, className = '' }) => (
  <div className={`ornate-border ${className}`}>
    <div className="corner top-left" /><div className="corner top-right" />
    <div className="corner bottom-left" /><div className="corner bottom-right" />
    <div className="border-content">{children}</div>
  </div>
);

// ============================================
// Video Player
// ============================================
const VideoPlayer = ({ video, onEnded }) => {
  if (!video) {
    return (
      <div className="video-placeholder">
        <div className="dragon-silhouette" />
        <p>Enter a URL to summon content</p>
        <span className="subtitle">YouTube, Vimeo, Spotify, or upload</span>
      </div>
    );
  }

  const parsed = parseVideoUrl(video.url);
  if (!parsed) return <div className="video-error"><Icon name="x" size="lg" /><p>Invalid URL</p></div>;

  switch (parsed.type) {
    case 'youtube':
      return (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${parsed.id}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="video-frame"
        />
      );
    case 'vimeo':
      return <iframe src={`https://player.vimeo.com/video/${parsed.id}?autoplay=1&title=0&byline=0&portrait=0`} allow="autoplay; fullscreen" allowFullScreen className="video-frame" />;
    case 'spotify':
      return <iframe src={`https://open.spotify.com/embed/${parsed.contentType}/${parsed.id}?theme=0`} allow="autoplay; clipboard-write; encrypted-media; fullscreen" className="video-frame" style={{minHeight: '152px'}} />;
    case 'soundcloud':
      return <iframe src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(parsed.url)}&color=%23d4a824&auto_play=true&hide_related=true&show_comments=false`} allow="autoplay" className="video-frame" style={{minHeight: '166px'}} />;
    case 'direct':
      const isAudio = video.url.match(/\.(mp3|wav|m4a)$/i) || video.isAudio;
      if (isAudio) {
        return (
          <div className="video-placeholder" style={{background: 'linear-gradient(135deg, #111 0%, #080808 100%)'}}>
            <div style={{fontSize: '48px', marginBottom: '16px'}}>🎵</div>
            <p style={{marginBottom: '16px'}}>{video.title}</p>
            <audio src={video.url} controls autoPlay onEnded={onEnded} style={{width: '80%', maxWidth: '400px'}} />
          </div>
        );
      }
      return <video src={video.url} controls autoPlay onEnded={onEnded} className="video-frame" style={{background: '#000', objectFit: 'contain'}} />;
    default:
      return <div className="video-error">Unsupported</div>;
  }
};

// ============================================
// Connected Users - with context menu and color picker
// ============================================
const BADGE_COLORS = [
  { name: 'Default', value: null },
  { name: 'Ruby', value: '#dc2626' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Sky', value: '#0284c7' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Slate', value: '#475569' },
  { name: 'Gold', value: '#d4a824' },
];

const ConnectedUsers = ({ users, isHost, currentUserId, roomId, onKick, onRename, onRenameSelf, onColorChange }) => {
  const [contextMenu, setContextMenu] = useState(null);
  const [renameModal, setRenameModal] = useState(null);
  const [colorPickerFor, setColorPickerFor] = useState(null);
  const [newName, setNewName] = useState('');
  const menuRef = useRef(null);
  const colorRef = useRef(null);

  const onlineCount = users.filter(u => u.status === 'online').length;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
      if (colorRef.current && !colorRef.current.contains(e.target)) {
        setColorPickerFor(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleContextMenu = (e, user) => {
    e.preventDefault();
    
    const isClickingOwnBadge = user.odisplayName === currentUserId;
    const isClickingOwner = user.isOwner;
    const isOnline = user.status === 'online';
    
    // Permissions
    let canKick = false;
    let canRename = false;
    let canChangeColor = isOnline; // Anyone can change color of online users if they're host, or their own
    
    if (isHost) {
      canRename = true;
      canKick = !isClickingOwner;
      canChangeColor = isOnline;
    } else {
      canRename = isClickingOwnBadge;
      canKick = false;
      canChangeColor = isClickingOwnBadge && isOnline;
    }
    
    if (!canKick && !canRename && !canChangeColor) return;
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      user,
      isClickingOwnBadge,
      canKick,
      canRename,
      canChangeColor
    });
  };

  const handleKick = () => {
    if (contextMenu?.user && contextMenu.canKick) {
      onKick(contextMenu.user.odisplayName, contextMenu.user.displayName);
    }
    setContextMenu(null);
  };

  const handleRenameClick = () => {
    setNewName(contextMenu.user.displayName);
    setRenameModal({ ...contextMenu.user, isClickingOwnBadge: contextMenu.isClickingOwnBadge });
    setContextMenu(null);
  };

  const handleColorClick = () => {
    setColorPickerFor(contextMenu.user);
    setContextMenu(null);
  };

  const handleColorSelect = (color) => {
    if (colorPickerFor && onColorChange) {
      onColorChange(colorPickerFor.odisplayName, color);
    }
    setColorPickerFor(null);
  };

  const handleRenameSubmit = () => {
    if (!newName.trim() || !renameModal) return;
    if (renameModal.isClickingOwnBadge) {
      onRenameSelf(newName.trim());
    } else {
      onRename(renameModal.odisplayName, newName.trim());
    }
    setRenameModal(null);
    setNewName('');
  };

  return (
    <div className="connected-users-section">
      <div className="connected-header">
        <h4><Icon name="users" size="sm" /> Connected</h4>
        <span className="online-count"><span className="count">{onlineCount}</span> online</span>
      </div>
      {users.length > 0 ? (
        <div className="users-list">
          {users.map(u => (
            <div 
              key={u.odisplayName} 
              className={`user-badge ${u.isYou ? 'is-you' : ''} ${u.isOwner ? 'is-owner' : ''} ${u.status}`}
              style={u.color && u.status === 'online' ? { background: u.color } : {}}
              onContextMenu={(e) => handleContextMenu(e, u)}
              title="Right-click for options"
            >
              {u.isOwner && <span className="owner-crown">👑</span>}
              <span className={`status-indicator ${u.status}`} />
              <span className="badge-name">{u.displayName}</span>
              {u.isYou && <span className="you-tag">(you)</span>}
            </div>
          ))}
        </div>
      ) : (
        <div className="no-users">No users connected</div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div 
          ref={menuRef}
          className="context-menu"
          style={{ }}
        >
          {contextMenu.canRename && (
            <button className="context-menu-item" onClick={handleRenameClick}>
              <Icon name="edit" size="sm" /> 
              {contextMenu.isClickingOwnBadge ? 'Change My Name' : 'Rename User'}
            </button>
          )}
          {contextMenu.canChangeColor && (
            <button className="context-menu-item" onClick={handleColorClick}>
              <span style={{width: '14px', height: '14px', borderRadius: '50%', background: 'linear-gradient(135deg, #dc2626, #d97706, #059669, #0284c7)', display: 'inline-block', marginRight: '8px'}} />
              Change Color
            </button>
          )}
          {contextMenu.canKick && (
            <button className="context-menu-item danger" onClick={handleKick}>
              <Icon name="x" size="sm" /> Kick from Room
            </button>
          )}
        </div>
      )}

      {/* Color Picker */}
      {colorPickerFor && (
        <div className="modal-overlay" onClick={() => setColorPickerFor(null)}>
          <div className="modal color-picker-modal" onClick={e => e.stopPropagation()} ref={colorRef}>
            <button className="modal-close" onClick={() => setColorPickerFor(null)}>×</button>
            <h2>Choose Color for {colorPickerFor.displayName}</h2>
            <div className="color-grid">
              {BADGE_COLORS.map(c => (
                <button 
                  key={c.name}
                  className={`color-option ${colorPickerFor.color === c.value ? 'selected' : ''}`}
                  style={{ background: c.value || 'rgba(255,255,255,0.1)' }}
                  onClick={() => handleColorSelect(c.value)}
                  title={c.name}
                >
                  {c.value === null && <span>✕</span>}
                  {colorPickerFor.color === c.value && c.value && <span>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal && (
        <div className="modal-overlay" onClick={() => setRenameModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setRenameModal(null)}>×</button>
            <h2>{renameModal.odisplayName === currentUserId ? 'Change Your Name' : `Rename ${renameModal.displayName}`}</h2>
            <div className="modal-input-group">
              <label>Display Name</label>
              <input 
                type="text" 
                value={newName} 
                onChange={e => setNewName(e.target.value)} 
                placeholder="Enter new name"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleRenameSubmit()}
              />
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setRenameModal(null)}>Cancel</button>
              <button className="btn primary" onClick={handleRenameSubmit}>Save</button>
            </div>
          </div>
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
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [captcha, setCaptcha] = useState(generateCaptcha());
  const [captchaInput, setCaptchaInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (typeof google !== 'undefined' && google.accounts) {
      google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleResponse });
    }
  }, []);

  const handleGoogleResponse = (response) => {
    try {
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      const displayName = payload.name || payload.email.split('@')[0];
      const user = {
        id: payload.sub,
        email: payload.email,
        username: displayName,
        displayName: displayName,
        picture: payload.picture,
        provider: 'google'
      };
      const users = storage.getUsers();
      if (!users[user.id]) {
        users[user.id] = { ...user, createdAt: Date.now() };
        storage.saveUsers(users);
        // Create default room
        const defaultRoom = { id: generateId(), name: 'My Room', createdAt: Date.now() };
        storage.saveUserRooms(user.id, [defaultRoom]);
      } else {
        users[user.id].displayName = displayName;
        users[user.id].username = displayName;
        storage.saveUsers(users);
      }
      storage.setCurrentUser(users[user.id]);
      onAuth(users[user.id]);
    } catch (e) {
      setError('Google sign-in failed');
    }
  };

  const handleGoogleClick = () => {
    if (typeof google !== 'undefined' && google.accounts) {
      google.accounts.id.prompt();
    } else {
      setError('Google Sign-In not available');
    }
  };

  const resetForm = () => {
    setLoginId(''); setEmail(''); setPassword(''); setUsername('');
    setCaptchaInput(''); setCaptcha(generateCaptcha());
    setError(''); setSuccess('');
  };

  const switchMode = (m) => { setMode(m); resetForm(); };

  const findUser = (identifier) => {
    const users = storage.getUsers();
    // Find user by email or username, and ensure id is included
    for (const [key, user] of Object.entries(users)) {
      const matches = validateEmail(identifier) 
        ? user.email === identifier
        : user.username?.toLowerCase() === identifier.toLowerCase();
      if (matches) {
        // Ensure the user object has an id (use key if missing)
        return { ...user, id: user.id || key };
      }
    }
    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const users = storage.getUsers();

    if (mode === 'login') {
      if (!loginId || !password) { setError('All fields required'); return; }
      const user = findUser(loginId);
      if (user && user.password === password) {
        storage.setCurrentUser(user);
        onAuth(user);
      } else {
        setError('Invalid credentials');
      }
    } else if (mode === 'register') {
      if (!email || !password || !username) { setError('All fields required'); return; }
      if (!validateEmail(email)) { setError('Invalid email'); return; }
      if (username.length < 3) { setError('Username must be 3+ characters'); return; }
      if (password.length < 6) { setError('Password must be 6+ characters'); return; }
      if (captchaInput !== captcha.answer) {
        setError('Wrong answer'); setCaptcha(generateCaptcha()); setCaptchaInput(''); return;
      }
      
      const existingEmail = Object.values(users).find(u => u.email === email);
      if (existingEmail) { setError('Email already registered'); return; }
      const existingUsername = Object.values(users).find(u => u.username?.toLowerCase() === username.toLowerCase());
      if (existingUsername) { setError('Username already taken'); return; }
      
      const id = `user_${Date.now()}`;
      const newUser = { 
        id, email, 
        username: username.trim(), 
        displayName: username.trim(),
        password, 
        createdAt: Date.now(), 
        provider: 'email' 
      };
      users[id] = newUser;
      storage.saveUsers(users);
      
      // Create default room
      const defaultRoom = { id: generateId(), name: 'My Room', createdAt: Date.now() };
      storage.saveUserRooms(id, [defaultRoom]);
      
      storage.setCurrentUser(newUser);
      onAuth(newUser);
    } else if (mode === 'forgot') {
      if (!loginId) { setError('Enter your email or username'); return; }
      const user = findUser(loginId);
      if (!user) { setError('Account not found'); return; }
      setSuccess('Password reset instructions sent! (Demo: password unchanged)');
    }
  };

  return (
    <div className="auth-screen">
      <DragonFire />
      <div className="auth-container">
        <div className="logo-section">
          <span className="logo-icon">🐉</span>
          <h1 className="logo">Dragon Playlist</h1>
          <p className="tagline">Forge your realm of entertainment</p>
        </div>

        <div className="auth-box">
          <h2>{mode === 'login' ? 'Welcome Back' : mode === 'register' ? 'Join the Realm' : 'Reset Password'}</h2>
          
          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <>
                <div className="input-group">
                  <label>Username</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><Icon name="user" size="sm" /></span>
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Choose a username" />
                  </div>
                </div>
                <div className="input-group">
                  <label>Email</label>
                  <div className="input-wrapper">
                    <span className="input-icon"><Icon name="mail" size="sm" /></span>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
                  </div>
                </div>
              </>
            )}
            
            {(mode === 'login' || mode === 'forgot') && (
              <div className="input-group">
                <label>Email or Username</label>
                <div className="input-wrapper">
                  <span className="input-icon"><Icon name="user" size="sm" /></span>
                  <input type="text" value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="Email or username" autoComplete="username" />
                </div>
              </div>
            )}
            
            {mode !== 'forgot' && (
              <div className="input-group">
                <label>Password</label>
                <div className="input-wrapper">
                  <span className="input-icon"><Icon name="lock" size="sm" /></span>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                </div>
              </div>
            )}
            
            {mode === 'register' && (
              <div className="captcha-box">
                <div className="captcha-question">🐉 {captcha.question}</div>
                <div className="captcha-input">
                  <input type="text" value={captchaInput} onChange={e => setCaptchaInput(e.target.value)} placeholder="?" />
                  <button type="button" className="icon-btn sm" onClick={() => setCaptcha(generateCaptcha())}><Icon name="refresh" size="sm" /></button>
                </div>
              </div>
            )}
            
            {error && <div className="error-message"><Icon name="x" size="sm" /> {error}</div>}
            {success && <div className="success-message"><Icon name="check" size="sm" /> {success}</div>}
            
            <button type="submit" className="auth-submit">
              {mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link'}
            </button>
          </form>
          
          {mode === 'login' && <button className="forgot-link" onClick={() => switchMode('forgot')}>Forgot password?</button>}
          
          {mode !== 'forgot' && (
            <>
              <div className="auth-divider">or</div>
              <button className="google-btn" onClick={handleGoogleClick}>
                <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
              </button>
            </>
          )}
          
          <div className="auth-links">
            {mode === 'login' && <><span>New here?</span><button onClick={() => switchMode('register')}>Create account</button></>}
            {mode === 'register' && <><span>Have an account?</span><button onClick={() => switchMode('login')}>Sign in</button></>}
            {mode === 'forgot' && <button onClick={() => switchMode('login')}>Back to sign in</button>}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Join Room Modal (for visitors/guests)
// ============================================
const JoinRoomModal = ({ hostName, roomName, existingName, isGuest, onJoin, onCancel, onCreateAccount, onLogin }) => {
  const [displayName, setDisplayName] = useState(existingName || '');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('guest'); // 'guest', 'options'

  const handleJoin = () => {
    if (!displayName.trim()) {
      setError('Please enter a display name');
      return;
    }
    if (displayName.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    onJoin(displayName.trim());
  };

  return (
    <div className="modal-overlay">
      <div className="modal join-modal" onClick={e => e.stopPropagation()}>
        <div className="join-header">
          <span className="join-dragon">🐉</span>
          <h2>Join {hostName}'s Room</h2>
          {roomName && <p className="join-room-name">{roomName}</p>}
        </div>
        
        <div className="join-content">
          {isGuest ? (
            <>
              <p className="join-description">
                Choose how you'd like to join this room:
              </p>
              
              <div className="join-option-card">
                <div className="join-option-header">
                  <span className="join-option-icon">👤</span>
                  <div>
                    <strong>Continue as Guest</strong>
                    <span>Quick access with a display name</span>
                  </div>
                </div>
                <div className="join-option-content">
                  <input 
                    type="text" 
                    value={displayName} 
                    onChange={e => { setDisplayName(e.target.value); setError(''); }}
                    placeholder="Enter your display name"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  />
                  {error && <div className="join-error">{error}</div>}
                  <button className="btn primary" onClick={handleJoin}>
                    <Icon name="enter" size="sm" /> Join as Guest
                  </button>
                  <span className="join-note">You can add videos and participate. Name saved for future visits.</span>
                </div>
              </div>

              <div className="join-divider">
                <span>or</span>
              </div>

              <div className="join-account-options">
                <button className="btn secondary" onClick={onCreateAccount}>
                  <Icon name="plus" size="sm" /> Create Account
                </button>
                <button className="btn ghost" onClick={onLogin}>
                  Already have an account? <strong>Sign In</strong>
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="join-description">
                {existingName 
                  ? "You can keep your saved name or change it for this room."
                  : "Choose how you want to appear in this room."
                }
              </p>
              
              <div className="modal-input-group">
                <label>Display Name</label>
                <input 
                  type="text" 
                  value={displayName} 
                  onChange={e => { setDisplayName(e.target.value); setError(''); }}
                  placeholder="Enter your name"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                />
              </div>
              
              {error && <div className="error-message"><Icon name="x" size="sm" /> {error}</div>}
              
              <div className="modal-actions">
                <button className="btn secondary" onClick={onCancel}>Cancel</button>
                <button className="btn primary" onClick={handleJoin}>
                  <Icon name="enter" size="sm" /> Join Room
                </button>
              </div>
            </>
          )}
        </div>
        
        <button className="join-cancel" onClick={onCancel}>
          <Icon name="x" size="sm" />
        </button>
      </div>
    </div>
  );
};

// ============================================
// Settings Modal
// ============================================
const SettingsModal = ({ user, onClose, onUpdate, onDeleteAccount }) => {
  const [tab, setTab] = useState('profile');
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [newEmail, setNewEmail] = useState(user.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = () => {
    setMessage({});
    if (!displayName.trim()) { setMessage({ type: 'error', text: 'Name required' }); return; }
    if (displayName.trim().length < 3) { setMessage({ type: 'error', text: 'Name must be 3+ characters' }); return; }
    
    const users = storage.getUsers();
    
    if (user.provider !== 'google') {
      const existingUser = Object.values(users).find(
        u => u.username?.toLowerCase() === displayName.trim().toLowerCase() && u.id !== user.id
      );
      if (existingUser) { setMessage({ type: 'error', text: 'Name already taken' }); return; }
    }
    
    setSaving(true);
    const userKey = Object.keys(users).find(key => users[key].id === user.id || key === user.id);
    
    if (userKey) {
      users[userKey].displayName = displayName.trim();
      users[userKey].username = displayName.trim();
      storage.saveUsers(users);
      onUpdate({ ...user, displayName: displayName.trim(), username: displayName.trim() });
      setMessage({ type: 'success', text: 'Profile saved!' });
    } else {
      users[user.id] = { ...user, displayName: displayName.trim(), username: displayName.trim() };
      storage.saveUsers(users);
      onUpdate({ ...user, displayName: displayName.trim(), username: displayName.trim() });
      setMessage({ type: 'success', text: 'Profile saved!' });
    }
    setSaving(false);
  };

  const handleChangeEmail = () => {
    setMessage({});
    if (!validateEmail(newEmail)) { setMessage({ type: 'error', text: 'Invalid email' }); return; }
    if (newEmail === user.email) { setMessage({ type: 'error', text: 'Same as current email' }); return; }
    
    const users = storage.getUsers();
    const existingEmail = Object.values(users).find(u => u.email === newEmail && u.id !== user.id);
    if (existingEmail) { setMessage({ type: 'error', text: 'Email already in use' }); return; }
    
    const userKey = Object.keys(users).find(key => users[key].id === user.id || key === user.id);
    if (!userKey) { setMessage({ type: 'error', text: 'Error updating email' }); return; }
    
    setSaving(true);
    users[userKey].email = newEmail;
    storage.saveUsers(users);
    onUpdate({ ...user, email: newEmail });
    setMessage({ type: 'success', text: 'Email updated!' });
    setSaving(false);
  };

  const handleChangePassword = () => {
    setMessage({});
    if (user.provider === 'google') { setMessage({ type: 'error', text: 'Use Google to manage password' }); return; }
    
    const users = storage.getUsers();
    const userKey = Object.keys(users).find(key => users[key].id === user.id || key === user.id);
    if (!userKey) { setMessage({ type: 'error', text: 'Error changing password' }); return; }
    
    if (users[userKey]?.password !== currentPassword) { setMessage({ type: 'error', text: 'Wrong current password' }); return; }
    if (newPassword.length < 6) { setMessage({ type: 'error', text: 'Password must be 6+ characters' }); return; }
    if (newPassword !== confirmPassword) { setMessage({ type: 'error', text: 'Passwords don\'t match' }); return; }
    
    setSaving(true);
    users[userKey].password = newPassword;
    storage.saveUsers(users);
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    setMessage({ type: 'success', text: 'Password changed!' });
    setSaving(false);
  };

  const handleDeleteAccount = () => {
    if (deleteConfirm !== 'DELETE') {
      setMessage({ type: 'error', text: 'Type DELETE to confirm' });
      return;
    }
    onDeleteAccount();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth: '450px'}}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Settings</h2>
        
        <div className="settings-tabs">
          <button className={`settings-tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => { setTab('profile'); setMessage({}); }}>Profile</button>
          <button className={`settings-tab ${tab === 'email' ? 'active' : ''}`} onClick={() => { setTab('email'); setMessage({}); }}>Email</button>
          <button className={`settings-tab ${tab === 'password' ? 'active' : ''}`} onClick={() => { setTab('password'); setMessage({}); }}>Password</button>
          <button className={`settings-tab ${tab === 'danger' ? 'active' : ''}`} onClick={() => { setTab('danger'); setMessage({}); }} style={{color: 'var(--error)'}}>Danger</button>
        </div>
        
        {message.text && <div className={`${message.type}-message`}>{message.text}</div>}
        
        {tab === 'profile' && (
          <>
            <div className="modal-input-group">
              <label>Username</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your username" />
              <small style={{color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px', display: 'block'}}>
                This is your display name and login username
              </small>
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={onClose}>Cancel</button>
              <button className="btn primary" onClick={handleSaveProfile} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
        
        {tab === 'email' && (
          <>
            <div className="modal-input-group">
              <label>Current Email</label>
              <input type="email" value={user.email} disabled style={{opacity: 0.6}} />
            </div>
            <div className="modal-input-group">
              <label>New Email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Enter new email" />
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={onClose}>Cancel</button>
              <button className="btn primary" onClick={handleChangeEmail} disabled={saving}>
                {saving ? 'Updating...' : 'Update Email'}
              </button>
            </div>
          </>
        )}
        
        {tab === 'password' && (
          <>
            {user.provider === 'google' ? (
              <p style={{color: 'var(--text-muted)', textAlign: 'center', padding: '20px'}}>
                Google accounts use Google password management.
              </p>
            ) : (
              <>
                <div className="modal-input-group">
                  <label>Current Password</label>
                  <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
                </div>
                <div className="modal-input-group">
                  <label>New Password</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" />
                </div>
                <div className="modal-input-group">
                  <label>Confirm New Password</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
                </div>
                <div className="modal-actions">
                  <button className="btn secondary" onClick={onClose}>Cancel</button>
                  <button className="btn primary" onClick={handleChangePassword} disabled={saving}>
                    {saving ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
        
        {tab === 'danger' && (
          <div className="danger-zone">
            <h3><Icon name="alertTriangle" size="sm" /> Delete Account</h3>
            <p>This action cannot be undone. All your rooms and data will be permanently deleted.</p>
            <div className="modal-input-group">
              <label>Type "DELETE" to confirm</label>
              <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
            </div>
            <button className="btn danger" onClick={handleDeleteAccount} style={{width: '100%'}}>
              <Icon name="trash" size="sm" /> Delete My Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// Edit Video Modal
// ============================================
const EditVideoModal = ({ video, onSave, onDelete, onClose }) => {
  const [title, setTitle] = useState(video?.title || '');
  if (!video) return null;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Edit Video</h2>
        <div className="modal-input-group">
          <label>Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
        </div>
        <div className="modal-input-group">
          <label>URL</label>
          <input type="text" value={video.url.startsWith('blob:') ? 'Local file' : video.url} disabled />
        </div>
        <div className="modal-actions">
          <button className="btn danger" onClick={() => onDelete(video.id)}><Icon name="trash" size="sm" /> Delete</button>
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => onSave(video.id, title.trim() || video.title)}>Save</button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Playlist Item
// ============================================
const PlaylistItem = ({ playlist, isActive, onSelect, onRename, onDelete, onDragStart, onDragOver, onDrop, isDragging, isDragOver }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(playlist.name);
  const inputRef = useRef(null);

  useEffect(() => { if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [isEditing]);

  const handleRename = () => {
    if (newName.trim() && newName !== playlist.name) onRename(playlist.id, newName.trim());
    setIsEditing(false);
  };

  return (
    <div
      className={`playlist-item ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      draggable
      onDragStart={e => onDragStart(e, playlist.id)}
      onDragOver={e => onDragOver(e, playlist.id)}
      onDrop={e => onDrop(e, playlist.id)}
    >
      <span className="drag-handle"><Icon name="grip" size="sm" /></span>
      {isEditing ? (
        <input ref={inputRef} className="playlist-edit-input" value={newName} onChange={e => setNewName(e.target.value)}
          onBlur={handleRename} onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setNewName(playlist.name); setIsEditing(false); } }} />
      ) : (
        <button className="playlist-select" onClick={() => onSelect(playlist)}>
          <span className="playlist-name">{playlist.name}</span>
          <span className="playlist-count">{playlist.videos.length}</span>
        </button>
      )}
      <div className="playlist-actions">
        <button className="icon-btn sm" onClick={() => setIsEditing(true)} title="Rename"><Icon name="edit" size="sm" /></button>
        <button className="icon-btn sm danger" onClick={() => onDelete(playlist.id)} title="Delete"><Icon name="trash" size="sm" /></button>
      </div>
    </div>
  );
};

// ============================================
// Video Item
// ============================================
const VideoItem = ({ video, index, isPlaying, onPlay, onEdit, onDelete, onDragStart, onDragOver, onDrop, isDragging, isDragOver }) => (
  <div
    className={`video-item ${isPlaying ? 'playing' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
    draggable
    onDragStart={e => onDragStart(e, video.id)}
    onDragOver={e => onDragOver(e, video.id)}
    onDrop={e => onDrop(e, video.id)}
    onClick={() => onPlay(video, index)}
  >
    <div className="video-item-top">
      <span className="drag-handle" onClick={e => e.stopPropagation()}><Icon name="grip" size="sm" /></span>
      <span className="video-index">{index + 1}</span>
      <span className="video-type-icon">{getVideoTypeIcon(video.type)}</span>
      <span className="video-title">{video.title}</span>
    </div>
    <div className="video-url">{video.url.startsWith('blob:') ? 'Local file' : video.url}</div>
    <div className="video-actions" onClick={e => e.stopPropagation()}>
      <button className="icon-btn sm" onClick={() => onPlay(video, index)} title="Play"><Icon name="play" size="sm" /></button>
      <button className="icon-btn sm" onClick={() => onEdit(video)} title="Edit"><Icon name="edit" size="sm" /></button>
      <button className="icon-btn sm danger" onClick={() => onDelete(video.id)} title="Remove"><Icon name="trash" size="sm" /></button>
    </div>
  </div>
);

// ============================================
// User Menu
// ============================================
const UserMenu = ({ user, onSettings, onLogout, onHome }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="user-menu-container" ref={ref}>
      <div className="user-menu" onClick={() => setOpen(!open)}>
        <div className="user-avatar">{user.displayName[0].toUpperCase()}</div>
        <span className="user-name">{user.displayName}</span>
      </div>
      {open && (
        <div className="user-dropdown">
          <div className="dropdown-header">
            <div className="name">{user.displayName}</div>
            <div className="email">{user.email}</div>
          </div>
          {onHome && (
            <button className="dropdown-item" onClick={() => { setOpen(false); onHome(); }}>
              <Icon name="home" size="sm" /> My Rooms
            </button>
          )}
          <button className="dropdown-item" onClick={() => { setOpen(false); onSettings(); }}>
            <Icon name="settings" size="sm" /> Settings
          </button>
          <div className="dropdown-divider" />
          <button className="dropdown-item danger" onClick={onLogout}>
            <Icon name="logout" size="sm" /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================
// Home Page - Room Management
// ============================================
// Helper to get room connected users
const getRoomConnectedUsers = (roomId) => {
  const presence = storage.getRoomPresence(roomId);
  const members = storage.getRoomMembers(roomId);
  const kicked = storage.getKickedUsers(roomId);
  const now = Date.now();
  
  return Object.values(members)
    .filter(m => !kicked.includes(m.visitorId))
    .map(m => {
      const p = presence[m.visitorId];
      return {
        visitorId: m.visitorId,
        displayName: m.displayName,
        color: m.color,
        isOwner: m.isOwner === true,
        status: (p && (now - p.lastSeen) < PRESENCE_TIMEOUT) 
          ? (p.status === 'away' ? 'away' : 'online') 
          : 'offline'
      };
    })
    .sort((a, b) => {
      if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
      if (a.status !== b.status) return a.status === 'online' ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });
};

const HomePage = ({ user, onEnterRoom, onLogout, onUpdateUser, onDeleteAccount }) => {
  const [rooms, setRooms] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [editingRoom, setEditingRoom] = useState(null);
  const [editName, setEditName] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [roomUsers, setRoomUsers] = useState({});

  useEffect(() => {
    const savedRooms = storage.getUserRooms(user.id);
    if (savedRooms.length === 0) {
      const defaultRoom = { id: generateId(), name: 'My Room', createdAt: Date.now() };
      storage.saveUserRooms(user.id, [defaultRoom]);
      setRooms([defaultRoom]);
    } else {
      setRooms(savedRooms);
    }
  }, [user.id]);

  // Update connected users for all rooms periodically
  useEffect(() => {
    const updateRoomUsers = () => {
      const usersMap = {};
      rooms.forEach(room => {
        usersMap[room.id] = getRoomConnectedUsers(room.id);
      });
      setRoomUsers(usersMap);
    };
    
    updateRoomUsers();
    const interval = setInterval(updateRoomUsers, 5000);
    return () => clearInterval(interval);
  }, [rooms]);

  const saveRooms = (newRooms) => {
    storage.saveUserRooms(user.id, newRooms);
    setRooms(newRooms);
  };

  const showNotif = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const createRoom = () => {
    if (!newRoomName.trim()) return;
    const newRoom = { id: generateId(), name: newRoomName.trim(), createdAt: Date.now() };
    saveRooms([...rooms, newRoom]);
    setNewRoomName('');
    setShowCreate(false);
    showNotif('Room created!');
  };

  const renameRoom = (roomId) => {
    if (!editName.trim()) return;
    saveRooms(rooms.map(r => r.id === roomId ? { ...r, name: editName.trim() } : r));
    setEditingRoom(null);
    setEditName('');
    showNotif('Room renamed!');
  };

  const deleteRoom = (roomId) => {
    const message = rooms.length <= 1 
      ? 'Delete your last room? You can create a new one anytime.'
      : 'Delete this room and all its playlists?';
    if (!confirm(message)) return;
    storage.deleteRoomPlaylists(roomId);
    saveRooms(rooms.filter(r => r.id !== roomId));
    showNotif('Room deleted!', 'warning');
  };

  const copyShareLink = (roomId) => {
    const link = `${window.location.origin}${window.location.pathname}#/room/${user.id}/${roomId}`;
    navigator.clipboard.writeText(link);
    showNotif('Link copied!');
  };

  const kickUserFromRoom = (roomId, visitorId, displayName) => {
    if (!confirm(`Kick ${displayName} from this room?`)) return;
    storage.kickUser(roomId, visitorId);
    storage.removeRoomMember(roomId, visitorId);
    storage.removeUserPresence(roomId, visitorId);
    // Refresh users
    const usersMap = { ...roomUsers };
    usersMap[roomId] = getRoomConnectedUsers(roomId);
    setRoomUsers(usersMap);
    showNotif(`${displayName} has been kicked`);
  };

  const getOnlineCount = (roomId) => {
    const users = roomUsers[roomId] || [];
    return users.filter(u => u.status === 'online').length;
  };

  return (
    <div className="home-page">
      <DragonFire />
      
      <header className="home-header">
        <div className="logo-small">
          <span className="dragon-icon">🐉</span>
          <span>Dragon Playlist</span>
        </div>
        <UserMenu user={user} onSettings={() => setSettingsOpen(true)} onLogout={onLogout} />
      </header>

      <main className="home-content">
        <div className="home-welcome">
          <div className="welcome-glow" />
          <h1>Welcome back, {user.displayName}</h1>
          <p>Your dragon's den awaits. Manage rooms and watch with friends.</p>
        </div>

        <div className="rooms-section">
          <div className="rooms-header">
            <h2>
              <span className="section-icon">🚪</span>
              My Rooms
              <span className="room-count">{rooms.length}</span>
            </h2>
            <button className="btn primary glow" onClick={() => setShowCreate(true)}>
              <Icon name="plus" size="sm" /> New Room
            </button>
          </div>

          {showCreate && (
            <div className="create-room-form">
              <input
                type="text"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                placeholder="Enter room name..."
                autoFocus
                onKeyDown={e => e.key === 'Enter' && createRoom()}
              />
              <button className="btn primary" onClick={createRoom}>Create</button>
              <button className="btn ghost" onClick={() => { setShowCreate(false); setNewRoomName(''); }}>Cancel</button>
            </div>
          )}

          {rooms.length > 0 ? (
            <div className="rooms-grid">
              {rooms.map(room => {
                const users = roomUsers[room.id] || [];
                const onlineUsers = users.filter(u => u.status === 'online');
                
                return (
                  <div key={room.id} className="room-card">
                    <div className="room-card-bg" />
                    <div className="room-card-content">
                      <div className="room-card-header">
                        {editingRoom === room.id ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onBlur={() => renameRoom(room.id)}
                            onKeyDown={e => { if (e.key === 'Enter') renameRoom(room.id); if (e.key === 'Escape') setEditingRoom(null); }}
                            autoFocus
                            className="room-edit-input"
                          />
                        ) : (
                          <h3>{room.name}</h3>
                        )}
                        <div className="room-status">
                          {onlineUsers.length > 0 && (
                            <span className="online-badge">
                              <span className="pulse" />
                              {onlineUsers.length} online
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Connected users mini-list */}
                      {users.length > 0 && (
                        <div className="room-users-preview">
                          {users.slice(0, 5).map(u => (
                            <div 
                              key={u.visitorId} 
                              className={`mini-user ${u.status}`}
                              style={u.color && u.status === 'online' ? { background: u.color } : {}}
                              title={`${u.displayName}${u.isOwner ? ' (Owner)' : ''} - ${u.status}`}
                            >
                              {u.isOwner && <span className="mini-crown">👑</span>}
                              <span className="mini-name">{u.displayName}</span>
                              {!u.isOwner && u.status !== 'offline' && (
                                <button 
                                  className="mini-kick"
                                  onClick={(e) => { e.stopPropagation(); kickUserFromRoom(room.id, u.visitorId, u.displayName); }}
                                  title="Kick user"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                          {users.length > 5 && (
                            <span className="more-users">+{users.length - 5} more</span>
                          )}
                        </div>
                      )}

                      <div className="room-card-actions">
                        <button className="btn primary enter-btn" onClick={() => onEnterRoom(room)}>
                          <Icon name="enter" size="sm" /> Enter Room
                        </button>
                        <div className="room-tools">
                          <button className="tool-btn" onClick={() => copyShareLink(room.id)} title="Share">
                            <Icon name="share" size="sm" />
                          </button>
                          <button className="tool-btn" onClick={() => { setEditingRoom(room.id); setEditName(room.name); }} title="Rename">
                            <Icon name="edit" size="sm" />
                          </button>
                          <button className="tool-btn danger" onClick={() => deleteRoom(room.id)} title="Delete">
                            <Icon name="trash" size="sm" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="no-rooms">
              <div className="no-rooms-icon">🏰</div>
              <h3>No Rooms Yet</h3>
              <p>Create your first room to start watching with friends</p>
              <button className="btn primary glow" onClick={() => setShowCreate(true)}>
                <Icon name="plus" size="sm" /> Create a Room
              </button>
            </div>
          )}
        </div>
      </main>

      {settingsOpen && (
        <SettingsModal 
          user={user} 
          onClose={() => setSettingsOpen(false)} 
          onUpdate={onUpdateUser}
          onDeleteAccount={onDeleteAccount}
        />
      )}
      {notification && <div className={`notification ${notification.type}`}>{notification.message}</div>}
    </div>
  );
};

// ============================================
// Room (Dashboard)
// ============================================
const Room = ({ user, room, hostId, visitorDisplayName, onHome, onLogout, onUpdateUser, onDeleteAccount, onDisplayNameChange }) => {
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
  const [editingVideo, setEditingVideo] = useState(null);
  const [notification, setNotification] = useState(null);
  const [draggingPlaylist, setDraggingPlaylist] = useState(null);
  const [dragOverPlaylist, setDragOverPlaylist] = useState(null);
  const [draggingVideo, setDraggingVideo] = useState(null);
  const [dragOverVideo, setDragOverVideo] = useState(null);
  const [currentDisplayName, setCurrentDisplayName] = useState(visitorDisplayName);
  const [kickedOut, setKickedOut] = useState(false);
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false);
  const fileInputRef = useRef(null);

  // Determine visitorId - for logged in users use their id, for guests generate/get one
  let visitorId;
  if (user && user.id) {
    visitorId = user.id;
  } else {
    visitorId = storage.getGuestId();
    if (!visitorId) {
      visitorId = `guest_${generateId()}`;
      storage.setGuestId(visitorId);
    }
  }
  
  // Determine if current user is the owner (logged in AND their id matches hostId)
  const isOwner = !!(user && user.id && user.id === hostId);
  
  const displayName = currentDisplayName || (user ? user.displayName : 'Guest');
  
  const { connectedUsers, refreshPresence } = usePresence(room.id, visitorId, displayName, isOwner);

  // Check if kicked (not for owner)
  useEffect(() => {
    if (isOwner) return; // Owner can't be kicked
    const checkKicked = () => {
      if (storage.isUserKicked(room.id, visitorId)) {
        setKickedOut(true);
      }
    };
    checkKicked();
    const interval = setInterval(checkKicked, 2000);
    return () => clearInterval(interval);
  }, [room.id, visitorId, isOwner]);

  // Load playlists on mount
  useEffect(() => {
    const saved = storage.getRoomPlaylists(room.id);
    setPlaylists(saved);
    if (saved.length > 0) setActivePlaylist(saved[0]);
    setPlaylistsLoaded(true);
  }, [room.id]);

  // Save playlists when changed (only after initial load)
  // Note: In localStorage, each browser has its own copy
  useEffect(() => {
    if (playlistsLoaded) {
      storage.saveRoomPlaylists(room.id, playlists);
    }
  }, [playlists, room.id, playlistsLoaded]);

  const showNotif = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Kick handler (host only)
  const handleKick = (visitorIdToKick, kickedName) => {
    if (!isOwner) return;
    storage.kickUser(room.id, visitorIdToKick);
    storage.removeRoomMember(room.id, visitorIdToKick);
    storage.removeUserPresence(room.id, visitorIdToKick);
    refreshPresence();
    showNotif(`${kickedName} has been kicked`);
  };

  // Rename handler (host can rename anyone)
  const handleRename = (targetVisitorId, newName) => {
    if (!isOwner) return;
    storage.updateMemberName(room.id, targetVisitorId, newName);
    refreshPresence();
    showNotif(`Renamed to ${newName}`);
  };

  // Self rename handler
  const handleRenameSelf = (newName) => {
    setCurrentDisplayName(newName);
    storage.updateMemberName(room.id, visitorId, newName);
    
    // For owner, update their user profile displayName for persistence
    if (isOwner && user) {
      const users = storage.getUsers();
      if (users[user.id]) {
        users[user.id].displayName = newName;
        storage.saveUsers(users);
        // Also update current user
        const updatedUser = { ...user, displayName: newName };
        storage.setCurrentUser(updatedUser);
        if (onUpdateUser) onUpdateUser(updatedUser);
      }
    } else if (user) {
      // Visitor - save visitor name
      storage.setVisitorName(hostId, user.id, newName);
    } else {
      // Guest
      const guestId = storage.getGuestId();
      storage.setGuestNameForHost(hostId, guestId, newName);
    }
    
    if (onDisplayNameChange) onDisplayNameChange(newName);
    refreshPresence();
    showNotif('Name updated!');
  };

  // Color change handler
  const handleColorChange = (targetVisitorId, color) => {
    storage.updateMemberColor(room.id, targetVisitorId, color);
    refreshPresence();
    showNotif(color ? 'Color updated!' : 'Color removed!');
  };

  // Playlist CRUD (only for owner)
  const createPlaylist = () => {
    if (!isOwner || !newPlaylistName.trim()) return;
    const np = { id: Date.now().toString(), name: newPlaylistName.trim(), videos: [], createdAt: Date.now() };
    setPlaylists(p => [...p, np]);
    setActivePlaylist(np);
    setNewPlaylistName('');
    setShowCreatePlaylist(false);
    showNotif('Playlist created!');
  };

  const renamePlaylist = (id, name) => {
    if (!isOwner) return;
    setPlaylists(p => p.map(pl => pl.id === id ? { ...pl, name } : pl));
    if (activePlaylist?.id === id) setActivePlaylist(ap => ({ ...ap, name }));
    showNotif('Playlist renamed!');
  };

  const deletePlaylist = (id) => {
    if (!isOwner) return;
    if (!confirm('Delete this playlist?')) return;
    setPlaylists(p => p.filter(pl => pl.id !== id));
    if (activePlaylist?.id === id) { setActivePlaylist(null); setCurrentVideo(null); setCurrentIndex(-1); }
    showNotif('Playlist deleted!', 'warning');
  };

  // Playlist drag & drop
  const handlePlaylistDragStart = (e, id) => { if (!isOwner) return; setDraggingPlaylist(id); e.dataTransfer.effectAllowed = 'move'; };
  const handlePlaylistDragOver = (e, id) => { if (!isOwner) return; e.preventDefault(); setDragOverPlaylist(id); };
  const handlePlaylistDrop = (e, targetId) => {
    if (!isOwner) return;
    e.preventDefault();
    if (draggingPlaylist && draggingPlaylist !== targetId) {
      const dragIdx = playlists.findIndex(p => p.id === draggingPlaylist);
      const targetIdx = playlists.findIndex(p => p.id === targetId);
      const newPlaylists = [...playlists];
      const [moved] = newPlaylists.splice(dragIdx, 1);
      newPlaylists.splice(targetIdx, 0, moved);
      setPlaylists(newPlaylists);
    }
    setDraggingPlaylist(null);
    setDragOverPlaylist(null);
  };

  // Video CRUD
  const addVideoToPlaylist = (url, title, isAudio = false) => {
    if (!isOwner || !url || !activePlaylist) return false;
    const parsed = parseVideoUrl(url);
    if (!parsed) { showNotif('Invalid URL', 'error'); return false; }
    const nv = { id: Date.now().toString(), url, title: title || `Video ${activePlaylist.videos.length + 1}`, addedAt: Date.now(), type: parsed.type, isAudio };
    const updated = { ...activePlaylist, videos: [...activePlaylist.videos, nv] };
    setPlaylists(p => p.map(pl => pl.id === activePlaylist.id ? updated : pl));
    setActivePlaylist(updated);
    return true;
  };

  const handleAddUrl = () => { 
    if (!isOwner) { showNotif('Only the room owner can add videos', 'error'); return; }
    if (urlInput.trim() && addVideoToPlaylist(urlInput.trim())) { setUrlInput(''); showNotif('Added!'); } 
  };
  
  const handleFileUpload = (e) => {
    if (!isOwner) { showNotif('Only the room owner can upload files', 'error'); return; }
    const files = e.target.files;
    if (!files?.length || !activePlaylist) { if (!activePlaylist) showNotif('Select a playlist first', 'error'); return; }
    Array.from(files).forEach(f => addVideoToPlaylist(URL.createObjectURL(f), f.name, f.type.startsWith('audio/')));
    showNotif(`${files.length} file(s) added!`);
    e.target.value = '';
  };

  const playVideo = (video, index) => { setCurrentVideo(video); setCurrentIndex(index); };
  
  const playNow = () => {
    if (!urlInput.trim()) return;
    const parsed = parseVideoUrl(urlInput);
    if (!parsed) { showNotif('Invalid URL', 'error'); return; }
    setCurrentVideo({ id: 'temp-' + Date.now(), url: urlInput.trim(), title: 'Now Playing', type: parsed.type });
    setCurrentIndex(-1);
    setUrlInput('');
  };

  const addCurrentToPlaylist = () => {
    if (!isOwner) { showNotif('Only the room owner can add to playlist', 'error'); return; }
    if (!currentVideo || !activePlaylist) return;
    if (currentVideo.id.startsWith('temp-')) {
      if (addVideoToPlaylist(currentVideo.url, currentVideo.title)) showNotif('Added to playlist!');
    }
  };

  const updateVideo = (id, title) => {
    if (!isOwner || !activePlaylist) return;
    const updated = { ...activePlaylist, videos: activePlaylist.videos.map(v => v.id === id ? { ...v, title } : v) };
    setPlaylists(p => p.map(pl => pl.id === activePlaylist.id ? updated : pl));
    setActivePlaylist(updated);
    if (currentVideo?.id === id) setCurrentVideo(cv => ({ ...cv, title }));
    setEditingVideo(null);
    showNotif('Updated!');
  };

  const removeVideo = (id) => {
    if (!isOwner || !activePlaylist) return;
    const v = activePlaylist.videos.find(vid => vid.id === id);
    if (v?.url?.startsWith('blob:')) URL.revokeObjectURL(v.url);
    const updated = { ...activePlaylist, videos: activePlaylist.videos.filter(vid => vid.id !== id) };
    setPlaylists(p => p.map(pl => pl.id === activePlaylist.id ? updated : pl));
    setActivePlaylist(updated);
    if (currentVideo?.id === id) { setCurrentVideo(null); setCurrentIndex(-1); }
    setEditingVideo(null);
    showNotif('Removed!');
  };

  // Video drag & drop
  const handleVideoDragStart = (e, id) => { if (!isOwner) return; setDraggingVideo(id); e.dataTransfer.effectAllowed = 'move'; };
  const handleVideoDragOver = (e, id) => { if (!isOwner) return; e.preventDefault(); setDragOverVideo(id); };
  const handleVideoDrop = (e, targetId) => {
    if (!isOwner) return;
    e.preventDefault();
    if (draggingVideo && draggingVideo !== targetId && activePlaylist) {
      const vids = [...activePlaylist.videos];
      const dragIdx = vids.findIndex(v => v.id === draggingVideo);
      const targetIdx = vids.findIndex(v => v.id === targetId);
      const [moved] = vids.splice(dragIdx, 1);
      vids.splice(targetIdx, 0, moved);
      const updated = { ...activePlaylist, videos: vids };
      setPlaylists(p => p.map(pl => pl.id === activePlaylist.id ? updated : pl));
      setActivePlaylist(updated);
      if (currentVideo) setCurrentIndex(vids.findIndex(v => v.id === currentVideo.id));
    }
    setDraggingVideo(null);
    setDragOverVideo(null);
  };

  const playNext = () => {
    if (!activePlaylist || currentIndex >= activePlaylist.videos.length - 1) return;
    const next = currentIndex + 1;
    setCurrentVideo(activePlaylist.videos[next]);
    setCurrentIndex(next);
  };

  const playPrev = () => {
    if (!activePlaylist || currentIndex <= 0) return;
    const prev = currentIndex - 1;
    setCurrentVideo(activePlaylist.videos[prev]);
    setCurrentIndex(prev);
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}${window.location.pathname}#/room/${hostId}/${room.id}`;
    navigator.clipboard.writeText(link);
    showNotif('Link copied!');
    setShareModalOpen(false);
  };

  // Get host display name
  const users = storage.getUsers();
  const hostUser = Object.values(users).find(u => u.id === hostId);
  const hostName = hostUser?.displayName || 'Unknown';

  // Show kicked out screen
  if (kickedOut) {
    return (
      <div className="kicked-screen">
        <DragonFire />
        <div className="kicked-content">
          <div className="kicked-icon">🚫</div>
          <h1>You've Been Kicked</h1>
          <p>The host has removed you from this room.</p>
          {onHome ? (
            <button className="btn primary" onClick={onHome}>
              <Icon name="home" size="sm" /> Go to My Rooms
            </button>
          ) : (
            <button className="btn primary" onClick={() => window.location.hash = ''}>
              <Icon name="home" size="sm" /> Go Home
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <DragonFire />
      <input type="file" ref={fileInputRef} className="hidden" accept="video/*,audio/*" multiple onChange={handleFileUpload} />

      <header className="dashboard-header">
        <div className="header-left">
          <button className="icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}><Icon name="menu" /></button>
          {onHome && (
            <button className="icon-btn" onClick={onHome} title="My Rooms"><Icon name="home" /></button>
          )}
          <div className="logo-small">
            <span className="dragon-icon">🐉</span>
            <span>{room.name}</span>
            {!isOwner && <span className="host-tag">by {hostName}</span>}
          </div>
        </div>
        <div className="header-center">
          <div className="url-bar">
            <input value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="Enter URL (YouTube, Spotify...)" onKeyDown={e => e.key === 'Enter' && playNow()} />
            <button className="icon-btn primary" onClick={playNow} title="Play Now"><Icon name="play" /></button>
            {/* Allow both owner and visitors to add videos */}
            <button className="icon-btn" onClick={handleAddUrl} disabled={!activePlaylist} title="Add to Playlist"><Icon name="plus" /></button>
            <button className="icon-btn" onClick={() => fileInputRef.current?.click()} disabled={!activePlaylist} title="Upload"><Icon name="upload" /></button>
          </div>
        </div>
        <div className="header-right">
          <button className="btn secondary sm" onClick={() => setShareModalOpen(true)}><Icon name="share" size="sm" /> Share</button>
          {user ? (
            <UserMenu user={user} onSettings={() => setSettingsOpen(true)} onLogout={onLogout} onHome={onHome} />
          ) : (
            <div className="guest-badge">
              <span className="guest-name">{displayName}</span>
              <span className="guest-tag">Guest</span>
            </div>
          )}
        </div>
      </header>

      <div className="dashboard-content">
        <aside className={`sidebar ${sidebarOpen ? '' : 'closed'}`}>
          <div className="sidebar-header">
            <h3>Playlists</h3>
            {isOwner && (
              <button className="icon-btn sm" onClick={() => setShowCreatePlaylist(true)} title="New Playlist"><Icon name="plus" size="sm" /></button>
            )}
          </div>
          {isOwner && showCreatePlaylist && (
            <div className="create-playlist-form">
              <input value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} placeholder="Playlist name" onKeyDown={e => e.key === 'Enter' && createPlaylist()} autoFocus />
              <div className="form-actions">
                <button className="btn primary sm" onClick={createPlaylist}>Create</button>
                <button className="btn sm" onClick={() => setShowCreatePlaylist(false)}>Cancel</button>
              </div>
            </div>
          )}
          <div className="playlists-list" onDragOver={e => e.preventDefault()}>
            {playlists.length === 0 ? (
              <div className="empty-playlists"><p>No playlists</p><span>{isOwner ? 'Create your first!' : 'Waiting for host...'}</span></div>
            ) : playlists.map(p => (
              <PlaylistItem key={p.id} playlist={p} isActive={activePlaylist?.id === p.id} onSelect={setActivePlaylist} 
                onRename={isOwner ? renamePlaylist : () => {}} onDelete={isOwner ? deletePlaylist : () => {}}
                onDragStart={handlePlaylistDragStart} onDragOver={handlePlaylistDragOver} onDrop={handlePlaylistDrop}
                isDragging={draggingPlaylist === p.id} isDragOver={dragOverPlaylist === p.id} />
            ))}
          </div>
        </aside>

        <main className="main-content">
          <div className="queue-panel">
            <div className="queue-header">
              <h3>📜 {activePlaylist?.name || 'Select Playlist'}</h3>
            </div>
            {activePlaylist ? (
              activePlaylist.videos.length > 0 ? (
                <div className="video-list" onDragOver={e => e.preventDefault()}>
                  {activePlaylist.videos.map((v, i) => (
                    <VideoItem key={v.id} video={v} index={i} isPlaying={currentVideo?.id === v.id} onPlay={playVideo} 
                      onEdit={isOwner ? setEditingVideo : () => {}} onDelete={isOwner ? removeVideo : () => {}}
                      onDragStart={handleVideoDragStart} onDragOver={handleVideoDragOver} onDrop={handleVideoDrop}
                      isDragging={draggingVideo === v.id} isDragOver={dragOverVideo === v.id} />
                  ))}
                </div>
              ) : <div className="empty-videos"><div className="empty-icon">🎬</div><p>Empty playlist</p><span>{isOwner ? 'Add videos above' : 'Waiting for host...'}</span></div>
            ) : <div className="no-playlist-selected"><div className="empty-icon">📜</div><p>No playlist</p><span>Select from sidebar</span></div>}
          </div>

          <div className="video-section">
            <OrnateBorder className="video-container">
              <VideoPlayer video={currentVideo} onEnded={playNext} />
            </OrnateBorder>
            <div className="playback-controls">
              <button className="btn sm" onClick={playPrev} disabled={!activePlaylist || currentIndex <= 0}><Icon name="prev" size="sm" /> Prev</button>
              <div className="now-playing">
                {currentVideo ? (
                  <>
                    <span className="playing-label">Now Playing</span>
                    <span className="playing-title">{currentVideo.title}</span>
                    {isOwner && currentVideo.id.startsWith('temp-') && activePlaylist && (
                      <button className="btn ghost sm add-playing-btn" onClick={addCurrentToPlaylist}><Icon name="addToList" size="sm" /> Add to Playlist</button>
                    )}
                  </>
                ) : <span className="playing-label">Nothing playing</span>}
              </div>
              <button className="btn sm" onClick={playNext} disabled={!activePlaylist || currentIndex >= (activePlaylist?.videos.length || 0) - 1}>Next <Icon name="next" size="sm" /></button>
            </div>
            <ConnectedUsers 
              users={connectedUsers} 
              isHost={isOwner}
              currentUserId={visitorId}
              roomId={room.id}
              onKick={handleKick}
              onRename={handleRename}
              onRenameSelf={handleRenameSelf}
              onColorChange={handleColorChange}
            />
          </div>
        </main>
      </div>

      {/* Embers */}
      <DragonFire />

      {shareModalOpen && (
        <div className="modal-overlay" onClick={() => setShareModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShareModalOpen(false)}>×</button>
            <h2>Share This Room</h2>
            <p>Invite others to join {room.name}</p>
            <div className="share-link-box">
              <input value={`${window.location.origin}${window.location.pathname}#/room/${hostId}/${room.id}`} readOnly />
              <button className="btn primary" onClick={copyShareLink}>Copy</button>
            </div>
            <div className="share-note">🐉 Users will appear in Connected when online</div>
          </div>
        </div>
      )}

      {user && settingsOpen && <SettingsModal user={user} onClose={() => setSettingsOpen(false)} onUpdate={onUpdateUser} onDeleteAccount={onDeleteAccount} />}
      {isOwner && editingVideo && <EditVideoModal video={editingVideo} onSave={updateVideo} onDelete={removeVideo} onClose={() => setEditingVideo(null)} />}
      {notification && <div className={`notification ${notification.type}`}>{notification.message}</div>}
    </div>
  );
};

// ============================================
// App
// ============================================
const DragonPlaylist = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('home'); // 'home', 'room', 'join'
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomHostId, setRoomHostId] = useState(null);
  const [visitorDisplayName, setVisitorDisplayName] = useState(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [pendingJoinData, setPendingJoinData] = useState(null);
  const skipHashChangeRef = useRef(false);

  useEffect(() => {
    // REPAIR: Ensure all users in storage have id field
    const users = storage.getUsers();
    let repaired = false;
    for (const [key, u] of Object.entries(users)) {
      if (!u.id) {
        users[key] = { ...u, id: key };
        repaired = true;
      }
    }
    if (repaired) {
      storage.saveUsers(users);
    }
    
    let saved = storage.getCurrentUser();
    
    // If user exists but missing id, try to find and fix it
    if (saved && !saved.id) {
      // Find this user in the users list by email
      for (const [key, u] of Object.entries(users)) {
        if (u.email === saved.email) {
          saved = { ...u, id: u.id || key };
          // Update storage with fixed user
          storage.setCurrentUser(saved);
          break;
        }
      }
    }
    
    if (saved) setUser(saved);
    
    // Check for room in URL on initial load
    const roomInfo = parseRoomUrl();
    if (roomInfo) {
      handleJoinFromUrl(roomInfo.hostId, roomInfo.roomId, saved);
    }
    
    setLoading(false);
    
    // Listen for hash changes (but skip if we triggered it internally)
    const handleHashChange = () => {
      if (skipHashChangeRef.current) {
        skipHashChangeRef.current = false;
        return;
      }
      const roomInfo = parseRoomUrl();
      if (roomInfo) {
        handleJoinFromUrl(roomInfo.hostId, roomInfo.roomId, storage.getCurrentUser());
      } else {
        setCurrentView('home');
        setCurrentRoom(null);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleJoinFromUrl = (hostId, roomId, currentUser) => {
    // Find the host's rooms
    const hostRooms = storage.getUserRooms(hostId);
    const room = hostRooms.find(r => r.id === roomId);
    
    if (!room) {
      alert('Room not found');
      window.location.hash = '';
      return;
    }
    
    // Check if this is the owner
    if (currentUser && currentUser.id === hostId) {
      // Owner entering their own room
      setCurrentRoom(room);
      setRoomHostId(hostId);
      setVisitorDisplayName(currentUser.displayName);
      setCurrentView('room');
      return;
    }
    
    // Visitor or guest - show join modal
    let existingName = null;
    let isGuest = !currentUser;
    
    if (currentUser) {
      // Logged-in visitor - check for saved name for this host
      existingName = storage.getVisitorName(hostId, currentUser.id) || currentUser.displayName;
    } else {
      // Guest - check for existing guest ID and name
      let guestId = storage.getGuestId();
      if (!guestId) {
        guestId = `guest_${generateId()}`;
        storage.setGuestId(guestId);
      }
      existingName = storage.getGuestNameForHost(hostId, guestId);
    }
    
    setPendingJoinData({ hostId, room, existingName, isGuest });
    setShowJoinModal(true);
  };

  const handleJoinRoom = (displayName) => {
    if (!pendingJoinData) return;
    
    const { hostId, room, isGuest } = pendingJoinData;
    
    if (user) {
      // Save visitor name for this host
      storage.setVisitorName(hostId, user.id, displayName);
    } else {
      // Save guest name for this host
      const guestId = storage.getGuestId();
      storage.setGuestNameForHost(hostId, guestId, displayName);
    }
    
    setCurrentRoom(room);
    setRoomHostId(hostId);
    setVisitorDisplayName(displayName);
    setCurrentView('room');
    setShowJoinModal(false);
    setPendingJoinData(null);
  };

  const handleCancelJoin = () => {
    setShowJoinModal(false);
    setPendingJoinData(null);
    skipHashChangeRef.current = true;
    window.location.hash = '';
  };

  const handleLogout = () => { 
    storage.clearCurrentUser(); 
    setUser(null);
    setCurrentView('home');
    setCurrentRoom(null);
    setRoomHostId(null);
    skipHashChangeRef.current = true;
    window.location.hash = '';
  };
  
  const handleUpdateUser = (updated) => { 
    storage.setCurrentUser(updated); 
    const users = storage.getUsers();
    const userKey = Object.keys(users).find(key => users[key].id === updated.id || key === updated.id);
    if (userKey) {
      users[userKey] = { ...users[userKey], ...updated };
      storage.saveUsers(users);
    }
    setUser(updated);
    // If user is the owner of the current room, update their display name
    if (roomHostId && updated.id === roomHostId) {
      setVisitorDisplayName(updated.displayName);
    }
  };

  const handleDeleteAccount = () => {
    if (!user) return;
    const users = storage.getUsers();
    const userKey = Object.keys(users).find(key => users[key].id === user.id || key === user.id);
    if (userKey) {
      delete users[userKey];
      storage.saveUsers(users);
    }
    
    // Delete all user's rooms and their playlists
    const rooms = storage.getUserRooms(user.id);
    rooms.forEach(room => storage.deleteRoomPlaylists(room.id));
    localStorage.removeItem(`dp_rooms_${user.id}`);
    
    storage.clearCurrentUser();
    setUser(null);
    setCurrentView('home');
    setCurrentRoom(null);
    setRoomHostId(null);
    skipHashChangeRef.current = true;
    window.location.hash = '';
  };

  const handleEnterRoom = (room) => {
    setCurrentRoom(room);
    setRoomHostId(user.id);
    setVisitorDisplayName(user.displayName);
    setCurrentView('room');
    skipHashChangeRef.current = true;
    window.location.hash = `/room/${user.id}/${room.id}`;
  };

  const handleGoHome = () => {
    setCurrentView('home');
    setCurrentRoom(null);
    setRoomHostId(null);
    skipHashChangeRef.current = true;
    window.location.hash = '';
  };

  if (loading) return <div className="loading-screen"><div className="loading-dragon">🐉</div><div className="loading-text">Awakening...</div></div>;

  // Show join modal for guests/visitors via share link
  if (showJoinModal && pendingJoinData) {
    const hostUsers = storage.getUsers();
    const hostUser = Object.values(hostUsers).find(u => u.id === pendingJoinData.hostId);
    const hostName = hostUser?.displayName || 'Someone';
    const roomName = pendingJoinData.room?.name;
    
    // Handler for when guest chooses to create account
    const handleCreateAccountFromJoin = () => {
      setShowJoinModal(false);
      // Store pending join info so we can redirect after auth
      storage.setGuestData({ 
        pendingRoom: pendingJoinData,
        returnToRoom: true 
      });
      setUser(null); // Force auth screen to show in register mode
    };
    
    // Handler for when guest chooses to login
    const handleLoginFromJoin = () => {
      setShowJoinModal(false);
      storage.setGuestData({ 
        pendingRoom: pendingJoinData,
        returnToRoom: true 
      });
      setUser(null); // Force auth screen
    };
    
    return (
      <div className="auth-screen">
        <DragonFire />
        <JoinRoomModal 
          hostName={hostName}
          roomName={roomName}
          existingName={pendingJoinData.existingName}
          isGuest={pendingJoinData.isGuest}
          onJoin={handleJoinRoom}
          onCancel={handleCancelJoin}
          onCreateAccount={handleCreateAccountFromJoin}
          onLogin={handleLoginFromJoin}
        />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <AuthScreen onAuth={u => { 
      storage.setCurrentUser(u); 
      setUser(u);
      // Check if user was trying to join a room
      const guestData = storage.getGuestData();
      if (guestData?.returnToRoom && guestData?.pendingRoom) {
        const pd = guestData.pendingRoom;
        storage.setGuestData(null);
        // Re-trigger join with the user now logged in
        handleJoinFromUrl(pd.hostId, pd.room?.id || pd.roomId, u);
      }
    }} />;
  }

  // In a room
  if (currentView === 'room' && currentRoom) {
    return (
      <Room 
        user={user}
        room={currentRoom}
        hostId={roomHostId}
        visitorDisplayName={visitorDisplayName}
        onHome={handleGoHome}
        onLogout={handleLogout}
        onUpdateUser={handleUpdateUser}
        onDeleteAccount={handleDeleteAccount}
        onDisplayNameChange={setVisitorDisplayName}
      />
    );
  }

  // Home page
  return (
    <HomePage 
      user={user}
      onEnterRoom={handleEnterRoom}
      onLogout={handleLogout}
      onUpdateUser={handleUpdateUser}
      onDeleteAccount={handleDeleteAccount}
    />
  );
};

ReactDOM.createRoot(document.getElementById('app')).render(<DragonPlaylist />);

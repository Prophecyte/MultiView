// ============================================
// MULTIVIEW.VIDEO - Database-backed version
// ============================================

const { useState, useEffect, useRef, useCallback } = React;

// Configuration
const GOOGLE_CLIENT_ID = window.APP_CONFIG?.GOOGLE_CLIENT_ID || '';
const API_BASE = '/api';

// ============================================
// API Client
// ============================================
const api = {
  getToken() {
    return localStorage.getItem('mv_token');
  },
  
  setToken(token) {
    localStorage.setItem('mv_token', token);
  },
  
  clearToken() {
    localStorage.removeItem('mv_token');
  },
  
  getGuestId() {
    let guestId = localStorage.getItem('mv_guest_id');
    if (!guestId) {
      guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('mv_guest_id', guestId);
    }
    return guestId;
  },

  async request(endpoint, options) {
    options = options || {};
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    const response = await fetch(API_BASE + endpoint, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  }
};

// Auth API
api.auth = {
  async register(email, username, password, displayName) {
    const data = await api.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: email, username: username, password: password, displayName: displayName })
    });
    api.setToken(data.token);
    return data.user;
  },
  
  async login(identifier, password) {
    const data = await api.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: identifier, password: password })
    });
    api.setToken(data.token);
    return data.user;
  },
  
  async googleLogin(credential) {
    const data = await api.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential: credential })
    });
    api.setToken(data.token);
    return data.user;
  },
  
  async logout() {
    try {
      await api.request('/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error:', e);
    }
    api.clearToken();
  },
  
  async getCurrentUser() {
    if (!api.getToken()) return null;
    try {
      const data = await api.request('/auth/me');
      return data.user;
    } catch (e) {
      console.error('Get user error:', e);
      api.clearToken();
      return null;
    }
  }
};

// Rooms API
api.rooms = {
  async list() {
    const data = await api.request('/rooms');
    return data.rooms || [];
  },
  
  async get(roomId) {
    const data = await api.request('/rooms/' + roomId);
    return data.room;
  },
  
  async create(name) {
    const data = await api.request('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name: name })
    });
    return data.room;
  },
  
  async update(roomId, updates) {
    const data = await api.request('/rooms/' + roomId, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return data.room;
  },
  
  async delete(roomId) {
    await api.request('/rooms/' + roomId, { method: 'DELETE' });
  },
  
  async join(roomId, displayName) {
    const guestId = api.getToken() ? null : api.getGuestId();
    await api.request('/rooms/' + roomId + '/join', {
      method: 'POST',
      body: JSON.stringify({ displayName: displayName, guestId: guestId })
    });
  },
  
  async kick(roomId, visitorId, guestId) {
    await api.request('/rooms/' + roomId + '/kick', {
      method: 'POST',
      body: JSON.stringify({ visitorId: visitorId, guestId: guestId })
    });
  }
};

// Playlists API
api.playlists = {
  async list(roomId) {
    const data = await api.request('/playlists?roomId=' + roomId);
    return data.playlists || [];
  },
  
  async create(roomId, name) {
    const data = await api.request('/playlists', {
      method: 'POST',
      body: JSON.stringify({ roomId: roomId, name: name })
    });
    return data.playlist;
  },
  
  async delete(playlistId) {
    await api.request('/playlists/' + playlistId, { method: 'DELETE' });
  },
  
  async addVideo(playlistId, video) {
    const data = await api.request('/playlists/' + playlistId + '/videos', {
      method: 'POST',
      body: JSON.stringify(video)
    });
    return data.video;
  },
  
  async removeVideo(playlistId, videoId) {
    await api.request('/playlists/' + playlistId + '/videos/' + videoId, { method: 'DELETE' });
  },
  
  async reorderVideos(playlistId, videoIds) {
    await api.request('/playlists/' + playlistId + '/reorder', {
      method: 'PUT',
      body: JSON.stringify({ videoIds: videoIds })
    });
  }
};

// Presence API
api.presence = {
  async heartbeat(roomId, status) {
    const guestId = api.getToken() ? null : api.getGuestId();
    await api.request('/presence/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ roomId: roomId, guestId: guestId, status: status || 'online' })
    });
  },
  
  async getMembers(roomId) {
    const data = await api.request('/presence/' + roomId);
    return data.members || [];
  },
  
  async leave(roomId) {
    const guestId = api.getToken() ? null : api.getGuestId();
    await api.request('/presence/leave', {
      method: 'POST',
      body: JSON.stringify({ roomId: roomId, guestId: guestId })
    });
  },
  
  async updateMember(roomId, visitorId, guestId, updates) {
    await api.request('/presence/member', {
      method: 'PUT',
      body: JSON.stringify(Object.assign({ roomId: roomId, visitorId: visitorId, guestId: guestId }, updates))
    });
  }
};

// ============================================
// Utilities
// ============================================
function parseVideoUrl(url) {
  if (!url) return null;
  
  // YouTube
  var ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { type: 'youtube', id: ytMatch[1], url: url };
  
  // Vimeo
  var vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { type: 'vimeo', id: vimeoMatch[1], url: url };
  
  // Spotify
  var spotifyMatch = url.match(/spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/);
  if (spotifyMatch) return { type: 'spotify', contentType: spotifyMatch[1], id: spotifyMatch[2], url: url };
  
  // SoundCloud
  if (url.includes('soundcloud.com')) return { type: 'soundcloud', url: url };
  
  // Direct video/audio
  if (url.match(/\.(mp4|webm|ogg|mp3|wav|m4a)(\?|$)/i)) return { type: 'direct', url: url };
  
  return null;
}

function getVideoTypeIcon(type) {
  var icons = { youtube: '▶️', spotify: '🎵', vimeo: '🎬', soundcloud: '🔊', direct: '📹' };
  return icons[type] || '📹';
}

function parseRoomUrl() {
  var hash = window.location.hash;
  var match = hash.match(/#\/room\/([^\/]+)\/([^\/]+)/);
  if (match) {
    return { hostId: match[1], roomId: match[2] };
  }
  return null;
}

// ============================================
// Icon Component
// ============================================
function Icon({ name, size }) {
  var s = { sm: 14, md: 18, lg: 24 }[size || 'md'] || 18;
  var icons = {
    play: React.createElement('polygon', { points: '5,3 19,12 5,21' }),
    pause: React.createElement(React.Fragment, null, 
      React.createElement('rect', { x: '6', y: '4', width: '4', height: '16' }),
      React.createElement('rect', { x: '14', y: '4', width: '4', height: '16' })
    ),
    prev: React.createElement(React.Fragment, null,
      React.createElement('polygon', { points: '11,12 22,4 22,20' }),
      React.createElement('line', { x1: '2', y1: '4', x2: '2', y2: '20' })
    ),
    next: React.createElement(React.Fragment, null,
      React.createElement('polygon', { points: '13,12 2,4 2,20' }),
      React.createElement('line', { x1: '22', y1: '4', x2: '22', y2: '20' })
    ),
    plus: React.createElement(React.Fragment, null,
      React.createElement('line', { x1: '12', y1: '5', x2: '12', y2: '19' }),
      React.createElement('line', { x1: '5', y1: '12', x2: '19', y2: '12' })
    ),
    trash: React.createElement(React.Fragment, null,
      React.createElement('polyline', { points: '3,6 5,6 21,6' }),
      React.createElement('path', { d: 'M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2' })
    ),
    edit: React.createElement(React.Fragment, null,
      React.createElement('path', { d: 'M11,4H4a2,2,0,0,0-2,2v14a2,2,0,0,0,2,2h14a2,2,0,0,0,2-2v-7' }),
      React.createElement('path', { d: 'M18.5,2.5a2.121,2.121,0,0,1,3,3L12,15l-4,1,1-4Z' })
    ),
    menu: React.createElement(React.Fragment, null,
      React.createElement('line', { x1: '3', y1: '6', x2: '21', y2: '6' }),
      React.createElement('line', { x1: '3', y1: '12', x2: '21', y2: '12' }),
      React.createElement('line', { x1: '3', y1: '18', x2: '21', y2: '18' })
    ),
    x: React.createElement(React.Fragment, null,
      React.createElement('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
      React.createElement('line', { x1: '6', y1: '6', x2: '18', y2: '18' })
    ),
    settings: React.createElement(React.Fragment, null,
      React.createElement('circle', { cx: '12', cy: '12', r: '3' }),
      React.createElement('path', { d: 'M19.4,15a1.65,1.65,0,0,0,.33,1.82l.06.06a2,2,0,0,1-2.83,2.83l-.06-.06a1.65,1.65,0,0,0-1.82-.33,1.65,1.65,0,0,0-1,1.51V21a2,2,0,0,1-4,0v-.09A1.65,1.65,0,0,0,9,19.4a1.65,1.65,0,0,0-1.82.33l-.06.06a2,2,0,0,1-2.83-2.83l.06-.06a1.65,1.65,0,0,0,.33-1.82,1.65,1.65,0,0,0-1.51-1H3a2,2,0,0,1,0-4h.09A1.65,1.65,0,0,0,4.6,9a1.65,1.65,0,0,0-.33-1.82l-.06-.06A2,2,0,0,1,7.04,4.29l.06.06a1.65,1.65,0,0,0,1.82.33H9a1.65,1.65,0,0,0,1-1.51V3a2,2,0,0,1,4,0v.09a1.65,1.65,0,0,0,1,1.51,1.65,1.65,0,0,0,1.82-.33l.06-.06a2,2,0,0,1,2.83,2.83l-.06.06a1.65,1.65,0,0,0-.33,1.82V9a1.65,1.65,0,0,0,1.51,1H21a2,2,0,0,1,0,4h-.09A1.65,1.65,0,0,0,19.4,15Z' })
    ),
    logout: React.createElement(React.Fragment, null,
      React.createElement('path', { d: 'M9,21H5a2,2,0,0,1-2-2V5a2,2,0,0,1,2-2h4' }),
      React.createElement('polyline', { points: '16,17 21,12 16,7' }),
      React.createElement('line', { x1: '21', y1: '12', x2: '9', y2: '12' })
    ),
    upload: React.createElement(React.Fragment, null,
      React.createElement('path', { d: 'M21,15v4a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2v-4' }),
      React.createElement('polyline', { points: '17,8 12,3 7,8' }),
      React.createElement('line', { x1: '12', y1: '3', x2: '12', y2: '15' })
    ),
    share: React.createElement(React.Fragment, null,
      React.createElement('circle', { cx: '18', cy: '5', r: '3' }),
      React.createElement('circle', { cx: '6', cy: '12', r: '3' }),
      React.createElement('circle', { cx: '18', cy: '19', r: '3' }),
      React.createElement('line', { x1: '8.59', y1: '13.51', x2: '15.42', y2: '17.49' }),
      React.createElement('line', { x1: '15.41', y1: '6.51', x2: '8.59', y2: '10.49' })
    ),
    users: React.createElement(React.Fragment, null,
      React.createElement('path', { d: 'M17,21v-2a4,4,0,0,0-4-4H5a4,4,0,0,0-4,4v2' }),
      React.createElement('circle', { cx: '9', cy: '7', r: '4' }),
      React.createElement('path', { d: 'M23,21v-2a4,4,0,0,0-3-3.87' }),
      React.createElement('path', { d: 'M16,3.13a4,4,0,0,1,0,7.75' })
    ),
    home: React.createElement(React.Fragment, null,
      React.createElement('path', { d: 'M3,9l9-7,9,7v11a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2Z' }),
      React.createElement('polyline', { points: '9,22 9,12 15,12 15,22' })
    ),
    enter: React.createElement(React.Fragment, null,
      React.createElement('path', { d: 'M15,3h4a2,2,0,0,1,2,2v14a2,2,0,0,1-2,2h-4' }),
      React.createElement('polyline', { points: '10,17 15,12 10,7' }),
      React.createElement('line', { x1: '15', y1: '12', x2: '3', y2: '12' })
    ),
    grip: React.createElement(React.Fragment, null,
      React.createElement('circle', { cx: '9', cy: '5', r: '1' }),
      React.createElement('circle', { cx: '9', cy: '12', r: '1' }),
      React.createElement('circle', { cx: '9', cy: '19', r: '1' }),
      React.createElement('circle', { cx: '15', cy: '5', r: '1' }),
      React.createElement('circle', { cx: '15', cy: '12', r: '1' }),
      React.createElement('circle', { cx: '15', cy: '19', r: '1' })
    )
  };
  
  return React.createElement('svg', {
    width: s,
    height: s,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  }, icons[name] || null);
}

// ============================================
// Dragon Fire (Embers)
// ============================================
function DragonFire() {
  var embers = [];
  for (var i = 0; i < 20; i++) {
    embers.push(
      React.createElement('div', {
        key: i,
        className: 'ember',
        style: {
          left: (Math.random() * 100) + '%',
          animationDuration: (2 + Math.random() * 3) + 's',
          animationDelay: (Math.random() * 2) + 's',
          opacity: 0.3 + Math.random() * 0.5
        }
      })
    );
  }
  return React.createElement('div', { className: 'dragon-fire-container' }, embers);
}

// ============================================
// Video Player
// ============================================
function VideoPlayer({ video, onEnded }) {
  if (!video) {
    return React.createElement('div', { className: 'video-placeholder' },
      React.createElement('div', { className: 'dragon-logo' }, '🐉'),
      React.createElement('h2', null, 'Multiview'),
      React.createElement('p', null, 'Select a video to play')
    );
  }

  var parsed = parseVideoUrl(video.url);
  if (!parsed) {
    return React.createElement('div', { className: 'video-error' }, 'Invalid video URL');
  }

  if (parsed.type === 'youtube') {
    return React.createElement('iframe', {
      src: 'https://www.youtube.com/embed/' + parsed.id + '?autoplay=1&rel=0',
      allow: 'autoplay; encrypted-media',
      allowFullScreen: true,
      className: 'video-frame'
    });
  }
  
  if (parsed.type === 'vimeo') {
    return React.createElement('iframe', {
      src: 'https://player.vimeo.com/video/' + parsed.id + '?autoplay=1',
      allow: 'autoplay; fullscreen',
      allowFullScreen: true,
      className: 'video-frame'
    });
  }
  
  if (parsed.type === 'spotify') {
    return React.createElement('iframe', {
      src: 'https://open.spotify.com/embed/' + parsed.contentType + '/' + parsed.id + '?theme=0',
      allow: 'autoplay; encrypted-media',
      className: 'video-frame',
      style: { minHeight: '152px' }
    });
  }
  
  if (parsed.type === 'soundcloud') {
    return React.createElement('iframe', {
      src: 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(parsed.url) + '&auto_play=true',
      className: 'video-frame',
      style: { minHeight: '166px' }
    });
  }
  
  if (parsed.type === 'direct') {
    if (video.url.match(/\.(mp3|wav|m4a)$/i)) {
      return React.createElement('div', { className: 'video-placeholder' },
        React.createElement('div', { style: { fontSize: '48px' } }, '🎵'),
        React.createElement('p', null, video.title),
        React.createElement('audio', {
          src: video.url,
          controls: true,
          autoPlay: true,
          onEnded: onEnded,
          style: { width: '80%', maxWidth: '400px' }
        })
      );
    }
    return React.createElement('video', {
      src: video.url,
      controls: true,
      autoPlay: true,
      onEnded: onEnded,
      className: 'video-frame'
    });
  }
  
  return React.createElement('div', { className: 'video-error' }, 'Unsupported format');
}

// ============================================
// Auth Screen
// ============================================
function AuthScreen({ onAuth }) {
  var [mode, setMode] = useState('login');
  var [email, setEmail] = useState('');
  var [username, setUsername] = useState('');
  var [password, setPassword] = useState('');
  var [displayName, setDisplayName] = useState('');
  var [error, setError] = useState('');
  var [loading, setLoading] = useState(false);

  useEffect(function() {
    if (GOOGLE_CLIENT_ID && window.google) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse
      });
    }
  }, []);

  function handleGoogleResponse(response) {
    setLoading(true);
    setError('');
    api.auth.googleLogin(response.credential)
      .then(function(user) {
        onAuth(user);
      })
      .catch(function(err) {
        setError(err.message || 'Google login failed');
      })
      .finally(function() {
        setLoading(false);
      });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    var promise;
    if (mode === 'register') {
      if (!displayName.trim()) {
        setError('Display name is required');
        setLoading(false);
        return;
      }
      promise = api.auth.register(email, username || null, password, displayName);
    } else {
      promise = api.auth.login(email, password);
    }

    promise
      .then(function(user) {
        onAuth(user);
      })
      .catch(function(err) {
        setError(err.message || 'Authentication failed');
      })
      .finally(function() {
        setLoading(false);
      });
  }

  function handleGoogleClick() {
    if (window.google) {
      window.google.accounts.id.prompt();
    } else {
      setError('Google sign-in not available');
    }
  }

  return React.createElement('div', { className: 'auth-screen' },
    React.createElement(DragonFire, null),
    React.createElement('div', { className: 'auth-container' },
      React.createElement('div', { className: 'auth-logo' },
        React.createElement('span', { className: 'dragon-icon' }, '🐉'),
        React.createElement('h1', null, 'Multiview'),
        React.createElement('p', null, 'Watch together, anywhere')
      ),
      React.createElement('div', { className: 'auth-form-container' },
        React.createElement('form', { className: 'auth-form', onSubmit: handleSubmit },
          React.createElement('h2', null, mode === 'login' ? 'Welcome back' : 'Create account'),
          
          error && React.createElement('div', { className: 'error-message' },
            React.createElement(Icon, { name: 'x', size: 'sm' }), ' ', error
          ),
          
          mode === 'register' && React.createElement('div', { className: 'input-group' },
            React.createElement('label', null, 'Display Name'),
            React.createElement('input', {
              type: 'text',
              value: displayName,
              onChange: function(e) { setDisplayName(e.target.value); },
              placeholder: 'Your name',
              required: true
            })
          ),
          
          React.createElement('div', { className: 'input-group' },
            React.createElement('label', null, mode === 'register' ? 'Email' : 'Email or Username'),
            React.createElement('input', {
              type: mode === 'register' ? 'email' : 'text',
              value: email,
              onChange: function(e) { setEmail(e.target.value); },
              required: true
            })
          ),
          
          mode === 'register' && React.createElement('div', { className: 'input-group' },
            React.createElement('label', null, 'Username (optional)'),
            React.createElement('input', {
              type: 'text',
              value: username,
              onChange: function(e) { setUsername(e.target.value); }
            })
          ),
          
          React.createElement('div', { className: 'input-group' },
            React.createElement('label', null, 'Password'),
            React.createElement('input', {
              type: 'password',
              value: password,
              onChange: function(e) { setPassword(e.target.value); },
              required: true,
              minLength: 6
            })
          ),
          
          React.createElement('button', {
            type: 'submit',
            className: 'btn primary full',
            disabled: loading
          }, loading ? 'Please wait...' : (mode === 'login' ? 'Sign in' : 'Create account')),
          
          React.createElement('div', { className: 'auth-divider' },
            React.createElement('span', null, 'or')
          ),
          
          React.createElement('button', {
            type: 'button',
            className: 'google-btn',
            onClick: handleGoogleClick
          },
            React.createElement('svg', { viewBox: '0 0 24 24' },
              React.createElement('path', { fill: '#4285F4', d: 'M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z' }),
              React.createElement('path', { fill: '#34A853', d: 'M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z' }),
              React.createElement('path', { fill: '#FBBC05', d: 'M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z' }),
              React.createElement('path', { fill: '#EA4335', d: 'M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z' })
            ),
            'Continue with Google'
          ),
          
          React.createElement('div', { className: 'auth-links' },
            mode === 'login' ? React.createElement(React.Fragment, null,
              React.createElement('span', null, 'New here?'),
              React.createElement('button', { type: 'button', onClick: function() { setMode('register'); setError(''); } }, 'Create account')
            ) : React.createElement(React.Fragment, null,
              React.createElement('span', null, 'Have an account?'),
              React.createElement('button', { type: 'button', onClick: function() { setMode('login'); setError(''); } }, 'Sign in')
            )
          )
        )
      )
    )
  );
}

// ============================================
// User Menu
// ============================================
function UserMenu({ user, onSettings, onLogout, onHome }) {
  var [open, setOpen] = useState(false);
  var ref = useRef(null);

  useEffect(function() {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return function() {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return React.createElement('div', { className: 'user-menu', ref: ref },
    React.createElement('button', { className: 'user-menu-trigger', onClick: function() { setOpen(!open); } },
      React.createElement('div', { className: 'avatar' }, user.displayName ? user.displayName.charAt(0).toUpperCase() : '?'),
      React.createElement('span', { className: 'user-name' }, user.displayName)
    ),
    open && React.createElement('div', { className: 'user-menu-dropdown' },
      onHome && React.createElement('button', { onClick: function() { onHome(); setOpen(false); } },
        React.createElement(Icon, { name: 'home', size: 'sm' }), ' My Rooms'
      ),
      React.createElement('button', { onClick: function() { onSettings(); setOpen(false); } },
        React.createElement(Icon, { name: 'settings', size: 'sm' }), ' Settings'
      ),
      React.createElement('button', { onClick: onLogout },
        React.createElement(Icon, { name: 'logout', size: 'sm' }), ' Log out'
      )
    )
  );
}

// ============================================
// Settings Modal
// ============================================
function SettingsModal({ user, onClose, onUpdate }) {
  var [displayName, setDisplayName] = useState(user.displayName || '');
  var [saved, setSaved] = useState(false);

  function handleSave() {
    if (displayName.trim() && displayName !== user.displayName) {
      // For now, just update locally
      onUpdate({ ...user, displayName: displayName.trim() });
      setSaved(true);
      setTimeout(function() { setSaved(false); }, 2000);
    }
  }

  return React.createElement('div', { className: 'modal-overlay', onClick: onClose },
    React.createElement('div', { className: 'modal settings-modal', onClick: function(e) { e.stopPropagation(); } },
      React.createElement('button', { className: 'modal-close', onClick: onClose }, '×'),
      React.createElement('h2', null, 'Settings'),
      React.createElement('div', { className: 'settings-section' },
        React.createElement('h3', null, 'Profile'),
        React.createElement('div', { className: 'modal-input-group' },
          React.createElement('label', null, 'Display Name'),
          React.createElement('input', {
            type: 'text',
            value: displayName,
            onChange: function(e) { setDisplayName(e.target.value); }
          })
        ),
        React.createElement('div', { className: 'modal-input-group' },
          React.createElement('label', null, 'Email'),
          React.createElement('input', { type: 'email', value: user.email, disabled: true })
        ),
        React.createElement('button', { className: 'btn primary', onClick: handleSave },
          saved ? '✓ Saved!' : 'Save'
        )
      )
    )
  );
}

// ============================================
// Home Page
// ============================================
function HomePage({ user, onEnterRoom, onLogout, onUpdateUser }) {
  var [rooms, setRooms] = useState([]);
  var [showCreate, setShowCreate] = useState(false);
  var [newRoomName, setNewRoomName] = useState('');
  var [editingRoom, setEditingRoom] = useState(null);
  var [editName, setEditName] = useState('');
  var [settingsOpen, setSettingsOpen] = useState(false);
  var [notification, setNotification] = useState(null);
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState(null);

  useEffect(function() {
    loadRooms();
  }, []);

  function loadRooms() {
    setLoading(true);
    setError(null);
    api.rooms.list()
      .then(function(fetchedRooms) {
        if (!fetchedRooms || fetchedRooms.length === 0) {
          return api.rooms.create('My Room').then(function(room) {
            return [room];
          });
        }
        return fetchedRooms;
      })
      .then(function(rooms) {
        setRooms(rooms);
      })
      .catch(function(err) {
        console.error('Load rooms error:', err);
        setError('Failed to load rooms: ' + err.message);
      })
      .finally(function() {
        setLoading(false);
      });
  }

  function showNotif(message, type) {
    setNotification({ message: message, type: type || 'success' });
    setTimeout(function() { setNotification(null); }, 3000);
  }

  function createRoom() {
    if (!newRoomName.trim()) return;
    api.rooms.create(newRoomName.trim())
      .then(function(room) {
        setRooms(rooms.concat([room]));
        setNewRoomName('');
        setShowCreate(false);
        showNotif('Room created!');
      })
      .catch(function(err) {
        showNotif('Failed to create room: ' + err.message, 'error');
      });
  }

  function renameRoom(roomId) {
    if (!editName.trim()) return;
    api.rooms.update(roomId, { name: editName.trim() })
      .then(function() {
        setRooms(rooms.map(function(r) {
          return r.id === roomId ? Object.assign({}, r, { name: editName.trim() }) : r;
        }));
        setEditingRoom(null);
        showNotif('Room renamed!');
      })
      .catch(function(err) {
        showNotif('Failed: ' + err.message, 'error');
      });
  }

  function deleteRoom(roomId) {
    if (!confirm('Delete this room?')) return;
    api.rooms.delete(roomId)
      .then(function() {
        setRooms(rooms.filter(function(r) { return r.id !== roomId; }));
        showNotif('Room deleted!', 'warning');
      })
      .catch(function(err) {
        showNotif('Failed: ' + err.message, 'error');
      });
  }

  function copyShareLink(roomId) {
    var link = window.location.origin + window.location.pathname + '#/room/' + user.id + '/' + roomId;
    navigator.clipboard.writeText(link);
    showNotif('Link copied!');
  }

  if (loading) {
    return React.createElement('div', { className: 'home-page' },
      React.createElement(DragonFire, null),
      React.createElement('div', { className: 'loading-screen' },
        React.createElement('div', { className: 'loading-dragon' }, '🐉'),
        React.createElement('div', { className: 'loading-text' }, 'Loading rooms...')
      )
    );
  }

  if (error) {
    return React.createElement('div', { className: 'home-page' },
      React.createElement(DragonFire, null),
      React.createElement('div', { className: 'loading-screen' },
        React.createElement('div', { className: 'loading-dragon' }, '❌'),
        React.createElement('div', { className: 'loading-text' }, error),
        React.createElement('button', { className: 'btn primary', onClick: loadRooms, style: { marginTop: '20px' } }, 'Retry')
      )
    );
  }

  return React.createElement('div', { className: 'home-page' },
    React.createElement(DragonFire, null),
    
    React.createElement('header', { className: 'home-header' },
      React.createElement('div', { className: 'logo-small' },
        React.createElement('span', { className: 'dragon-icon' }, '🐉'),
        React.createElement('span', null, 'Multiview')
      ),
      React.createElement(UserMenu, { user: user, onSettings: function() { setSettingsOpen(true); }, onLogout: onLogout })
    ),
    
    React.createElement('main', { className: 'home-content' },
      React.createElement('div', { className: 'home-welcome' },
        React.createElement('div', { className: 'welcome-glow' }),
        React.createElement('h1', null, 'Welcome, ' + user.displayName),
        React.createElement('p', null, 'Manage rooms and watch with friends')
      ),
      
      React.createElement('div', { className: 'rooms-section' },
        React.createElement('div', { className: 'rooms-header' },
          React.createElement('h2', null,
            React.createElement('span', { className: 'section-icon' }, '🚪'),
            'My Rooms',
            React.createElement('span', { className: 'room-count' }, rooms.length)
          ),
          React.createElement('button', { className: 'btn primary glow', onClick: function() { setShowCreate(true); } },
            React.createElement(Icon, { name: 'plus', size: 'sm' }), ' New Room'
          )
        ),
        
        showCreate && React.createElement('div', { className: 'create-room-form' },
          React.createElement('input', {
            type: 'text',
            value: newRoomName,
            onChange: function(e) { setNewRoomName(e.target.value); },
            placeholder: 'Room name',
            autoFocus: true,
            onKeyDown: function(e) { if (e.key === 'Enter') createRoom(); }
          }),
          React.createElement('button', { className: 'btn primary', onClick: createRoom }, 'Create'),
          React.createElement('button', { className: 'btn ghost', onClick: function() { setShowCreate(false); } }, 'Cancel')
        ),
        
        rooms.length > 0 ? React.createElement('div', { className: 'rooms-grid' },
          rooms.map(function(room) {
            return React.createElement('div', { key: room.id, className: 'room-card' },
              React.createElement('div', { className: 'room-card-bg' }),
              React.createElement('div', { className: 'room-card-content' },
                React.createElement('div', { className: 'room-card-header' },
                  editingRoom === room.id ? React.createElement('input', {
                    type: 'text',
                    value: editName,
                    onChange: function(e) { setEditName(e.target.value); },
                    onBlur: function() { renameRoom(room.id); },
                    onKeyDown: function(e) {
                      if (e.key === 'Enter') renameRoom(room.id);
                      if (e.key === 'Escape') setEditingRoom(null);
                    },
                    autoFocus: true,
                    className: 'room-edit-input'
                  }) : React.createElement('h3', null, room.name)
                ),
                React.createElement('div', { className: 'room-card-actions' },
                  React.createElement('button', { className: 'btn primary enter-btn', onClick: function() { onEnterRoom(room); } },
                    React.createElement(Icon, { name: 'enter', size: 'sm' }), ' Enter'
                  ),
                  React.createElement('div', { className: 'room-tools' },
                    React.createElement('button', { className: 'tool-btn', onClick: function() { copyShareLink(room.id); }, title: 'Share' },
                      React.createElement(Icon, { name: 'share', size: 'sm' })
                    ),
                    React.createElement('button', { className: 'tool-btn', onClick: function() { setEditingRoom(room.id); setEditName(room.name); }, title: 'Rename' },
                      React.createElement(Icon, { name: 'edit', size: 'sm' })
                    ),
                    React.createElement('button', { className: 'tool-btn danger', onClick: function() { deleteRoom(room.id); }, title: 'Delete' },
                      React.createElement(Icon, { name: 'trash', size: 'sm' })
                    )
                  )
                )
              )
            );
          })
        ) : React.createElement('div', { className: 'no-rooms' },
          React.createElement('div', { className: 'no-rooms-icon' }, '🏰'),
          React.createElement('h3', null, 'No Rooms Yet'),
          React.createElement('p', null, 'Create your first room'),
          React.createElement('button', { className: 'btn primary glow', onClick: function() { setShowCreate(true); } },
            React.createElement(Icon, { name: 'plus', size: 'sm' }), ' Create a Room'
          )
        )
      )
    ),
    
    settingsOpen && React.createElement(SettingsModal, {
      user: user,
      onClose: function() { setSettingsOpen(false); },
      onUpdate: onUpdateUser
    }),
    
    notification && React.createElement('div', { className: 'notification ' + notification.type }, notification.message)
  );
}

// ============================================
// Room Component (Simplified)
// ============================================
function Room({ user, room, hostId, visitorDisplayName, onHome, onLogout, onUpdateUser }) {
  var [playlists, setPlaylists] = useState([]);
  var [activePlaylist, setActivePlaylist] = useState(null);
  var [currentVideo, setCurrentVideo] = useState(null);
  var [currentIndex, setCurrentIndex] = useState(-1);
  var [urlInput, setUrlInput] = useState('');
  var [newPlaylistName, setNewPlaylistName] = useState('');
  var [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  var [sidebarOpen, setSidebarOpen] = useState(true);
  var [shareModalOpen, setShareModalOpen] = useState(false);
  var [settingsOpen, setSettingsOpen] = useState(false);
  var [notification, setNotification] = useState(null);
  var fileInputRef = useRef(null);

  var visitorId = user ? user.id : api.getGuestId();
  var isOwner = user && user.id === hostId;
  var displayName = visitorDisplayName || (user ? user.displayName : 'Guest');

  useEffect(function() {
    api.playlists.list(room.id)
      .then(function(p) {
        setPlaylists(p);
        if (p.length > 0) setActivePlaylist(p[0]);
      })
      .catch(function(err) {
        console.error('Load playlists error:', err);
      });
  }, [room.id]);

  useEffect(function() {
    api.rooms.join(room.id, displayName).catch(function(err) {
      console.error('Join room error:', err);
    });
  }, [room.id, displayName]);

  function showNotif(message, type) {
    setNotification({ message: message, type: type || 'success' });
    setTimeout(function() { setNotification(null); }, 3000);
  }

  function createPlaylist() {
    if (!isOwner || !newPlaylistName.trim()) return;
    api.playlists.create(room.id, newPlaylistName.trim())
      .then(function(p) {
        var newPlaylist = Object.assign({}, p, { videos: [] });
        setPlaylists(playlists.concat([newPlaylist]));
        setActivePlaylist(newPlaylist);
        setNewPlaylistName('');
        setShowCreatePlaylist(false);
        showNotif('Playlist created!');
      })
      .catch(function(err) {
        showNotif('Failed: ' + err.message, 'error');
      });
  }

  function deletePlaylist(id) {
    if (!isOwner || !confirm('Delete playlist?')) return;
    api.playlists.delete(id)
      .then(function() {
        setPlaylists(playlists.filter(function(pl) { return pl.id !== id; }));
        if (activePlaylist && activePlaylist.id === id) {
          setActivePlaylist(null);
          setCurrentVideo(null);
        }
        showNotif('Deleted!', 'warning');
      })
      .catch(function(err) {
        showNotif('Failed: ' + err.message, 'error');
      });
  }

  function handleAddUrl() {
    if (!activePlaylist || !urlInput.trim()) return;
    var parsed = parseVideoUrl(urlInput.trim());
    if (!parsed) {
      showNotif('Invalid URL', 'error');
      return;
    }
    api.playlists.addVideo(activePlaylist.id, {
      title: urlInput.trim(),
      url: urlInput.trim(),
      videoType: parsed.type
    })
      .then(function(video) {
        var newVideos = (activePlaylist.videos || []).concat([video]);
        var updated = Object.assign({}, activePlaylist, { videos: newVideos });
        setPlaylists(playlists.map(function(pl) {
          return pl.id === activePlaylist.id ? updated : pl;
        }));
        setActivePlaylist(updated);
        setUrlInput('');
        showNotif('Added!');
      })
      .catch(function(err) {
        showNotif('Failed: ' + err.message, 'error');
      });
  }

  function playVideo(video, index) {
    setCurrentVideo(video);
    setCurrentIndex(index);
  }

  function playNow() {
    if (!urlInput.trim()) return;
    var parsed = parseVideoUrl(urlInput.trim());
    if (!parsed) {
      showNotif('Invalid URL', 'error');
      return;
    }
    setCurrentVideo({ id: 'temp', title: urlInput, url: urlInput.trim() });
    setUrlInput('');
  }

  function playPrev() {
    if (!activePlaylist || currentIndex <= 0) return;
    var videos = activePlaylist.videos || [];
    setCurrentVideo(videos[currentIndex - 1]);
    setCurrentIndex(currentIndex - 1);
  }

  function playNext() {
    if (!activePlaylist) return;
    var videos = activePlaylist.videos || [];
    if (currentIndex < videos.length - 1) {
      setCurrentVideo(videos[currentIndex + 1]);
      setCurrentIndex(currentIndex + 1);
    }
  }

  function removeVideo(videoId) {
    if (!activePlaylist) return;
    api.playlists.removeVideo(activePlaylist.id, videoId)
      .then(function() {
        var newVideos = (activePlaylist.videos || []).filter(function(v) { return v.id !== videoId; });
        var updated = Object.assign({}, activePlaylist, { videos: newVideos });
        setPlaylists(playlists.map(function(pl) {
          return pl.id === activePlaylist.id ? updated : pl;
        }));
        setActivePlaylist(updated);
        if (currentVideo && currentVideo.id === videoId) setCurrentVideo(null);
        showNotif('Removed!');
      })
      .catch(function(err) {
        showNotif('Failed: ' + err.message, 'error');
      });
  }

  function copyShareLink() {
    var link = window.location.origin + window.location.pathname + '#/room/' + hostId + '/' + room.id;
    navigator.clipboard.writeText(link);
    showNotif('Copied!');
    setShareModalOpen(false);
  }

  function handleFileUpload(e) {
    var files = Array.prototype.slice.call(e.target.files);
    files.forEach(function(file) {
      var url = URL.createObjectURL(file);
      var title = file.name.replace(/\.[^/.]+$/, '');
      setCurrentVideo({ id: 'local_' + Date.now(), title: title, url: url });
    });
    e.target.value = '';
  }

  return React.createElement('div', { className: 'dashboard' },
    React.createElement(DragonFire, null),
    React.createElement('input', {
      type: 'file',
      ref: fileInputRef,
      className: 'hidden',
      accept: 'video/*,audio/*',
      multiple: true,
      onChange: handleFileUpload
    }),
    
    // Header
    React.createElement('header', { className: 'dashboard-header' },
      React.createElement('div', { className: 'header-left' },
        React.createElement('button', { className: 'icon-btn', onClick: function() { setSidebarOpen(!sidebarOpen); } },
          React.createElement(Icon, { name: 'menu' })
        ),
        onHome && React.createElement('button', { className: 'icon-btn', onClick: onHome, title: 'Home' },
          React.createElement(Icon, { name: 'home' })
        ),
        React.createElement('div', { className: 'room-info' },
          React.createElement('h1', null, room.name)
        )
      ),
      React.createElement('div', { className: 'header-center' },
        React.createElement('div', { className: 'url-bar' },
          React.createElement('input', {
            value: urlInput,
            onChange: function(e) { setUrlInput(e.target.value); },
            placeholder: 'Enter URL...',
            onKeyDown: function(e) { if (e.key === 'Enter') playNow(); }
          }),
          React.createElement('button', { className: 'icon-btn primary', onClick: playNow },
            React.createElement(Icon, { name: 'play' })
          ),
          React.createElement('button', { className: 'icon-btn', onClick: handleAddUrl, disabled: !activePlaylist },
            React.createElement(Icon, { name: 'plus' })
          ),
          React.createElement('button', { className: 'icon-btn', onClick: function() { fileInputRef.current && fileInputRef.current.click(); } },
            React.createElement(Icon, { name: 'upload' })
          )
        )
      ),
      React.createElement('div', { className: 'header-right' },
        React.createElement('button', { className: 'btn secondary sm', onClick: function() { setShareModalOpen(true); } },
          React.createElement(Icon, { name: 'share', size: 'sm' }), ' Share'
        ),
        user ? React.createElement(UserMenu, {
          user: user,
          onSettings: function() { setSettingsOpen(true); },
          onLogout: onLogout,
          onHome: onHome
        }) : React.createElement('div', { className: 'guest-badge' },
          React.createElement('span', { className: 'guest-name' }, displayName),
          React.createElement('span', { className: 'guest-tag' }, 'Guest')
        )
      )
    ),
    
    // Content
    React.createElement('div', { className: 'dashboard-content' },
      // Sidebar
      React.createElement('aside', { className: 'sidebar' + (sidebarOpen ? '' : ' closed') },
        React.createElement('div', { className: 'sidebar-header' },
          React.createElement('h3', null, 'Playlists'),
          isOwner && React.createElement('button', { className: 'icon-btn sm', onClick: function() { setShowCreatePlaylist(true); } },
            React.createElement(Icon, { name: 'plus', size: 'sm' })
          )
        ),
        isOwner && showCreatePlaylist && React.createElement('div', { className: 'create-playlist-form' },
          React.createElement('input', {
            value: newPlaylistName,
            onChange: function(e) { setNewPlaylistName(e.target.value); },
            placeholder: 'Name',
            onKeyDown: function(e) { if (e.key === 'Enter') createPlaylist(); },
            autoFocus: true
          }),
          React.createElement('div', { className: 'form-actions' },
            React.createElement('button', { className: 'btn primary sm', onClick: createPlaylist }, 'Create'),
            React.createElement('button', { className: 'btn sm', onClick: function() { setShowCreatePlaylist(false); } }, 'Cancel')
          )
        ),
        React.createElement('div', { className: 'playlists-list' },
          playlists.length === 0 ? React.createElement('div', { className: 'empty-playlists' },
            React.createElement('p', null, 'No playlists')
          ) : playlists.map(function(p) {
            return React.createElement('div', {
              key: p.id,
              className: 'playlist-item' + (activePlaylist && activePlaylist.id === p.id ? ' active' : '')
            },
              React.createElement('button', {
                className: 'playlist-select',
                onClick: function() { setActivePlaylist(p); }
              },
                React.createElement('span', { className: 'playlist-name' }, p.name),
                React.createElement('span', { className: 'playlist-count' }, (p.videos || []).length)
              ),
              isOwner && React.createElement('div', { className: 'playlist-actions' },
                React.createElement('button', { className: 'icon-btn sm danger', onClick: function() { deletePlaylist(p.id); } },
                  React.createElement(Icon, { name: 'trash', size: 'sm' })
                )
              )
            );
          })
        )
      ),
      
      // Main
      React.createElement('main', { className: 'main-content' },
        // Queue
        React.createElement('div', { className: 'queue-panel' },
          React.createElement('div', { className: 'queue-header' },
            React.createElement('h3', null, '📜 ' + (activePlaylist ? activePlaylist.name : 'Select Playlist'))
          ),
          React.createElement('div', { className: 'video-list' },
            activePlaylist && (activePlaylist.videos || []).map(function(v, i) {
              return React.createElement('div', {
                key: v.id,
                className: 'video-item' + (currentVideo && currentVideo.id === v.id ? ' playing' : '')
              },
                React.createElement('div', { className: 'video-item-top' },
                  React.createElement('span', { className: 'video-index' }, i + 1),
                  React.createElement('span', { className: 'video-type-icon' }, getVideoTypeIcon(parseVideoUrl(v.url) && parseVideoUrl(v.url).type)),
                  React.createElement('span', { className: 'video-title', onClick: function() { playVideo(v, i); } }, v.title),
                  React.createElement('button', { className: 'icon-btn sm', onClick: function() { removeVideo(v.id); } },
                    React.createElement(Icon, { name: 'trash', size: 'sm' })
                  )
                )
              );
            }),
            activePlaylist && (activePlaylist.videos || []).length === 0 && React.createElement('div', { className: 'empty-queue' },
              React.createElement('p', null, 'No videos')
            )
          )
        ),
        
        // Video Section
        React.createElement('div', { className: 'video-section' },
          React.createElement(VideoPlayer, { video: currentVideo, onEnded: playNext }),
          React.createElement('div', { className: 'video-controls' },
            React.createElement('button', {
              className: 'btn sm',
              onClick: playPrev,
              disabled: !activePlaylist || currentIndex <= 0
            },
              React.createElement(Icon, { name: 'prev', size: 'sm' }), ' Prev'
            ),
            React.createElement('div', { className: 'now-playing' },
              currentVideo ? React.createElement('span', { className: 'playing-title' },
                React.createElement('span', { className: 'playing-label' }, 'Now:'), ' ', currentVideo.title
              ) : React.createElement('span', { className: 'playing-label' }, 'Nothing playing')
            ),
            React.createElement('button', {
              className: 'btn sm',
              onClick: playNext,
              disabled: !activePlaylist || currentIndex >= ((activePlaylist && activePlaylist.videos || []).length) - 1
            },
              'Next ', React.createElement(Icon, { name: 'next', size: 'sm' })
            )
          )
        )
      )
    ),
    
    // Share Modal
    shareModalOpen && React.createElement('div', { className: 'modal-overlay', onClick: function() { setShareModalOpen(false); } },
      React.createElement('div', { className: 'modal', onClick: function(e) { e.stopPropagation(); } },
        React.createElement('button', { className: 'modal-close', onClick: function() { setShareModalOpen(false); } }, '×'),
        React.createElement('h2', null, 'Share Room'),
        React.createElement('div', { className: 'share-link-box' },
          React.createElement('input', {
            value: window.location.origin + window.location.pathname + '#/room/' + hostId + '/' + room.id,
            readOnly: true
          }),
          React.createElement('button', { className: 'btn primary', onClick: copyShareLink }, 'Copy')
        )
      )
    ),
    
    // Settings Modal
    settingsOpen && user && React.createElement(SettingsModal, {
      user: user,
      onClose: function() { setSettingsOpen(false); },
      onUpdate: onUpdateUser
    }),
    
    // Notification
    notification && React.createElement('div', { className: 'notification ' + notification.type }, notification.message)
  );
}

// ============================================
// Main App
// ============================================
function MultiviewApp() {
  var [user, setUser] = useState(null);
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState(null);
  var [currentView, setCurrentView] = useState('home');
  var [currentRoom, setCurrentRoom] = useState(null);
  var [roomHostId, setRoomHostId] = useState(null);
  var [visitorDisplayName, setVisitorDisplayName] = useState(null);

  useEffect(function() {
    console.log('App starting...');
    checkAuth();
  }, []);

  function checkAuth() {
    console.log('Checking auth...');
    api.auth.getCurrentUser()
      .then(function(u) {
        console.log('User:', u);
        if (u) setUser(u);
        
        // Check for room URL
        var roomInfo = parseRoomUrl();
        if (roomInfo) {
          handleJoinFromUrl(roomInfo.hostId, roomInfo.roomId);
        }
      })
      .catch(function(err) {
        console.error('Auth check error:', err);
        setError('Failed to check authentication: ' + err.message);
      })
      .finally(function() {
        setLoading(false);
      });
  }

  useEffect(function() {
    function handleHashChange() {
      var roomInfo = parseRoomUrl();
      if (roomInfo) {
        handleJoinFromUrl(roomInfo.hostId, roomInfo.roomId);
      } else if (currentView === 'room') {
        setCurrentView('home');
        setCurrentRoom(null);
      }
    }
    window.addEventListener('hashchange', handleHashChange);
    return function() {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [currentView, user]);

  function handleJoinFromUrl(hostId, roomId) {
    console.log('Joining room:', hostId, roomId);
    api.rooms.get(roomId)
      .then(function(room) {
        if (!room) {
          alert('Room not found');
          window.location.hash = '';
          return;
        }
        setCurrentRoom(room);
        setRoomHostId(hostId);
        setVisitorDisplayName(user ? user.displayName : 'Guest');
        setCurrentView('room');
      })
      .catch(function(err) {
        console.error('Join error:', err);
        alert('Failed to load room: ' + err.message);
        window.location.hash = '';
      });
  }

  function handleEnterRoom(room) {
    window.location.hash = '/room/' + user.id + '/' + room.id;
    setCurrentRoom(room);
    setRoomHostId(user.id);
    setVisitorDisplayName(user.displayName);
    setCurrentView('room');
  }

  function handleGoHome() {
    window.location.hash = '';
    setCurrentView('home');
    setCurrentRoom(null);
  }

  function handleLogout() {
    api.auth.logout().then(function() {
      setUser(null);
      setCurrentView('home');
      setCurrentRoom(null);
      window.location.hash = '';
    });
  }

  function handleUpdateUser(u) {
    setUser(u);
  }

  // Loading
  if (loading) {
    return React.createElement('div', { className: 'loading-screen' },
      React.createElement('div', { className: 'loading-dragon' }, '🐉'),
      React.createElement('div', { className: 'loading-text' }, 'Loading...')
    );
  }

  // Error
  if (error) {
    return React.createElement('div', { className: 'loading-screen' },
      React.createElement('div', { className: 'loading-dragon' }, '❌'),
      React.createElement('div', { className: 'loading-text' }, error),
      React.createElement('button', {
        className: 'btn primary',
        onClick: function() { setError(null); setLoading(true); checkAuth(); },
        style: { marginTop: '20px' }
      }, 'Retry')
    );
  }

  // Not logged in
  if (!user) {
    return React.createElement(AuthScreen, {
      onAuth: function(u) {
        setUser(u);
        // Check for pending room URL
        var roomInfo = parseRoomUrl();
        if (roomInfo) {
          handleJoinFromUrl(roomInfo.hostId, roomInfo.roomId);
        }
      }
    });
  }

  // In room
  if (currentView === 'room' && currentRoom) {
    return React.createElement(Room, {
      user: user,
      room: currentRoom,
      hostId: roomHostId,
      visitorDisplayName: visitorDisplayName,
      onHome: handleGoHome,
      onLogout: handleLogout,
      onUpdateUser: handleUpdateUser
    });
  }

  // Home
  return React.createElement(HomePage, {
    user: user,
    onEnterRoom: handleEnterRoom,
    onLogout: handleLogout,
    onUpdateUser: handleUpdateUser
  });
}

// ============================================
// Render
// ============================================
console.log('Rendering app...');
try {
  ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(MultiviewApp));
  console.log('App rendered successfully');
} catch (e) {
  console.error('Render error:', e);
  document.getElementById('app').innerHTML = '<div style="color: red; padding: 20px;"><h1>Error</h1><pre>' + e.message + '</pre></div>';
}

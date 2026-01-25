// ============================================
// MULTIVIEW.VIDEO - Synchronized Playback
// Uses YouTube IFrame API for play/pause sync
// ============================================

var useState = React.useState;
var useEffect = React.useEffect;
var useRef = React.useRef;
var useCallback = React.useCallback;

var GOOGLE_CLIENT_ID = window.APP_CONFIG?.GOOGLE_CLIENT_ID || '';
var API_BASE = '/api';
var SYNC_INTERVAL = 1500; // Faster sync for better responsiveness

// ============================================
// API Client
// ============================================
var api = {
  getToken: function() { return localStorage.getItem('mv_token'); },
  setToken: function(token) { localStorage.setItem('mv_token', token); },
  clearToken: function() { localStorage.removeItem('mv_token'); },
  
  getGuestId: function() {
    var guestId = localStorage.getItem('mv_guest_id');
    if (!guestId) {
      guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('mv_guest_id', guestId);
    }
    return guestId;
  },

  request: function(endpoint, options) {
    options = options || {};
    var token = this.getToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    return fetch(API_BASE + endpoint, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body
    }).then(function(response) {
      return response.json().then(function(data) {
        if (!response.ok) throw new Error(data.error || 'Request failed');
        return data;
      });
    });
  }
};

api.auth = {
  register: function(email, username, password, displayName) {
    return api.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: email, username: username, password: password, displayName: displayName })
    }).then(function(data) {
      api.setToken(data.token);
      return data.user;
    });
  },
  login: function(identifier, password) {
    return api.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: identifier, password: password })
    }).then(function(data) {
      api.setToken(data.token);
      return data.user;
    });
  },
  googleLogin: function(credential) {
    return api.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential: credential })
    }).then(function(data) {
      api.setToken(data.token);
      return data.user;
    });
  },
  logout: function() {
    return api.request('/auth/logout', { method: 'POST' }).catch(function() {}).then(function() {
      api.clearToken();
    });
  },
  getCurrentUser: function() {
    if (!api.getToken()) return Promise.resolve(null);
    return api.request('/auth/me').then(function(data) {
      return data.user;
    }).catch(function() {
      api.clearToken();
      return null;
    });
  },
  updateProfile: function(displayName) {
    return api.request('/auth/profile', { 
      method: 'PUT', 
      body: JSON.stringify({ displayName: displayName }) 
    });
  },
  updateEmail: function(newEmail, password) {
    return api.request('/auth/email', { 
      method: 'PUT', 
      body: JSON.stringify({ newEmail: newEmail, password: password }) 
    });
  },
  updatePassword: function(currentPassword, newPassword) {
    return api.request('/auth/password', { 
      method: 'PUT', 
      body: JSON.stringify({ currentPassword: currentPassword, newPassword: newPassword }) 
    });
  },
  deleteAccount: function() {
    return api.request('/auth/account', { method: 'DELETE' }).then(function() {
      api.clearToken();
    });
  }
};

api.rooms = {
  list: function() { return api.request('/rooms').then(function(d) { return d.rooms || []; }); },
  get: function(roomId) { return api.request('/rooms/' + roomId).then(function(d) { return d.room; }); },
  create: function(name) { return api.request('/rooms', { method: 'POST', body: JSON.stringify({ name: name }) }).then(function(d) { return d.room; }); },
  update: function(roomId, updates) { return api.request('/rooms/' + roomId, { method: 'PUT', body: JSON.stringify(updates) }).then(function(d) { return d.room; }); },
  delete: function(roomId) { return api.request('/rooms/' + roomId, { method: 'DELETE' }); },
  join: function(roomId, displayName) {
    var guestId = api.getToken() ? null : api.getGuestId();
    return api.request('/rooms/' + roomId + '/join', { method: 'POST', body: JSON.stringify({ displayName: displayName, guestId: guestId }) });
  },
  kick: function(roomId, visitorId, guestId) {
    return api.request('/rooms/' + roomId + '/kick', { method: 'POST', body: JSON.stringify({ visitorId: visitorId, guestId: guestId }) });
  },
  getSync: function(roomId) {
    return api.request('/rooms/' + roomId + '/sync');
  },
  updateSync: function(roomId, state) {
    return api.request('/rooms/' + roomId + '/sync', { method: 'PUT', body: JSON.stringify(state) });
  }
};

api.playlists = {
  list: function(roomId) { return api.request('/playlists?roomId=' + roomId).then(function(d) { return d.playlists || []; }); },
  create: function(roomId, name) { return api.request('/playlists', { method: 'POST', body: JSON.stringify({ roomId: roomId, name: name }) }).then(function(d) { return d.playlist; }); },
  update: function(playlistId, updates) { return api.request('/playlists/' + playlistId, { method: 'PUT', body: JSON.stringify(updates) }).then(function(d) { return d.playlist; }); },
  delete: function(playlistId) { return api.request('/playlists/' + playlistId, { method: 'DELETE' }); },
  addVideo: function(playlistId, video) { return api.request('/playlists/' + playlistId + '/videos', { method: 'POST', body: JSON.stringify(video) }).then(function(d) { return d.video; }); },
  removeVideo: function(playlistId, videoId) { return api.request('/playlists/' + playlistId + '/videos/' + videoId, { method: 'DELETE' }); },
  updateVideo: function(playlistId, videoId, updates) { return api.request('/playlists/' + playlistId + '/videos/' + videoId, { method: 'PUT', body: JSON.stringify(updates) }); },
  reorderVideos: function(playlistId, videoIds) { return api.request('/playlists/' + playlistId + '/reorder', { method: 'PUT', body: JSON.stringify({ videoIds: videoIds }) }); },
  reorder: function(roomId, playlistIds) { return api.request('/playlists/reorder', { method: 'PUT', body: JSON.stringify({ roomId: roomId, playlistIds: playlistIds }) }); }
};

api.presence = {
  heartbeat: function(roomId, status) {
    var guestId = api.getToken() ? null : api.getGuestId();
    return api.request('/presence/heartbeat', { method: 'POST', body: JSON.stringify({ roomId: roomId, guestId: guestId, status: status || 'online' }) });
  },
  getMembers: function(roomId) { return api.request('/presence/' + roomId).then(function(d) { return d.members || []; }); },
  leave: function(roomId) {
    var guestId = api.getToken() ? null : api.getGuestId();
    return api.request('/presence/leave', { method: 'POST', body: JSON.stringify({ roomId: roomId, guestId: guestId }) });
  },
  updateMember: function(roomId, visitorId, guestId, updates) {
    return api.request('/presence/member', { method: 'PUT', body: JSON.stringify(Object.assign({ roomId: roomId, visitorId: visitorId, guestId: guestId }, updates)) });
  }
};

// ============================================
// Utilities
// ============================================
function parseVideoUrl(url) {
  if (!url) return null;
  var ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { type: 'youtube', id: ytMatch[1], url: url };
  var vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { type: 'vimeo', id: vimeoMatch[1], url: url };
  if (url.match(/\.(mp4|webm|ogg|mp3|wav|m4a)(\?|$)/i)) return { type: 'direct', url: url };
  return null;
}

function getVideoTypeIcon(type) {
  var icons = { youtube: '▶️', vimeo: '🎬', direct: '📹' };
  return icons[type] || '📹';
}

function parseRoomUrl() {
  var hash = window.location.hash;
  var match = hash.match(/#\/room\/([^\/]+)\/([^\/]+)/);
  return match ? { hostId: match[1], roomId: match[2] } : null;
}

// ============================================
// Icon Component
// ============================================
function Icon(props) {
  var name = props.name;
  var size = props.size;
  var s = { sm: 14, md: 18, lg: 24 }[size || 'md'] || 18;
  var paths = {
    play: React.createElement('polygon', { points: '5,3 19,12 5,21' }),
    pause: React.createElement(React.Fragment, null, React.createElement('rect', { x: '6', y: '4', width: '4', height: '16' }), React.createElement('rect', { x: '14', y: '4', width: '4', height: '16' })),
    prev: React.createElement(React.Fragment, null, React.createElement('polygon', { points: '11,12 22,4 22,20' }), React.createElement('line', { x1: '2', y1: '4', x2: '2', y2: '20' })),
    next: React.createElement(React.Fragment, null, React.createElement('polygon', { points: '13,12 2,4 2,20' }), React.createElement('line', { x1: '22', y1: '4', x2: '22', y2: '20' })),
    plus: React.createElement(React.Fragment, null, React.createElement('line', { x1: '12', y1: '5', x2: '12', y2: '19' }), React.createElement('line', { x1: '5', y1: '12', x2: '19', y2: '12' })),
    trash: React.createElement(React.Fragment, null, React.createElement('polyline', { points: '3,6 5,6 21,6' }), React.createElement('path', { d: 'M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2' })),
    edit: React.createElement(React.Fragment, null, React.createElement('path', { d: 'M11,4H4a2,2,0,0,0-2,2v14a2,2,0,0,0,2,2h14a2,2,0,0,0,2-2v-7' }), React.createElement('path', { d: 'M18.5,2.5a2.121,2.121,0,0,1,3,3L12,15l-4,1,1-4Z' })),
    menu: React.createElement(React.Fragment, null, React.createElement('line', { x1: '3', y1: '6', x2: '21', y2: '6' }), React.createElement('line', { x1: '3', y1: '12', x2: '21', y2: '12' }), React.createElement('line', { x1: '3', y1: '18', x2: '21', y2: '18' })),
    x: React.createElement(React.Fragment, null, React.createElement('line', { x1: '18', y1: '6', x2: '6', y2: '18' }), React.createElement('line', { x1: '6', y1: '6', x2: '18', y2: '18' })),
    settings: React.createElement(React.Fragment, null, React.createElement('circle', { cx: '12', cy: '12', r: '3' }), React.createElement('path', { d: 'M19.4,15a1.65,1.65,0,0,0,.33,1.82l.06.06a2,2,0,0,1-2.83,2.83l-.06-.06a1.65,1.65,0,0,0-1.82-.33,1.65,1.65,0,0,0-1,1.51V21a2,2,0,0,1-4,0v-.09A1.65,1.65,0,0,0,9,19.4a1.65,1.65,0,0,0-1.82.33l-.06.06a2,2,0,0,1-2.83-2.83l.06-.06a1.65,1.65,0,0,0,.33-1.82,1.65,1.65,0,0,0-1.51-1H3a2,2,0,0,1,0-4h.09A1.65,1.65,0,0,0,4.6,9a1.65,1.65,0,0,0-.33-1.82l-.06-.06A2,2,0,0,1,7.04,4.29l.06.06a1.65,1.65,0,0,0,1.82.33H9a1.65,1.65,0,0,0,1-1.51V3a2,2,0,0,1,4,0v.09a1.65,1.65,0,0,0,1,1.51,1.65,1.65,0,0,0,1.82-.33l.06-.06a2,2,0,0,1,2.83,2.83l-.06.06a1.65,1.65,0,0,0-.33,1.82V9a1.65,1.65,0,0,0,1.51,1H21a2,2,0,0,1,0,4h-.09A1.65,1.65,0,0,0,19.4,15Z' })),
    logout: React.createElement(React.Fragment, null, React.createElement('path', { d: 'M9,21H5a2,2,0,0,1-2-2V5a2,2,0,0,1,2-2h4' }), React.createElement('polyline', { points: '16,17 21,12 16,7' }), React.createElement('line', { x1: '21', y1: '12', x2: '9', y2: '12' })),
    upload: React.createElement(React.Fragment, null, React.createElement('path', { d: 'M21,15v4a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2v-4' }), React.createElement('polyline', { points: '17,8 12,3 7,8' }), React.createElement('line', { x1: '12', y1: '3', x2: '12', y2: '15' })),
    share: React.createElement(React.Fragment, null, React.createElement('circle', { cx: '18', cy: '5', r: '3' }), React.createElement('circle', { cx: '6', cy: '12', r: '3' }), React.createElement('circle', { cx: '18', cy: '19', r: '3' }), React.createElement('line', { x1: '8.59', y1: '13.51', x2: '15.42', y2: '17.49' }), React.createElement('line', { x1: '15.41', y1: '6.51', x2: '8.59', y2: '10.49' })),
    users: React.createElement(React.Fragment, null, React.createElement('path', { d: 'M17,21v-2a4,4,0,0,0-4-4H5a4,4,0,0,0-4,4v2' }), React.createElement('circle', { cx: '9', cy: '7', r: '4' }), React.createElement('path', { d: 'M23,21v-2a4,4,0,0,0-3-3.87' }), React.createElement('path', { d: 'M16,3.13a4,4,0,0,1,0,7.75' })),
    home: React.createElement(React.Fragment, null, React.createElement('path', { d: 'M3,9l9-7,9,7v11a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2Z' }), React.createElement('polyline', { points: '9,22 9,12 15,12 15,22' })),
    enter: React.createElement(React.Fragment, null, React.createElement('path', { d: 'M15,3h4a2,2,0,0,1,2,2v14a2,2,0,0,1-2,2h-4' }), React.createElement('polyline', { points: '10,17 15,12 10,7' }), React.createElement('line', { x1: '15', y1: '12', x2: '3', y2: '12' })),
    chevronDown: React.createElement('polyline', { points: '6,9 12,15 18,9' }),
    grip: React.createElement(React.Fragment, null, React.createElement('circle', { cx: '9', cy: '5', r: '1.5' }), React.createElement('circle', { cx: '9', cy: '12', r: '1.5' }), React.createElement('circle', { cx: '9', cy: '19', r: '1.5' }), React.createElement('circle', { cx: '15', cy: '5', r: '1.5' }), React.createElement('circle', { cx: '15', cy: '12', r: '1.5' }), React.createElement('circle', { cx: '15', cy: '19', r: '1.5' }))
  };
  return React.createElement('svg', { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' }, paths[name] || null);
}

// ============================================
// Dragon Fire (Embers)
// ============================================
function DragonFire() {
  var embers = [];
  for (var i = 0; i < 20; i++) {
    embers.push(React.createElement('div', { key: i, className: 'ember', style: { left: (Math.random() * 100) + '%', animationDuration: (2 + Math.random() * 3) + 's', animationDelay: (Math.random() * 2) + 's', opacity: 0.3 + Math.random() * 0.5 } }));
  }
  return React.createElement('div', { className: 'dragon-fire-container' }, embers);
}

// ============================================
// YouTube Player Component with Sync
// ============================================
function YouTubePlayer(props) {
  var videoId = props.videoId;
  var playbackState = props.playbackState;
  var playbackTime = props.playbackTime;
  var onStateChange = props.onStateChange;
  var onSeek = props.onSeek;
  
  var containerRef = useRef(null);
  var playerRef = useRef(null);
  var isReady = useRef(false);
  var lastCommandTime = useRef(0);
  var lastKnownTime = useRef(0);
  var seekCheckInterval = useRef(null);

  // Load YouTube API once
  useEffect(function() {
    if (window.YT && window.YT.Player) return;
    
    if (!document.getElementById('youtube-api')) {
      var tag = document.createElement('script');
      tag.id = 'youtube-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  }, []);

  // Create player when API is ready
  useEffect(function() {
    function initPlayer() {
      if (!containerRef.current || playerRef.current) return;
      
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: videoId,
        playerVars: {
          autoplay: playbackState === 'playing' ? 1 : 0,
          rel: 0,
          modestbranding: 1,
          start: Math.floor(playbackTime || 0)
        },
        events: {
          onReady: function() {
            console.log('YT Player ready');
            isReady.current = true;
            lastKnownTime.current = playbackTime || 0;
            
            // Start monitoring for seeks
            seekCheckInterval.current = setInterval(function() {
              if (!playerRef.current || !isReady.current) return;
              if (Date.now() - lastCommandTime.current < 1000) return;
              
              try {
                var currentTime = playerRef.current.getCurrentTime();
                var timeDiff = Math.abs(currentTime - lastKnownTime.current);
                
                // If time jumped more than 3 seconds, user seeked
                if (timeDiff > 3 && lastKnownTime.current > 0) {
                  console.log('YT: User seeked to', currentTime);
                  if (onSeek) {
                    onSeek(currentTime);
                  }
                }
                lastKnownTime.current = currentTime;
              } catch (e) {}
            }, 500);
          },
          onStateChange: function(event) {
            // Ignore events triggered by our commands
            if (Date.now() - lastCommandTime.current < 1000) return;
            
            // YT states: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering
            if (event.data === 1 && onStateChange) {
              console.log('YT: User played');
              onStateChange('playing', playerRef.current.getCurrentTime());
            } else if (event.data === 2 && onStateChange) {
              console.log('YT: User paused');
              onStateChange('paused', playerRef.current.getCurrentTime());
            }
          }
        }
      });
    }

    // Wait for YT API
    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return function() {
      if (seekCheckInterval.current) {
        clearInterval(seekCheckInterval.current);
      }
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
        isReady.current = false;
      }
    };
  }, [videoId]);

  // Apply playback state changes from sync
  useEffect(function() {
    if (!isReady.current || !playerRef.current) return;
    
    try {
      var currentState = playerRef.current.getPlayerState();
      // 1 = playing, 2 = paused
      
      if (playbackState === 'playing' && currentState !== 1) {
        console.log('>>> Sending PLAY command');
        lastCommandTime.current = Date.now();
        playerRef.current.playVideo();
      } else if (playbackState === 'paused' && currentState !== 2) {
        console.log('>>> Sending PAUSE command');
        lastCommandTime.current = Date.now();
        playerRef.current.pauseVideo();
      }
    } catch (e) {
      console.error('YT command error:', e);
    }
  }, [playbackState]);

  // Apply time sync from server
  useEffect(function() {
    if (!isReady.current || !playerRef.current) return;
    if (playbackTime === undefined || playbackTime === null) return;
    
    try {
      var currentTime = playerRef.current.getCurrentTime();
      var timeDiff = Math.abs(currentTime - playbackTime);
      
      // Only seek if difference is more than 3 seconds
      if (timeDiff > 3) {
        console.log('>>> Seeking to synced time:', playbackTime, '(was at', currentTime, ')');
        lastCommandTime.current = Date.now();
        lastKnownTime.current = playbackTime;
        playerRef.current.seekTo(playbackTime, true);
      }
    } catch (e) {
      console.error('YT seek error:', e);
    }
  }, [playbackTime]);

  return React.createElement('div', {
    ref: containerRef,
    style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }
  });
}

// ============================================
// Video Player
// ============================================
function VideoPlayer(props) {
  var video = props.video;
  var playbackState = props.playbackState;
  var playbackTime = props.playbackTime;
  var onStateChange = props.onStateChange;
  var onSeek = props.onSeek;
  var onEnded = props.onEnded;
  var isLocalChange = props.isLocalChange;
  
  var videoRef = useRef(null);
  var ignoreNextEvent = useRef(false);

  // Direct video element handlers
  useEffect(function() {
    if (!videoRef.current) return;
    
    function handlePlay() {
      if (ignoreNextEvent.current) { ignoreNextEvent.current = false; return; }
      console.log('Direct video: play at', videoRef.current.currentTime);
      onStateChange('playing', videoRef.current.currentTime);
    }
    
    function handlePause() {
      if (ignoreNextEvent.current) { ignoreNextEvent.current = false; return; }
      console.log('Direct video: pause at', videoRef.current.currentTime);
      onStateChange('paused', videoRef.current.currentTime);
    }
    
    function handleSeeked() {
      if (ignoreNextEvent.current) { ignoreNextEvent.current = false; return; }
      var state = videoRef.current.paused ? 'paused' : 'playing';
      console.log('Direct video: seeked to', videoRef.current.currentTime);
      onStateChange(state, videoRef.current.currentTime);
    }
    
    videoRef.current.addEventListener('play', handlePlay);
    videoRef.current.addEventListener('pause', handlePause);
    videoRef.current.addEventListener('seeked', handleSeeked);
    
    return function() {
      if (videoRef.current) {
        videoRef.current.removeEventListener('play', handlePlay);
        videoRef.current.removeEventListener('pause', handlePause);
        videoRef.current.removeEventListener('seeked', handleSeeked);
      }
    };
  }, [video]);

  // Apply remote state to direct video
  useEffect(function() {
    if (!videoRef.current || isLocalChange) return;
    
    var timeDiff = Math.abs(videoRef.current.currentTime - playbackTime);
    
    if (timeDiff > 2) {
      ignoreNextEvent.current = true;
      videoRef.current.currentTime = playbackTime;
    }
    
    if (playbackState === 'playing' && videoRef.current.paused) {
      ignoreNextEvent.current = true;
      videoRef.current.play().catch(function() {});
    } else if (playbackState === 'paused' && !videoRef.current.paused) {
      ignoreNextEvent.current = true;
      videoRef.current.pause();
    }
  }, [playbackState, playbackTime, isLocalChange]);

  if (!video) {
    return React.createElement('div', { className: 'video-placeholder' },
      React.createElement('div', { className: 'dragon-logo' }, '🐉'),
      React.createElement('h2', null, 'Multiview'),
      React.createElement('p', null, 'Select a video to play')
    );
  }

  var parsed = parseVideoUrl(video.url);
  console.log('VideoPlayer rendering:', video.url, 'parsed:', parsed);
  
  if (!parsed) return React.createElement('div', { className: 'video-error' }, 'Invalid video URL');

  if (parsed.type === 'youtube') {
    console.log('Rendering YouTube player for ID:', parsed.id);
    return React.createElement('div', { className: 'video-frame' },
      React.createElement(YouTubePlayer, {
        videoId: parsed.id,
        playbackState: playbackState,
        playbackTime: playbackTime,
        onStateChange: onStateChange,
        onSeek: onSeek
      })
    );
  }
  
  if (parsed.type === 'vimeo') {
    return React.createElement('iframe', { 
      key: video.url, 
      src: 'https://player.vimeo.com/video/' + parsed.id + '?autoplay=1', 
      allow: 'autoplay; fullscreen', 
      allowFullScreen: true, 
      className: 'video-frame' 
    });
  }
  
  if (parsed.type === 'direct') {
    if (video.url.match(/\.(mp3|wav|m4a)$/i)) {
      return React.createElement('div', { className: 'video-placeholder' },
        React.createElement('div', { style: { fontSize: '48px' } }, '🎵'),
        React.createElement('p', null, video.title),
        React.createElement('audio', { 
          ref: videoRef,
          key: video.url, 
          src: video.url, 
          controls: true, 
          autoPlay: playbackState === 'playing', 
          onEnded: onEnded, 
          style: { width: '80%', maxWidth: '400px' } 
        })
      );
    }
    return React.createElement('video', { 
      ref: videoRef,
      key: video.url, 
      src: video.url, 
      controls: true, 
      autoPlay: playbackState === 'playing', 
      onEnded: onEnded, 
      className: 'video-frame' 
    });
  }
  
  return React.createElement('div', { className: 'video-error' }, 'Unsupported format');
}

// ============================================
// Connected Users
// ============================================
function ConnectedUsers(props) {
  var users = props.users;
  var isHost = props.isHost;
  var currentUserId = props.currentUserId;
  var roomId = props.roomId;
  var onKick = props.onKick;
  var onRename = props.onRename;
  var onColorChange = props.onColorChange;
  
  var _contextMenu = useState(null);
  var contextMenu = _contextMenu[0];
  var setContextMenu = _contextMenu[1];

  function handleRightClick(e, user) {
    e.preventDefault();
    var x = Math.min(e.clientX, window.innerWidth - 180);
    var y = Math.min(e.clientY, window.innerHeight - 150);
    setContextMenu({ x: x, y: y, user: user });
  }

  useEffect(function() {
    function close() { setContextMenu(null); }
    document.addEventListener('click', close);
    return function() { document.removeEventListener('click', close); };
  }, []);

  var onlineUsers = users.filter(function(u) { return u.status === 'online'; });
  var offlineUsers = users.filter(function(u) { return u.status !== 'online'; });
  
  function sortUsers(list) {
    return list.slice().sort(function(a, b) {
      if (a.isOwner && !b.isOwner) return -1;
      if (!a.isOwner && b.isOwner) return 1;
      return (a.displayName || '').localeCompare(b.displayName || '');
    });
  }
  
  var sortedOnline = sortUsers(onlineUsers);
  var sortedOffline = sortUsers(offlineUsers);

  function renderUser(user) {
    var visId = user.visitorId || user.guestId;
    var isYou = visId === currentUserId;
    var isGuest = user.guestId || (visId && visId.startsWith && visId.startsWith('guest_'));
    var statusClass = user.status || 'offline';
    var badgeStyle = user.color ? { background: user.color } : {};
    
    return React.createElement('div', {
      key: visId,
      className: 'user-badge ' + statusClass + (isYou ? ' is-you' : '') + (user.isOwner ? ' is-owner' : ''),
      style: badgeStyle,
      onContextMenu: function(e) { handleRightClick(e, user); }
    },
      user.isOwner && React.createElement('span', { className: 'owner-crown' }, '👑'),
      React.createElement('span', { className: 'status-indicator ' + statusClass }),
      React.createElement('span', { className: 'badge-name' }, user.displayName || 'Guest'),
      isYou && React.createElement('span', { className: 'you-tag' }, '(you)'),
      isGuest && !isYou && React.createElement('span', { className: 'guest-tag-badge' }, '(guest)')
    );
  }

  return React.createElement('div', { className: 'connected-users-section' },
    React.createElement('div', { className: 'connected-header' },
      React.createElement('h4', null, React.createElement(Icon, { name: 'users', size: 'sm' }), ' Connected'),
      React.createElement('span', { className: 'online-count' }, React.createElement('span', { className: 'count' }, sortedOnline.length), ' online')
    ),
    React.createElement('div', { className: 'users-list' },
      sortedOnline.length === 0 && sortedOffline.length === 0 
        ? React.createElement('div', { className: 'no-users' }, 'No one here yet')
        : React.createElement(React.Fragment, null,
            sortedOnline.map(renderUser),
            sortedOffline.length > 0 && React.createElement('div', { className: 'offline-divider' }, 'Offline'),
            sortedOffline.map(renderUser)
          )
    ),
    contextMenu && React.createElement('div', { 
      className: 'context-menu', 
      style: { position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 10000 },
      onClick: function(e) { e.stopPropagation(); }
    },
      React.createElement('button', { className: 'context-menu-item', onClick: function() { 
        var name = prompt('New display name:', contextMenu.user.displayName);
        if (name && name.trim()) {
          var isGuest = contextMenu.user.guestId || (contextMenu.user.visitorId && contextMenu.user.visitorId.startsWith('guest_'));
          onRename(isGuest ? null : contextMenu.user.visitorId, isGuest ? (contextMenu.user.guestId || contextMenu.user.visitorId) : null, name.trim());
        }
        setContextMenu(null);
      } }, React.createElement(Icon, { name: 'edit', size: 'sm' }), ' Rename'),
      React.createElement('button', { className: 'context-menu-item', onClick: function() {
        var colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#e91e63', '#607d8b'];
        var colorIdx = colors.indexOf(contextMenu.user.color);
        var newColor = colors[(colorIdx + 1) % colors.length];
        var isGuest = contextMenu.user.guestId || (contextMenu.user.visitorId && contextMenu.user.visitorId.startsWith('guest_'));
        onColorChange(isGuest ? null : contextMenu.user.visitorId, isGuest ? (contextMenu.user.guestId || contextMenu.user.visitorId) : null, newColor);
        setContextMenu(null);
      } }, '🎨 Change Color'),
      isHost && contextMenu.user.visitorId !== currentUserId && React.createElement('button', { className: 'context-menu-item danger', onClick: function() {
        if (confirm('Kick ' + contextMenu.user.displayName + '?')) {
          var isGuest = contextMenu.user.guestId || (contextMenu.user.visitorId && contextMenu.user.visitorId.startsWith('guest_'));
          onKick(isGuest ? null : contextMenu.user.visitorId, isGuest ? (contextMenu.user.guestId || contextMenu.user.visitorId) : null);
        }
        setContextMenu(null);
      } }, React.createElement(Icon, { name: 'x', size: 'sm' }), ' Kick')
    )
  );
}

// ============================================
// Draggable Video List with Rename
// ============================================
function DraggableVideoList(props) {
  var videos = props.videos || [];
  var currentVideo = props.currentVideo;
  var onPlay = props.onPlay;
  var onRemove = props.onRemove;
  var onRename = props.onRename;
  var onReorder = props.onReorder;
  
  var _dragItem = useState(null);
  var dragItem = _dragItem[0];
  var setDragItem = _dragItem[1];
  
  var _dragOver = useState(null);
  var dragOver = _dragOver[0];
  var setDragOver = _dragOver[1];
  
  var _editingId = useState(null);
  var editingId = _editingId[0];
  var setEditingId = _editingId[1];
  
  var _editTitle = useState('');
  var editTitle = _editTitle[0];
  var setEditTitle = _editTitle[1];

  function handleDragStart(e, index) {
    setDragItem(index);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    if (dragItem === null) return;
    setDragOver(index);
  }

  function handleDrop(e, index) {
    e.preventDefault();
    if (dragItem === null || dragItem === index) {
      setDragItem(null);
      setDragOver(null);
      return;
    }
    
    var newVideos = videos.slice();
    var item = newVideos.splice(dragItem, 1)[0];
    newVideos.splice(index, 0, item);
    
    onReorder(newVideos.map(function(v) { return v.id; }));
    setDragItem(null);
    setDragOver(null);
  }

  function handleDragEnd() {
    setDragItem(null);
    setDragOver(null);
  }

  function startRename(video) {
    setEditingId(video.id);
    setEditTitle(video.title || video.url);
  }

  function saveRename(videoId) {
    if (editTitle.trim()) {
      onRename(videoId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  }

  if (videos.length === 0) {
    return React.createElement('div', { className: 'empty-queue' }, React.createElement('p', null, 'No videos in playlist'));
  }

  return React.createElement('div', { className: 'video-list' },
    videos.map(function(v, i) {
      var isPlaying = currentVideo && (currentVideo.id === v.id || currentVideo.url === v.url);
      var isDragging = dragItem === i;
      var isDragOver = dragOver === i;
      var isEditing = editingId === v.id;
      var parsed = parseVideoUrl(v.url);
      
      return React.createElement('div', { 
        key: v.id, 
        className: 'video-item' + (isPlaying ? ' playing' : '') + (isDragging ? ' dragging' : '') + (isDragOver ? ' drag-over' : ''),
        draggable: !isEditing,
        onDragStart: function(e) { handleDragStart(e, i); },
        onDragOver: function(e) { handleDragOver(e, i); },
        onDrop: function(e) { handleDrop(e, i); },
        onDragEnd: handleDragEnd
      },
        React.createElement('div', { className: 'video-item-top' },
          React.createElement('div', { className: 'drag-handle' }, React.createElement(Icon, { name: 'grip', size: 'sm' })),
          React.createElement('span', { className: 'video-index' }, i + 1),
          React.createElement('span', { className: 'video-type-icon' }, getVideoTypeIcon(parsed ? parsed.type : null)),
          isEditing 
            ? React.createElement('input', {
                className: 'video-edit-input',
                value: editTitle,
                onChange: function(e) { setEditTitle(e.target.value); },
                onBlur: function() { saveRename(v.id); },
                onKeyDown: function(e) { 
                  if (e.key === 'Enter') saveRename(v.id);
                  if (e.key === 'Escape') { setEditingId(null); setEditTitle(''); }
                },
                autoFocus: true,
                onClick: function(e) { e.stopPropagation(); }
              })
            : React.createElement('span', { className: 'video-title', onClick: function() { onPlay(v, i); } }, v.title || v.url)
        ),
        React.createElement('div', { className: 'video-actions' },
          React.createElement('button', { className: 'icon-btn sm primary', onClick: function(e) { e.stopPropagation(); onPlay(v, i); }, title: 'Play' }, React.createElement(Icon, { name: 'play', size: 'sm' })),
          React.createElement('button', { className: 'icon-btn sm', onClick: function(e) { e.stopPropagation(); startRename(v); }, title: 'Rename' }, React.createElement(Icon, { name: 'edit', size: 'sm' })),
          React.createElement('button', { className: 'icon-btn sm danger', onClick: function(e) { e.stopPropagation(); onRemove(v.id); }, title: 'Remove' }, React.createElement(Icon, { name: 'trash', size: 'sm' }))
        )
      );
    })
  );
}

// ============================================
// Playlist Panel (Draggable)
// ============================================
function PlaylistPanel(props) {
  var playlists = props.playlists;
  var activePlaylist = props.activePlaylist;
  var onSelect = props.onSelect;
  var onCreate = props.onCreate;
  var onDelete = props.onDelete;
  var onRename = props.onRename;
  var onReorder = props.onReorder;
  
  var _showCreate = useState(false);
  var showCreate = _showCreate[0];
  var setShowCreate = _showCreate[1];
  
  var _newName = useState('');
  var newName = _newName[0];
  var setNewName = _newName[1];
  
  var _editingId = useState(null);
  var editingId = _editingId[0];
  var setEditingId = _editingId[1];
  
  var _editName = useState('');
  var editName = _editName[0];
  var setEditName = _editName[1];
  
  var _dragItem = useState(null);
  var dragItem = _dragItem[0];
  var setDragItem = _dragItem[1];
  
  var _dragOver = useState(null);
  var dragOver = _dragOver[0];
  var setDragOver = _dragOver[1];

  function handleCreate() {
    if (!newName.trim()) return;
    onCreate(newName.trim());
    setNewName('');
    setShowCreate(false);
  }

  function handleRename(id) {
    if (!editName.trim()) return;
    onRename(id, editName.trim());
    setEditingId(null);
    setEditName('');
  }

  function handleDragStart(e, index) {
    setDragItem(index);
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    if (dragItem === null) return;
    setDragOver(index);
  }

  function handleDrop(e, index) {
    e.preventDefault();
    if (dragItem === null || dragItem === index) {
      setDragItem(null);
      setDragOver(null);
      return;
    }
    var newPlaylists = playlists.slice();
    var item = newPlaylists.splice(dragItem, 1)[0];
    newPlaylists.splice(index, 0, item);
    if (onReorder) onReorder(newPlaylists.map(function(p) { return p.id; }));
    setDragItem(null);
    setDragOver(null);
  }

  return React.createElement('div', { className: 'playlist-panel' },
    React.createElement('div', { className: 'sidebar-header' },
      React.createElement('h3', null, 'Playlists'),
      React.createElement('button', { className: 'icon-btn sm', onClick: function() { setShowCreate(true); } }, 
        React.createElement(Icon, { name: 'plus', size: 'sm' })
      )
    ),
    showCreate && React.createElement('div', { className: 'create-playlist-form' },
      React.createElement('input', { value: newName, onChange: function(e) { setNewName(e.target.value); }, placeholder: 'Playlist name', autoFocus: true, onKeyDown: function(e) { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); } }),
      React.createElement('div', { className: 'form-actions' },
        React.createElement('button', { className: 'btn primary sm', onClick: handleCreate }, 'Create'),
        React.createElement('button', { className: 'btn sm', onClick: function() { setShowCreate(false); } }, 'Cancel')
      )
    ),
    React.createElement('div', { className: 'playlists-list' },
      playlists.length === 0 
        ? React.createElement('div', { className: 'empty-playlists' }, 'No playlists yet')
        : playlists.map(function(p, i) {
            var isActive = activePlaylist && activePlaylist.id === p.id;
            var isEditing = editingId === p.id;
            var isDragging = dragItem === i;
            var isDragOver = dragOver === i;
            
            return React.createElement('div', { 
              key: p.id, 
              className: 'playlist-item' + (isActive ? ' active' : '') + (isDragging ? ' dragging' : '') + (isDragOver ? ' drag-over' : ''),
              draggable: !isEditing,
              onDragStart: function(e) { handleDragStart(e, i); },
              onDragOver: function(e) { handleDragOver(e, i); },
              onDrop: function(e) { handleDrop(e, i); },
              onDragEnd: function() { setDragItem(null); setDragOver(null); }
            },
              React.createElement('div', { className: 'drag-handle' }, React.createElement(Icon, { name: 'grip', size: 'sm' })),
              isEditing 
                ? React.createElement('input', { className: 'playlist-edit-input', value: editName, onChange: function(e) { setEditName(e.target.value); }, onBlur: function() { handleRename(p.id); }, onKeyDown: function(e) { if (e.key === 'Enter') handleRename(p.id); if (e.key === 'Escape') { setEditingId(null); setEditName(''); } }, autoFocus: true })
                : React.createElement('button', { className: 'playlist-select', onClick: function() { onSelect(p); } },
                    React.createElement('span', { className: 'playlist-name' }, p.name),
                    React.createElement('span', { className: 'playlist-count' }, (p.videos || []).length)
                  ),
              React.createElement('div', { className: 'playlist-actions' },
                React.createElement('button', { className: 'icon-btn sm', onClick: function(e) { e.stopPropagation(); setEditingId(p.id); setEditName(p.name); }, title: 'Rename' }, React.createElement(Icon, { name: 'edit', size: 'sm' })),
                React.createElement('button', { className: 'icon-btn sm danger', onClick: function(e) { e.stopPropagation(); onDelete(p.id); }, title: 'Delete' }, React.createElement(Icon, { name: 'trash', size: 'sm' }))
              )
            );
          })
    )
  );
}

// ============================================
// User Menu
// ============================================
function UserMenu(props) {
  var user = props.user;
  var onSettings = props.onSettings;
  var onLogout = props.onLogout;
  var onHome = props.onHome;
  
  var _open = useState(false);
  var open = _open[0];
  var setOpen = _open[1];
  
  var ref = useRef(null);

  useEffect(function() {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return function() { document.removeEventListener('mousedown', handleClickOutside); };
  }, []);

  return React.createElement('div', { className: 'user-menu-container', ref: ref },
    React.createElement('button', { className: 'user-menu', onClick: function() { setOpen(!open); } },
      React.createElement('div', { className: 'user-avatar' }, user.displayName ? user.displayName.charAt(0).toUpperCase() : '?'),
      React.createElement('span', { className: 'user-name' }, user.displayName),
      React.createElement(Icon, { name: 'chevronDown', size: 'sm' })
    ),
    open && React.createElement('div', { className: 'user-dropdown' },
      React.createElement('div', { className: 'dropdown-header' },
        React.createElement('div', { className: 'name' }, user.displayName),
        React.createElement('div', { className: 'email' }, user.email)
      ),
      onHome && React.createElement('button', { className: 'dropdown-item', onClick: function() { onHome(); setOpen(false); } }, React.createElement(Icon, { name: 'home', size: 'sm' }), ' My Rooms'),
      React.createElement('button', { className: 'dropdown-item', onClick: function() { onSettings(); setOpen(false); } }, React.createElement(Icon, { name: 'settings', size: 'sm' }), ' Settings'),
      React.createElement('div', { className: 'dropdown-divider' }),
      React.createElement('button', { className: 'dropdown-item danger', onClick: onLogout }, React.createElement(Icon, { name: 'logout', size: 'sm' }), ' Log out')
    )
  );
}

// ============================================
// Settings Modal
// ============================================
function SettingsModal(props) {
  var user = props.user;
  var onClose = props.onClose;
  var onUpdate = props.onUpdate;
  var onLogout = props.onLogout;
  
  var _tab = useState('profile');
  var tab = _tab[0];
  var setTab = _tab[1];
  
  var _displayName = useState(user.displayName || '');
  var displayName = _displayName[0];
  var setDisplayName = _displayName[1];
  
  var _newEmail = useState('');
  var newEmail = _newEmail[0];
  var setNewEmail = _newEmail[1];
  
  var _emailPassword = useState('');
  var emailPassword = _emailPassword[0];
  var setEmailPassword = _emailPassword[1];
  
  var _currentPassword = useState('');
  var currentPassword = _currentPassword[0];
  var setCurrentPassword = _currentPassword[1];
  
  var _newPassword = useState('');
  var newPassword = _newPassword[0];
  var setNewPassword = _newPassword[1];
  
  var _confirmPassword = useState('');
  var confirmPassword = _confirmPassword[0];
  var setConfirmPassword = _confirmPassword[1];
  
  var _message = useState(null);
  var message = _message[0];
  var setMessage = _message[1];
  
  var _loading = useState(false);
  var loading = _loading[0];
  var setLoading = _loading[1];

  function handleSaveProfile() {
    if (!displayName.trim()) return;
    setLoading(true);
    api.auth.updateProfile(displayName.trim()).then(function() {
      onUpdate(Object.assign({}, user, { displayName: displayName.trim() }));
      setMessage({ text: 'Profile saved!', type: 'success' });
      setLoading(false);
    }).catch(function(err) {
      setMessage({ text: err.message, type: 'error' });
      setLoading(false);
    });
  }

  function handleChangeEmail() {
    if (!newEmail.trim() || !emailPassword) {
      setMessage({ text: 'Please fill in all fields', type: 'error' });
      return;
    }
    setLoading(true);
    api.auth.updateEmail(newEmail.trim(), emailPassword).then(function() {
      onUpdate(Object.assign({}, user, { email: newEmail.trim() }));
      setMessage({ text: 'Email updated!', type: 'success' });
      setNewEmail('');
      setEmailPassword('');
      setLoading(false);
    }).catch(function(err) {
      setMessage({ text: err.message, type: 'error' });
      setLoading(false);
    });
  }

  function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ text: 'Please fill in all fields', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ text: 'New passwords do not match', type: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ text: 'Password must be at least 6 characters', type: 'error' });
      return;
    }
    setLoading(true);
    api.auth.updatePassword(currentPassword, newPassword).then(function() {
      setMessage({ text: 'Password changed!', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setLoading(false);
    }).catch(function(err) {
      setMessage({ text: err.message, type: 'error' });
      setLoading(false);
    });
  }

  function handleDeleteAccount() {
    if (!confirm('Delete your account? This cannot be undone.')) return;
    setLoading(true);
    api.auth.deleteAccount().then(onLogout).catch(function(err) { setMessage({ text: err.message, type: 'error' }); setLoading(false); });
  }

  return React.createElement('div', { className: 'modal-overlay', onClick: onClose },
    React.createElement('div', { className: 'modal settings-modal', onClick: function(e) { e.stopPropagation(); } },
      React.createElement('button', { className: 'modal-close', onClick: onClose }, '×'),
      React.createElement('h2', null, 'Settings'),
      React.createElement('div', { className: 'settings-tabs' },
        React.createElement('button', { className: 'settings-tab' + (tab === 'profile' ? ' active' : ''), onClick: function() { setTab('profile'); setMessage(null); } }, 'Profile'),
        React.createElement('button', { className: 'settings-tab' + (tab === 'email' ? ' active' : ''), onClick: function() { setTab('email'); setMessage(null); } }, 'Email'),
        React.createElement('button', { className: 'settings-tab' + (tab === 'password' ? ' active' : ''), onClick: function() { setTab('password'); setMessage(null); } }, 'Password'),
        React.createElement('button', { className: 'settings-tab' + (tab === 'danger' ? ' active' : ''), onClick: function() { setTab('danger'); setMessage(null); } }, 'Account')
      ),
      message && React.createElement('div', { className: message.type === 'error' ? 'error-message' : 'success-message' }, message.text),
      
      tab === 'profile' && React.createElement('div', { className: 'settings-content' },
        React.createElement('div', { className: 'modal-input-group' },
          React.createElement('label', null, 'Display Name'),
          React.createElement('input', { type: 'text', value: displayName, onChange: function(e) { setDisplayName(e.target.value); } })
        ),
        React.createElement('button', { className: 'btn primary', onClick: handleSaveProfile, disabled: loading }, loading ? 'Saving...' : 'Save Changes')
      ),
      
      tab === 'email' && React.createElement('div', { className: 'settings-content' },
        React.createElement('div', { className: 'modal-input-group' },
          React.createElement('label', null, 'Current Email'),
          React.createElement('input', { type: 'email', value: user.email, disabled: true })
        ),
        React.createElement('div', { className: 'modal-input-group' },
          React.createElement('label', null, 'New Email'),
          React.createElement('input', { type: 'email', value: newEmail, onChange: function(e) { setNewEmail(e.target.value); }, placeholder: 'Enter new email' })
        ),
        React.createElement('div', { className: 'modal-input-group' },
          React.createElement('label', null, 'Current Password'),
          React.createElement('input', { type: 'password', value: emailPassword, onChange: function(e) { setEmailPassword(e.target.value); }, placeholder: 'Confirm with password' })
        ),
        React.createElement('button', { className: 'btn primary', onClick: handleChangeEmail, disabled: loading }, loading ? 'Updating...' : 'Update Email')
      ),
      
      tab === 'password' && React.createElement('div', { className: 'settings-content' },
        React.createElement('div', { className: 'modal-input-group' },
          React.createElement('label', null, 'Current Password'),
          React.createElement('input', { type: 'password', value: currentPassword, onChange: function(e) { setCurrentPassword(e.target.value); }, placeholder: 'Enter current password' })
        ),
        React.createElement('div', { className: 'modal-input-group' },
          React.createElement('label', null, 'New Password'),
          React.createElement('input', { type: 'password', value: newPassword, onChange: function(e) { setNewPassword(e.target.value); }, placeholder: 'Enter new password' })
        ),
        React.createElement('div', { className: 'modal-input-group' },
          React.createElement('label', null, 'Confirm New Password'),
          React.createElement('input', { type: 'password', value: confirmPassword, onChange: function(e) { setConfirmPassword(e.target.value); }, placeholder: 'Confirm new password' })
        ),
        React.createElement('button', { className: 'btn primary', onClick: handleChangePassword, disabled: loading }, loading ? 'Changing...' : 'Change Password')
      ),
      
      tab === 'danger' && React.createElement('div', { className: 'settings-content' },
        React.createElement('div', { className: 'danger-zone' },
          React.createElement('h3', null, '⚠️ Danger Zone'),
          React.createElement('p', null, 'Deleting your account will permanently remove all your data.'),
          React.createElement('button', { className: 'btn danger', onClick: handleDeleteAccount, disabled: loading }, loading ? 'Deleting...' : 'Delete My Account')
        )
      )
    )
  );
}

// ============================================
// Guest Join Modal
// ============================================
function GuestJoinModal(props) {
  var _name = useState('');
  var name = _name[0];
  var setName = _name[1];

  return React.createElement('div', { className: 'modal-overlay' },
    React.createElement('div', { className: 'modal guest-modal' },
      React.createElement('div', { className: 'guest-modal-icon' }, '🐉'),
      React.createElement('h2', null, 'Join Room'),
      React.createElement('p', null, 'Enter a display name to join'),
      React.createElement('div', { className: 'modal-input-group' },
        React.createElement('input', { type: 'text', value: name, onChange: function(e) { setName(e.target.value); }, placeholder: 'Your name', autoFocus: true, onKeyDown: function(e) { if (e.key === 'Enter') props.onJoin(name.trim() || 'Guest'); } })
      ),
      React.createElement('button', { className: 'btn primary', onClick: function() { props.onJoin(name.trim() || 'Guest'); } }, 'Join as Guest'),
      React.createElement('div', { className: 'guest-modal-divider' }, React.createElement('span', null, 'or')),
      React.createElement('button', { className: 'btn secondary', onClick: props.onLogin }, 'Sign in / Create Account')
    )
  );
}

// ============================================
// Auth Screen
// ============================================
function AuthScreen(props) {
  var _mode = useState('login');
  var mode = _mode[0];
  var setMode = _mode[1];
  
  var _email = useState('');
  var email = _email[0];
  var setEmail = _email[1];
  
  var _username = useState('');
  var username = _username[0];
  var setUsername = _username[1];
  
  var _password = useState('');
  var password = _password[0];
  var setPassword = _password[1];
  
  var _displayName = useState('');
  var displayName = _displayName[0];
  var setDisplayName = _displayName[1];
  
  var _error = useState('');
  var error = _error[0];
  var setError = _error[1];
  
  var _loading = useState(false);
  var loading = _loading[0];
  var setLoading = _loading[1];

  useEffect(function() {
    if (GOOGLE_CLIENT_ID && window.google) {
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: function(response) {
        setLoading(true);
        api.auth.googleLogin(response.credential).then(props.onAuth).catch(function(err) { setError(err.message); }).finally(function() { setLoading(false); });
      } });
    }
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    var promise = mode === 'register' ? api.auth.register(email, username || null, password, displayName) : api.auth.login(email, password);
    promise.then(props.onAuth).catch(function(err) { setError(err.message); }).finally(function() { setLoading(false); });
  }

  return React.createElement('div', { className: 'auth-screen' },
    React.createElement(DragonFire, null),
    React.createElement('div', { className: 'auth-container' },
      React.createElement('div', { className: 'logo-section' },
        React.createElement('span', { className: 'logo-icon' }, '🐉'),
        React.createElement('h1', { className: 'logo' }, 'Multiview'),
        React.createElement('p', { className: 'tagline' }, 'Watch together, anywhere')
      ),
      React.createElement('div', { className: 'auth-box' },
        React.createElement('h2', null, mode === 'login' ? 'Welcome back' : 'Create account'),
        error && React.createElement('div', { className: 'error-message' }, error),
        React.createElement('form', { onSubmit: handleSubmit },
          mode === 'register' && React.createElement('div', { className: 'input-group' },
            React.createElement('label', null, 'Display Name'),
            React.createElement('input', { type: 'text', value: displayName, onChange: function(e) { setDisplayName(e.target.value); }, required: true })
          ),
          React.createElement('div', { className: 'input-group' },
            React.createElement('label', null, mode === 'register' ? 'Email' : 'Email or Username'),
            React.createElement('input', { type: mode === 'register' ? 'email' : 'text', value: email, onChange: function(e) { setEmail(e.target.value); }, required: true })
          ),
          mode === 'register' && React.createElement('div', { className: 'input-group' },
            React.createElement('label', null, 'Username (optional)'),
            React.createElement('input', { type: 'text', value: username, onChange: function(e) { setUsername(e.target.value); } })
          ),
          React.createElement('div', { className: 'input-group' },
            React.createElement('label', null, 'Password'),
            React.createElement('input', { type: 'password', value: password, onChange: function(e) { setPassword(e.target.value); }, required: true, minLength: 6 })
          ),
          React.createElement('button', { type: 'submit', className: 'auth-submit', disabled: loading }, loading ? 'Please wait...' : (mode === 'login' ? 'Sign in' : 'Create account'))
        ),
        React.createElement('div', { className: 'auth-divider' }, React.createElement('span', null, 'or')),
        React.createElement('button', { type: 'button', className: 'google-btn', onClick: function() { if (window.google) window.google.accounts.id.prompt(); } },
          React.createElement('svg', { viewBox: '0 0 24 24', width: 18, height: 18 },
            React.createElement('path', { fill: '#4285F4', d: 'M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z' }),
            React.createElement('path', { fill: '#34A853', d: 'M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z' }),
            React.createElement('path', { fill: '#FBBC05', d: 'M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z' }),
            React.createElement('path', { fill: '#EA4335', d: 'M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z' })
          ),
          'Continue with Google'
        ),
        React.createElement('div', { className: 'auth-links' },
          mode === 'login' 
            ? React.createElement(React.Fragment, null, React.createElement('span', null, 'New here? '), React.createElement('button', { type: 'button', onClick: function() { setMode('register'); setError(''); } }, 'Create account'))
            : React.createElement(React.Fragment, null, React.createElement('span', null, 'Have an account? '), React.createElement('button', { type: 'button', onClick: function() { setMode('login'); setError(''); } }, 'Sign in'))
        )
      )
    )
  );
}

// ============================================
// Home Page
// ============================================
function HomePage(props) {
  var user = props.user;
  
  var _rooms = useState([]);
  var rooms = _rooms[0];
  var setRooms = _rooms[1];
  
  var _showCreate = useState(false);
  var showCreate = _showCreate[0];
  var setShowCreate = _showCreate[1];
  
  var _newRoomName = useState('');
  var newRoomName = _newRoomName[0];
  var setNewRoomName = _newRoomName[1];
  
  var _editingRoom = useState(null);
  var editingRoom = _editingRoom[0];
  var setEditingRoom = _editingRoom[1];
  
  var _editName = useState('');
  var editName = _editName[0];
  var setEditName = _editName[1];
  
  var _settingsOpen = useState(false);
  var settingsOpen = _settingsOpen[0];
  var setSettingsOpen = _settingsOpen[1];
  
  var _notification = useState(null);
  var notification = _notification[0];
  var setNotification = _notification[1];
  
  var _loading = useState(true);
  var loading = _loading[0];
  var setLoading = _loading[1];

  useEffect(function() { loadRooms(); }, []);

  function loadRooms() {
    setLoading(true);
    api.rooms.list().then(function(r) {
      if (!r || r.length === 0) return api.rooms.create('My Room').then(function(room) { return [room]; });
      return r;
    }).then(setRooms).finally(function() { setLoading(false); });
  }

  function showNotif(msg, type) {
    setNotification({ message: msg, type: type || 'success' });
    setTimeout(function() { setNotification(null); }, 3000);
  }

  function createRoom() {
    if (!newRoomName.trim()) return;
    api.rooms.create(newRoomName.trim()).then(function(room) {
      setRooms(rooms.concat([room]));
      setNewRoomName('');
      setShowCreate(false);
      showNotif('Room created!');
    });
  }

  function renameRoom(roomId) {
    if (!editName.trim()) return;
    api.rooms.update(roomId, { name: editName.trim() }).then(function() {
      setRooms(rooms.map(function(r) { return r.id === roomId ? Object.assign({}, r, { name: editName.trim() }) : r; }));
      setEditingRoom(null);
      showNotif('Renamed!');
    });
  }

  function deleteRoom(roomId) {
    if (!confirm('Delete this room?')) return;
    api.rooms.delete(roomId).then(function() {
      setRooms(rooms.filter(function(r) { return r.id !== roomId; }));
      showNotif('Deleted!', 'warning');
    });
  }

  function copyShareLink(roomId) {
    navigator.clipboard.writeText(location.origin + location.pathname + '#/room/' + user.id + '/' + roomId);
    showNotif('Link copied!');
  }

  if (loading) {
    return React.createElement('div', { className: 'home-page' },
      React.createElement(DragonFire, null),
      React.createElement('div', { className: 'loading-screen' },
        React.createElement('div', { className: 'loading-dragon' }, '🐉'),
        React.createElement('div', { className: 'loading-text' }, 'Loading...')
      )
    );
  }

  return React.createElement('div', { className: 'home-page' },
    React.createElement(DragonFire, null),
    React.createElement('header', { className: 'home-header' },
      React.createElement('div', { className: 'logo-small' }, React.createElement('span', { className: 'dragon-icon' }, '🐉'), React.createElement('span', null, 'Multiview')),
      React.createElement(UserMenu, { user: user, onSettings: function() { setSettingsOpen(true); }, onLogout: props.onLogout })
    ),
    React.createElement('main', { className: 'home-content' },
      React.createElement('div', { className: 'home-welcome' },
        React.createElement('h1', null, 'Welcome, ' + user.displayName),
        React.createElement('p', null, 'Manage rooms and watch with friends')
      ),
      React.createElement('div', { className: 'rooms-section' },
        React.createElement('div', { className: 'rooms-header' },
          React.createElement('h2', null, '🚪 My Rooms'),
          React.createElement('button', { className: 'btn primary', onClick: function() { setShowCreate(true); } }, React.createElement(Icon, { name: 'plus', size: 'sm' }), ' New Room')
        ),
        showCreate && React.createElement('div', { className: 'create-room-form' },
          React.createElement('input', { type: 'text', value: newRoomName, onChange: function(e) { setNewRoomName(e.target.value); }, placeholder: 'Room name', autoFocus: true, onKeyDown: function(e) { if (e.key === 'Enter') createRoom(); } }),
          React.createElement('button', { className: 'btn primary', onClick: createRoom }, 'Create'),
          React.createElement('button', { className: 'btn', onClick: function() { setShowCreate(false); } }, 'Cancel')
        ),
        React.createElement('div', { className: 'rooms-grid' },
          rooms.map(function(room) {
            return React.createElement('div', { key: room.id, className: 'room-card' },
              React.createElement('div', { className: 'room-card-content' },
                editingRoom === room.id 
                  ? React.createElement('input', { type: 'text', value: editName, onChange: function(e) { setEditName(e.target.value); }, onBlur: function() { renameRoom(room.id); }, onKeyDown: function(e) { if (e.key === 'Enter') renameRoom(room.id); if (e.key === 'Escape') setEditingRoom(null); }, autoFocus: true, className: 'room-edit-input' })
                  : React.createElement('h3', null, room.name),
                React.createElement('div', { className: 'room-card-actions' },
                  React.createElement('button', { className: 'btn primary', onClick: function() { props.onEnterRoom(room); } }, React.createElement(Icon, { name: 'enter', size: 'sm' }), ' Enter'),
                  React.createElement('button', { className: 'icon-btn', onClick: function() { copyShareLink(room.id); }, title: 'Share' }, React.createElement(Icon, { name: 'share', size: 'sm' })),
                  React.createElement('button', { className: 'icon-btn', onClick: function() { setEditingRoom(room.id); setEditName(room.name); }, title: 'Rename' }, React.createElement(Icon, { name: 'edit', size: 'sm' })),
                  React.createElement('button', { className: 'icon-btn danger', onClick: function() { deleteRoom(room.id); }, title: 'Delete' }, React.createElement(Icon, { name: 'trash', size: 'sm' }))
                )
              )
            );
          })
        )
      )
    ),
    settingsOpen && React.createElement(SettingsModal, { user: user, onClose: function() { setSettingsOpen(false); }, onUpdate: props.onUpdateUser, onLogout: props.onLogout }),
    notification && React.createElement('div', { className: 'notification ' + notification.type }, notification.message)
  );
}

// ============================================
// Room Component with Synchronized Playback
// ============================================
function Room(props) {
  var user = props.user;
  var room = props.room;
  var hostId = props.hostId;
  var guestDisplayName = props.guestDisplayName;
  
  var _playlists = useState([]);
  var playlists = _playlists[0];
  var setPlaylists = _playlists[1];
  
  var _activePlaylist = useState(null);
  var activePlaylist = _activePlaylist[0];
  var setActivePlaylist = _activePlaylist[1];
  
  var _currentVideo = useState(null);
  var currentVideo = _currentVideo[0];
  var setCurrentVideo = _currentVideo[1];
  
  var _currentIndex = useState(-1);
  var currentIndex = _currentIndex[0];
  var setCurrentIndex = _currentIndex[1];
  
  var _playbackState = useState('paused');
  var playbackState = _playbackState[0];
  var setPlaybackState = _playbackState[1];
  
  var _playbackTime = useState(0);
  var playbackTime = _playbackTime[0];
  var setPlaybackTime = _playbackTime[1];
  
  var _urlInput = useState('');
  var urlInput = _urlInput[0];
  var setUrlInput = _urlInput[1];
  
  var _sidebarOpen = useState(true);
  var sidebarOpen = _sidebarOpen[0];
  var setSidebarOpen = _sidebarOpen[1];
  
  var _shareModalOpen = useState(false);
  var shareModalOpen = _shareModalOpen[0];
  var setShareModalOpen = _shareModalOpen[1];
  
  var _settingsOpen = useState(false);
  var settingsOpen = _settingsOpen[0];
  var setSettingsOpen = _settingsOpen[1];
  
  var _notification = useState(null);
  var notification = _notification[0];
  var setNotification = _notification[1];
  
  var _connectedUsers = useState([]);
  var connectedUsers = _connectedUsers[0];
  var setConnectedUsers = _connectedUsers[1];
  
  var fileInputRef = useRef(null);
  var syncInterval = useRef(null);
  var lastLocalChange = useRef(0);

  var visitorId = user ? user.id : api.getGuestId();
  var isOwner = user && user.id === hostId;
  var displayName = guestDisplayName || (user ? user.displayName : 'Guest');

  // Track current video ID to prevent re-renders
  var currentVideoIdRef = useRef(null);
  var lastSyncedState = useRef(null);
  var lastSyncedTime = useRef(0);

  function syncRoomState() {
    api.rooms.getSync(room.id).then(function(data) {
      if (data.members) setConnectedUsers(data.members);
      
      if (data.playlists) {
        setPlaylists(data.playlists);
        if (activePlaylist) {
          var updated = data.playlists.find(function(p) { return p.id === activePlaylist.id; });
          if (updated) setActivePlaylist(updated);
        } else if (data.playlists.length > 0 && !activePlaylist) {
          setActivePlaylist(data.playlists[0]);
        }
      }
      
      // Skip sync if we made a local change in the last 2 seconds
      var timeSinceLocalChange = Date.now() - (lastLocalChange.current || 0);
      if (timeSinceLocalChange < 2000) {
        return;
      }
      
      // Sync from server
      if (data.room) {
        var serverUrl = data.room.currentVideoUrl;
        var serverState = data.room.playbackState || 'paused';
        var serverTime = data.room.playbackTime || 0;
        
        if (serverUrl) {
          // Extract video ID for comparison
          var serverParsed = parseVideoUrl(serverUrl);
          var serverVideoId = serverParsed ? serverParsed.id : serverUrl;
          
          // Only update video if ID actually changed
          if (serverVideoId !== currentVideoIdRef.current) {
            console.log('>>> NEW VIDEO:', serverVideoId, 'state:', serverState, 'time:', serverTime);
            currentVideoIdRef.current = serverVideoId;
            lastSyncedState.current = serverState;
            lastSyncedTime.current = serverTime;
            setCurrentVideo({ 
              id: serverVideoId, 
              title: data.room.currentVideoTitle || serverUrl, 
              url: serverUrl 
            });
            setPlaybackState(serverState);
            setPlaybackTime(serverTime);
          } else {
            // Same video - check for state or time changes
            var stateChanged = serverState !== lastSyncedState.current;
            var timeDiff = Math.abs(serverTime - lastSyncedTime.current);
            var timeChanged = timeDiff > 3; // Only sync if > 3 seconds difference
            
            if (stateChanged) {
              console.log('>>> STATE CHANGE:', lastSyncedState.current, '->', serverState);
              lastSyncedState.current = serverState;
              setPlaybackState(serverState);
            }
            
            if (timeChanged) {
              console.log('>>> TIME SYNC:', lastSyncedTime.current, '->', serverTime, '(diff:', timeDiff, ')');
              lastSyncedTime.current = serverTime;
              setPlaybackTime(serverTime);
            }
          }
        } else {
          // No video on server
          if (currentVideoIdRef.current) {
            console.log('>>> Clearing video');
            currentVideoIdRef.current = null;
            lastSyncedState.current = null;
            lastSyncedTime.current = 0;
            setCurrentVideo(null);
            setPlaybackState('paused');
            setPlaybackTime(0);
          }
        }
      }
    }).catch(function(err) {
      console.error('Sync error:', err);
    });
  }

  useEffect(function() {
    console.log('Joining room and starting sync...');
    api.rooms.join(room.id, displayName).then(function() {
      console.log('Joined room, syncing...');
      syncRoomState();
    }).catch(console.error);
    
    syncInterval.current = setInterval(function() {
      api.presence.heartbeat(room.id, 'online').catch(console.error);
      syncRoomState();
    }, SYNC_INTERVAL);
    
    return function() {
      clearInterval(syncInterval.current);
      api.presence.leave(room.id).catch(console.error);
    };
  }, [room.id]);

  function showNotif(msg, type) {
    setNotification({ message: msg, type: type || 'success' });
    setTimeout(function() { setNotification(null); }, 3000);
  }

  function broadcastState(video, state, time) {
    console.log('>>> BROADCASTING:', video ? video.url : null, state, time);
    lastLocalChange.current = Date.now();
    
    api.rooms.updateSync(room.id, {
      currentVideoUrl: video ? video.url : null,
      currentVideoTitle: video ? (video.title || video.url) : null,
      currentPlaylistId: activePlaylist ? activePlaylist.id : null,
      playbackState: state || 'paused',
      playbackTime: time || 0
    }).then(function() {
      console.log('Broadcast successful');
    }).catch(function(err) {
      console.error('Broadcast failed:', err);
    });
  }

  function handlePlayerStateChange(state, time) {
    console.log('Player state changed:', state, 'at', time);
    lastSyncedState.current = state;
    lastSyncedTime.current = time;
    lastLocalChange.current = Date.now();
    setPlaybackState(state);
    setPlaybackTime(time);
    broadcastState(currentVideo, state, time);
  }

  function handlePlayerSeek(time) {
    console.log('Player seeked to:', time);
    lastSyncedTime.current = time;
    lastLocalChange.current = Date.now();
    setPlaybackTime(time);
    broadcastState(currentVideo, playbackState, time);
  }

  function playVideo(video, index) {
    console.log('Playing video:', video.title || video.url);
    var parsed = parseVideoUrl(video.url);
    currentVideoIdRef.current = parsed ? parsed.id : video.url;
    lastSyncedState.current = 'playing';
    lastSyncedTime.current = 0;
    setCurrentVideo(video);
    setCurrentIndex(index);
    setPlaybackState('playing');
    setPlaybackTime(0);
    broadcastState(video, 'playing', 0);
  }

  function playNow() {
    if (!urlInput.trim()) return;
    var parsed = parseVideoUrl(urlInput.trim());
    if (!parsed) { showNotif('Invalid URL', 'error'); return; }
    currentVideoIdRef.current = parsed.id;
    lastSyncedState.current = 'playing';
    lastSyncedTime.current = 0;
    var video = { id: parsed.id, title: urlInput, url: urlInput.trim() };
    setCurrentVideo(video);
    setPlaybackState('playing');
    setPlaybackTime(0);
    broadcastState(video, 'playing', 0);
    setUrlInput('');
  }

  function playPrev() {
    if (!activePlaylist || currentIndex <= 0) return;
    var videos = activePlaylist.videos || [];
    var video = videos[currentIndex - 1];
    playVideo(video, currentIndex - 1);
  }

  function playNext() {
    if (!activePlaylist) return;
    var videos = activePlaylist.videos || [];
    if (currentIndex < videos.length - 1) {
      playVideo(videos[currentIndex + 1], currentIndex + 1);
    }
  }

  function handleCreatePlaylist(name) {
    api.playlists.create(room.id, name).then(function(p) {
      var newPl = Object.assign({}, p, { videos: [] });
      setPlaylists(playlists.concat([newPl]));
      setActivePlaylist(newPl);
      showNotif('Created!');
    }).catch(function(err) { showNotif(err.message, 'error'); });
  }

  function handleDeletePlaylist(id) {
    if (!confirm('Delete playlist?')) return;
    api.playlists.delete(id).then(function() {
      setPlaylists(playlists.filter(function(p) { return p.id !== id; }));
      if (activePlaylist && activePlaylist.id === id) { setActivePlaylist(null); setCurrentVideo(null); }
      showNotif('Deleted!', 'warning');
    });
  }

  function handleRenamePlaylist(id, name) {
    api.playlists.update(id, { name: name }).then(function() {
      setPlaylists(playlists.map(function(p) { return p.id === id ? Object.assign({}, p, { name: name }) : p; }));
      if (activePlaylist && activePlaylist.id === id) setActivePlaylist(Object.assign({}, activePlaylist, { name: name }));
      showNotif('Renamed!');
    });
  }

  function handleReorderPlaylists(ids) {
    api.playlists.reorder(room.id, ids).catch(console.error);
  }

  function handleAddUrl() {
    if (!activePlaylist || !urlInput.trim()) return;
    var parsed = parseVideoUrl(urlInput.trim());
    if (!parsed) { showNotif('Invalid URL', 'error'); return; }
    api.playlists.addVideo(activePlaylist.id, { title: urlInput.trim(), url: urlInput.trim(), videoType: parsed.type }).then(function(video) {
      var newVideos = (activePlaylist.videos || []).concat([video]);
      var updated = Object.assign({}, activePlaylist, { videos: newVideos });
      setPlaylists(playlists.map(function(p) { return p.id === activePlaylist.id ? updated : p; }));
      setActivePlaylist(updated);
      setUrlInput('');
      showNotif('Added!');
    });
  }

  function removeVideo(videoId) {
    if (!activePlaylist) return;
    api.playlists.removeVideo(activePlaylist.id, videoId).then(function() {
      var newVideos = (activePlaylist.videos || []).filter(function(v) { return v.id !== videoId; });
      var updated = Object.assign({}, activePlaylist, { videos: newVideos });
      setPlaylists(playlists.map(function(p) { return p.id === activePlaylist.id ? updated : p; }));
      setActivePlaylist(updated);
      if (currentVideo && currentVideo.id === videoId) setCurrentVideo(null);
      showNotif('Removed!');
    });
  }

  function renameVideo(videoId, title) {
    if (!activePlaylist) return;
    api.playlists.updateVideo(activePlaylist.id, videoId, { title: title }).then(function() {
      var newVideos = (activePlaylist.videos || []).map(function(v) { return v.id === videoId ? Object.assign({}, v, { title: title }) : v; });
      var updated = Object.assign({}, activePlaylist, { videos: newVideos });
      setPlaylists(playlists.map(function(p) { return p.id === activePlaylist.id ? updated : p; }));
      setActivePlaylist(updated);
      showNotif('Renamed!');
    });
  }

  function reorderVideos(videoIds) {
    if (!activePlaylist) return;
    api.playlists.reorderVideos(activePlaylist.id, videoIds).then(function() {
      var videoMap = {};
      (activePlaylist.videos || []).forEach(function(v) { videoMap[v.id] = v; });
      var newVideos = videoIds.map(function(id) { return videoMap[id]; }).filter(Boolean);
      var updated = Object.assign({}, activePlaylist, { videos: newVideos });
      setPlaylists(playlists.map(function(p) { return p.id === activePlaylist.id ? updated : p; }));
      setActivePlaylist(updated);
    });
  }

  function copyShareLink() {
    navigator.clipboard.writeText(location.origin + location.pathname + '#/room/' + hostId + '/' + room.id);
    showNotif('Copied!');
    setShareModalOpen(false);
  }

  function handleKick(visitorId, guestId) {
    api.rooms.kick(room.id, visitorId, guestId).then(function() {
      setConnectedUsers(connectedUsers.filter(function(u) { return u.visitorId !== visitorId && u.guestId !== guestId; }));
      showNotif('Kicked!');
    });
  }

  function handleRenameUser(visitorId, guestId, name) {
    api.presence.updateMember(room.id, visitorId, guestId, { displayName: name }).then(function() {
      setConnectedUsers(connectedUsers.map(function(u) { return (u.visitorId === visitorId || u.guestId === guestId) ? Object.assign({}, u, { displayName: name }) : u; }));
      showNotif('Renamed!');
    });
  }

  function handleColorChange(visitorId, guestId, color) {
    api.presence.updateMember(room.id, visitorId, guestId, { color: color }).then(function() {
      setConnectedUsers(connectedUsers.map(function(u) { return (u.visitorId === visitorId || u.guestId === guestId) ? Object.assign({}, u, { color: color }) : u; }));
    });
  }

  function handleFileUpload(e) {
    var files = Array.from(e.target.files);
    files.forEach(function(file) {
      var url = URL.createObjectURL(file);
      var title = file.name.replace(/\.[^/.]+$/, '');
      var video = { id: 'local_' + Date.now(), title: title, url: url };
      playVideo(video, -1);
    });
    e.target.value = '';
  }

  return React.createElement('div', { className: 'dashboard' },
    React.createElement(DragonFire, null),
    React.createElement('input', { type: 'file', ref: fileInputRef, className: 'hidden', accept: 'video/*,audio/*', multiple: true, onChange: handleFileUpload }),
    
    React.createElement('header', { className: 'dashboard-header' },
      React.createElement('div', { className: 'header-left' },
        React.createElement('button', { className: 'icon-btn', onClick: function() { setSidebarOpen(!sidebarOpen); } }, React.createElement(Icon, { name: 'menu' })),
        props.onHome && React.createElement('button', { className: 'icon-btn', onClick: props.onHome, title: 'Home' }, React.createElement(Icon, { name: 'home' })),
        React.createElement('h1', { className: 'room-title' }, room.name)
      ),
      React.createElement('div', { className: 'header-center' },
        React.createElement('div', { className: 'url-bar' },
          React.createElement('input', { value: urlInput, onChange: function(e) { setUrlInput(e.target.value); }, placeholder: 'Enter URL...', onKeyDown: function(e) { if (e.key === 'Enter') playNow(); } }),
          React.createElement('button', { className: 'icon-btn primary', onClick: playNow, title: 'Play Now' }, React.createElement(Icon, { name: 'play' })),
          React.createElement('button', { className: 'icon-btn', onClick: handleAddUrl, disabled: !activePlaylist, title: 'Add to Playlist' }, React.createElement(Icon, { name: 'plus' })),
          React.createElement('button', { className: 'icon-btn', onClick: function() { fileInputRef.current && fileInputRef.current.click(); }, title: 'Upload' }, React.createElement(Icon, { name: 'upload' }))
        )
      ),
      React.createElement('div', { className: 'header-right' },
        React.createElement('button', { className: 'btn secondary sm', onClick: function() { setShareModalOpen(true); } }, React.createElement(Icon, { name: 'share', size: 'sm' }), ' Share'),
        user 
          ? React.createElement(UserMenu, { user: user, onSettings: function() { setSettingsOpen(true); }, onLogout: props.onLogout, onHome: props.onHome })
          : React.createElement('div', { className: 'guest-badge' }, React.createElement('span', { className: 'guest-name' }, displayName), React.createElement('span', { className: 'guest-tag' }, 'Guest'))
      )
    ),
    
    React.createElement('div', { className: 'dashboard-content' },
      React.createElement('aside', { className: 'sidebar' + (sidebarOpen ? '' : ' closed') },
        React.createElement(PlaylistPanel, { playlists: playlists, activePlaylist: activePlaylist, onSelect: setActivePlaylist, onCreate: handleCreatePlaylist, onDelete: handleDeletePlaylist, onRename: handleRenamePlaylist, onReorder: handleReorderPlaylists })
      ),
      
      React.createElement('main', { className: 'main-content' },
        React.createElement('div', { className: 'queue-panel' },
          React.createElement('div', { className: 'queue-header' }, React.createElement('h3', null, '📜 ', activePlaylist ? activePlaylist.name : 'Select Playlist')),
          activePlaylist 
            ? React.createElement(DraggableVideoList, { videos: activePlaylist.videos || [], currentVideo: currentVideo, onPlay: playVideo, onRemove: removeVideo, onRename: renameVideo, onReorder: reorderVideos })
            : React.createElement('div', { className: 'empty-queue' }, React.createElement('p', null, 'Select a playlist'))
        ),
        
        React.createElement('div', { className: 'video-section' },
          React.createElement(VideoPlayer, { 
            key: currentVideo ? currentVideo.url : 'no-video',
            video: currentVideo, 
            playbackState: playbackState, 
            playbackTime: playbackTime, 
            onStateChange: handlePlayerStateChange,
            onSeek: handlePlayerSeek,
            onEnded: playNext,
            isLocalChange: (Date.now() - lastLocalChange.current) < 2000
          }),
          React.createElement('div', { className: 'playback-controls' },
            React.createElement('button', { className: 'btn sm', onClick: playPrev, disabled: !activePlaylist || currentIndex <= 0 }, React.createElement(Icon, { name: 'prev', size: 'sm' }), ' Prev'),
            React.createElement('div', { className: 'now-playing' },
              currentVideo 
                ? React.createElement(React.Fragment, null, 
                    React.createElement('span', { className: 'playing-label' }, playbackState === 'playing' ? '▶ Playing' : '⏸ Paused'),
                    React.createElement('span', { className: 'playing-title' }, currentVideo.title || currentVideo.url)
                  )
                : React.createElement('span', { className: 'playing-label' }, 'Nothing playing')
            ),
            React.createElement('button', { className: 'btn sm', onClick: playNext, disabled: !activePlaylist || currentIndex >= ((activePlaylist && activePlaylist.videos || []).length) - 1 }, 'Next ', React.createElement(Icon, { name: 'next', size: 'sm' }))
          ),
          React.createElement(ConnectedUsers, { users: connectedUsers, isHost: isOwner, currentUserId: visitorId, roomId: room.id, onKick: handleKick, onRename: handleRenameUser, onColorChange: handleColorChange })
        )
      )
    ),
    
    shareModalOpen && React.createElement('div', { className: 'modal-overlay', onClick: function() { setShareModalOpen(false); } },
      React.createElement('div', { className: 'modal', onClick: function(e) { e.stopPropagation(); } },
        React.createElement('button', { className: 'modal-close', onClick: function() { setShareModalOpen(false); } }, '×'),
        React.createElement('h2', null, 'Share Room'),
        React.createElement('p', null, 'Anyone with this link can join'),
        React.createElement('div', { className: 'share-link-box' },
          React.createElement('input', { value: location.origin + location.pathname + '#/room/' + hostId + '/' + room.id, readOnly: true }),
          React.createElement('button', { className: 'btn primary', onClick: copyShareLink }, 'Copy')
        )
      )
    ),
    
    settingsOpen && user && React.createElement(SettingsModal, { user: user, onClose: function() { setSettingsOpen(false); }, onUpdate: props.onUpdateUser, onLogout: props.onLogout }),
    notification && React.createElement('div', { className: 'notification ' + notification.type }, notification.message)
  );
}

// ============================================
// Main App
// ============================================
function MultiviewApp() {
  var _user = useState(null);
  var user = _user[0];
  var setUser = _user[1];
  
  var _loading = useState(true);
  var loading = _loading[0];
  var setLoading = _loading[1];
  
  var _currentView = useState('home');
  var currentView = _currentView[0];
  var setCurrentView = _currentView[1];
  
  var _currentRoom = useState(null);
  var currentRoom = _currentRoom[0];
  var setCurrentRoom = _currentRoom[1];
  
  var _roomHostId = useState(null);
  var roomHostId = _roomHostId[0];
  var setRoomHostId = _roomHostId[1];
  
  var _guestDisplayName = useState(null);
  var guestDisplayName = _guestDisplayName[0];
  var setGuestDisplayName = _guestDisplayName[1];
  
  var _showGuestModal = useState(false);
  var showGuestModal = _showGuestModal[0];
  var setShowGuestModal = _showGuestModal[1];
  
  var _showAuthScreen = useState(false);
  var showAuthScreen = _showAuthScreen[0];
  var setShowAuthScreen = _showAuthScreen[1];
  
  var _pendingRoom = useState(null);
  var pendingRoom = _pendingRoom[0];
  var setPendingRoom = _pendingRoom[1];

  useEffect(function() {
    api.auth.getCurrentUser().then(function(u) {
      if (u) setUser(u);
      var roomInfo = parseRoomUrl();
      if (roomInfo) handleJoinFromUrl(roomInfo.hostId, roomInfo.roomId, u);
    }).finally(function() { setLoading(false); });
  }, []);

  useEffect(function() {
    function handleHashChange() {
      var roomInfo = parseRoomUrl();
      if (roomInfo) handleJoinFromUrl(roomInfo.hostId, roomInfo.roomId, user);
      else if (currentView === 'room') { setCurrentView('home'); setCurrentRoom(null); }
    }
    window.addEventListener('hashchange', handleHashChange);
    return function() { window.removeEventListener('hashchange', handleHashChange); };
  }, [currentView, user]);

  function handleJoinFromUrl(hostId, roomId, currentUser) {
    api.rooms.get(roomId).then(function(room) {
      if (!room) { alert('Room not found'); location.hash = ''; return; }
      if (currentUser) {
        setCurrentRoom(room);
        setRoomHostId(hostId);
        setGuestDisplayName(currentUser.displayName);
        setCurrentView('room');
      } else {
        setPendingRoom({ room: room, hostId: hostId });
        setShowGuestModal(true);
      }
    }).catch(function(err) { alert('Failed: ' + err.message); location.hash = ''; });
  }

  function handleGuestJoin(name) {
    if (!pendingRoom) return;
    setCurrentRoom(pendingRoom.room);
    setRoomHostId(pendingRoom.hostId);
    setGuestDisplayName(name);
    setCurrentView('room');
    setShowGuestModal(false);
    setPendingRoom(null);
  }

  function handleAuthComplete(u) {
    setUser(u);
    setShowAuthScreen(false);
    if (pendingRoom) {
      setCurrentRoom(pendingRoom.room);
      setRoomHostId(pendingRoom.hostId);
      setGuestDisplayName(u.displayName);
      setCurrentView('room');
      setPendingRoom(null);
    }
  }

  function handleEnterRoom(room) {
    location.hash = '/room/' + user.id + '/' + room.id;
    setCurrentRoom(room);
    setRoomHostId(user.id);
    setGuestDisplayName(user.displayName);
    setCurrentView('room');
  }

  function handleGoHome() {
    location.hash = '';
    setCurrentView('home');
    setCurrentRoom(null);
  }

  function handleLogout() {
    api.auth.logout().then(function() {
      setUser(null);
      setCurrentView('home');
      setCurrentRoom(null);
      location.hash = '';
    });
  }

  if (loading) return React.createElement('div', { className: 'loading-screen' }, React.createElement('div', { className: 'loading-dragon' }, '🐉'), React.createElement('div', { className: 'loading-text' }, 'Loading...'));

  if (showGuestModal) return React.createElement(GuestJoinModal, { onJoin: handleGuestJoin, onLogin: function() { setShowGuestModal(false); setShowAuthScreen(true); } });

  if (showAuthScreen) return React.createElement(AuthScreen, { onAuth: handleAuthComplete });

  if (!user && currentView !== 'room') return React.createElement(AuthScreen, { onAuth: function(u) { setUser(u); var ri = parseRoomUrl(); if (ri) handleJoinFromUrl(ri.hostId, ri.roomId, u); } });

  if (currentView === 'room' && currentRoom) return React.createElement(Room, { user: user, room: currentRoom, hostId: roomHostId, guestDisplayName: guestDisplayName, onHome: user ? handleGoHome : null, onLogout: handleLogout, onUpdateUser: setUser });

  if (user) return React.createElement(HomePage, { user: user, onEnterRoom: handleEnterRoom, onLogout: handleLogout, onUpdateUser: setUser });

  return React.createElement(AuthScreen, { onAuth: setUser });
}

// Render
console.log('Multiview with YouTube IFrame API sync');
ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(MultiviewApp));

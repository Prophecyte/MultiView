// api.js - API client for Multiview.video

const API_BASE = '/api';

// Get stored auth token
const getToken = () => localStorage.getItem('mv_token');
const setToken = (token) => localStorage.setItem('mv_token', token);
const clearToken = () => localStorage.removeItem('mv_token');

// Get/set guest ID
const getGuestId = () => {
  let guestId = localStorage.getItem('mv_guest_id');
  if (!guestId) {
    guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('mv_guest_id', guestId);
  }
  return guestId;
};

// API request helper
const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
};

// ============================================
// Auth API
// ============================================
export const auth = {
  async register(email, username, password, displayName) {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password, displayName })
    });
    setToken(data.token);
    return data.user;
  },

  async login(identifier, password) {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    });
    setToken(data.token);
    return data.user;
  },

  async googleLogin(credential) {
    const data = await apiRequest('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential })
    });
    setToken(data.token);
    return data.user;
  },

  async logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      clearToken();
    }
  },

  async getCurrentUser() {
    if (!getToken()) return null;
    try {
      const data = await apiRequest('/auth/me');
      return data.user;
    } catch {
      clearToken();
      return null;
    }
  },

  isLoggedIn() {
    return !!getToken();
  },

  getGuestId
};

// ============================================
// Rooms API
// ============================================
export const rooms = {
  async list() {
    const data = await apiRequest('/rooms');
    return data.rooms;
  },

  async get(roomId) {
    const data = await apiRequest(`/rooms/${roomId}`);
    return data.room;
  },

  async create(name, description) {
    const data = await apiRequest('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name, description })
    });
    return data.room;
  },

  async update(roomId, updates) {
    const data = await apiRequest(`/rooms/${roomId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return data.room;
  },

  async delete(roomId) {
    await apiRequest(`/rooms/${roomId}`, { method: 'DELETE' });
  },

  async join(roomId, displayName) {
    const guestId = auth.isLoggedIn() ? null : getGuestId();
    await apiRequest(`/rooms/${roomId}/join`, {
      method: 'POST',
      body: JSON.stringify({ displayName, guestId })
    });
  },

  async getMembers(roomId) {
    const data = await apiRequest(`/rooms/${roomId}/members`);
    return data.members;
  },

  async kick(roomId, visitorId, guestId) {
    await apiRequest(`/rooms/${roomId}/kick`, {
      method: 'POST',
      body: JSON.stringify({ visitorId, guestId })
    });
  }
};

// ============================================
// Playlists API
// ============================================
export const playlists = {
  async list(roomId) {
    const data = await apiRequest(`/playlists?roomId=${roomId}`);
    return data.playlists;
  },

  async create(roomId, name) {
    const data = await apiRequest('/playlists', {
      method: 'POST',
      body: JSON.stringify({ roomId, name })
    });
    return data.playlist;
  },

  async update(playlistId, updates) {
    const data = await apiRequest(`/playlists/${playlistId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return data.playlist;
  },

  async delete(playlistId) {
    await apiRequest(`/playlists/${playlistId}`, { method: 'DELETE' });
  },

  async addVideo(playlistId, video) {
    const data = await apiRequest(`/playlists/${playlistId}/videos`, {
      method: 'POST',
      body: JSON.stringify(video)
    });
    return data.video;
  },

  async updateVideo(playlistId, videoId, updates) {
    const data = await apiRequest(`/playlists/${playlistId}/videos/${videoId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return data.video;
  },

  async removeVideo(playlistId, videoId) {
    await apiRequest(`/playlists/${playlistId}/videos/${videoId}`, { method: 'DELETE' });
  },

  async reorderVideos(playlistId, videoIds) {
    await apiRequest(`/playlists/${playlistId}/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ videoIds })
    });
  }
};

// ============================================
// Presence API
// ============================================
export const presence = {
  async heartbeat(roomId, status = 'online') {
    const guestId = auth.isLoggedIn() ? null : getGuestId();
    await apiRequest('/presence/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ roomId, guestId, status })
    });
  },

  async getMembers(roomId) {
    const data = await apiRequest(`/presence/${roomId}`);
    return data.members;
  },

  async leave(roomId) {
    const guestId = auth.isLoggedIn() ? null : getGuestId();
    await apiRequest('/presence/leave', {
      method: 'POST',
      body: JSON.stringify({ roomId, guestId })
    });
  },

  async updateMember(roomId, visitorId, guestId, updates) {
    await apiRequest('/presence/member', {
      method: 'PUT',
      body: JSON.stringify({ roomId, visitorId, guestId, ...updates })
    });
  }
};

// Export everything
export default { auth, rooms, playlists, presence };

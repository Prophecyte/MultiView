// netlify/functions/rooms.js
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

const getPath = (event) => {
  let path = event.path || '';
  path = path.replace('/.netlify/functions/rooms', '');
  path = path.replace('/api/rooms', '');
  if (!path.startsWith('/')) path = '/' + path;
  if (path === '/') path = '';
  return path;
};

const getUserFromToken = async (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  
  const [session] = await sql`
    SELECT u.id, u.email, u.display_name
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ${token} AND s.expires_at > NOW()
  `;
  
  return session || null;
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = getPath(event);
  const body = event.body ? JSON.parse(event.body) : {};
  const user = await getUserFromToken(event.headers.authorization || event.headers.Authorization);

  console.log('Rooms function:', event.httpMethod, path, 'User:', user?.id);

  try {
    // GET /rooms - List user's rooms
    if (event.httpMethod === 'GET' && path === '') {
      if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const rooms = await sql`
        SELECT r.id, r.name, r.description, r.is_public, r.created_at,
               (SELECT COUNT(*) FROM playlists WHERE room_id = r.id) as playlist_count
        FROM rooms r
        WHERE r.owner_id = ${user.id}
        ORDER BY r.created_at DESC
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ rooms: rooms.map(r => ({ ...r, ownerId: user.id })) })
      };
    }

    // POST /rooms - Create room
    if (event.httpMethod === 'POST' && path === '') {
      if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const { name, description, isPublic } = body;
      if (!name) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Name required' }) };
      }

      const [room] = await sql`
        INSERT INTO rooms (owner_id, name, description, is_public)
        VALUES (${user.id}, ${name}, ${description || null}, ${isPublic || false})
        RETURNING id, name, description, is_public, created_at
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ room: { ...room, ownerId: user.id } })
      };
    }

    // Extract room ID from path
    const roomMatch = path.match(/^\/([^\/]+)(\/.*)?$/);
    if (!roomMatch) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
    }

    const roomId = roomMatch[1];
    const subPath = roomMatch[2] || '';

    // GET /rooms/:id - Get room
    if (event.httpMethod === 'GET' && subPath === '') {
      const [room] = await sql`
        SELECT r.id, r.name, r.description, r.is_public, r.owner_id, r.created_at,
               u.display_name as owner_name
        FROM rooms r
        JOIN users u ON r.owner_id = u.id
        WHERE r.id = ${roomId}::uuid
      `;

      if (!room) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Room not found' }) };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ room: { ...room, ownerId: room.owner_id, ownerName: room.owner_name } })
      };
    }

    // PUT /rooms/:id - Update room
    if (event.httpMethod === 'PUT' && subPath === '') {
      if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const [room] = await sql`SELECT owner_id FROM rooms WHERE id = ${roomId}::uuid`;
      if (!room) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Room not found' }) };
      }
      if (room.owner_id !== user.id) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not your room' }) };
      }

      const { name, description, isPublic } = body;
      const [updated] = await sql`
        UPDATE rooms 
        SET name = COALESCE(${name}, name),
            description = COALESCE(${description}, description),
            is_public = COALESCE(${isPublic}, is_public)
        WHERE id = ${roomId}::uuid
        RETURNING id, name, description, is_public, created_at
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ room: { ...updated, ownerId: user.id } })
      };
    }

    // DELETE /rooms/:id - Delete room
    if (event.httpMethod === 'DELETE' && subPath === '') {
      if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const [room] = await sql`SELECT owner_id FROM rooms WHERE id = ${roomId}::uuid`;
      if (!room) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Room not found' }) };
      }
      if (room.owner_id !== user.id) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not your room' }) };
      }

      await sql`DELETE FROM rooms WHERE id = ${roomId}::uuid`;

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // POST /rooms/:id/join - Join room
    if (event.httpMethod === 'POST' && subPath === '/join') {
      const { displayName, guestId } = body;

      const [room] = await sql`SELECT id, owner_id FROM rooms WHERE id = ${roomId}::uuid`;
      if (!room) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Room not found' }) };
      }

      // Upsert room visitor - use DELETE then INSERT for reliability
      if (user) {
        // Check if exists
        const [existing] = await sql`
          SELECT id FROM room_visitors WHERE room_id = ${roomId}::uuid AND user_id = ${user.id}
        `;
        if (existing) {
          await sql`
            UPDATE room_visitors 
            SET display_name = ${displayName || user.display_name}, last_seen = NOW(), status = 'online'
            WHERE room_id = ${roomId}::uuid AND user_id = ${user.id}
          `;
        } else {
          await sql`
            INSERT INTO room_visitors (room_id, user_id, display_name, last_seen, status)
            VALUES (${roomId}::uuid, ${user.id}, ${displayName || user.display_name}, NOW(), 'online')
          `;
        }
      } else if (guestId) {
        const [existing] = await sql`
          SELECT id FROM room_visitors WHERE room_id = ${roomId}::uuid AND guest_id = ${guestId}
        `;
        if (existing) {
          await sql`
            UPDATE room_visitors 
            SET display_name = ${displayName || 'Guest'}, last_seen = NOW(), status = 'online'
            WHERE room_id = ${roomId}::uuid AND guest_id = ${guestId}
          `;
        } else {
          await sql`
            INSERT INTO room_visitors (room_id, guest_id, display_name, last_seen, status)
            VALUES (${roomId}::uuid, ${guestId}, ${displayName || 'Guest'}, NOW(), 'online')
          `;
        }
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // POST /rooms/:id/kick - Kick user
    if (event.httpMethod === 'POST' && subPath === '/kick') {
      if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const [room] = await sql`SELECT owner_id FROM rooms WHERE id = ${roomId}::uuid`;
      if (!room || room.owner_id !== user.id) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not room owner' }) };
      }

      const { visitorId, guestId } = body;
      
      if (visitorId) {
        await sql`DELETE FROM room_visitors WHERE room_id = ${roomId}::uuid AND user_id = ${visitorId}`;
      } else if (guestId) {
        await sql`DELETE FROM room_visitors WHERE room_id = ${roomId}::uuid AND guest_id = ${guestId}`;
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // GET /rooms/:id/sync - Get full room state for sync
    if (event.httpMethod === 'GET' && subPath === '/sync') {
      const [room] = await sql`
        SELECT r.id, r.name, r.owner_id, r.current_video_url, r.current_video_title, 
               r.current_playlist_id, r.playback_updated_at,
               u.display_name as owner_name
        FROM rooms r
        JOIN users u ON r.owner_id = u.id
        WHERE r.id = ${roomId}::uuid
      `;

      if (!room) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Room not found' }) };
      }

      // Get playlists with videos
      const playlists = await sql`
        SELECT p.id, p.name, p.position, p.created_at,
               COALESCE(
                 json_agg(
                   json_build_object(
                     'id', v.id,
                     'title', v.title,
                     'url', v.url,
                     'videoType', v.video_type,
                     'position', v.position
                   ) ORDER BY v.position
                 ) FILTER (WHERE v.id IS NOT NULL),
                 '[]'
               ) as videos
        FROM playlists p
        LEFT JOIN videos v ON v.playlist_id = p.id
        WHERE p.room_id = ${roomId}::uuid
        GROUP BY p.id
        ORDER BY p.position, p.created_at
      `;

      // Get members
      const members = await sql`
        SELECT rv.user_id, rv.guest_id, rv.display_name, rv.color, rv.status, rv.last_seen,
               CASE WHEN rv.user_id = ${room.owner_id} THEN true ELSE false END as is_owner
        FROM room_visitors rv
        WHERE rv.room_id = ${roomId}::uuid
          AND (rv.last_seen > NOW() - INTERVAL '60 seconds' OR rv.status = 'online')
        ORDER BY is_owner DESC, rv.display_name
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          room: {
            id: room.id,
            name: room.name,
            ownerId: room.owner_id,
            ownerName: room.owner_name,
            currentVideoUrl: room.current_video_url,
            currentVideoTitle: room.current_video_title,
            currentPlaylistId: room.current_playlist_id,
            playbackUpdatedAt: room.playback_updated_at
          },
          playlists,
          members: members.map(m => ({
            visitorId: m.user_id || m.guest_id,
            visitorUserId: m.user_id,
            guestId: m.guest_id,
            displayName: m.display_name,
            color: m.color,
            status: m.status,
            isOwner: m.is_owner,
            lastSeen: m.last_seen
          }))
        })
      };
    }

    // PUT /rooms/:id/sync - Update room playback state
    if (event.httpMethod === 'PUT' && subPath === '/sync') {
      const { currentVideoUrl, currentVideoTitle, currentPlaylistId } = body;

      await sql`
        UPDATE rooms 
        SET current_video_url = ${currentVideoUrl || null},
            current_video_title = ${currentVideoTitle || null},
            current_playlist_id = ${currentPlaylistId || null},
            playback_updated_at = NOW()
        WHERE id = ${roomId}::uuid
      `;

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };

  } catch (error) {
    console.error('Rooms error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};

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

      // Upsert room visitor
      if (user) {
        await sql`
          INSERT INTO room_visitors (room_id, user_id, display_name, last_seen, status)
          VALUES (${roomId}::uuid, ${user.id}, ${displayName || user.display_name}, NOW(), 'online')
          ON CONFLICT (room_id, user_id) WHERE user_id IS NOT NULL
          DO UPDATE SET display_name = EXCLUDED.display_name, last_seen = NOW(), status = 'online'
        `;
      } else if (guestId) {
        await sql`
          INSERT INTO room_visitors (room_id, guest_id, display_name, last_seen, status)
          VALUES (${roomId}::uuid, ${guestId}, ${displayName || 'Guest'}, NOW(), 'online')
          ON CONFLICT (room_id, guest_id) WHERE guest_id IS NOT NULL
          DO UPDATE SET display_name = EXCLUDED.display_name, last_seen = NOW(), status = 'online'
        `;
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

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };

  } catch (error) {
    console.error('Rooms error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};

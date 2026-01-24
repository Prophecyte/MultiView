// netlify/functions/rooms.js
import { neon } from '@neondatabase/serverless';

// Netlify Neon extension uses NETLIFY_DATABASE_URL
const sql = neon(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

// Helper to get user from token
const getUserFromToken = async (authHeader) => {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  
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

  const path = event.path.replace('/.netlify/functions/rooms', '');
  const body = event.body ? JSON.parse(event.body) : {};
  const user = await getUserFromToken(event.headers.authorization);

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
        body: JSON.stringify({ rooms })
      };
    }

    // GET /rooms/:id - Get single room
    if (event.httpMethod === 'GET' && path.match(/^\/[^\/]+$/)) {
      const roomId = path.substring(1);
      
      const [room] = await sql`
        SELECT r.*, u.display_name as owner_name, u.id as owner_id
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
        body: JSON.stringify({ room })
      };
    }

    // POST /rooms - Create room
    if (event.httpMethod === 'POST' && path === '') {
      if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const { name, description } = body;
      if (!name) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Name is required' }) };
      }

      const [room] = await sql`
        INSERT INTO rooms (owner_id, name, description)
        VALUES (${user.id}, ${name}, ${description || null})
        RETURNING *
      `;

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ room })
      };
    }

    // PUT /rooms/:id - Update room
    if (event.httpMethod === 'PUT' && path.match(/^\/[^\/]+$/)) {
      if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const roomId = path.substring(1);
      const { name, description, isPublic } = body;

      // Check ownership
      const [existing] = await sql`SELECT owner_id FROM rooms WHERE id = ${roomId}::uuid`;
      if (!existing || existing.owner_id !== user.id) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not authorized' }) };
      }

      const [room] = await sql`
        UPDATE rooms
        SET name = COALESCE(${name}, name),
            description = COALESCE(${description}, description),
            is_public = COALESCE(${isPublic}, is_public)
        WHERE id = ${roomId}::uuid
        RETURNING *
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ room })
      };
    }

    // DELETE /rooms/:id - Delete room
    if (event.httpMethod === 'DELETE' && path.match(/^\/[^\/]+$/)) {
      if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const roomId = path.substring(1);

      // Check ownership
      const [existing] = await sql`SELECT owner_id FROM rooms WHERE id = ${roomId}::uuid`;
      if (!existing || existing.owner_id !== user.id) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not authorized' }) };
      }

      await sql`DELETE FROM rooms WHERE id = ${roomId}::uuid`;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    // GET /rooms/:id/members - Get room members
    if (event.httpMethod === 'GET' && path.match(/^\/[^\/]+\/members$/)) {
      const roomId = path.split('/')[1];

      const members = await sql`
        SELECT rm.*, 
               CASE WHEN p.status IS NOT NULL AND p.last_seen > NOW() - INTERVAL '30 seconds' 
                    THEN p.status ELSE 'offline' END as status
        FROM room_members rm
        LEFT JOIN presence p ON rm.room_id = p.room_id 
          AND (rm.user_id = p.user_id OR rm.guest_id = p.guest_id)
        WHERE rm.room_id = ${roomId}::uuid
        ORDER BY rm.is_owner DESC, rm.display_name
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ members })
      };
    }

    // POST /rooms/:id/join - Join room
    if (event.httpMethod === 'POST' && path.match(/^\/[^\/]+\/join$/)) {
      const roomId = path.split('/')[1];
      const { displayName, guestId } = body;

      // Check if room exists
      const [room] = await sql`SELECT id, owner_id FROM rooms WHERE id = ${roomId}::uuid`;
      if (!room) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Room not found' }) };
      }

      // Check if kicked
      if (user) {
        const [kicked] = await sql`
          SELECT id FROM kicked_users 
          WHERE room_id = ${roomId}::uuid AND user_id = ${user.id}
        `;
        if (kicked) {
          return { statusCode: 403, headers, body: JSON.stringify({ error: 'You have been kicked from this room' }) };
        }
      } else if (guestId) {
        const [kicked] = await sql`
          SELECT id FROM kicked_users 
          WHERE room_id = ${roomId}::uuid AND guest_id = ${guestId}
        `;
        if (kicked) {
          return { statusCode: 403, headers, body: JSON.stringify({ error: 'You have been kicked from this room' }) };
        }
      }

      const isOwner = user && room.owner_id === user.id;
      const name = displayName || (user ? user.display_name : 'Guest');

      if (user) {
        await sql`
          INSERT INTO room_members (room_id, user_id, display_name, is_owner)
          VALUES (${roomId}::uuid, ${user.id}, ${name}, ${isOwner})
          ON CONFLICT (room_id, user_id) DO UPDATE SET display_name = ${name}
        `;
      } else if (guestId) {
        await sql`
          INSERT INTO room_members (room_id, guest_id, display_name, is_owner)
          VALUES (${roomId}::uuid, ${guestId}, ${name}, false)
          ON CONFLICT (room_id, guest_id) DO UPDATE SET display_name = ${name}
        `;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    // POST /rooms/:id/kick - Kick user from room
    if (event.httpMethod === 'POST' && path.match(/^\/[^\/]+\/kick$/)) {
      if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const roomId = path.split('/')[1];
      const { visitorId, guestId: targetGuestId } = body;

      // Check ownership
      const [room] = await sql`SELECT owner_id FROM rooms WHERE id = ${roomId}::uuid`;
      if (!room || room.owner_id !== user.id) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Only room owner can kick' }) };
      }

      // Add to kicked users
      if (visitorId) {
        await sql`
          INSERT INTO kicked_users (room_id, user_id, kicked_by)
          VALUES (${roomId}::uuid, ${visitorId}::uuid, ${user.id})
          ON CONFLICT DO NOTHING
        `;
        await sql`DELETE FROM room_members WHERE room_id = ${roomId}::uuid AND user_id = ${visitorId}::uuid`;
        await sql`DELETE FROM presence WHERE room_id = ${roomId}::uuid AND user_id = ${visitorId}::uuid`;
      } else if (targetGuestId) {
        await sql`
          INSERT INTO kicked_users (room_id, guest_id, kicked_by)
          VALUES (${roomId}::uuid, ${targetGuestId}, ${user.id})
          ON CONFLICT DO NOTHING
        `;
        await sql`DELETE FROM room_members WHERE room_id = ${roomId}::uuid AND guest_id = ${targetGuestId}`;
        await sql`DELETE FROM presence WHERE room_id = ${roomId}::uuid AND guest_id = ${targetGuestId}`;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };

  } catch (error) {
    console.error('Rooms error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

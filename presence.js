// netlify/functions/presence.js
import { neon } from '@neondatabase/serverless';

// Netlify Neon extension uses NETLIFY_DATABASE_URL
const sql = neon(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

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

  const path = event.path.replace('/.netlify/functions/presence', '');
  const body = event.body ? JSON.parse(event.body) : {};
  const user = await getUserFromToken(event.headers.authorization);

  try {
    // POST /presence/heartbeat - Update presence
    if (event.httpMethod === 'POST' && path === '/heartbeat') {
      const { roomId, guestId, status = 'online' } = body;

      if (!roomId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'roomId is required' }) };
      }

      if (user) {
        await sql`
          INSERT INTO presence (room_id, user_id, status, last_seen)
          VALUES (${roomId}::uuid, ${user.id}, ${status}, NOW())
          ON CONFLICT (room_id, user_id) 
          DO UPDATE SET status = ${status}, last_seen = NOW()
        `;
      } else if (guestId) {
        await sql`
          INSERT INTO presence (room_id, guest_id, status, last_seen)
          VALUES (${roomId}::uuid, ${guestId}, ${status}, NOW())
          ON CONFLICT (room_id, guest_id) 
          DO UPDATE SET status = ${status}, last_seen = NOW()
        `;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    // GET /presence/:roomId - Get room presence
    if (event.httpMethod === 'GET' && path.match(/^\/[^\/]+$/)) {
      const roomId = path.substring(1);

      // Get members with presence info
      const members = await sql`
        SELECT 
          rm.id,
          rm.user_id,
          rm.guest_id,
          rm.display_name,
          rm.color,
          rm.is_owner,
          CASE 
            WHEN p.last_seen > NOW() - INTERVAL '30 seconds' THEN p.status
            ELSE 'offline'
          END as status,
          p.last_seen
        FROM room_members rm
        LEFT JOIN presence p ON rm.room_id = p.room_id 
          AND (
            (rm.user_id IS NOT NULL AND rm.user_id = p.user_id) OR
            (rm.guest_id IS NOT NULL AND rm.guest_id = p.guest_id)
          )
        WHERE rm.room_id = ${roomId}::uuid
        ORDER BY rm.is_owner DESC, rm.display_name
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ members })
      };
    }

    // POST /presence/leave - Leave room
    if (event.httpMethod === 'POST' && path === '/leave') {
      const { roomId, guestId } = body;

      if (!roomId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'roomId is required' }) };
      }

      if (user) {
        await sql`
          UPDATE presence SET status = 'offline', last_seen = NOW()
          WHERE room_id = ${roomId}::uuid AND user_id = ${user.id}
        `;
      } else if (guestId) {
        await sql`
          UPDATE presence SET status = 'offline', last_seen = NOW()
          WHERE room_id = ${roomId}::uuid AND guest_id = ${guestId}
        `;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    // PUT /presence/member - Update member info (name, color)
    if (event.httpMethod === 'PUT' && path === '/member') {
      const { roomId, visitorId, guestId: targetGuestId, displayName, color } = body;

      if (!roomId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'roomId is required' }) };
      }

      if (visitorId) {
        await sql`
          UPDATE room_members 
          SET display_name = COALESCE(${displayName}, display_name),
              color = ${color}
          WHERE room_id = ${roomId}::uuid AND user_id = ${visitorId}::uuid
        `;
      } else if (targetGuestId) {
        await sql`
          UPDATE room_members 
          SET display_name = COALESCE(${displayName}, display_name),
              color = ${color}
          WHERE room_id = ${roomId}::uuid AND guest_id = ${targetGuestId}
        `;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    // Cleanup old presence data (can be called periodically)
    if (event.httpMethod === 'POST' && path === '/cleanup') {
      // Remove presence older than 1 hour
      await sql`DELETE FROM presence WHERE last_seen < NOW() - INTERVAL '1 hour'`;

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
    console.error('Presence error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

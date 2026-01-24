// netlify/functions/playlists.js
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

  const path = event.path.replace('/.netlify/functions/playlists', '');
  const body = event.body ? JSON.parse(event.body) : {};
  const user = await getUserFromToken(event.headers.authorization);

  try {
    // GET /playlists?roomId=xxx - List playlists for a room
    if (event.httpMethod === 'GET' && path === '') {
      const roomId = event.queryStringParameters?.roomId;
      if (!roomId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'roomId is required' }) };
      }

      const playlists = await sql`
        SELECT p.*, 
               (SELECT COUNT(*) FROM videos WHERE playlist_id = p.id) as video_count,
               json_agg(
                 json_build_object(
                   'id', v.id,
                   'title', v.title,
                   'url', v.url,
                   'videoType', v.video_type,
                   'thumbnailUrl', v.thumbnail_url,
                   'duration', v.duration,
                   'position', v.position
                 ) ORDER BY v.position
               ) FILTER (WHERE v.id IS NOT NULL) as videos
        FROM playlists p
        LEFT JOIN videos v ON v.playlist_id = p.id
        WHERE p.room_id = ${roomId}::uuid
        GROUP BY p.id
        ORDER BY p.position, p.created_at
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ playlists })
      };
    }

    // POST /playlists - Create playlist
    if (event.httpMethod === 'POST' && path === '') {
      const { roomId, name } = body;
      
      if (!roomId || !name) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'roomId and name are required' }) };
      }

      // Check if user owns room (if logged in)
      if (user) {
        const [room] = await sql`SELECT owner_id FROM rooms WHERE id = ${roomId}::uuid`;
        if (!room || room.owner_id !== user.id) {
          return { statusCode: 403, headers, body: JSON.stringify({ error: 'Only room owner can create playlists' }) };
        }
      }

      // Get max position
      const [maxPos] = await sql`SELECT COALESCE(MAX(position), -1) + 1 as pos FROM playlists WHERE room_id = ${roomId}::uuid`;

      const [playlist] = await sql`
        INSERT INTO playlists (room_id, name, position)
        VALUES (${roomId}::uuid, ${name}, ${maxPos.pos})
        RETURNING *
      `;

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ playlist: { ...playlist, videos: [] } })
      };
    }

    // PUT /playlists/:id - Update playlist
    if (event.httpMethod === 'PUT' && path.match(/^\/[^\/]+$/)) {
      const playlistId = path.substring(1);
      const { name, position } = body;

      const [playlist] = await sql`
        UPDATE playlists
        SET name = COALESCE(${name}, name),
            position = COALESCE(${position}, position)
        WHERE id = ${playlistId}::uuid
        RETURNING *
      `;

      if (!playlist) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Playlist not found' }) };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ playlist })
      };
    }

    // DELETE /playlists/:id - Delete playlist
    if (event.httpMethod === 'DELETE' && path.match(/^\/[^\/]+$/)) {
      const playlistId = path.substring(1);

      await sql`DELETE FROM playlists WHERE id = ${playlistId}::uuid`;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    // POST /playlists/:id/videos - Add video to playlist
    if (event.httpMethod === 'POST' && path.match(/^\/[^\/]+\/videos$/)) {
      const playlistId = path.split('/')[1];
      const { title, url, videoType, thumbnailUrl, duration } = body;

      if (!title || !url || !videoType) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'title, url, and videoType are required' }) };
      }

      // Get max position
      const [maxPos] = await sql`SELECT COALESCE(MAX(position), -1) + 1 as pos FROM videos WHERE playlist_id = ${playlistId}::uuid`;

      const [video] = await sql`
        INSERT INTO videos (playlist_id, title, url, video_type, thumbnail_url, duration, position, added_by)
        VALUES (${playlistId}::uuid, ${title}, ${url}, ${videoType}, ${thumbnailUrl || null}, ${duration || null}, ${maxPos.pos}, ${user?.id || null})
        RETURNING *
      `;

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ video })
      };
    }

    // PUT /playlists/:playlistId/videos/:videoId - Update video
    if (event.httpMethod === 'PUT' && path.match(/^\/[^\/]+\/videos\/[^\/]+$/)) {
      const parts = path.split('/');
      const videoId = parts[3];
      const { title, position } = body;

      const [video] = await sql`
        UPDATE videos
        SET title = COALESCE(${title}, title),
            position = COALESCE(${position}, position)
        WHERE id = ${videoId}::uuid
        RETURNING *
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ video })
      };
    }

    // DELETE /playlists/:playlistId/videos/:videoId - Remove video
    if (event.httpMethod === 'DELETE' && path.match(/^\/[^\/]+\/videos\/[^\/]+$/)) {
      const parts = path.split('/');
      const videoId = parts[3];

      await sql`DELETE FROM videos WHERE id = ${videoId}::uuid`;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    // PUT /playlists/:id/reorder - Reorder videos
    if (event.httpMethod === 'PUT' && path.match(/^\/[^\/]+\/reorder$/)) {
      const playlistId = path.split('/')[1];
      const { videoIds } = body; // Array of video IDs in new order

      if (!Array.isArray(videoIds)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'videoIds array is required' }) };
      }

      // Update positions
      for (let i = 0; i < videoIds.length; i++) {
        await sql`UPDATE videos SET position = ${i} WHERE id = ${videoIds[i]}::uuid AND playlist_id = ${playlistId}::uuid`;
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
    console.error('Playlists error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

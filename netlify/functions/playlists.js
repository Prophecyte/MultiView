// netlify/functions/playlists.js
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
  path = path.replace('/.netlify/functions/playlists', '');
  path = path.replace('/api/playlists', '');
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
  const query = event.queryStringParameters || {};

  console.log('Playlists function:', event.httpMethod, path);

  try {
    // GET /playlists?roomId=xxx - List playlists for room
    if (event.httpMethod === 'GET' && path === '') {
      const roomId = query.roomId;
      if (!roomId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'roomId required' }) };
      }

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

      return { statusCode: 200, headers, body: JSON.stringify({ playlists }) };
    }

    // POST /playlists - Create playlist
    if (event.httpMethod === 'POST' && path === '') {
      const { roomId, name } = body;
      
      if (!roomId || !name) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'roomId and name required' }) };
      }

      // Get max position
      const [maxPos] = await sql`SELECT COALESCE(MAX(position), -1) + 1 as pos FROM playlists WHERE room_id = ${roomId}::uuid`;

      const [playlist] = await sql`
        INSERT INTO playlists (room_id, name, position)
        VALUES (${roomId}::uuid, ${name}, ${maxPos.pos})
        RETURNING id, name, position, created_at
      `;

      return { statusCode: 200, headers, body: JSON.stringify({ playlist: { ...playlist, videos: [] } }) };
    }

    // Extract playlist ID from path
    const playlistMatch = path.match(/^\/([^\/]+)(\/.*)?$/);
    if (!playlistMatch) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
    }

    const playlistId = playlistMatch[1];
    const subPath = playlistMatch[2] || '';

    // PUT /playlists/:id - Update playlist
    if (event.httpMethod === 'PUT' && subPath === '') {
      const { name } = body;

      const [playlist] = await sql`
        UPDATE playlists SET name = COALESCE(${name}, name)
        WHERE id = ${playlistId}::uuid
        RETURNING id, name, position, created_at
      `;

      if (!playlist) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Playlist not found' }) };
      }

      return { statusCode: 200, headers, body: JSON.stringify({ playlist }) };
    }

    // DELETE /playlists/:id - Delete playlist
    if (event.httpMethod === 'DELETE' && subPath === '') {
      await sql`DELETE FROM playlists WHERE id = ${playlistId}::uuid`;
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // POST /playlists/:id/videos - Add video
    if (event.httpMethod === 'POST' && subPath === '/videos') {
      const { title, url, videoType } = body;

      if (!url) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'url required' }) };
      }

      const [maxPos] = await sql`SELECT COALESCE(MAX(position), -1) + 1 as pos FROM videos WHERE playlist_id = ${playlistId}::uuid`;

      const [video] = await sql`
        INSERT INTO videos (playlist_id, title, url, video_type, position)
        VALUES (${playlistId}::uuid, ${title || url}, ${url}, ${videoType || 'youtube'}, ${maxPos.pos})
        RETURNING id, title, url, video_type as "videoType", position
      `;

      return { statusCode: 200, headers, body: JSON.stringify({ video }) };
    }

    // DELETE /playlists/:id/videos/:videoId - Remove video
    const videoMatch = subPath.match(/^\/videos\/([^\/]+)$/);
    if (event.httpMethod === 'DELETE' && videoMatch) {
      const videoId = videoMatch[1];
      await sql`DELETE FROM videos WHERE id = ${videoId}::uuid AND playlist_id = ${playlistId}::uuid`;
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // PUT /playlists/:id/reorder - Reorder videos
    if (event.httpMethod === 'PUT' && subPath === '/reorder') {
      const { videoIds } = body;

      if (!Array.isArray(videoIds)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'videoIds array required' }) };
      }

      for (let i = 0; i < videoIds.length; i++) {
        await sql`UPDATE videos SET position = ${i} WHERE id = ${videoIds[i]}::uuid AND playlist_id = ${playlistId}::uuid`;
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };

  } catch (error) {
    console.error('Playlists error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};

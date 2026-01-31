import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB limit for database storage

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
};

// Get user from session token
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

// Allowed file types
const ALLOWED_TYPES = {
  // Video
  'video/mp4': { ext: 'mp4', category: 'video' },
  'video/webm': { ext: 'webm', category: 'video' },
  'video/ogg': { ext: 'ogv', category: 'video' },
  'video/quicktime': { ext: 'mov', category: 'video' },
  // Audio
  'audio/mpeg': { ext: 'mp3', category: 'audio' },
  'audio/mp3': { ext: 'mp3', category: 'audio' },
  'audio/wav': { ext: 'wav', category: 'audio' },
  'audio/x-wav': { ext: 'wav', category: 'audio' },
  'audio/mp4': { ext: 'm4a', category: 'audio' },
  'audio/x-m4a': { ext: 'm4a', category: 'audio' },
  'audio/ogg': { ext: 'ogg', category: 'audio' },
  'audio/flac': { ext: 'flac', category: 'audio' },
  'audio/aac': { ext: 'aac', category: 'audio' },
  'audio/webm': { ext: 'webm', category: 'audio' }
};

// Parse multipart form data
function parseMultipart(body, contentType) {
  const boundary = contentType.split('boundary=')[1];
  if (!boundary) return null;
  
  const parts = body.split('--' + boundary);
  const result = { fields: {}, file: null };
  
  for (const part of parts) {
    if (part.includes('Content-Disposition')) {
      const nameMatch = part.match(/name="([^"]+)"/);
      const filenameMatch = part.match(/filename="([^"]+)"/);
      
      if (nameMatch) {
        const name = nameMatch[1];
        
        // Find the content (after double newline)
        const contentStart = part.indexOf('\r\n\r\n');
        if (contentStart === -1) continue;
        
        let content = part.slice(contentStart + 4);
        // Remove trailing \r\n
        if (content.endsWith('\r\n')) {
          content = content.slice(0, -2);
        }
        
        if (filenameMatch) {
          // This is a file
          const contentTypeMatch = part.match(/Content-Type:\s*([^\r\n]+)/);
          result.file = {
            name: name,
            filename: filenameMatch[1],
            contentType: contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream',
            data: content
          };
        } else {
          // This is a field
          result.fields[name] = content.trim();
        }
      }
    }
  }
  
  return result;
}

export const handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Get user from token (optional - guests can upload too)
  const user = await getUserFromToken(event.headers.authorization || event.headers.Authorization);

  const path = event.path.replace('/.netlify/functions/files', '').replace('/api/files', '');

  try {
    // GET /files/:fileId - Download/stream a file
    const fileMatch = path.match(/^\/([a-zA-Z0-9_-]+)$/);
    if (event.httpMethod === 'GET' && fileMatch) {
      const fileId = fileMatch[1];
      
      // Get file from database
      const [file] = await sql`
        SELECT id, filename, content_type, data, category
        FROM uploaded_files
        WHERE id = ${fileId}
      `;
      
      if (!file) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'File not found' }) };
      }
      
      // Return file with appropriate content type
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': file.content_type || 'application/octet-stream',
          'Content-Disposition': `inline; filename="${file.filename || fileId}"`,
          'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
        },
        body: file.data, // Already base64 encoded
        isBase64Encoded: true
      };
    }

    // POST /files - Upload a file
    if (event.httpMethod === 'POST' && path === '') {
      const contentType = event.headers['content-type'] || event.headers['Content-Type'];
      
      if (!contentType || !contentType.includes('multipart/form-data')) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Content-Type must be multipart/form-data' }) };
      }
      
      // Decode body if base64
      let body = event.body;
      if (event.isBase64Encoded) {
        body = Buffer.from(body, 'base64').toString('binary');
      }
      
      // Parse multipart data
      const parsed = parseMultipart(body, contentType);
      if (!parsed || !parsed.file) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'No file provided' }) };
      }
      
      const { file, fields } = parsed;
      const roomId = fields.roomId;
      
      if (!roomId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'roomId required' }) };
      }
      
      // Check file type
      const typeInfo = ALLOWED_TYPES[file.contentType];
      if (!typeInfo) {
        return { 
          statusCode: 400, 
          headers, 
          body: JSON.stringify({ 
            error: 'File type not allowed. Supported: mp4, webm, mp3, wav, m4a, ogg, flac' 
          }) 
        };
      }
      
      // Convert to base64 for storage
      const fileBuffer = Buffer.from(file.data, 'binary');
      const base64Data = fileBuffer.toString('base64');
      
      // Check file size
      if (fileBuffer.length > MAX_FILE_SIZE) {
        return { 
          statusCode: 400, 
          headers, 
          body: JSON.stringify({ error: 'File too large. Maximum size is 25MB.' }) 
        };
      }
      
      // Generate unique file ID
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 10);
      const fileId = `${timestamp}_${random}`;
      
      // Store file in database
      await sql`
        INSERT INTO uploaded_files (id, room_id, filename, content_type, category, data, size, uploaded_by)
        VALUES (${fileId}, ${roomId}::uuid, ${file.filename}, ${file.contentType}, ${typeInfo.category}, ${base64Data}, ${fileBuffer.length}, ${user ? user.id : null})
      `;
      
      // Build the URL for accessing the file
      const fileUrl = `/.netlify/functions/files/${fileId}?type=${typeInfo.category}`;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          fileId: fileId,
          url: fileUrl,
          filename: file.filename,
          contentType: file.contentType,
          category: typeInfo.category,
          size: fileBuffer.length
        })
      };
    }

    // DELETE /files/:fileId - Delete a file
    if (event.httpMethod === 'DELETE' && fileMatch) {
      const fileId = fileMatch[1];
      
      await sql`DELETE FROM uploaded_files WHERE id = ${fileId}`;
      
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };

  } catch (error) {
    console.error('Files error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Server error' }) };
  }
};

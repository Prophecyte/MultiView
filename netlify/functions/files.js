import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);

const MAX_FILE_SIZE = 25 * 1024 * 1024; 

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
};

// Get user from session token
const getUserFromToken = async (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.replace('Bearer ', '');
    
    const [session] = await sql`
      SELECT u.id, u.email, u.display_name
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ${token} AND s.expires_at > NOW()
    `;
    
    return session || null;
  } catch (e) {
    console.error('Token validation error:', e);
    return null;
  }
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

// Parse multipart form data (handles binary data properly)
function parseMultipart(bodyBuffer, contentType) {
  try {
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
    if (!boundaryMatch) return null;
    const boundary = boundaryMatch[1] || boundaryMatch[2];
    
    const boundaryBuffer = Buffer.from('--' + boundary);
    const result = { fields: {}, file: null };
    
    // Find all boundary positions
    let pos = 0;
    const parts = [];
    
    while (pos < bodyBuffer.length) {
      const boundaryPos = bodyBuffer.indexOf(boundaryBuffer, pos);
      if (boundaryPos === -1) break;
      
      if (parts.length > 0) {
        // End of previous part (excluding \r\n before boundary)
        const partEnd = boundaryPos - 2;
        if (partEnd > parts[parts.length - 1]) {
          parts[parts.length - 1] = { start: parts[parts.length - 1], end: partEnd };
        }
      }
      
      // Start of new part (after boundary and \r\n)
      const partStart = boundaryPos + boundaryBuffer.length + 2;
      parts.push(partStart);
      pos = partStart;
    }
    
    // Process each part
    for (const part of parts) {
      if (typeof part !== 'object') continue;
      
      const partBuffer = bodyBuffer.slice(part.start, part.end);
      const headerEnd = partBuffer.indexOf(Buffer.from('\r\n\r\n'));
      if (headerEnd === -1) continue;
      
      const headerStr = partBuffer.slice(0, headerEnd).toString('utf8');
      const contentBuffer = partBuffer.slice(headerEnd + 4);
      
      const nameMatch = headerStr.match(/name="([^"]+)"/);
      if (!nameMatch) continue;
      
      const name = nameMatch[1];
      const filenameMatch = headerStr.match(/filename="([^"]+)"/);
      
      if (filenameMatch) {
        // This is a file
        const ctMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
        result.file = {
          name: name,
          filename: filenameMatch[1],
          contentType: ctMatch ? ctMatch[1].trim() : 'application/octet-stream',
          buffer: contentBuffer
        };
      } else {
        // This is a field
        result.fields[name] = contentBuffer.toString('utf8').trim();
      }
    }
    
    return result;
  } catch (e) {
    console.error('Multipart parse error:', e);
    return null;
  }
}

export const handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

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
          'Cache-Control': 'public, max-age=31536000'
        },
        body: file.data,
        isBase64Encoded: true
      };
    }

    // POST /files - Upload a file
    if (event.httpMethod === 'POST' && path === '') {
      const contentType = event.headers['content-type'] || event.headers['Content-Type'];
      
      if (!contentType || !contentType.includes('multipart/form-data')) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Content-Type must be multipart/form-data' }) };
      }
      
      // Get user (optional)
      const user = await getUserFromToken(event.headers.authorization || event.headers.Authorization);
      
      // Convert body to buffer
      let bodyBuffer;
      if (event.isBase64Encoded) {
        bodyBuffer = Buffer.from(event.body, 'base64');
      } else {
        bodyBuffer = Buffer.from(event.body, 'binary');
      }
      
      // Parse multipart data
      const parsed = parseMultipart(bodyBuffer, contentType);
      if (!parsed || !parsed.file) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'No file provided or parse error' }) };
      }
      
      const { file, fields } = parsed;
      const roomId = fields.roomId;
      
      if (!roomId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'roomId required' }) };
      }
      
      // Check file type
      let typeInfo = ALLOWED_TYPES[file.contentType];
      
      // Fallback: check by file extension if MIME type not recognized
      if (!typeInfo) {
        const ext = file.filename.split('.').pop().toLowerCase();
        const extMap = { mp3: 'audio', wav: 'audio', m4a: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio', mp4: 'video', webm: 'video', ogv: 'video', mov: 'video' };
        if (extMap[ext]) {
          typeInfo = { ext: ext, category: extMap[ext] };
        }
      }
      
      if (!typeInfo) {
        return { 
          statusCode: 400, 
          headers, 
          body: JSON.stringify({ 
            error: `File type "${file.contentType}" not allowed. Supported: mp4, webm, mp3, wav, m4a, ogg, flac` 
          }) 
        };
      }
      
      // Check file size
      if (file.buffer.length > MAX_FILE_SIZE) {
        return { 
          statusCode: 400, 
          headers, 
          body: JSON.stringify({ error: `File too large (${(file.buffer.length / 1024 / 1024).toFixed(1)}MB). Maximum size is 4MB.` }) 
        };
      }
      
      // Convert to base64 for storage
      const base64Data = file.buffer.toString('base64');
      
      // Generate unique file ID
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 10);
      const fileId = `${timestamp}_${random}`;
      
      // Store file in database
      await sql`
        INSERT INTO uploaded_files (id, room_id, filename, content_type, category, data, size, uploaded_by)
        VALUES (${fileId}, ${roomId}::uuid, ${file.filename}, ${file.contentType}, ${typeInfo.category}, ${base64Data}, ${file.buffer.length}, ${user ? user.id : null})
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
          size: file.buffer.length
        })
      };
    }

    // DELETE /files/:fileId - Delete a file
    const deleteMatch = path.match(/^\/([a-zA-Z0-9_-]+)$/);
    if (event.httpMethod === 'DELETE' && deleteMatch) {
      const fileId = deleteMatch[1];
      
      await sql`DELETE FROM uploaded_files WHERE id = ${fileId}`;
      
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };

  } catch (error) {
    console.error('Files error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Server error', details: error.toString() }) };
  }
};

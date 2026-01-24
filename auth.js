// netlify/functions/auth.js
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';

// Netlify Neon extension uses NETLIFY_DATABASE_URL
const sql = neon(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);

// Generate a random token
const generateToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

export const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/auth', '');
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    // POST /auth/register
    if (event.httpMethod === 'POST' && path === '/register') {
      const { email, username, password, displayName } = body;

      if (!email || !password || !displayName) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email, password, and display name are required' })
        };
      }

      // Check if user exists
      const existing = await sql`SELECT id FROM users WHERE email = ${email} OR username = ${username}`;
      if (existing.length > 0) {
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({ error: 'User already exists' })
        };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const [user] = await sql`
        INSERT INTO users (email, username, display_name, password_hash, auth_provider)
        VALUES (${email}, ${username || null}, ${displayName}, ${passwordHash}, 'email')
        RETURNING id, email, username, display_name, avatar_url, created_at
      `;

      // Create session
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await sql`
        INSERT INTO sessions (user_id, token, expires_at)
        VALUES (${user.id}, ${token}, ${expiresAt})
      `;

      // Create default room
      await sql`
        INSERT INTO rooms (owner_id, name)
        VALUES (${user.id}, 'My Room')
      `;

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            displayName: user.display_name,
            avatarUrl: user.avatar_url
          },
          token
        })
      };
    }

    // POST /auth/login
    if (event.httpMethod === 'POST' && path === '/login') {
      const { identifier, password } = body;

      if (!identifier || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email/username and password are required' })
        };
      }

      // Find user
      const [user] = await sql`
        SELECT id, email, username, display_name, password_hash, avatar_url
        FROM users
        WHERE (email = ${identifier} OR username = ${identifier})
          AND auth_provider = 'email'
      `;

      if (!user || !user.password_hash) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid credentials' })
        };
      }

      // Verify password
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid credentials' })
        };
      }

      // Create session
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await sql`
        INSERT INTO sessions (user_id, token, expires_at)
        VALUES (${user.id}, ${token}, ${expiresAt})
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            displayName: user.display_name,
            avatarUrl: user.avatar_url
          },
          token
        })
      };
    }

    // POST /auth/google
    if (event.httpMethod === 'POST' && path === '/google') {
      const { credential } = body;

      if (!credential) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Google credential required' })
        };
      }

      // Verify Google token
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID
      });

      const payload = ticket.getPayload();
      const { sub: googleId, email, name, picture } = payload;

      // Check if user exists
      let [user] = await sql`
        SELECT id, email, username, display_name, avatar_url
        FROM users
        WHERE google_id = ${googleId} OR email = ${email}
      `;

      if (!user) {
        // Create new user
        [user] = await sql`
          INSERT INTO users (email, display_name, avatar_url, auth_provider, google_id)
          VALUES (${email}, ${name}, ${picture}, 'google', ${googleId})
          RETURNING id, email, username, display_name, avatar_url
        `;

        // Create default room
        await sql`
          INSERT INTO rooms (owner_id, name)
          VALUES (${user.id}, 'My Room')
        `;
      } else if (!user.google_id) {
        // Link Google to existing account
        await sql`
          UPDATE users SET google_id = ${googleId}, avatar_url = COALESCE(avatar_url, ${picture})
          WHERE id = ${user.id}
        `;
      }

      // Create session
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await sql`
        INSERT INTO sessions (user_id, token, expires_at)
        VALUES (${user.id}, ${token}, ${expiresAt})
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            displayName: user.display_name,
            avatarUrl: user.avatar_url
          },
          token
        })
      };
    }

    // POST /auth/logout
    if (event.httpMethod === 'POST' && path === '/logout') {
      const authHeader = event.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        await sql`DELETE FROM sessions WHERE token = ${token}`;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    // GET /auth/me - Get current user from token
    if (event.httpMethod === 'GET' && path === '/me') {
      const authHeader = event.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'No token provided' })
        };
      }

      const token = authHeader.substring(7);
      const [session] = await sql`
        SELECT s.user_id, s.expires_at, u.id, u.email, u.username, u.display_name, u.avatar_url
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ${token} AND s.expires_at > NOW()
      `;

      if (!session) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid or expired token' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          user: {
            id: session.id,
            email: session.email,
            username: session.username,
            displayName: session.display_name,
            avatarUrl: session.avatar_url
          }
        })
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };

  } catch (error) {
    console.error('Auth error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

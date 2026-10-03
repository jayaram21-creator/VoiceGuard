import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { signToken } from '../utils/jwt.js';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 10;

function toSafeUser(row) {
  return { id: row.id, username: row.username, email: row.email };
}

export function register(req, res) {
  const { username, email, password } = req.body || {};

  if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'username, email, and password are required' });
  }

  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (!USERNAME_RE.test(cleanUsername)) {
    return res
      .status(400)
      .json({ error: 'Username must be 3-20 characters: letters, numbers, or underscores' });
  }
  if (!EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
    .get(cleanUsername, cleanEmail);
  if (existing) {
    return res.status(409).json({ error: 'Username or email is already registered' });
  }

  const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);

  let result;
  try {
    result = db
      .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
      .run(cleanUsername, cleanEmail, passwordHash);
  } catch (err) {
    // Race condition guard: two requests could both pass the SELECT check
    // above before either INSERT commits. The UNIQUE constraints on
    // username/email are the real source of truth.
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Username or email is already registered' });
    }
    throw err;
  }

  const user = db
    .prepare('SELECT id, username, email FROM users WHERE id = ?')
    .get(result.lastInsertRowid);

  const token = signToken({ userId: user.id });

  return res.status(201).json({ token, user });
}

export function login(req, res) {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);

  // Deliberately the same generic error whether the email doesn't exist
  // or the password is wrong, so responses never reveal which one failed.
  const invalidCredentials = () => res.status(401).json({ error: 'Invalid email or password' });

  if (!row) {
    return invalidCredentials();
  }

  const passwordMatches = bcrypt.compareSync(password, row.password_hash);
  if (!passwordMatches) {
    return invalidCredentials();
  }

  const token = signToken({ userId: row.id });
  return res.json({ token, user: toSafeUser(row) });
}

export function me(req, res) {
  const row = db.prepare('SELECT id, username, email FROM users WHERE id = ?').get(req.userId);
  if (!row) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({ user: row });
}

export function logout(_req, res) {
  // JWTs are stateless: there is no server-side session to invalidate.
  // The client is responsible for discarding its stored token; this
  // endpoint exists only so the frontend has something to call.
  return res.status(200).json({ message: 'Logged out. Discard the token on the client.' });
}

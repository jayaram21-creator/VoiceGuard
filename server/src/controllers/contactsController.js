import { db } from '../db/index.js';
import { isUserOnline } from '../socket/presence.js';

export function getContacts(req, res) {
  const userId = req.userId;

  const rows = db
    .prepare(
      `
    SELECT u.id, u.username, u.email, c.created_at as added_at
    FROM contacts c
    JOIN users u ON c.contact_id = u.id
    WHERE c.user_id = ?
    ORDER BY u.username ASC
  `
    )
    .all(userId);

  const contacts = rows.map((row) => ({
    id: row.id,
    username: row.username,
    email: row.email,
    addedAt: row.added_at,
    isOnline: isUserOnline(row.id),
  }));

  return res.json({ contacts });
}

export function addContact(req, res) {
  const userId = req.userId;
  const { username, contactId } = req.body || {};

  let targetUser = null;

  if (contactId) {
    targetUser = db.prepare('SELECT id, username, email FROM users WHERE id = ?').get(Number(contactId));
  } else if (typeof username === 'string' && username.trim()) {
    targetUser = db
      .prepare('SELECT id, username, email FROM users WHERE username = ? COLLATE NOCASE')
      .get(username.trim());
  }

  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (targetUser.id === userId) {
    return res.status(400).json({ error: 'You cannot add yourself as a contact' });
  }

  try {
    db.prepare('INSERT INTO contacts (user_id, contact_id) VALUES (?, ?)').run(userId, targetUser.id);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(409).json({ error: 'Contact already in your list' });
    }
    throw err;
  }

  return res.status(201).json({
    message: 'Contact added successfully',
    contact: {
      id: targetUser.id,
      username: targetUser.username,
      email: targetUser.email,
      isOnline: isUserOnline(targetUser.id),
    },
  });
}

export function deleteContact(req, res) {
  const userId = req.userId;
  const contactId = Number(req.params.id);

  if (!contactId) {
    return res.status(400).json({ error: 'Invalid contact ID' });
  }

  const result = db
    .prepare('DELETE FROM contacts WHERE user_id = ? AND contact_id = ?')
    .run(userId, contactId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Contact not found in your list' });
  }

  return res.json({ message: 'Contact removed successfully' });
}

export function searchUsers(req, res) {
  const userId = req.userId;
  const query = (req.query.q || '').trim();

  if (!query || query.length < 1) {
    return res.json({ users: [] });
  }

  const searchTerm = `%${query}%`;
  const rows = db
    .prepare(
      `
    SELECT id, username, email
    FROM users
    WHERE (username LIKE ? OR email LIKE ?) AND id != ?
    LIMIT 10
  `
    )
    .all(searchTerm, searchTerm, userId);

  const users = rows.map((row) => ({
    id: row.id,
    username: row.username,
    email: row.email,
    isOnline: isUserOnline(row.id),
  }));

  return res.json({ users });
}

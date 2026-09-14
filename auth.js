const jwt = require('jsonwebtoken');
const { query } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_TOPGEAR_SECRET';

function signUser(user) {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '12h' });
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Nicht angemeldet' });
    const payload = jwt.verify(token, JWT_SECRET);
    const result = await query(
      'SELECT id, username, display_name, rank, software_role, online, created_at FROM members WHERE id = $1',
      [payload.id]
    );
    if (!result.rowCount) return res.status(401).json({ error: 'Benutzer nicht gefunden' });
    req.user = result.rows[0];
    next();
  } catch {
    res.status(401).json({ error: 'Ungültiges oder abgelaufenes Login' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.software_role !== 'Administrator') {
    return res.status(403).json({ error: 'Administrator erforderlich' });
  }
  next();
}

function requireRank(minRank) {
  return (req, res, next) => {
    if (!req.user || req.user.rank < minRank) {
      return res.status(403).json({ error: `Rang ${minRank} erforderlich` });
    }
    next();
  };
}

module.exports = { signUser, requireAuth, requireAdmin, requireRank };

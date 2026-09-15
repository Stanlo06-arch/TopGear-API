const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'topgear-development-secret-change-this';

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      name: user.name,
      rank: user.rank,
      software_role: user.software_role
    },
    JWT_SECRET,
    {
      expiresIn: '7d'
    }
  );
}

function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || '';

    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentifizierung erforderlich'
      });
    }

    const token = header.substring(7);

    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;

    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Ungültiges oder abgelaufenes Token'
    });
  }
}

module.exports = {
  signToken,
  authRequired
};

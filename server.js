const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
const { authRequired } = require('./auth');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'TopGear API',
    time: new Date().toISOString()
  });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/members', require('./routes/members'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/colors', require('./routes/colors'));
app.use('/api/search', require('./routes/search'));

app.get('/api/me', authRequired, (req, res) => {
  res.json(req.user);
});

const PORT = Number(process.env.PORT) || 3000;

initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`TopGear API läuft auf Port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error(
      'Datenbank-Initialisierung fehlgeschlagen:',
      err
    );
    process.exit(1);
  });

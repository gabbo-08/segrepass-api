require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Router Modules
const authRoutes = require('./routes/auth');
const careerRoutes = require('./routes/career');
const sessionRoutes = require('./routes/session');
const profileRoutes = require('./routes/profile');
const careerPlanRoutes = require('./routes/career-plan');
const studyPlanRoutes = require('./routes/study-plans');
const timetableRoutes = require('./routes/timetable');
const careerTaxesRoutes = require('./routes/career-taxes');
const docentiRoutes = require('./routes/docenti');

const authModule = require('./middleware/auth');
const authMiddleware = authModule.authMiddleware || authModule;

require('./db');
const { initCluster, closeCluster } = require('./scraper/pool'); // Nuovo import

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Fondamentale per l'accesso in rete locale/produzione

app.use(helmet());

const frontendOrigins = [...new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL
].filter(Boolean))];

app.use(cors({ origin: frontendOrigins }));
app.use(express.json());
app.use(rateLimit({ windowMs: 60 * 1000, max: 100, message: { error: 'Troppe richieste.' } }));

app.use('/api/session', sessionRoutes);
app.use('/api/auth', authRoutes);

app.use('/api/profile', authMiddleware, profileRoutes);
app.use('/api/career', authMiddleware, careerPlanRoutes);
app.use('/api/career', authMiddleware, careerTaxesRoutes);
app.use('/api/study-plans', authMiddleware, studyPlanRoutes);
app.use('/api/timetable', authMiddleware, timetableRoutes);
app.use('/api/docenti', authMiddleware, docentiRoutes);
app.use('/api', authMiddleware, careerRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Errore interno' });
});

// Sequenza di Avvio Integrata
const server = app.listen(PORT, HOST, async () => {
  console.log(`[System] API attive su http://${HOST}:${PORT}`);
  try {
    await initCluster(); // Alloca i processi Chromium prima di accettare richieste pesanti
  } catch (error) {
    console.error('[System] Fallimento critico avvio cluster:', error);
    process.exit(1);
  }
});

// Graceful Shutdown: evita processi zombie se arresti il server (Ctrl+C)
const gracefulShutdown = async () => {
  console.log('\n[System] Inizio procedura di spegnimento sicuro...');
  await closeCluster();
  server.close(() => {
    console.log('[System] Server HTTP chiuso. Terminazione processo Node.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
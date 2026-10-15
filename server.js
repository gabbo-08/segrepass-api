require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const authRoutes   = require('./routes/auth');
const careerRoutes = require('./routes/career');
const sessionRoutes = require('./routes/session');
const profileRoutes = require('./routes/profile');
const careerPlanRoutes = require('./routes/career-plan');
const studyPlanRoutes = require('./routes/study-plans');
const timetableRoutes = require('./routes/timetable');
const careerTaxesRoutes = require('./routes/career-taxes');
const docentiRoutes = require('./routes/docenti');
const { authMiddleware } = require('./middleware/auth');
require('./db');
const app  = express();
const PORT = process.env.PORT || 3001;
app.use(helmet());
const frontendOrigins = [...new Set([
	'http://localhost:3000',
	'http://127.0.0.1:3000',
	process.env.FRONTEND_URL
].filter(Boolean))];
app.use(cors({ origin: frontendOrigins }));
app.use(express.json());
app.use(rateLimit({ windowMs: 60 * 1000, max: 20, message: { error: 'Troppe richieste.' } }));
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
app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message || 'Errore interno' }));
app.listen(PORT, '127.0.0.1', () => console.log(`Segrepass API su http://localhost:${PORT}`));

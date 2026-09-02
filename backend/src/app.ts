import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import kycRoutes from './routes/kyc.routes';
import rentalRoutes from './routes/rental.routes';
import adminRoutes from './routes/admin.routes';
import { startWeeklyBilling } from './services/weeklyBilling';
import { prisma } from './utils/prisma';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins (important for Android emulator & Web Dashboard connections)
app.use(cors());

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (!req.url.startsWith('/assets') && req.url !== '/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Parse JSON request bodies
app.use(express.json());

// 1. Register API Routes
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/kyc', kycRoutes);
app.use('/rental', rentalRoutes);

// Admin API endpoints
app.use('/admin/api', adminRoutes);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ride-for-you-backend',
  });
});

// 2. Serve Static Admin Dashboard Files (if build exists)
const adminDistPath = path.resolve(__dirname, '../../admin/dist');
const fallbackPublicPath = path.resolve(__dirname, '../public');

let staticPath = '';
if (fs.existsSync(adminDistPath)) {
  staticPath = adminDistPath;
} else if (fs.existsSync(fallbackPublicPath)) {
  staticPath = fallbackPublicPath;
}

if (staticPath) {
  console.log(`Serving admin dashboard from: ${staticPath}`);
  app.use(express.static(staticPath));
  app.use('/admin', express.static(staticPath));

  app.get('/admin/*', (_req: Request, res: Response) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

// 3. Fallback Route
app.use((req: Request, res: Response) => {
  if (req.accepts('html') && staticPath) {
    return res.sendFile(path.join(staticPath, 'index.html'));
  }
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
    message: 'The requested resource does not exist on this server.',
  });
});

// Start Background Services & Server
async function startServer() {
  try {
    await prisma.$connect();
    console.log('Connected to PostgreSQL Database successfully.');

    startWeeklyBilling();

    app.listen(PORT, () => {
      console.log(`Ride For You Backend listening on http://localhost:${PORT}`);
      console.log(`Admin Portal available at http://localhost:${PORT}/admin/`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;

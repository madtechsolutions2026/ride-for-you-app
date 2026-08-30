import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import kycRoutes from './routes/kyc.routes';
import rentalRoutes from './routes/rental.routes';
import adminRoutes from './routes/admin.routes';
import { prisma } from './utils/prisma';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins (important for Android emulator & Web Dashboard connections)
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// 1. Register API Routes
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/kyc', kycRoutes);
app.use('/rental', rentalRoutes);

// Admin API endpoints (available under /admin/api and /api/admin)
app.use('/admin/api', adminRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ride-for-you-backend' });
});

// 2. Serve Static Admin Web App
const publicPath = path.join(__dirname, '../public');
const adminDistPath = path.join(__dirname, '../../admin/dist');
const resolvedStaticPath = fs.existsSync(publicPath)
  ? publicPath
  : fs.existsSync(adminDistPath)
  ? adminDistPath
  : null;

if (resolvedStaticPath) {
  // Static assets
  app.use('/admin', express.static(resolvedStaticPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));
  app.use(express.static(resolvedStaticPath));

  // SPA fallback for /admin and subroutes
  app.get(['/admin', '/admin/*'], (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(resolvedStaticPath, 'index.html'));
  });

  app.get('/', (_req, res) => {
    res.redirect('/admin/');
  });
}

// Start Express server
const server = app.listen(PORT, async () => {
  try {
    await prisma.$connect();
    console.log(`\n========================================`);
    console.log(`Ride For You Auth Backend is running on port ${PORT}`);
    console.log(`Database connected successfully (PostgreSQL)`);
    console.log(`Admin Dashboard available at http://localhost:${PORT}/admin/`);
    console.log(`========================================\n`);
  } catch (error) {
    console.error('Failed to connect to the database:', error);
    process.exit(1);
  }
});

// Handle graceful shutdowns
const shutdown = async () => {
  console.log('Shutting down server gracefully...');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Prisma database client disconnected.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import adminRoutes from './routes/admin.routes';
import { prisma } from './utils/prisma';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins (important for Android emulator connections)
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Register API Routes
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/admin', adminRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ride-for-you-backend' });
});

// Start Express server
const server = app.listen(PORT, async () => {
  try {
    /*
     * Schema changes are applied by `prisma migrate deploy` in the deploy
     * command, NOT here. This used to run `prisma db push --accept-data-loss`
     * on every boot, which lets Prisma drop columns and tables to match the
     * schema — silently, on a live database, every restart.
     */
    await prisma.$connect();
    console.log(`\n========================================`);
    console.log(`Ride For You Auth Backend is running on port ${PORT}`);
    console.log(`Database connected successfully (PostgreSQL)`);
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

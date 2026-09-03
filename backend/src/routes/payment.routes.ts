import { Router } from 'express';
import { createIntent, handleWebhook } from '../controllers/payment.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Rider-initiated: needs a session.
router.post('/intent', authenticateToken, createIntent);

/**
 * Gateway callback — deliberately NO auth middleware; the signature is the
 * authentication. The raw bytes it was computed over are captured globally by
 * the express.json `verify` hook in app.ts (see the note there).
 */
router.post('/webhook/:provider', handleWebhook);

export default router;

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  listMyTickets,
  createTicket,
  getMyTicketDetail,
  listTicketMessages,
  postRiderMessage,
} from '../controllers/support.controller';
import { uploadSingle } from '../utils/uploads';

const router = Router();

router.use(authenticateToken);

router.get('/', listMyTickets);
router.post('/', createTicket);
router.get('/:id', getMyTicketDetail);

// Conversation thread — the rider's side.
router.get('/:id/messages', listTicketMessages);
router.post('/:id/messages', uploadSingle, postRiderMessage);

export default router;

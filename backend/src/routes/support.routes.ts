import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { listMyTickets, createTicket, getMyTicketDetail } from '../controllers/support.controller';

const router = Router();

router.use(authenticateToken);

router.get('/', listMyTickets);
router.post('/', createTicket);
router.get('/:id', getMyTicketDetail);

export default router;

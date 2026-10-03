import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  getContacts,
  addContact,
  deleteContact,
  searchUsers,
} from '../controllers/contactsController.js';

const router = Router();

router.use(requireAuth);

router.get('/contacts', getContacts);
router.post('/contacts', addContact);
router.delete('/contacts/:id', deleteContact);
router.get('/users/search', searchUsers);

export default router;

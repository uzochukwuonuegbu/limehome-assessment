import express from 'express';
import controller from '../controllers/bookings';
const router = express.Router();

router.get('/', controller.healthCheck);
router.post('/api/v1/booking/', controller.createBooking);
router.post('/api/v1/booking/extend', controller.extendBooking);
router.get('/api/v1/booking/:id', controller.getBooking);

export = router;

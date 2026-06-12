const express = require('express');
const router = express.Router();

// Import controller and middleware (you will need to create these next)
const bookingController = require('../controllers/booking.controller');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');

// All booking routes require authentication at minimum
router.use(requireAuth);

// POST /bookings/bulk-approve → [Admin] Bulk approve
router.post('/bulk-approve', requireAdmin, bookingController.bulkApprove);

// POST /bookings/bulk-reject → [Admin] Bulk reject
router.post('/bulk-reject', requireAdmin, bookingController.bulkReject);

// GET /bookings → [Admin] All bookings (filterable)
router.get('/', requireAdmin, bookingController.getAllBookings);

// GET /bookings/mine → [User] My bookings
router.get('/mine', bookingController.getMyBookings);

// GET /bookings/:id → Single booking detail
router.get('/:id', bookingController.getBookingById);

// POST /bookings → [User] Create booking request
router.post('/', bookingController.createBooking);

// PUT /bookings/:id/approve → [Admin] Approve booking
router.put('/:id/approve', requireAdmin, bookingController.approveBooking);

// PUT /bookings/:id/reject → [Admin] Reject booking
router.put('/:id/reject', requireAdmin, bookingController.rejectBooking);

// PUT /bookings/:id/issue → [Admin] Issue asset
router.put('/:id/issue', requireAdmin, bookingController.issueAsset);

// PUT /bookings/:id/return → [Admin] Record return
router.put('/:id/return', requireAdmin, bookingController.recordReturn);

module.exports = router;

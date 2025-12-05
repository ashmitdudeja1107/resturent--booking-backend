const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const { validateBooking } = require('../middleware/validation');

function emitSocketEvent(req, eventName, data) {
  const io = req.app.get('io');
  if (io) {
    io.emit(eventName, data);
    console.log(`📡 Socket event emitted: ${eventName}`);
  }
}

router.get('/', async (req, res) => {
  try {
    const { status, date, cuisine, limit = 50, page = 1 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (cuisine) query.cuisinePreference = cuisine;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      query.bookingDate = { $gte: startDate, $lte: endDate };
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const bookings = await Booking.find(query)
      .sort({ bookingDate: 1, bookingTime: 1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await Booking.countDocuments(query);
    
    res.json({
      success: true,
      count: bookings.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: bookings
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch bookings',
      message: error.message 
    });
  }
});

router.get('/upcoming', async (req, res) => {
  try {
    const bookings = await Booking.findUpcoming();
    
    res.json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    console.error('Error fetching upcoming bookings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch upcoming bookings',
      message: error.message 
    });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const totalBookings = await Booking.countDocuments();
    const confirmedBookings = await Booking.countDocuments({ status: 'confirmed' });
    const pendingBookings = await Booking.countDocuments({ status: 'pending' });
    const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });
    
    const cuisineStats = await Booking.aggregate([
      { $group: { _id: '$cuisinePreference', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    const seatingStats = await Booking.aggregate([
      { $group: { _id: '$seatingPreference', count: { $sum: 1 } } }
    ]);
    
    res.json({
      success: true,
      data: {
        total: totalBookings,
        confirmed: confirmedBookings,
        pending: pendingBookings,
        cancelled: cancelledBookings,
        popularCuisines: cuisineStats,
        seatingPreferences: seatingStats
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch statistics',
      message: error.message 
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId: req.params.id });
    
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        error: 'Booking not found' 
      });
    }
    
    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch booking',
      message: error.message 
    });
  }
});

router.post('/', validateBooking, async (req, res) => {
  try {
    const bookingData = {
      customerName: req.body.customerName,
      numberOfGuests: req.body.numberOfGuests,
      bookingDate: req.body.bookingDate,
      bookingTime: req.body.bookingTime,
      cuisinePreference: req.body.cuisinePreference,
      specialRequests: req.body.specialRequests,
      weatherInfo: req.body.weatherInfo,
      seatingPreference: req.body.seatingPreference,
      contactPhone: req.body.contactPhone,
      contactEmail: req.body.contactEmail,
      notes: req.body.notes
    };
    
    const booking = new Booking(bookingData);
    await booking.save();
    
    emitSocketEvent(req, 'booking-created', {
      booking: booking,
      message: `New booking created: ${booking.bookingId}`,
      timestamp: new Date()
    });
    
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('new-booking-alert', {
        booking: booking,
        message: `🆕 New booking from ${booking.customerName}`,
        timestamp: new Date()
      });
    }
    
    const total = await Booking.countDocuments();
    emitSocketEvent(req, 'stats-update', {
      totalBookings: total,
      timestamp: new Date()
    });
    
    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed',
        details: errors 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create booking',
      message: error.message 
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const booking = await Booking.findOne({ 
      $or: [
        { bookingId: req.params.id },
        { _id: req.params.id }
      ]
    });
    
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        error: 'Booking not found' 
      });
    }
    
    const oldStatus = booking.status;
    
    const allowedUpdates = [
      'numberOfGuests', 'bookingDate', 'bookingTime', 
      'cuisinePreference', 'specialRequests', 'seatingPreference',
      'contactPhone', 'contactEmail', 'notes', 'status'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        booking[field] = req.body[field];
      }
    });
    
    await booking.save();
    
    emitSocketEvent(req, 'booking-updated', {
      booking: booking,
      oldStatus: oldStatus,
      newStatus: booking.status,
      message: `Booking ${booking.bookingId} updated`,
      timestamp: new Date()
    });
    
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('booking-modified', {
        booking: booking,
        changes: req.body,
        timestamp: new Date()
      });
    }
    
    res.json({
      success: true,
      message: 'Booking updated successfully',
      data: booking
    });
  } catch (error) {
    console.error('Error updating booking:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed',
        details: errors 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update booking',
      message: error.message 
    });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid status. Use: pending, confirmed, cancelled, or completed' 
      });
    }
    
    const booking = await Booking.findOne({ 
      $or: [
        { bookingId: req.params.id },
        { _id: req.params.id }
      ]
    });
    
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        error: 'Booking not found' 
      });
    }
    
    const oldStatus = booking.status;
    booking.status = status;
    await booking.save();
    
    emitSocketEvent(req, 'booking-status-changed', {
      bookingId: booking.bookingId,
      oldStatus: oldStatus,
      newStatus: status,
      booking: booking,
      message: `Booking ${booking.bookingId} status changed to ${status}`,
      timestamp: new Date()
    });
    
    const stats = {
      confirmed: await Booking.countDocuments({ status: 'confirmed' }),
      pending: await Booking.countDocuments({ status: 'pending' }),
      cancelled: await Booking.countDocuments({ status: 'cancelled' }),
      completed: await Booking.countDocuments({ status: 'completed' })
    };
    
    emitSocketEvent(req, 'stats-update', {
      ...stats,
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      message: `Booking ${status} successfully`,
      data: booking
    });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update booking status',
      message: error.message 
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId: req.params.id });
    
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        error: 'Booking not found' 
      });
    }

    const oldStatus = booking.status;
    booking.status = 'cancelled';
    await booking.save();

    emitSocketEvent(req, 'booking-cancelled', {
      booking: booking,
      oldStatus: oldStatus,
      message: `Booking ${booking.bookingId} cancelled`,
      timestamp: new Date()
    });
    
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('booking-cancellation-alert', {
        booking: booking,
        message: `❌ Booking ${booking.bookingId} was cancelled`,
        timestamp: new Date()
      });
    }
    
    const stats = {
      cancelled: await Booking.countDocuments({ status: 'cancelled' })
    };
    
    emitSocketEvent(req, 'stats-update', stats);

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking
    });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cancel booking',
      message: error.message 
    });
  }
});

module.exports = router;
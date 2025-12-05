
const { body, validationResult } = require('express-validator');


const bookingValidationRules = [
  body('customerName')
    .trim()
    .notEmpty().withMessage('Customer name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  
  body('numberOfGuests')
    .notEmpty().withMessage('Number of guests is required')
    .isInt({ min: 1, max: 20 }).withMessage('Number of guests must be between 1 and 20'),
  
  body('bookingDate')
    .notEmpty().withMessage('Booking date is required')
    .isISO8601().withMessage('Invalid date format. Use YYYY-MM-DD')
    .custom((value) => {
      const bookingDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (bookingDate < today) {
        throw new Error('Booking date cannot be in the past');
      }
      return true;
    }),
  
  body('bookingTime')
    .notEmpty().withMessage('Booking time is required')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format. Use HH:MM (24-hour format)'),
  
  body('cuisinePreference')
    .optional()
    .isIn(['Italian', 'Chinese', 'Indian', 'Mexican', 'Japanese', 'American', 'Mediterranean', 'Thai', 'French', 'Other'])
    .withMessage('Invalid cuisine preference'),
  
  body('specialRequests')
    .optional()
    .isLength({ max: 500 }).withMessage('Special requests cannot exceed 500 characters'),
  
  body('seatingPreference')
    .optional()
    .isIn(['indoor', 'outdoor', 'no preference'])
    .withMessage('Invalid seating preference'),
  
  body('contactPhone')
    .optional()
    .matches(/^[0-9]{10}$/).withMessage('Phone number must be 10 digits'),
  
  body('contactEmail')
    .optional()
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail()
];


const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  
  next();
};


module.exports = {
  validateBooking: [...bookingValidationRules, handleValidationErrors]
};
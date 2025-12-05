
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    required: true,
    unique: true,
    default: () => `BK${Date.now()}${Math.floor(Math.random() * 1000)}`
  },
  
  customerName: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long']
  },
  
  numberOfGuests: {
    type: Number,
    required: [true, 'Number of guests is required'],
    min: [1, 'At least 1 guest is required'],
    max: [20, 'Maximum 20 guests allowed per booking']
  },
  
  bookingDate: {
    type: Date,
    required: [true, 'Booking date is required'],
    validate: {
      validator: function(date) {
        // Ensure booking is not in the past
        return date >= new Date().setHours(0, 0, 0, 0);
      },
      message: 'Booking date cannot be in the past'
    }
  },
  
  bookingTime: {
    type: String,
    required: [true, 'Booking time is required'],
    validate: {
      validator: function(time) {
        // Validate time format (HH:MM)
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
      },
      message: 'Invalid time format. Use HH:MM (24-hour format)'
    }
  },
  
  cuisinePreference: {
    type: String,
    enum: ['Italian', 'Chinese', 'Indian', 'Mexican', 'Japanese', 'American', 'Mediterranean', 'Thai', 'French', 'Other'],
    default: 'Other'
  },
  
  specialRequests: {
    type: String,
    maxlength: [500, 'Special requests cannot exceed 500 characters'],
    default: ''
  },
  
  weatherInfo: {
    condition: String,
    temperature: Number,
    description: String,
    humidity: Number,
    windSpeed: Number,
    date: Date
  },
  
  seatingPreference: {
    type: String,
    enum: ['indoor', 'outdoor', 'no preference'],
    default: 'no preference'
  },
  
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'confirmed'
  },
  
  contactPhone: {
    type: String,
    validate: {
      validator: function(phone) {
       
        return !phone || /^[0-9]{10}$/.test(phone.replace(/[-()\s]/g, ''));
      },
      message: 'Invalid phone number format'
    }
  },
  
  contactEmail: {
    type: String,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email) {
        // Basic email validation (optional field)
        return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      },
      message: 'Invalid email format'
    }
  },
  
  tableNumber: {
    type: Number,
    min: 1
  },
  
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  }
  
}, {
  timestamps: true 
});


bookingSchema.index({ bookingDate: 1, bookingTime: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ customerName: 1 });
bookingSchema.index({ bookingId: 1 }, { unique: true });


bookingSchema.virtual('isUpcoming').get(function() {
  const bookingDateTime = new Date(this.bookingDate);
  bookingDateTime.setHours(parseInt(this.bookingTime.split(':')[0]));
  bookingDateTime.setMinutes(parseInt(this.bookingTime.split(':')[1]));
  return bookingDateTime > new Date();
});


bookingSchema.methods.cancel = function() {
  this.status = 'cancelled';
  return this.save();
};

bookingSchema.methods.confirm = function() {
  this.status = 'confirmed';
  return this.save();
};

bookingSchema.methods.complete = function() {
  this.status = 'completed';
  return this.save();
};


bookingSchema.statics.findUpcoming = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return this.find({
    bookingDate: { $gte: today },
    status: { $in: ['pending', 'confirmed'] }
  }).sort({ bookingDate: 1, bookingTime: 1 });
};

bookingSchema.statics.findByDateRange = function(startDate, endDate) {
  return this.find({
    bookingDate: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  }).sort({ bookingDate: 1, bookingTime: 1 });
};


bookingSchema.pre('save', function(next) {
  // Auto-generate booking ID if not present
  if (!this.bookingId) {
    this.bookingId = `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }
  next();
});


bookingSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
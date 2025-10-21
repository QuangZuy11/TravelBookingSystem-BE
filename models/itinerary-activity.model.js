const mongoose = require('mongoose');

const itineraryActivitySchema = new mongoose.Schema({
    itinerary_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Itinerary',
        required: true
    },
    poi_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PointOfInterest',
        required: false
    },
    destination_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Destination',
        required: false
    },
    activity_name: {
        type: String,
        required: true,
        trim: true
    },
    start_time: {
        type: String,  // Format: "HH:mm" e.g. "09:00"
        required: true
    },
    end_time: {
        type: String,  // Format: "HH:mm" e.g. "17:00"
        required: false
    },
    duration_hours: {
        type: Number,
        default: 0,
        min: 0
    },
    description: {
        type: String,
        trim: true
    },
    cost: {
        type: Number,
        default: 0,
        min: 0
    },
    included_in_tour: {
        type: Boolean,
        default: true
    },
    optional: {
        type: Boolean,
        default: false
    },
    notes: {
        type: String,
        trim: true
    },
    images: [{
        type: String  // URLs
    }],
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

// Indexes
itineraryActivitySchema.index({ itinerary_id: 1 });
itineraryActivitySchema.index({ poi_id: 1 });
itineraryActivitySchema.index({ destination_id: 1 });

// Pre-save middleware to update timestamp
itineraryActivitySchema.pre('save', function(next) {
    this.updated_at = Date.now();
    
    // Auto-calculate duration if start and end times provided
    if (this.start_time && this.end_time && !this.duration_hours) {
        const start = this.start_time.split(':');
        const end = this.end_time.split(':');
        const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
        const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);
        this.duration_hours = (endMinutes - startMinutes) / 60;
    }
    
    next();
});

// Set toJSON options to include virtuals
itineraryActivitySchema.set('toJSON', { virtuals: true });
itineraryActivitySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ItineraryActivity', itineraryActivitySchema, 'ITINERARY_ACTIVITIES');
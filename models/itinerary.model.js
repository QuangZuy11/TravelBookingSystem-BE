const mongoose = require("mongoose");

const itinerarySchema = new mongoose.Schema(
    {
        tour_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tour",
            required: true,
        },
        day_number: {
            type: Number,
            required: true,
            min: 1,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true
        },
        meals: [{
            type: String,
            enum: ['breakfast', 'lunch', 'dinner', 'snack']
        }],
        activities: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ItineraryActivity'
        }],
        notes: String,
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
// Unique day per tour when tour_id is present. Use partial index to allow multiple generated itineraries without a tour_id.
itinerarySchema.index({ tour_id: 1, day_number: 1 }, { unique: true, partialFilterExpression: { tour_id: { $exists: true, $ne: null } } });
itinerarySchema.index({ provider_id: 1 });

// Update timestamp on save
itinerarySchema.pre('save', function (next) {
    this.updated_at = Date.now();
    next();
});

// Virtual populate for budget_breakdowns (reverse relationship)
itinerarySchema.virtual('budget_breakdowns', {
    ref: 'BudgetBreakdown',
    localField: '_id',
    foreignField: 'itinerary_id'
});

// Ensure virtuals are included
itinerarySchema.set('toJSON', { virtuals: true });
itinerarySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("ITINERARIES", itinerarySchema, "ITINERARIES");

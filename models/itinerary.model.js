const mongoose = require("mongoose");

const itinerarySchema = new mongoose.Schema(
    {
        origin_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },

        // Type determines what origin_id references  
        type: {
            type: String,
            enum: ['tour', 'ai_gen', 'customized'],
            required: true,
            default: 'tour'
            // 'tour' -> origin_id = Tour._id
            // 'ai_gen' -> origin_id = AI_GENERATED_ITINERARIES._id
            // 'customized' -> origin_id = AI_GENERATED_ITINERARIES._id (same as source ai_gen)
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

        // UNIFIED activities schema - supports both tour and AI formats
        activities: [{
            // ===== TOUR FORMAT (Simple) =====
            time: {
                type: String,
                trim: true,
                // Required for tour type itineraries
                validate: {
                    validator: function () {
                        // Only validate if this is a tour itinerary
                        if (this.parent().type === 'tour') {
                            return !!this.time;
                        }
                        return true;
                    },
                    message: 'Time is required for tour activities'
                }
            },


            action: {
                type: String,
                trim: true,
                // Required for tour type itineraries  
                validate: {
                    validator: function () {
                        if (this.parent().type === 'tour') {
                            return !!this.action;
                        }
                        return true;
                    },
                    message: 'Action is required for tour activities'
                }
            },

            // ===== AI FORMAT (Detailed) =====
            activityId: {
                type: String,
                trim: true
            },
            activity: {
                type: String,
                trim: true,
                // Required for AI type itineraries
                validate: {
                    validator: function () {
                        if (['ai_gen', 'customized'].includes(this.parent().type)) {
                            return !!(this.activity || this.action);
                        }
                        return true;
                    },
                    message: 'Activity name is required for AI activities'
                }
            },
            location: {
                type: String,
                trim: true,
                default: ''
            },
            duration: {
                type: Number,
                min: 0,
                default: 60 // Default 1 hour
            },
            cost: {
                type: Number,
                min: 0,
                default: 0
            },
            activityType: {
                type: String,
                enum: ['food', 'transport', 'sightseeing', 'entertainment', 'accommodation',
                    'shopping', 'nature', 'culture', 'adventure', 'relaxation', 'history', 'leisure', 'other'],
                default: 'other',
                set: function (value) {
                    if (!value) return 'other';

                    const typeMapping = {
                        'cultural': 'culture',
                        'historical': 'history',
                        'outdoor': 'nature',
                        'nightlife': 'entertainment',
                        'dining': 'food',
                        'recreational': 'leisure',
                        'ẩm thực': 'food',
                        'văn hóa': 'culture',
                        'thiên nhiên': 'nature',
                        'giải trí': 'entertainment',
                        'nghỉ ngơi': 'relaxation',
                        'du lịch': 'sightseeing'
                    };

                    const type = value.toLowerCase();
                    if (typeMapping[type]) {
                        return typeMapping[type];
                    }

                    // If it's already a valid type, return as is
                    if (['food', 'transport', 'sightseeing', 'entertainment', 'accommodation',
                        'shopping', 'nature', 'culture', 'adventure', 'relaxation', 'history', 'leisure', 'other']
                        .includes(type)) {
                        return type;
                    }

                    // Default fallback
                    return 'other';
                }
            },
            timeSlot: {
                type: String,
                enum: ['morning', 'afternoon', 'evening', 'night'],
                default: 'morning'
            },
            userModified: {
                type: Boolean,
                default: false
            },

            // Internal MongoDB ObjectId for tracking
            _id: {
                type: mongoose.Schema.Types.ObjectId,
                auto: true
            }
        }],

        // NEW: Day total cost for AI itineraries
        day_total: {
            type: Number,
            default: 0
        },

        // NEW: User modification tracking
        user_modified: {
            type: Boolean,
            default: false
        },

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

// Indexes for unified approach
// Unique day per origin + type combination
itinerarySchema.index({ origin_id: 1, day_number: 1, type: 1 }, { unique: true });

// Performance indexes
itinerarySchema.index({ type: 1 });
itinerarySchema.index({ origin_id: 1 });

// Update timestamp and process activities on save
itinerarySchema.pre('save', function (next) {
    this.updated_at = Date.now();

    // Auto-calculate day_total for AI itineraries
    if (this.type !== 'tour' && this.activities && this.activities.length > 0) {
        this.day_total = this.activities.reduce((total, activity) => {
            return total + (activity.cost || 0);
        }, 0);

        // Transform activity types
        this.activities.forEach(activity => {
            if (activity.activityType) {
                const typeMapping = {
                    'cultural': 'culture',
                    'historical': 'history',
                    'outdoor': 'nature',
                    'nightlife': 'entertainment',
                    'dining': 'food',
                    'recreational': 'leisure',
                    'ẩm thực': 'food',
                    'văn hóa': 'culture',
                    'thiên nhiên': 'nature',
                    'giải trí': 'entertainment',
                    'nghỉ ngơi': 'relaxation',
                    'du lịch': 'sightseeing'
                };

                const type = activity.activityType.toLowerCase();
                if (typeMapping[type]) {
                    activity.activityType = typeMapping[type];
                } else if (!['food', 'transport', 'sightseeing', 'entertainment', 'accommodation',
                    'shopping', 'nature', 'culture', 'adventure', 'relaxation', 'history', 'leisure', 'other'].includes(type)) {
                    activity.activityType = 'other';
                }
            }
        });
    }

    next();
});

// ===== UNIFIED HELPER FUNCTIONS =====

// Normalize activities based on itinerary type
itinerarySchema.statics.normalizeActivities = function (activities, itineraryType) {
    if (!activities || !Array.isArray(activities)) return [];

    return activities.map(activity => {
        if (itineraryType === 'tour') {
            // Tour format: keep simple structure
            return {
                time: activity.time,
                action: activity.action
            };
        } else {
            // AI format: comprehensive structure with validation
            // Map activity type using the static helper method
            const activityType = this.mapActivityType(activity.type || activity.activityType || 'other'); return {
                activityId: activity.activityId || `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                activity: activity.activity || activity.name || activity.action || 'Unnamed Activity',
                location: activity.location || '',
                duration: this.parseDuration(activity.duration),
                cost: parseInt(activity.cost) || 0,
                activityType: activityType,
                timeSlot: activity.timeSlot || 'morning',
                userModified: activity.userModified || activity.user_modified || false
            };
        }
    });
};

// Parse duration from various formats
itinerarySchema.statics.parseDuration = function (duration) {
    if (typeof duration === 'number') {
        return duration;
    }

    if (typeof duration === 'string') {
        const durationStr = duration.toLowerCase();
        if (durationStr.includes('hour')) {
            const hours = parseFloat(durationStr.match(/[\d.]+/)?.[0] || '1');
            return hours * 60;
        } else if (durationStr.includes('minute')) {
            return parseFloat(durationStr.match(/[\d.]+/)?.[0] || '60');
        } else {
            // Try to parse as number
            const parsed = parseFloat(durationStr);
            return !isNaN(parsed) ? parsed : 60;
        }
    }

    return 60; // Default 1 hour
};

// Helper function to map activity type
itinerarySchema.statics.mapActivityType = function (type) {
    if (!type) return 'other';

    const validActivityTypes = ['food', 'transport', 'sightseeing', 'entertainment',
        'accommodation', 'shopping', 'nature', 'culture', 'adventure',
        'relaxation', 'history', 'leisure', 'other'];

    type = type.toLowerCase();
    if (validActivityTypes.includes(type)) return type;

    const typeMapping = {
        'cultural': 'culture',
        'historical': 'history',
        'outdoor': 'nature',
        'nightlife': 'entertainment',
        'dining': 'food',
        'recreational': 'leisure',
        'ẩm thực': 'food',
        'văn hóa': 'culture',
        'thiên nhiên': 'nature',
        'giải trí': 'entertainment',
        'nghỉ ngơi': 'relaxation',
        'du lịch': 'sightseeing'
    };

    return typeMapping[type] || 'other';
};

// Validate activities based on itinerary type
itinerarySchema.statics.validateActivities = function (activities, itineraryType) {
    if (!activities || !Array.isArray(activities)) {
        return { valid: true };
    }

    for (const activity of activities) {
        if (itineraryType === 'tour') {
            // Tour format validation
            if (!activity.time || !activity.action) {
                return {
                    valid: false,
                    error: 'Tour activities must have time and action fields'
                };
            }
        } else if (['ai_gen', 'customized'].includes(itineraryType)) {
            // AI format validation
            if (!activity.activity && !activity.action && !activity.name) {
                return {
                    valid: false,
                    error: 'AI activities must have an activity name'
                };
            }

            // Map activity type before validation
            if (activity.type || activity.activityType) {
                activity.activityType = this.mapActivityType(activity.type || activity.activityType);
            }
        }
    }

    return { valid: true };
};

// Format response based on itinerary type
itinerarySchema.statics.formatResponse = function (itinerary) {
    const baseResponse = {
        _id: itinerary._id,
        origin_id: itinerary.origin_id,
        type: itinerary.type,
        day_number: itinerary.day_number,
        title: itinerary.title,
        description: itinerary.description,
        day_total: itinerary.day_total,
        user_modified: itinerary.user_modified,
        created_at: itinerary.created_at,
        updated_at: itinerary.updated_at
    };

    if (itinerary.type === 'tour') {
        // Tour format - simple activities
        baseResponse.activities = itinerary.activities.map(activity => ({
            time: activity.time,
            action: activity.action,
            _id: activity._id
        }));
    } else {
        // AI format - detailed activities
        baseResponse.activities = itinerary.activities.map(activity => ({
            activityId: activity.activityId,
            activity: activity.activity,
            location: activity.location,
            duration: activity.duration,
            cost: activity.cost,
            activityType: activity.activityType,
            timeSlot: activity.timeSlot,
            userModified: activity.userModified,
            _id: activity._id
        }));
    }

    return baseResponse;
};

// Static method for creating from AI generated data
itinerarySchema.statics.createFromAIGenerated = function (aiGeneratedId, dayNumber, aiDayData) {
    const activities = aiDayData.activities?.map(activity => {
        return {
            activityId: activity.activityId || `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            activity: activity.activity || activity.name || 'Unnamed Activity',
            location: activity.location || '',
            duration: this.parseDuration(activity.duration),
            cost: parseInt(activity.cost) || 0,
            activityType: activity.type || 'other',
            timeSlot: activity.timeSlot || 'morning',
            userModified: false
        };
    }) || [];

    return new this({
        origin_id: aiGeneratedId, // AI_GENERATED_ITINERARIES._id
        type: 'ai_gen',
        day_number: dayNumber,
        title: aiDayData.theme || `Day ${dayNumber}`,
        description: aiDayData.description || '',
        activities: activities,
        notes: aiDayData.notes || '',
        user_modified: false
    });
};

itinerarySchema.statics.createCustomizedCopy = function (originalItinerary) {
    const customizedData = originalItinerary.toObject();
    delete customizedData._id;
    delete customizedData.__v;

    return new this({
        ...customizedData,
        type: 'customized',
        // Keep same origin_id as the ai_gen version (both point to AI_GENERATED_ITINERARIES._id)
        origin_id: originalItinerary.origin_id,
        user_modified: false,
        created_at: new Date(),
        updated_at: new Date()
    });
};

// Ensure virtuals are included
itinerarySchema.set('toJSON', { virtuals: true });
itinerarySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("ITINERARIES", itinerarySchema, "ITINERARIES");

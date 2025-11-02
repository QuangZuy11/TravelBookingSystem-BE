/**
 * UNIFIED ITINERARY HELPERS
 * Centralized utility functions for consistent itinerary handling across tour and AI systems
 */

const Itinerary = require('../models/itinerary.model');

class ItineraryHelpers {

    /**
     * Create standard API response for itinerary operations
     */
    static createApiResponse(success, message, data = null, error = null) {
        const response = {
            success,
            message
        };

        if (data !== null) {
            response.data = data;
        }

        if (error !== null) {
            response.error = error;
        }

        return response;
    }

    /**
     * Validate itinerary creation/update request
     */
    static validateItineraryRequest(requestBody, requiredFields = ['origin_id', 'day_number', 'title']) {
        const errors = [];

        // Check required fields
        for (const field of requiredFields) {
            if (!requestBody[field]) {
                errors.push(`${field} is required`);
            }
        }

        // Validate type if provided
        if (requestBody.type && !['tour', 'ai_gen', 'customized'].includes(requestBody.type)) {
            errors.push('Invalid itinerary type');
        }

        // Validate day_number
        if (requestBody.day_number && (typeof requestBody.day_number !== 'number' || requestBody.day_number < 1)) {
            errors.push('day_number must be a positive number');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Format itinerary for consistent API responses
     */
    static formatItineraryForAPI(itinerary) {
        if (!itinerary) return null;

        // Use schema static method for consistent formatting
        return Itinerary.formatResponse(itinerary);
    }

    /**
     * Format multiple itineraries for API response
     */
    static formatItinerariesForAPI(itineraries) {
        if (!Array.isArray(itineraries)) return [];

        return itineraries.map(itinerary => this.formatItineraryForAPI(itinerary));
    }

    /**
     * Create unified query for itineraries
     */
    static createItineraryQuery(originId, type = null, filters = {}) {
        const query = { origin_id: originId };

        if (type) {
            query.type = type;
        }

        // Add additional filters
        Object.keys(filters).forEach(key => {
            if (filters[key] !== undefined) {
                query[key] = filters[key];
            }
        });

        return query;
    }

    /**
     * Handle itinerary save with error handling
     */
    static async saveItinerary(itinerary) {
        try {
            await itinerary.save();
            return {
                success: true,
                data: this.formatItineraryForAPI(itinerary)
            };
        } catch (error) {
            console.error('❌ Error saving itinerary:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get itineraries with unified query and formatting
     */
    static async getItinerariesByQuery(query, sortOptions = { day_number: 1 }) {
        try {
            const itineraries = await Itinerary.find(query).sort(sortOptions);
            return {
                success: true,
                data: this.formatItinerariesForAPI(itineraries),
                count: itineraries.length
            };
        } catch (error) {
            console.error('❌ Error fetching itineraries:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Delete itinerary with proper error handling
     */
    static async deleteItinerary(itineraryId) {
        try {
            const itinerary = await Itinerary.findById(itineraryId);

            if (!itinerary) {
                return {
                    success: false,
                    error: 'Itinerary not found'
                };
            }

            await Itinerary.findByIdAndDelete(itineraryId);

            return {
                success: true,
                message: 'Itinerary deleted successfully'
            };
        } catch (error) {
            console.error('❌ Error deleting itinerary:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update itinerary with unified validation and normalization
     */
    static async updateItinerary(itineraryId, updateData) {
        try {
            const itinerary = await Itinerary.findById(itineraryId);

            if (!itinerary) {
                return {
                    success: false,
                    error: 'Itinerary not found'
                };
            }

            // Validate activities if provided
            if (updateData.activities !== undefined) {
                const validation = Itinerary.validateActivities(updateData.activities, itinerary.type);
                if (!validation.valid) {
                    return {
                        success: false,
                        error: validation.error
                    };
                }

                // Normalize activities
                updateData.activities = Itinerary.normalizeActivities(updateData.activities, itinerary.type);
            }

            // Apply updates
            Object.keys(updateData).forEach(key => {
                if (updateData[key] !== undefined) {
                    itinerary[key] = updateData[key];
                }
            });

            itinerary.updated_at = new Date();

            return await this.saveItinerary(itinerary);
        } catch (error) {
            console.error('❌ Error updating itinerary:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create new itinerary with unified validation and normalization
     */
    static async createItinerary(itineraryData) {
        try {
            // Validate request
            const validation = this.validateItineraryRequest(itineraryData);
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.errors.join(', ')
                };
            }

            // Validate and normalize activities
            const activities = itineraryData.activities || [];
            const activityValidation = Itinerary.validateActivities(activities, itineraryData.type || 'tour');
            if (!activityValidation.valid) {
                return {
                    success: false,
                    error: activityValidation.error
                };
            }

            const normalizedActivities = Itinerary.normalizeActivities(activities, itineraryData.type || 'tour');

            // Create itinerary
            const itinerary = new Itinerary({
                ...itineraryData,
                activities: normalizedActivities
            });

            return await this.saveItinerary(itinerary);
        } catch (error) {
            console.error('❌ Error creating itinerary:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get tour itineraries with proper formatting
     */
    static async getTourItineraries(tourId) {
        const query = this.createItineraryQuery(tourId, 'tour');
        return await this.getItinerariesByQuery(query);
    }

    /**
     * Get AI itineraries with proper formatting
     */
    static async getAIItineraries(aiGeneratedId, type = 'ai_gen') {
        const query = this.createItineraryQuery(aiGeneratedId, type);
        return await this.getItinerariesByQuery(query);
    }

    /**
     * Check if origin exists based on type
     */
    static async validateOrigin(originId, type) {
        try {
            if (type === 'tour') {
                const Tour = require('../models/tour.model');
                const tour = await Tour.findById(originId);
                return !!tour;
            } else if (['ai_gen', 'customized'].includes(type)) {
                const AiGeneratedItinerary = require('../models/ai_generated_itineraries.model');
                const aiItinerary = await AiGeneratedItinerary.findById(originId);
                return !!aiItinerary;
            }
            return false;
        } catch (error) {
            console.error('❌ Error validating origin:', error);
            return false;
        }
    }

    /**
     * Add cache prevention headers for real-time updates
     */
    static addCacheHeaders(res) {
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Surrogate-Control': 'no-store'
        });
    }

}

module.exports = ItineraryHelpers;
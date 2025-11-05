const mongoose = require('mongoose');

/**
 * Middleware to validate ObjectId parameters
 * @param {string} paramName - The parameter name to validate (default: 'id')
 * @returns {Function} Express middleware function
 */
const validateObjectId = (paramName = 'id') => {
    return (req, res, next) => {
        const id = req.params[paramName];

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: `ID ${paramName} không hợp lệ`,
            });
        }

        next();
    };
};

/**
 * Validate multiple ObjectId parameters
 * @param {Array} paramNames - Array of parameter names to validate
 * @returns {Function} Express middleware function
 */
const validateMultipleObjectIds = (paramNames = ['id']) => {
    return (req, res, next) => {
        for (const paramName of paramNames) {
            const id = req.params[paramName];

            if (id && !mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: `ID ${paramName} không hợp lệ`,
                });
            }
        }

        next();
    };
};

/**
 * Helper function to check if a string is a valid ObjectId
 * @param {string} id - The ID to validate
 * @returns {boolean} True if valid ObjectId, false otherwise
 */
const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

module.exports = {
    validateObjectId,
    validateMultipleObjectIds,
    isValidObjectId
};
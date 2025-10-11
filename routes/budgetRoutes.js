const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/service-provider/tour/budgetController');

// ===== BUDGET BREAKDOWN MANAGEMENT =====

/**
 * Create budget breakdown item
 * POST /api/budget-breakdowns
 * Body: { itinerary_id, category, item_name, unit_price, quantity, day_number, description, is_included, is_optional, activity_id, supplier, currency, notes }
 */
router.post('/', budgetController.createBudgetBreakdown);

/**
 * Get all budget items for an itinerary
 * GET /api/budget-breakdowns/itinerary/:itineraryId
 * Returns: { items: [...], summary: {...} }
 */
router.get('/itinerary/:itineraryId', budgetController.getTourBudgetBreakdown);

/**
 * Get budget summary grouped by category
 * GET /api/budget-breakdowns/itinerary/:itineraryId/summary
 */
router.get('/itinerary/:itineraryId/summary', budgetController.getBudgetSummary);

/**
 * Get single budget item by ID
 * GET /api/budget-breakdowns/:id
 */
router.get('/:id', budgetController.getBudgetBreakdownById);

/**
 * Update budget breakdown item
 * PUT /api/budget-breakdowns/:id
 */
router.put('/:id', budgetController.updateBudgetBreakdown);

/**
 * Delete budget breakdown item
 * DELETE /api/budget-breakdowns/:id
 */
router.delete('/:id', budgetController.deleteBudgetBreakdown);

/**
 * Delete all budget items of an itinerary
 * DELETE /api/budget-breakdowns/itinerary/:itineraryId
 */
router.delete('/itinerary/:itineraryId', budgetController.deleteTourBudgetBreakdown);

module.exports = router;

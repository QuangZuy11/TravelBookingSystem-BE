/**
 * Budget Breakdown Controller  
 * Quản lý chi tiết ngân sách cho itineraries
 */

const BudgetBreakdown = require('../../../models/budget-breakdown.model');
const Itinerary = require('../../../models/itinerary.model');
// const ItineraryActivity = require('../../../models/itinerary-activity.model'); // Removed - activities are now simple array

/**
 * @route   POST /api/budget-breakdowns
 * @desc    Tạo budget breakdown mới cho tour
 * @access  Private (Provider)
 */
exports.createBudgetBreakdown = async (req, res) => {
    try {
        const {
            itinerary_id,
            category,
            item_name,
            unit_price,
            quantity,
            description,
            is_included,
            is_optional,
            day_number,
            activity_id,
            supplier,
            notes
        } = req.body;

        // Validate required fields
        if (!itinerary_id || !category || !item_name || unit_price === undefined || !day_number) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp đầy đủ thông tin',
                error: 'Missing required fields: itinerary_id, category, item_name, unit_price, day_number'
            });
        }

        const Itinerary = require('../../../models/itinerary.model');

        // Validate itinerary exists
        const itinerary = await Itinerary.findById(itinerary_id);
        if (!itinerary) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch trình',
                error: 'Itinerary not found'
            });
        }

        // Create budget breakdown (total_price will be auto-calculated by pre-save hook)
        const budgetBreakdown = new BudgetBreakdown({
            itinerary_id,
            category,
            item_name,
            unit_price,
            quantity: quantity || 1,
            total_price: (quantity || 1) * unit_price, // Will be recalculated by pre-save
            description,
            is_included: is_included !== undefined ? is_included : true,
            is_optional: is_optional || false,
            day_number,
            activity_id: activity_id || null,
            supplier: supplier || null,
            notes
        });

        await budgetBreakdown.save();


        res.status(201).json({
            success: true,
            message: 'Tạo mục ngân sách thành công',
            data: budgetBreakdown
        });

    } catch (error) {
        console.error('❌ Error creating budget breakdown:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi tạo ngân sách',
            error: error.message
        });
    }
};

/**
 * @route   GET /api/budget-breakdowns/itinerary/:itineraryId
 * @desc    Lấy danh sách budget breakdown của itinerary
 * @access  Public
 */
exports.getTourBudgetBreakdown = async (req, res) => {
    try {
        const { itineraryId } = req.params;

        // Validate itinerary exists
        const itinerary = await Itinerary.findById(itineraryId);
        if (!itinerary) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch trình',
                error: 'Itinerary not found'
            });
        }

        // Get all budget items for this itinerary
        const budgetItems = await BudgetBreakdown.find({ itinerary_id: itineraryId })
            .populate('activity_id', 'activity_name start_time end_time')
            .sort({ day_number: 1, category: 1 });

        // Calculate summary using model static methods
        const totals = await BudgetBreakdown.calculateItineraryTotal(itineraryId);
        const byCategory = await BudgetBreakdown.calculateByCategory(itineraryId);

        res.status(200).json({
            success: true,
            message: 'Lấy thông tin ngân sách thành công',
            data: {
                items: budgetItems,
                summary: {
                    total: totals.total,
                    included_total: totals.included_total,
                    optional_total: totals.optional_total,
                    by_category: byCategory,
                    item_count: budgetItems.length
                }
            }
        });

    } catch (error) {
        console.error('❌ Error getting itinerary budget breakdown:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thông tin ngân sách',
            error: error.message
        });
    }
};

/**
 * @route   GET /api/budget-breakdowns/:id
 * @desc    Lấy chi tiết một budget item
 * @access  Public
 */
exports.getBudgetBreakdownById = async (req, res) => {
    try {
        const { id } = req.params;

        const budgetItem = await BudgetBreakdown.findById(id)
            .populate('itinerary_id', 'title day_number')
            .populate('activity_id', 'activity_name start_time end_time');

        if (!budgetItem) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy mục ngân sách',
                error: 'Budget item not found'
            });
        }

        res.status(200).json({
            success: true,
            data: budgetItem
        });

    } catch (error) {
        console.error('❌ Error getting budget breakdown:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
};

/**
 * @route   PUT /api/budget-breakdowns/:id
 * @desc    Cập nhật budget breakdown
 * @access  Private (Provider)
 */
exports.updateBudgetBreakdown = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            category,
            item_name,
            unit_price,
            quantity,
            description,
            is_included,
            is_optional,
            day_number,
            activity_id,
            supplier,
            currency,
            notes
        } = req.body;

        const budgetItem = await BudgetBreakdown.findById(id);

        if (!budgetItem) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy mục ngân sách',
                error: 'Budget item not found'
            });
        }

        // Update fields (only if provided)
        if (category !== undefined) budgetItem.category = category;
        if (item_name !== undefined) budgetItem.item_name = item_name;
        if (unit_price !== undefined) budgetItem.unit_price = unit_price;
        if (quantity !== undefined) budgetItem.quantity = quantity;
        if (description !== undefined) budgetItem.description = description;
        if (is_included !== undefined) budgetItem.is_included = is_included;
        if (is_optional !== undefined) budgetItem.is_optional = is_optional;
        if (day_number !== undefined) budgetItem.day_number = day_number;
        if (activity_id !== undefined) budgetItem.activity_id = activity_id;
        if (supplier !== undefined) budgetItem.supplier = supplier;
        if (currency !== undefined) budgetItem.currency = currency;
        if (notes !== undefined) budgetItem.notes = notes;

        // total_price will be recalculated by pre-save hook
        budgetItem.updated_at = new Date();

        await budgetItem.save();


        res.status(200).json({
            success: true,
            message: 'Cập nhật ngân sách thành công',
            data: budgetItem
        });

    } catch (error) {
        console.error('❌ Error updating budget breakdown:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi cập nhật ngân sách',
            error: error.message
        });
    }
};

/**
 * @route   DELETE /api/budget-breakdowns/:id
 * @desc    Xóa budget breakdown
 * @access  Private (Provider)
 */
exports.deleteBudgetBreakdown = async (req, res) => {
    try {
        const { id } = req.params;

        const budgetItem = await BudgetBreakdown.findById(id);

        if (!budgetItem) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy mục ngân sách',
                error: 'Budget item not found'
            });
        }

        await BudgetBreakdown.findByIdAndDelete(id);


        res.status(200).json({
            success: true,
            message: 'Xóa mục ngân sách thành công'
        });

    } catch (error) {
        console.error('❌ Error deleting budget breakdown:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi xóa ngân sách',
            error: error.message
        });
    }
};

/**
 * @route   DELETE /api/budget-breakdowns/itinerary/:itineraryId
 * @desc    Xóa tất cả budget items của itinerary
 * @access  Private (Provider)
 */
exports.deleteTourBudgetBreakdown = async (req, res) => {
    try {
        const { itineraryId } = req.params;

        const result = await BudgetBreakdown.deleteMany({ itinerary_id: itineraryId });


        res.status(200).json({
            success: true,
            message: `Đã xóa ${result.deletedCount} mục ngân sách`,
            data: {
                deletedCount: result.deletedCount
            }
        });

    } catch (error) {
        console.error('❌ Error deleting itinerary budget breakdown:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi xóa ngân sách',
            error: error.message
        });
    }
};

/**
 * @route   GET /api/budget-breakdowns/itinerary/:itineraryId/summary
 * @desc    Lấy tổng hợp ngân sách theo category
 * @access  Public
 */
exports.getBudgetSummary = async (req, res) => {
    try {
        const { itineraryId } = req.params;

        // Validate itinerary exists
        const itinerary = await Itinerary.findById(itineraryId);
        if (!itinerary) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch trình',
                error: 'Itinerary not found'
            });
        }

        // Use model static methods
        const byCategory = await BudgetBreakdown.calculateByCategory(itineraryId);
        const totals = await BudgetBreakdown.calculateItineraryTotal(itineraryId);

        res.status(200).json({
            success: true,
            message: 'Lấy tổng hợp ngân sách thành công',
            data: {
                itinerary_id: itineraryId,
                itinerary_title: itinerary.title,
                day_number: itinerary.day_number,
                categories: byCategory,
                totals: totals
            }
        });

    } catch (error) {
        console.error('❌ Error getting budget summary:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
};

module.exports = exports;

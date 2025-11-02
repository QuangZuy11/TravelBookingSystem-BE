const Itinerary = require('../models/itinerary.model');

const finalDayController = {
    // Update day theme and notes (only works on type='customized')
    async updateDay(req, res) {
        try {
            const { aiGeneratedId, dayNumber } = req.params;
            const updates = req.body;

            const day = await Itinerary.findOne({
                origin_id: aiGeneratedId,
                day_number: parseInt(dayNumber),
                type: 'customized'
            });

            if (!day) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy ngày tùy chỉnh. Vui lòng khởi tạo tùy chỉnh trước.'
                });
            }

            // Update allowed fields
            if (updates.theme) day.title = updates.theme;
            if (updates.description) day.description = updates.description;
            if (updates.notes) day.notes = updates.notes;

            day.user_modified = true;
            await day.save();

            res.json({
                success: true,
                message: 'Cập nhật ngày thành công',
                data: {
                    dayNumber: day.day_number,
                    theme: day.title,
                    description: day.description,
                    notes: day.notes,
                    dayTotal: day.day_total,
                    userModified: day.user_modified
                }
            });

        } catch (error) {
            console.error('❌ Error updating day:', error);

            if (error.name === 'VersionError') {
                return res.status(409).json({
                    success: false,
                    message: 'Dữ liệu đã được cập nhật bởi phiên khác. Vui lòng tải lại.',
                    shouldRetry: true
                });
            }

            res.status(500).json({
                success: false,
                message: 'Lỗi khi cập nhật ngày',
                error: error.message
            });
        }
    },

    // Add activity to day (only works on type='customized')
    async addActivity(req, res) {
        try {
            const { aiGeneratedId, dayNumber } = req.params;
            const activityData = req.body;

            const day = await Itinerary.findOne({
                origin_id: aiGeneratedId,
                day_number: parseInt(dayNumber),
                type: 'customized'
            });

            if (!day) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy ngày tùy chỉnh'
                });
            }

            const newActivity = {
                activityId: activityData.activityId || `activity_${dayNumber}_${Date.now()}`,
                name: activityData.name,
                location: activityData.location,
                duration: activityData.duration || 60,
                cost: activityData.cost || 0,
                type: activityData.type || 'other',
                timeSlot: activityData.timeSlot || 'morning',
                userModified: true
            };

            day.activities.push(newActivity);
            day.user_modified = true;
            await day.save(); // day_total will be auto-calculated

            res.json({
                success: true,
                message: 'Thêm hoạt động thành công',
                data: {
                    activity: newActivity,
                    dayTotal: day.day_total,
                    totalActivities: day.activities.length
                }
            });

        } catch (error) {
            console.error('❌ Error adding activity:', error);

            if (error.name === 'VersionError') {
                // Retry mechanism
                console.log('🔄 Version conflict, retrying...');
                return setTimeout(() => {
                    req.retryCount = (req.retryCount || 0) + 1;
                    if (req.retryCount < 3) {
                        return this.addActivity(req, res);
                    }
                    return res.status(409).json({
                        success: false,
                        message: 'Không thể thêm hoạt động sau nhiều lần thử'
                    });
                }, 100);
            }

            res.status(500).json({
                success: false,
                message: 'Lỗi khi thêm hoạt động',
                error: error.message
            });
        }
    },

    // Update specific activity (only works on type='customized')
    async updateActivity(req, res) {
        try {
            const { aiGeneratedId, dayNumber, activityId } = req.params;
            const updates = req.body;

            const day = await Itinerary.findOne({
                origin_id: aiGeneratedId,
                day_number: parseInt(dayNumber),
                type: 'customized'
            });

            if (!day) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy ngày tùy chỉnh'
                });
            }

            const activity = day.activities.id(activityId) ||
                day.activities.find(a => a.activityId === activityId);

            if (!activity) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy hoạt động'
                });
            }

            // Update activity fields
            Object.keys(updates).forEach(key => {
                if (key !== '_id' && key !== 'activityId' && updates[key] !== undefined) {
                    activity[key] = updates[key];
                }
            });

            activity.userModified = true;
            day.user_modified = true;
            await day.save();

            res.json({
                success: true,
                message: 'Cập nhật hoạt động thành công',
                data: {
                    activity: activity,
                    dayTotal: day.day_total
                }
            });

        } catch (error) {
            console.error('❌ Error updating activity:', error);

            if (error.name === 'VersionError') {
                return setTimeout(() => {
                    req.retryCount = (req.retryCount || 0) + 1;
                    if (req.retryCount < 3) {
                        return this.updateActivity(req, res);
                    }
                    return res.status(409).json({
                        success: false,
                        message: 'Không thể cập nhật sau nhiều lần thử'
                    });
                }, 100);
            }

            res.status(500).json({
                success: false,
                message: 'Lỗi khi cập nhật hoạt động',
                error: error.message
            });
        }
    },

    // Delete activity (only works on type='customized')
    async deleteActivity(req, res) {
        try {
            const { aiGeneratedId, dayNumber, activityId } = req.params;

            const day = await Itinerary.findOne({
                origin_id: aiGeneratedId,
                day_number: parseInt(dayNumber),
                type: 'customized'
            });

            if (!day) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy ngày tùy chỉnh'
                });
            }

            const initialCount = day.activities.length;

            // Remove activity by _id or activityId
            day.activities = day.activities.filter(activity =>
                activity._id.toString() !== activityId &&
                activity.activityId !== activityId
            );

            if (day.activities.length === initialCount) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy hoạt động để xóa'
                });
            }

            day.user_modified = true;
            await day.save();

            res.json({
                success: true,
                message: 'Xóa hoạt động thành công',
                data: {
                    remainingActivities: day.activities.length,
                    dayTotal: day.day_total
                }
            });

        } catch (error) {
            console.error('❌ Error deleting activity:', error);

            if (error.name === 'VersionError') {
                return res.status(409).json({
                    success: false,
                    message: 'Dữ liệu đã thay đổi. Vui lòng tải lại và thử lại.'
                });
            }

            res.status(500).json({
                success: false,
                message: 'Lỗi khi xóa hoạt động',
                error: error.message
            });
        }
    },

    // Reorder activities within a day (only works on type='customized')
    async reorderActivities(req, res) {
        try {
            const { aiGeneratedId, dayNumber } = req.params;
            const { activityIds } = req.body;

            const day = await Itinerary.findOne({
                origin_id: aiGeneratedId,
                day_number: parseInt(dayNumber),
                type: 'customized'
            });

            if (!day) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy ngày tùy chỉnh'
                });
            }

            if (!Array.isArray(activityIds)) {
                return res.status(400).json({
                    success: false,
                    message: 'activityIds phải là một mảng'
                });
            }

            // Reorder activities based on provided IDs
            const reorderedActivities = [];
            activityIds.forEach(activityId => {
                const activity = day.activities.find(a =>
                    a._id.toString() === activityId || a.activityId === activityId
                );
                if (activity) {
                    reorderedActivities.push(activity);
                }
            });

            // Add any activities not included in the reorder list
            day.activities.forEach(activity => {
                if (!activityIds.includes(activity._id.toString()) &&
                    !activityIds.includes(activity.activityId)) {
                    reorderedActivities.push(activity);
                }
            });

            day.activities = reorderedActivities;
            day.user_modified = true;
            await day.save();

            res.json({
                success: true,
                message: 'Sắp xếp lại hoạt động thành công',
                data: {
                    activities: day.activities,
                    totalActivities: day.activities.length
                }
            });

        } catch (error) {
            console.error('❌ Error reordering activities:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi sắp xếp lại hoạt động',
                error: error.message
            });
        }
    }
};

module.exports = finalDayController;
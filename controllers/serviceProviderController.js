const ServiceProvider = require('../models/service-provider.model');

// Get provider profile
exports.getProviderProfile = async (req, res) => {
    try {
        const provider = await ServiceProvider.findById(req.params.providerId);
        if (!provider) {
            return res.status(404).json({
                success: false,
                error: 'Service provider not found'
            });
        }

        res.status(200).json({
            success: true,
            data: provider
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Update provider profile
exports.updateProviderProfile = async (req, res) => {
    try {
        const provider = await ServiceProvider.findByIdAndUpdate(
            req.params.providerId,
            req.body,
            { new: true, runValidators: true }
        );

        if (!provider) {
            return res.status(404).json({
                success: false,
                error: 'Service provider not found'
            });
        }

        res.status(200).json({
            success: true,
            data: provider
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Get provider statistics
exports.getProviderStatistics = async (req, res) => {
    try {
        const stats = await ServiceProvider.aggregate([
            {
                $match: { _id: mongoose.Types.ObjectId(req.params.providerId) }
            },
            {
                $lookup: {
                    from: 'tours',
                    localField: '_id',
                    foreignField: 'providerId',
                    as: 'tours'
                }
            },
            {
                $lookup: {
                    from: 'hotels',
                    localField: '_id',
                    foreignField: 'providerId',
                    as: 'hotels'
                }
            },
            {
                $lookup: {
                    from: 'flights',
                    localField: '_id',
                    foreignField: 'providerId',
                    as: 'flights'
                }
            },
            {
                $project: {
                    totalTours: { $size: '$tours' },
                    totalHotels: { $size: '$hotels' },
                    totalFlights: { $size: '$flights' },
                    rating: 1,
                    totalReviews: 1
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: stats[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};

// Upload provider documents
exports.uploadDocuments = async (req, res) => {
    try {
        const provider = await ServiceProvider.findById(req.params.providerId);

        if (!provider) {
            return res.status(404).json({
                success: false,
                error: 'Service provider not found'
            });
        }

        // Assuming req.files contains the uploaded documents
        const documentUrls = req.files.map(file => file.path);
        provider.documents.push(...documentUrls);
        await provider.save();

        res.status(200).json({
            success: true,
            data: provider
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Get service processes
exports.getServiceProcesses = async (req, res) => {
    try {
        const provider = await ServiceProvider.findById(req.params.providerId)
            .populate('serviceProcesses');

        if (!provider) {
            return res.status(404).json({
                success: false,
                error: 'Service provider not found'
            });
        }

        res.status(200).json({
            success: true,
            count: provider.serviceProcesses.length,
            data: provider.serviceProcesses
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
};
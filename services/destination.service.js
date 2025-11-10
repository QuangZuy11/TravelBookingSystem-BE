const Destination = require('../models/destination.model');

/**
 * Calculate approximate distances between destinations using their coordinates
 * @param {Array} destinations Array of destination documents
 * @returns {Object} Matrix of distances between destinations
 */
async function calculateDestinationDistances(destinations) {
    const distanceMatrix = {};

    for (const dest1 of destinations) {
        distanceMatrix[dest1._id] = {};
        for (const dest2 of destinations) {
            if (dest1._id === dest2._id) continue;

            // For now using simple distance calculation
            // In future, could integrate with Maps API for real distances
            const distance = {
                distance_km: Math.floor(Math.random() * 300) + 100, // Dummy distance 100-400km
                duration_minutes: Math.floor(Math.random() * 180) + 60, // Dummy duration 1-4 hours
                suggested_mode: getTransportMode(Math.floor(Math.random() * 300) + 100)
            };

            distanceMatrix[dest1._id][dest2._id] = distance;
        }
    }

    return distanceMatrix;
}

/**
 * Get suggested transport mode based on distance
 */
function getTransportMode(distance) {
    if (distance < 100) return 'car';
    if (distance < 300) return 'bus';
    if (distance < 500) return 'train';
    return 'plane';
}

/**
 * Group nearby destinations for multi-destination trips
 * @param {Array} destinations Array of destination documents
 * @param {Number} maxDistance Maximum distance to consider destinations as "nearby"
 * @returns {Array} Groups of nearby destinations
 */
async function groupNearbyDestinations(destinations, maxDistance = 300) {
    const distanceMatrix = await calculateDestinationDistances(destinations);
    const groups = [];
    const used = new Set();

    for (const dest of destinations) {
        if (used.has(dest._id.toString())) continue;

        const group = [dest];
        used.add(dest._id.toString());

        // Find nearby destinations
        for (const other of destinations) {
            if (used.has(other._id.toString())) continue;

            const distance = distanceMatrix[dest._id][other._id]?.distance_km;
            if (distance && distance <= maxDistance) {
                group.push(other);
                used.add(other._id.toString());
            }
        }

        if (group.length > 0) {
            groups.push({
                destinations: group,
                center: dest,
                max_distance: Math.max(...group.map(d =>
                    d._id === dest._id ? 0 : distanceMatrix[dest._id][d._id].distance_km
                ))
            });
        }
    }

    return groups;
}

/**
 * Find optimal route between multiple destinations
 * Simple implementation - can be enhanced with actual TSP algorithm
 */
function planMultiDestinationRoute(destinations, distanceMatrix) {
    if (destinations.length <= 2) return destinations;

    const route = [destinations[0]];
    const remaining = new Set(destinations.slice(1).map(d => d._id.toString()));

    while (remaining.size > 0) {
        const current = route[route.length - 1];
        let nearest = null;
        let minDistance = Infinity;

        for (const destId of remaining) {
            const distance = distanceMatrix[current._id][destId]?.distance_km || Infinity;
            if (distance < minDistance) {
                minDistance = distance;
                nearest = destinations.find(d => d._id.toString() === destId);
            }
        }

        if (nearest) {
            route.push(nearest);
            remaining.delete(nearest._id.toString());
        }
    }

    return route;
}

module.exports = {
    calculateDestinationDistances,
    groupNearbyDestinations,
    planMultiDestinationRoute
};
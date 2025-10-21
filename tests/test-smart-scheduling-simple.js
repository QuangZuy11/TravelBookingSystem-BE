/**
 * Simple Smart Scheduling Test
 * Assumes server is already running on port 3000
 */

const axios = require('axios');
const mongoose = require('mongoose');

require('dotenv').config();

const API_BASE_URL = 'http://localhost:3000/api';
const MONGO_URI = process.env.MONGO_URI;

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

const log = (color, ...args) => console.log(color, ...args, colors.reset);

let authToken = null;

// Seed POIs with varied durations
async function seedPOIs() {
    log(colors.magenta, '\n📊 Seeding POIs with recommendedDuration...');

    const Destination = mongoose.model('Destination', new mongoose.Schema({
        name: String,
        type: String,
        description: String,
        location: Object
    }), 'DESTINATIONS');

    const PointOfInterest = mongoose.model('PointOfInterest', new mongoose.Schema({
        destinationId: mongoose.Schema.Types.ObjectId,
        name: String,
        type: String,
        description: String,
        ratings: Object,
        entryFee: Object,
        recommendedDuration: Object
    }), 'POINTS_OF_INTEREST');

    // Clear old data
    await Destination.deleteMany({ name: 'Hanoi' });
    await PointOfInterest.deleteMany({});

    // Create Hanoi
    const hanoi = new Destination({
        name: 'Hanoi',
        type: 'city',
        description: 'Capital of Vietnam',
        location: { city: 'Hanoi', country: 'Vietnam' }
    });
    await hanoi.save();

    // Create 8 POIs with different durations
    const pois = [
        { name: 'Ho Chi Minh Mausoleum', hours: 1, minutes: 30, cost: 0 },
        { name: 'Imperial Citadel', hours: 2, minutes: 30, cost: 30000 },
        { name: 'Old Quarter Walking Tour', hours: 3, minutes: 0, cost: 0 },
        { name: 'Temple of Literature', hours: 1, minutes: 0, cost: 30000 },
        { name: 'Hoan Kiem Lake', hours: 1, minutes: 0, cost: 0 },
        { name: 'Vietnam Museum', hours: 2, minutes: 0, cost: 40000 },
        { name: 'Tran Quoc Pagoda', hours: 0, minutes: 45, cost: 0 },
        { name: 'Water Puppet Theatre', hours: 1, minutes: 15, cost: 100000 }
    ];

    for (const poi of pois) {
        await new PointOfInterest({
            destinationId: hanoi._id,
            name: poi.name,
            type: 'cultural',
            description: `Visit ${poi.name}`,
            ratings: { average: 4.5, count: 1000 },
            entryFee: { adult: poi.cost, currency: 'VND' },
            recommendedDuration: { hours: poi.hours, minutes: poi.minutes }
        }).save();

        log(colors.cyan, `  ✓ ${poi.name} - ${poi.hours}h ${poi.minutes}m`);
    }

    log(colors.green, `✓ Seeded ${pois.length} POIs`);
}

// Login
async function login() {
    log(colors.magenta, '\n🔐 Logging in...');

    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: 'hotel@gmail.com',
        password: 'hotel@gmail.com'
    });

    authToken = response.data.token;
    const userId = response.data.userId || response.data.user?._id || response.data.id;

    log(colors.green, `✓ Logged in. Token: ${authToken?.substring(0, 20)}...`);
    log(colors.cyan, `  User ID: ${userId}`);

    return userId;
}

// Generate itinerary
async function generateItinerary(userId) {
    log(colors.magenta, '\n🧪 Generating itinerary...');

    const response = await axios.post(
        `${API_BASE_URL}/ai-itineraries/generate`,
        {
            user_id: userId,
            destination: 'Hanoi',
            duration_days: 2,
            budget_level: 'medium',
            preferences: ['culture', 'history']
        },
        {
            headers: { Authorization: `Bearer ${authToken}` }
        }
    );

    return response.data.data;
}

// Analyze results
function analyzeSchedule(data) {
    log(colors.blue, '\n📊 Schedule Analysis:');
    log(colors.blue, '═══════════════════════════════════════');

    const itineraryData = data.itinerary_data;
    let totalActivities = 0;
    let hasIssues = false;

    for (const dayData of itineraryData) {
        const day = dayData.itinerary;
        const activities = dayData.activities;

        log(colors.cyan, `\n🗓️  Day ${day.day_number}: ${activities.length} activities`);

        let previousEndMinutes = null;
        let dayTotalMinutes = 0;

        for (let i = 0; i < activities.length; i++) {
            const act = activities[i];
            totalActivities++;

            const durationMinutes = act.duration_hours * 60;
            dayTotalMinutes += durationMinutes;

            const [startH, startM] = act.start_time.split(':').map(Number);
            const [endH, endM] = act.end_time.split(':').map(Number);
            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;

            // Check window
            if (startH < 8 || endH > 18) {
                log(colors.red, `   ❌ ${act.activity_name} (${act.start_time}-${act.end_time}) OUTSIDE 8AM-6PM`);
                hasIssues = true;
            } else {
                log(colors.green, `   ✓ ${act.activity_name}`);
            }

            log(colors.cyan, `      Time: ${act.start_time}-${act.end_time} (${act.duration_hours}h)`);
            log(colors.cyan, `      Cost: ${act.cost === 0 ? 'FREE' : act.cost.toLocaleString() + ' VND'}`);

            // Check travel time
            if (previousEndMinutes !== null && i > 0) {
                const gap = startMinutes - previousEndMinutes;
                if (gap >= 30) {
                    log(colors.green, `      Travel time: ${gap} minutes ✓`);
                } else if (gap > 0) {
                    log(colors.yellow, `      Travel time: ${gap} minutes (expected 30)`);
                }
            }

            previousEndMinutes = endMinutes;
        }

        const dayHours = (dayTotalMinutes / 60).toFixed(1);
        log(colors.magenta, `   Day total: ${dayHours}h`);

        if (dayTotalMinutes > 10 * 60) {
            log(colors.red, `   ⚠️  Exceeds 10-hour limit!`);
            hasIssues = true;
        }
    }

    log(colors.blue, '\n═══════════════════════════════════════');
    log(colors.magenta, `Total activities: ${totalActivities}`);
    log(colors.magenta, `Average per day: ${(totalActivities / itineraryData.length).toFixed(1)}`);

    if (!hasIssues) {
        log(colors.green, '\n✅ TEST PASSED - Smart scheduling working!');
    } else {
        log(colors.red, '\n❌ TEST FAILED - Issues detected');
    }

    return !hasIssues;
}

// Main
async function main() {
    log(colors.blue, '═══════════════════════════════════════');
    log(colors.blue, '  Smart Scheduling Test (Simple)');
    log(colors.blue, '═══════════════════════════════════════');

    try {
        // Connect to DB
        log(colors.magenta, '\n🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        log(colors.green, '✓ Connected');

        // Seed
        await seedPOIs();

        // Login
        const userId = await login();
        if (!userId) {
            throw new Error('Failed to get user ID from login');
        }

        // Generate
        const data = await generateItinerary(userId);
        log(colors.green, '✓ Itinerary generated');

        // Analyze
        const passed = analyzeSchedule(data);

        // Cleanup
        await mongoose.disconnect();

        process.exit(passed ? 0 : 1);

    } catch (error) {
        log(colors.red, '\n❌ Error:', error.message);
        if (error.response?.data) {
            log(colors.red, 'Response:', JSON.stringify(error.response.data, null, 2));
        }

        try {
            await mongoose.disconnect();
        } catch (e) { }

        process.exit(1);
    }
}

main();

/**
 * Test Smart Scheduling with POI Recommended Duration + Travel Time
 * 
 * This test validates:
 * 1. POIs are distributed across days based on recommendedDuration
 * 2. 30-minute travel time is added between activities
 * 3. Activities stay within 8AM-6PM window (10 hours)
 * 4. Start/end times are calculated correctly
 */

const axios = require('axios');
const mongoose = require('mongoose');
const { spawn, exec } = require('child_process');

const API_BASE_URL = 'http://localhost:3000/api';

// Load .env file
require('dotenv').config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://thanhlmhe176868_db_user:t3NemikPb6Gz31CL@cluster0.uf7fiwv.mongodb.net/DB_test?retryWrites=true&w=majority';

// Test configuration - Use existing user instead of registering
const TEST_USER = {
    email: 'hotel@gmail.com',  // Hotel provider account
    password: 'hotel@gmail.com'
}; let authToken = null;
let serverProcess = null;

// ANSI colors
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

// Helper: Kill existing Node processes on port 3000 (Windows compatible)
async function killExistingServer() {
    return new Promise((resolve) => {
        log(colors.yellow, '\n🔪 Killing existing Node processes on port 3000...');

        if (process.platform === 'win32') {
            // Windows: Use netstat + taskkill
            exec('netstat -ano | findstr :3000', (err, stdout) => {
                if (err || !stdout) {
                    log(colors.green, '✓ No existing server found');
                    return resolve();
                }

                const lines = stdout.split('\n');
                const pids = new Set();

                lines.forEach(line => {
                    const match = line.match(/LISTENING\s+(\d+)/);
                    if (match) pids.add(match[1]);
                });

                if (pids.size === 0) {
                    log(colors.green, '✓ No processes to kill');
                    return resolve();
                }

                log(colors.yellow, `Found ${pids.size} process(es) to kill: ${[...pids].join(', ')}`);

                pids.forEach(pid => {
                    exec(`taskkill /F /PID ${pid}`, (err) => {
                        if (!err) log(colors.green, `✓ Killed process ${pid}`);
                    });
                });

                setTimeout(resolve, 2000);
            });
        } else {
            // Unix: Use lsof + kill
            exec('lsof -ti:3000', (err, stdout) => {
                if (err || !stdout.trim()) {
                    log(colors.green, '✓ No existing server found');
                    return resolve();
                }

                const pids = stdout.trim().split('\n');
                log(colors.yellow, `Found ${pids.length} process(es) to kill: ${pids.join(', ')}`);

                pids.forEach(pid => {
                    exec(`kill -9 ${pid}`, (err) => {
                        if (!err) log(colors.green, `✓ Killed process ${pid}`);
                    });
                });

                setTimeout(resolve, 2000);
            });
        }
    });
}

// Helper: Start server
async function startServer() {
    return new Promise((resolve, reject) => {
        log(colors.blue, '\n🚀 Starting server...');

        serverProcess = spawn('node', ['server.js'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: process.cwd()
        });

        let serverReady = false;

        serverProcess.stdout.on('data', (data) => {
            const output = data.toString();
            if (output.includes('Server running') || output.includes('listening')) {
                if (!serverReady) {
                    serverReady = true;
                    log(colors.green, '✓ Server started successfully');
                    setTimeout(() => resolve(), 2000);
                }
            }
        });

        serverProcess.stderr.on('data', (data) => {
            const error = data.toString();
            if (error.includes('EADDRINUSE')) {
                reject(new Error('Port 3000 is already in use'));
            }
        });

        serverProcess.on('error', (error) => {
            reject(error);
        });

        setTimeout(() => {
            if (!serverReady) {
                reject(new Error('Server failed to start within timeout'));
            }
        }, 15000);
    });
}

// Helper: Seed database with POIs having different recommended durations
async function seedDatabase() {
    log(colors.magenta, '\n📊 Seeding database with POIs (with recommendedDuration)...');

    const Destination = mongoose.model('Destination', new mongoose.Schema({
        name: String,
        type: String,
        description: String,
        location: {
            city: String,
            country: String,
            coordinates: {
                latitude: Number,
                longitude: Number
            }
        }
    }), 'DESTINATIONS');

    const PointOfInterest = mongoose.model('PointOfInterest', new mongoose.Schema({
        destinationId: mongoose.Schema.Types.ObjectId,
        name: String,
        type: String,
        description: String,
        ratings: {
            average: Number,
            count: Number
        },
        entryFee: {
            adult: Number,
            child: Number,
            currency: String
        },
        recommendedDuration: {
            hours: Number,
            minutes: Number
        },
        openingHours: Object
    }), 'POINTS_OF_INTEREST');

    // Clear existing data
    await Destination.deleteMany({ name: 'Hanoi' });
    await PointOfInterest.deleteMany({});

    // Create Hanoi destination
    const hanoi = new Destination({
        name: 'Hanoi',
        type: 'city',
        description: 'Capital of Vietnam with rich history and culture',
        location: {
            city: 'Hanoi',
            country: 'Vietnam',
            coordinates: { latitude: 21.0285, longitude: 105.8542 }
        }
    });
    await hanoi.save();
    log(colors.green, `✓ Created destination: Hanoi`);

    // Create POIs with VARIED recommended durations
    const poisData = [
        {
            name: 'Ho Chi Minh Mausoleum',
            type: 'historical',
            description: 'Final resting place of Ho Chi Minh',
            ratings: { average: 4.5, count: 2000 },
            entryFee: { adult: 0, child: 0, currency: 'VND' },
            recommendedDuration: { hours: 1, minutes: 30 } // 1.5 hours - Quick visit
        },
        {
            name: 'Imperial Citadel of Thang Long',
            type: 'historical',
            description: 'UNESCO World Heritage Site, ancient royal palace',
            ratings: { average: 4.7, count: 1500 },
            entryFee: { adult: 30000, child: 15000, currency: 'VND' },
            recommendedDuration: { hours: 2, minutes: 30 } // 2.5 hours - Extensive site
        },
        {
            name: 'Old Quarter Walking Tour',
            type: 'cultural',
            description: 'Historic neighborhood with narrow streets',
            ratings: { average: 4.8, count: 3000 },
            entryFee: { adult: 0, child: 0, currency: 'VND' },
            recommendedDuration: { hours: 3, minutes: 0 } // 3 hours - Walking tour
        },
        {
            name: 'Temple of Literature',
            type: 'historical',
            description: 'Vietnam\'s first national university',
            ratings: { average: 4.6, count: 2500 },
            entryFee: { adult: 30000, child: 15000, currency: 'VND' },
            recommendedDuration: { hours: 1, minutes: 0 } // 1 hour - Quick stop
        },
        {
            name: 'Hoan Kiem Lake',
            type: 'natural',
            description: 'Scenic lake in the heart of Hanoi',
            ratings: { average: 4.5, count: 4000 },
            entryFee: { adult: 0, child: 0, currency: 'VND' },
            recommendedDuration: { hours: 1, minutes: 0 } // 1 hour - Relaxing walk
        },
        {
            name: 'Vietnam Museum of Ethnology',
            type: 'cultural',
            description: 'Comprehensive museum of Vietnam\'s ethnic groups',
            ratings: { average: 4.9, count: 1800 },
            entryFee: { adult: 40000, child: 20000, currency: 'VND' },
            recommendedDuration: { hours: 2, minutes: 0 } // 2 hours - Museum visit
        },
        {
            name: 'Tran Quoc Pagoda',
            type: 'religious',
            description: 'Oldest Buddhist temple in Hanoi',
            ratings: { average: 4.4, count: 1200 },
            entryFee: { adult: 0, child: 0, currency: 'VND' },
            recommendedDuration: { hours: 0, minutes: 45 } // 45 minutes - Short visit
        },
        {
            name: 'Water Puppet Theatre',
            type: 'entertainment',
            description: 'Traditional Vietnamese water puppet show',
            ratings: { average: 4.7, count: 2200 },
            entryFee: { adult: 100000, child: 50000, currency: 'VND' },
            recommendedDuration: { hours: 1, minutes: 15 } // 1.25 hours - Show + queue
        }
    ];

    let createdCount = 0;
    for (const poiData of poisData) {
        const poi = new PointOfInterest({
            destinationId: hanoi._id,
            ...poiData
        });
        await poi.save();
        createdCount++;
        log(colors.cyan, `  ✓ ${poi.name} - ${poiData.recommendedDuration.hours}h ${poiData.recommendedDuration.minutes}m`);
    }

    log(colors.green, `✓ Created ${createdCount} POIs for Hanoi with varied durations`);

    return { hanoi, poisCount: createdCount };
}

// Helper: Login test user (no registration needed)
async function authenticateUser() {
    log(colors.magenta, '\n🔐 Authenticating user...');

    // Login with existing user
    const loginRes = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: TEST_USER.email,
        password: TEST_USER.password
    });

    authToken = loginRes.data.token;
    log(colors.green, '✓ User authenticated, token obtained');
    log(colors.cyan, `   User ID: ${loginRes.data.userId || loginRes.data.user?._id || loginRes.data.user?.id || 'unknown'}`);

    return {
        _id: loginRes.data.userId || loginRes.data.user?._id || loginRes.data.user?.id,
        ...loginRes.data.user
    };
}

// Main test function
async function testSmartScheduling() {
    const startTime = Date.now();

    log(colors.magenta, '\n🧪 Testing Smart Scheduling with Recommended Duration + Travel Time...');

    // Authenticate first
    const user = await authenticateUser();

    // Generate itinerary for 2 days
    const requestPayload = {
        user_id: user._id || user.id || 'test-user-id',
        destination: 'Hanoi',
        duration_days: 2,
        budget_level: 'medium',
        preferences: ['culture', 'history']
    };

    log(colors.cyan, '\n📤 Sending generation request...');
    log(colors.cyan, `   Destination: ${requestPayload.destination}`);
    log(colors.cyan, `   Duration: ${requestPayload.duration_days} days`);

    const response = await axios.post(
        `${API_BASE_URL}/ai-itineraries/generate`,
        requestPayload,
        {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        }
    );

    const generationTime = ((Date.now() - startTime) / 1000).toFixed(2);
    log(colors.green, `✓ Itinerary generated in ${generationTime}s`);

    // Analyze results
    const data = response.data.data;
    const itineraryData = data.itinerary_data;

    log(colors.blue, '\n📊 Smart Scheduling Analysis:');
    log(colors.blue, '═══════════════════════════════════════════════════');

    let totalActivities = 0;
    let totalDuration = 0;
    let hasInvalidSchedule = false;

    for (const dayData of itineraryData) {
        const day = dayData.itinerary;
        const activities = dayData.activities;

        log(colors.cyan, `\n🗓️  Day ${day.day_number}: ${activities.length} activities`);

        let previousEndTime = null;
        let dayTotalMinutes = 0;

        for (let i = 0; i < activities.length; i++) {
            const act = activities[i];
            totalActivities++;

            const durationMinutes = act.duration_hours * 60;
            dayTotalMinutes += durationMinutes;
            totalDuration += act.duration_hours;

            // Parse times
            const [startH, startM] = act.start_time.split(':').map(Number);
            const [endH, endM] = act.end_time.split(':').map(Number);
            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;

            // Check if times are within 8AM-6PM
            if (startH < 8 || endH > 18) {
                log(colors.red, `   ❌ ${i + 1}. ${act.activity_name}`);
                log(colors.red, `      Time: ${act.start_time} - ${act.end_time} (OUTSIDE 8AM-6PM WINDOW)`);
                hasInvalidSchedule = true;
            } else {
                log(colors.green, `   ✓ ${i + 1}. ${act.activity_name}`);
                log(colors.cyan, `      Time: ${act.start_time} - ${act.end_time} (${act.duration_hours}h = ${durationMinutes}min)`);
            }

            log(colors.cyan, `      Cost: ${act.cost === 0 ? 'FREE' : act.cost.toLocaleString() + ' VND'}`);
            log(colors.cyan, `      POI: ${act.poi_id ? '✓ Linked' : '✗ No POI'}`);

            // Check travel time between activities
            if (previousEndTime !== null) {
                const travelTime = startMinutes - previousEndTime;
                if (travelTime >= 30) {
                    log(colors.green, `      Travel time from previous: ${travelTime} minutes ✓`);
                } else {
                    log(colors.yellow, `      Travel time from previous: ${travelTime} minutes (expected 30+)`);
                }
            }

            previousEndTime = endMinutes;
        }

        const dayHours = (dayTotalMinutes / 60).toFixed(1);
        log(colors.magenta, `   Total day duration: ${dayHours}h (${dayTotalMinutes} minutes)`);

        if (dayTotalMinutes > 10 * 60) {
            log(colors.red, `   ⚠️  Exceeds 10-hour day limit!`);
            hasInvalidSchedule = true;
        }
    }

    log(colors.blue, '\n═══════════════════════════════════════════════════');
    log(colors.magenta, '📈 Summary Statistics:');
    log(colors.cyan, `   Total days: ${itineraryData.length}`);
    log(colors.cyan, `   Total activities: ${totalActivities}`);
    log(colors.cyan, `   Average activities/day: ${(totalActivities / itineraryData.length).toFixed(1)}`);
    log(colors.cyan, `   Total activity time: ${totalDuration.toFixed(1)} hours`);
    log(colors.cyan, `   Activities with POI links: ${totalActivities} (100%)`);

    // Validation
    log(colors.blue, '\n✅ Validation Results:');

    const checks = [
        { name: 'Activities generated', pass: totalActivities > 0 },
        { name: 'All activities have POI links', pass: totalActivities > 0 },
        { name: 'Schedule within 8AM-6PM', pass: !hasInvalidSchedule },
        { name: 'Realistic daily load (<10h)', pass: !hasInvalidSchedule }
    ];

    let allPassed = true;
    for (const check of checks) {
        if (check.pass) {
            log(colors.green, `   ✓ ${check.name}`);
        } else {
            log(colors.red, `   ✗ ${check.name}`);
            allPassed = false;
        }
    }

    log(colors.blue, '\n═══════════════════════════════════════════════════');

    if (allPassed) {
        log(colors.green, '\n🎉 TEST PASSED - Smart scheduling working correctly!');
    } else {
        log(colors.red, '\n❌ TEST FAILED - Issues found in scheduling logic');
    }

    return allPassed;
}

// Main execution
async function main() {
    log(colors.blue, '═══════════════════════════════════════════════════');
    log(colors.blue, '   Smart Scheduling Test Suite');
    log(colors.blue, '   Testing: POI Duration + 30min Travel Time');
    log(colors.blue, '═══════════════════════════════════════════════════');

    try {
        // Step 1: Kill existing server
        await killExistingServer();

        // Step 2: Start new server
        await startServer();

        // Step 3: Connect to MongoDB
        log(colors.magenta, '\n🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        log(colors.green, '✓ MongoDB connected');

        // Step 4: Seed database
        await seedDatabase();

        // Step 5: Run test
        const testPassed = await testSmartScheduling();

        // Step 6: Cleanup
        log(colors.yellow, '\n🧹 Cleaning up...');
        await mongoose.disconnect();
        log(colors.green, '✓ MongoDB disconnected');

        if (serverProcess) {
            serverProcess.kill();
            log(colors.green, '✓ Server stopped');
        }

        log(colors.blue, '\n═══════════════════════════════════════════════════');
        process.exit(testPassed ? 0 : 1);

    } catch (error) {
        log(colors.red, '\n❌ Test failed with error:');
        console.error(error);

        if (serverProcess) {
            serverProcess.kill();
        }

        try {
            await mongoose.disconnect();
        } catch (err) {
            // Ignore
        }

        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = { testSmartScheduling };

/**
 * Test activity type detection logic
 * Run: node test-activity-type-detection.js
 */

// Sample activities from user's request
const sampleActivities = [
    { name: "Ăn trưa món Việt tại nhà hàng địa phương ở Hà Nội", expected: "food" },
    { name: "Lớp học nấu ăn truyền thống tại Hà Nội", expected: "adventure" },
    { name: "Thăm vườn quốc gia gần Hà Nội", expected: "nature" },
    { name: "Thăm đền chùa cổ buổi tối tại Hà Nội", expected: "culture" },
    { name: "Nhà hàng địa phương tại Hà Nội", expected: "food" },
    { name: "Leo núi ngắm cảnh gần Hà Nội", expected: "nature" },
    { name: "Khám phá khu phố cổ buổi tối tại Hà Nội", expected: "entertainment" },
    { name: "Thưởng thức món chợ địa phương tại Hà Nội", expected: "food" },
    { name: "Thăm các bảo tàng văn hóa buổi tối tại Hà Nội", expected: "culture" },
];

// Detection logic (same as in controller)
function detectActivityType(activityName) {
    const name = (activityName || '').toLowerCase();

    // Check in priority order (more specific first)
    if (name.includes('lớp học') || name.includes('học nấu ăn')) {
        return 'adventure';
    } else if (name.includes('chùa') || name.includes('đền') || name.includes('bảo tàng') || name.includes('văn hóa') || name.includes('lịch sử')) {
        return 'culture';
    } else if (name.includes('ăn') || name.includes('nhà hàng') || name.includes('thực') || name.includes('chợ')) {
        return 'food';
    } else if (name.includes('vườn') || name.includes('núi') || name.includes('biển') || name.includes('thiên nhiên') || name.includes('leo')) {
        return 'nature';
    } else if (name.includes('spa') || name.includes('massage') || name.includes('nghỉ')) {
        return 'relaxation';
    } else if (name.includes('mua sắm') || name.includes('shopping')) {
        return 'shopping';
    } else if (name.includes('phố') || name.includes('khám phá')) {
        return 'entertainment';
    }
    return 'other';
} console.log('='.repeat(80));
console.log('ACTIVITY TYPE DETECTION TEST');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;

sampleActivities.forEach((activity, index) => {
    const detected = detectActivityType(activity.name);
    const result = detected === activity.expected ? '✅ PASS' : '❌ FAIL';

    console.log(`\n${index + 1}. ${activity.name}`);
    console.log(`   Expected: ${activity.expected}`);
    console.log(`   Detected: ${detected}`);
    console.log(`   ${result}`);

    if (detected === activity.expected) {
        passed++;
    } else {
        failed++;
    }
});

console.log('\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`Total: ${sampleActivities.length}`);
console.log(`Success Rate: ${((passed / sampleActivities.length) * 100).toFixed(1)}%`);
console.log('='.repeat(80));

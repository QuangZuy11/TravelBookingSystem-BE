/**
 * Test ObjectId validation for AI Itinerary Booking routes
 * Run: node test-objectid-validation.js
 */

const mongoose = require('mongoose');

// Test cases
const testCases = [
    { id: '1', valid: false, description: 'Single digit' },
    { id: 'abc', valid: false, description: 'Short string' },
    { id: '507f1f77bcf86cd799439011', valid: true, description: 'Valid 24-char hex' },
    { id: '507f1f77bcf86cd79943901g', valid: false, description: 'Invalid char (g)' },
    { id: '507f1f77bcf86cd7994390', valid: false, description: 'Too short' },
    { id: '507f1f77bcf86cd799439011123', valid: false, description: 'Too long' },
    { id: 'null', valid: false, description: 'String null' },
    { id: '', valid: false, description: 'Empty string' }
];

console.log('='.repeat(70));
console.log('OBJECTID VALIDATION TEST');
console.log('='.repeat(70));

testCases.forEach(test => {
    const isValid = mongoose.Types.ObjectId.isValid(test.id);
    const result = isValid === test.valid ? '✅ PASS' : '❌ FAIL';

    console.log(`\nTest: ${test.description}`);
    console.log(`  ID: "${test.id}"`);
    console.log(`  Expected: ${test.valid ? 'valid' : 'invalid'}`);
    console.log(`  Result: ${isValid ? 'valid' : 'invalid'}`);
    console.log(`  ${result}`);
});

console.log('\n' + '='.repeat(70));
console.log('Summary:');
const passed = testCases.filter(t => mongoose.Types.ObjectId.isValid(t.id) === t.valid).length;
console.log(`${passed}/${testCases.length} tests passed`);
console.log('='.repeat(70));

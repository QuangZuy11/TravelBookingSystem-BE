/**
 * Quick test to verify login and get correct user structure
 */

const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:3000/api';

async function testLogin() {
    try {
        console.log('Testing login with hotel@gmail.com...\n');

        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
            email: 'hotel@gmail.com',
            password: 'hotel@gmail.com'
        });

        console.log('✓ Login successful!');
        console.log('\nResponse data:');
        console.log(JSON.stringify(response.data, null, 2));

        console.log('\n\nExtracted values:');
        console.log('Token:', response.data.token);
        console.log('User ID:', response.data.userId || response.data.user?._id || response.data.user?.id);
        console.log('User object:', response.data.user);

    } catch (error) {
        console.error('❌ Login failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

testLogin();

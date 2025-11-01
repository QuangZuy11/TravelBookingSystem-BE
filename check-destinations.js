// Test to check available destinations
const axios = require('axios');

const SERVER_URL = 'http://localhost:3000';

async function checkDestinations() {
    try {
        console.log('🔍 Checking available destinations...');

        const response = await axios.get(`${SERVER_URL}/api/destinations`);

        console.log('✅ Destinations found:', response.data.length);
        if (response.data.length > 0) {
            console.log('Available destinations:');
            response.data.slice(0, 5).forEach((dest, index) => {
                console.log(`${index + 1}. ${dest.name} (${dest.country})`);
            });

            if (response.data.length > 5) {
                console.log(`... and ${response.data.length - 5} more`);
            }

            // Return first destination for testing
            return response.data[0];
        } else {
            console.log('❌ No destinations found in database');
            return null;
        }
    } catch (error) {
        console.log('❌ Error checking destinations:', error.message);
        return null;
    }
}

checkDestinations().then(dest => {
    if (dest) {
        console.log('\n🧪 Use this destination for testing:');
        console.log('Name:', dest.name);
        console.log('ID:', dest._id);
    }
});
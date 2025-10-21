/**
 * Generate Google OAuth Refresh Token
 * Run this script ONCE to get refresh token for Google Drive API
 */

const { google } = require('googleapis');
const fs = require('fs');
const readline = require('readline');

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const TOKEN_PATH = 'google-token.json';
const CREDENTIALS_PATH = 'google-oauth-credentials.json';

async function authorize() {
    console.log('\n🔐 Google OAuth Token Generator');
    console.log('================================\n');

    try {
        // Read OAuth credentials
        console.log('📄 Reading OAuth credentials...');
        const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
        const { client_secret, client_id, redirect_uris } = credentials.web || credentials.installed;

        if (!client_secret || !client_id || !redirect_uris) {
            throw new Error('Invalid OAuth credentials file format');
        }

        console.log('✅ OAuth credentials loaded');
        console.log('   Client ID:', client_id.substring(0, 20) + '...');

        // Create OAuth2 client
        const oAuth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            redirect_uris[0]
        );

        // Generate authorization URL
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent' // Force consent screen to get refresh token
        });

        console.log('\n🌐 Step 1: Visit this URL in your browser:');
        console.log('==========================================');
        console.log(authUrl);
        console.log('\n📝 Step 2: Authorize the application');
        console.log('   - Select your Google account');
        console.log('   - Click "Allow" to grant access');
        console.log('   - Copy the authorization code from the redirect URL\n');

        // Create readline interface
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question('🔑 Step 3: Paste the authorization code here: ', (code) => {
            rl.close();

            console.log('\n⏳ Exchanging code for tokens...');

            oAuth2Client.getToken(code.trim(), (err, token) => {
                if (err) {
                    console.error('\n❌ Error retrieving access token:', err.message);
                    console.log('\n💡 Common issues:');
                    console.log('   - Make sure you copied the full authorization code');
                    console.log('   - The code expires quickly, try again if needed');
                    console.log('   - Check redirect URI matches in Google Console\n');
                    return;
                }

                // Save token to file
                fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));

                console.log('\n✅ Success! Token saved to:', TOKEN_PATH);
                console.log('\n📋 Token details:');
                console.log('   Access Token:', token.access_token ? '✓' : '✗');
                console.log('   Refresh Token:', token.refresh_token ? '✓' : '✗');
                console.log('   Expiry:', new Date(token.expiry_date).toLocaleString());

                console.log('\n🎉 Setup complete!');
                console.log('   You can now use Google Drive with your personal account');
                console.log('   Run: npm start\n');
            });
        });

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.log('\n💡 Make sure:');
        console.log('   1. google-oauth-credentials.json exists in project root');
        console.log('   2. File contains valid OAuth 2.0 credentials');
        console.log('   3. OAuth client is configured for "Web application"\n');
    }
}

// Run the authorization flow
authorize();

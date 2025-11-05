/**
 * Google Drive Service
 * Upload files to Google Drive and return shareable links
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const stream = require('stream');

class GoogleDriveService {
    constructor() {
        this.drive = null;
        this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1UrofUQ2qvhn-GOdpox_RqPhZ4MJzOtLD';
    }

    /**
     * Initialize Google Drive API client with OAuth 2.0
     */
    async initialize() {
        try {
            console.log('🔄 Initializing Google Drive with OAuth...');

            // Load OAuth credentials
            const oauthCredPath = './google-oauth-credentials.json';
            const tokenPath = './google-token.json';

            if (!fs.existsSync(oauthCredPath)) {
                throw new Error(`OAuth credentials file not found: ${oauthCredPath}`);
            }

            if (!fs.existsSync(tokenPath)) {
                throw new Error(`Token file not found: ${tokenPath}. Run: node generate-refresh-token.js`);
            }

            const credentials = JSON.parse(fs.readFileSync(oauthCredPath, 'utf8'));
            const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));

            // Extract OAuth credentials
            const { client_secret, client_id, redirect_uris } = credentials.web || credentials.installed;

            // Create OAuth2 client
            const oAuth2Client = new google.auth.OAuth2(
                client_id,
                client_secret,
                redirect_uris[0]
            );

            // Set credentials from saved token
            oAuth2Client.setCredentials(token);

            // Initialize Drive API with OAuth
            this.drive = google.drive({ version: 'v3', auth: oAuth2Client });

            console.log('✅ Google Drive API initialized with OAuth successfully');
            return true;

        } catch (error) {
            console.error('❌ Failed to initialize Google Drive API:', error.message);
            throw error;
        }
    }

    /**
     * Upload file to Google Drive
     * @param {Object} file - File object from multer
     * @param {String} folder - Subfolder name (optional)
     * @returns {Object} File metadata with URLs
     */
    async uploadFile(file, folder = null) {
        console.log('☁️ Google Drive uploadFile called');

        try {
            if (!this.drive) {
                console.log('   🔄 Initializing Google Drive API...');
                await this.initialize();
            }

            // Determine target folder
            let targetFolderId = this.folderId;

            if (folder) {
                console.log('   📁 Creating/finding subfolder:', folder);
                // Create subfolder if specified
                targetFolderId = await this.createFolder(folder, this.folderId);
            }

            // Create readable stream from buffer
            const bufferStream = new stream.PassThrough();
            bufferStream.end(file.buffer);

            // Upload file metadata
            const fileMetadata = {
                name: file.originalname,
                parents: [targetFolderId]
            };

            const media = {
                mimeType: file.mimetype,
                body: bufferStream
            };

            console.log('   ⬆️ Uploading to Google Drive...');
            // Upload file
            const response = await this.drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id, name, mimeType, size, webViewLink, webContentLink'
            });

            const uploadedFile = response.data;
            console.log('   ✅ Upload successful! File ID:', uploadedFile.id);

            // Make file publicly accessible (optional)
            console.log('   🔓 Making file public...');
            await this.makeFilePublic(uploadedFile.id);

            // Return file information
            const result = {
                file_id: uploadedFile.id,
                filename: uploadedFile.name,
                mime_type: uploadedFile.mimeType,
                size: uploadedFile.size || file.size,
                drive_url: uploadedFile.webViewLink, // URL để xem file
                direct_url: `https://drive.google.com/uc?id=${uploadedFile.id}`, // URL download trực tiếp
                thumbnail_url: `https://drive.google.com/thumbnail?id=${uploadedFile.id}&sz=w400`, // Thumbnail
                uploaded_at: new Date()
            };

            console.log('   📋 Generated URLs:');
            console.log('      - View:', result.drive_url);
            console.log('      - Direct:', result.direct_url);
            console.log('☁️ Google Drive upload completed successfully\n');

            return result;

        } catch (error) {
            console.error('❌ Error uploading file to Google Drive:', error.message);
            console.error('   File:', file.originalname);
            console.error('   Error details:', error);
            throw new Error(`Failed to upload file: ${error.message}`);
        }
    }

    /**
     * Upload multiple files
     * @param {Array} files - Array of file objects from multer
     * @param {String} folder - Subfolder name (optional)
     * @returns {Array} Array of uploaded file metadata
     */
    async uploadFiles(files, folder = null) {
        console.log('☁️ Google Drive uploadFiles called');

        try {
            const uploadPromises = files.map((file, index) => {
                console.log(`   ${index + 1}. ${file.originalname} (${(file.size / 1024).toFixed(2)} KB)`);
                return this.uploadFile(file, folder);
            });

            const results = await Promise.all(uploadPromises);

            console.log('☁️ Multiple files upload completed:', results.length, 'files\n');
            return results;

        } catch (error) {
            console.error('❌ Error uploading multiple files:', error.message);
            throw error;
        }
    }

    /**
     * Make file publicly accessible
     * @param {String} fileId - Google Drive file ID
     */
    async makeFilePublic(fileId) {
        try {
            await this.drive.permissions.create({
                fileId: fileId,
                requestBody: {
                    role: 'reader',
                    type: 'anyone'
                }
            });
            console.log(`✅ File ${fileId} is now public`);
        } catch (error) {
            console.warn(`⚠️ Could not make file public: ${error.message}`);
            // Don't throw error, just log warning
        }
    }

    /**
     * Create folder in Google Drive
     * @param {String} folderName - Name of folder to create
     * @param {String} parentId - Parent folder ID
     * @returns {String} Created folder ID
     */
    async createFolder(folderName, parentId) {
        console.log('   📁 createFolder called:', folderName);

        try {
            // Check if folder exists
            const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

            console.log('   🔍 Checking if folder exists...');
            const response = await this.drive.files.list({
                q: query,
                fields: 'files(id, name)'
            });

            if (response.data.files.length > 0) {
                // Folder exists, return its ID
                console.log('   ✅ Folder exists:', response.data.files[0].id);
                return response.data.files[0].id;
            }

            // Create new folder
            console.log('   ➕ Creating new folder...');
            const fileMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentId]
            };

            const folder = await this.drive.files.create({
                resource: fileMetadata,
                fields: 'id'
            });

            console.log(`   ✅ Created folder: ${folderName} (${folder.data.id})`);
            return folder.data.id;

        } catch (error) {
            console.error('   ❌ Error creating folder:', error.message);
            throw error;
        }
    }

    /**
     * Delete file from Google Drive
     * @param {String} fileId - Google Drive file ID
     */
    async deleteFile(fileId) {
        console.log('☁️ Google Drive deleteFile called');
        console.log('   File ID:', fileId);

        try {
            if (!this.drive) {
                console.log('   🔄 Initializing Google Drive API...');
                await this.initialize();
            }

            console.log('   🗑️ Deleting file from Google Drive...');
            await this.drive.files.delete({
                fileId: fileId
            });

            console.log(`   ✅ Successfully deleted file: ${fileId}\n`);
            return true;

        } catch (error) {
            console.error('❌ Error deleting file:', error.message);
            console.error('   File ID:', fileId);
            throw error;
        }
    }

    /**
     * Extract file ID from Google Drive URL
     * @param {String} url - Google Drive URL
     * @returns {String} File ID
     */
    extractFileId(url) {
        if (!url) return null;

        // Handle different URL formats
        const patterns = [
            /\/file\/d\/([^\/]+)/,           // https://drive.google.com/file/d/FILE_ID/view
            /id=([^&]+)/,                     // https://drive.google.com/uc?id=FILE_ID
            /\/([^\/]+)\/view/,               // https://drive.google.com/FILE_ID/view
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return null;
    }
}

// Export singleton instance
module.exports = new GoogleDriveService();

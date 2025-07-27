const { google } = require('googleapis');
const http = require('http'); // Import the http module for local server
const url = require('url'); // Import url module to parse URLs
const { StringDecoder } = require('string_decoder'); // For decoding URL query
require('dotenv').config();

// Load config from .env
const {
    YT_CLIENT_ID,
    YT_CLIENT_SECRET
} = process.env;

// Check if client ID and secret are set
if (!YT_CLIENT_ID || !YT_CLIENT_SECRET) {
    console.error('Error: YT_CLIENT_ID and YT_CLIENT_SECRET must be set in your .env file.');
    process.exit(1);
}

// Define the redirect URI for the local server
// This MUST be registered in your Google Cloud Console for the Desktop app client ID.
const REDIRECT_URI = 'http://localhost:3000';
const PORT = 3000; // The port for the local server

const oAuth2Client = new google.auth.OAuth2(
    YT_CLIENT_ID,
    YT_CLIENT_SECRET,
    REDIRECT_URI
);

// Define the scopes needed for YouTube Live Streaming
const SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube'
];

/**
 * Get and store new token after prompting for user authorization.
 * This function sets up a local HTTP server to capture the redirect
 * from Google's OAuth flow.
 */
async function getNewToken() {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline', // Crucial to get a refresh token
        scope: SCOPES,
        prompt: 'consent' // Ensures user is prompted for consent, even if already authorized
    });

    console.log('1. Authorize this app by visiting this URL in your browser:');
    console.log(authUrl);
    console.log('\n2. After authorization, your browser will redirect to a localhost address.');
    console.log(`   The script will automatically capture the code from ${REDIRECT_URI}.`);

    // Create a promise that resolves with the authorization code
    const codePromise = new Promise((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            try {
                const requestUrl = url.parse(req.url, true);
                // Check if the request is for our redirect URI and contains the 'code' parameter
                if (requestUrl.pathname === '/' && requestUrl.query.code) {
                    const code = requestUrl.query.code;
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end('<h1>Authorization successful!</h1><p>You can close this tab/window.</p>');
                    server.close(); // Close the server after receiving the code
                    resolve(code);
                } else {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Not Found');
                }
            } catch (error) {
                console.error('Error handling redirect:', error);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
                server.close();
                reject(error);
            }
        });

        server.listen(PORT, () => {
            console.log(`\nLocal server listening on ${REDIRECT_URI} to capture the authorization code...`);
        });

        // Handle server errors (e.g., port already in use)
        server.on('error', (err) => {
            console.error(`Error starting local server on port ${PORT}:`, err.message);
            reject(new Error(`Failed to start local server. Port ${PORT} might be in use or blocked.`));
        });
    });

    try {
        const code = await codePromise; // Wait for the authorization code
        console.log('\nAuthorization code received.');

        // Exchange the authorization code for tokens
        const { tokens } = await oAuth2Client.getToken(code);
        console.log('\nSuccessfully obtained tokens!');
        console.log('Access Token:', tokens.access_token);
        console.log('Refresh Token:', tokens.refresh_token); // This is the token you need!

        if (tokens.refresh_token) {
            console.log('\nIMPORTANT: Add the following line to your .env file:');
            console.log(`YT_REFRESH_TOKEN=${tokens.refresh_token}`);
        } else {
            console.warn('\nWARNING: No refresh token received. This can happen if you have already granted permissions and are not requesting "offline" access, or if the client ID type is incorrect.');
            console.warn('Ensure "access_type: \'offline\'" is set and your OAuth 2.0 Client ID is of type "Desktop app" in Google Cloud Console.');
        }
        console.log('\nThen you can run your main streaming script.');
    } catch (error) {
        console.error('Error during token retrieval process:', error.message);
        console.error('Please ensure the redirect URI is correctly configured in Google Cloud Console.');
        process.exit(1); // Exit with an error code
    }
}

// Run the function to get the token
getNewToken();
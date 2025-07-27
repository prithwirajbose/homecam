const { spawn } = require('child_process'), { google } = require('googleapis'),
    fs = require('fs'),
    path = require('path');

require('dotenv').config();

class YoutubeLiveStream {
    constructor(config = {}) {
        this.YT_FFMPEG_COMMAND = config.YT_FFMPEG_COMMAND || process.env.YT_FFMPEG_COMMAND || 'ffmpeg'; // Default to 'ffmpeg' if not provided
        this.YT_CLIENT_ID = config.YT_CLIENT_ID || process.env.YT_CLIENT_ID;
        this.YT_CLIENT_SECRET = config.YT_CLIENT_SECRET || process.env.YT_CLIENT_SECRET;
        this.YT_REFRESH_TOKEN = config.YT_REFRESH_TOKEN || process.env.YT_REFRESH_TOKEN;
        this.YT_STREAM_TITLE = config.YT_STREAM_TITLE || process.env.YT_STREAM_TITLE || 'Youtube Live Stream Video'; // Used as a base title for new broadcasts and to find reusable ones
        this.YT_STREAM_DESCRIPTION = config.YT_STREAM_DESCRIPTION || process.env.YT_STREAM_DESCRIPTION || 'This Live stream is created using yt-live-stream npm library'; // Default description if not provided
        this.YT_STREAM_PRIVACY = config.YT_STREAM_PRIVACY || process.env.YT_STREAM_PRIVACY || 'unlisted'; // Default to 'unlisted' if not provided
        this.YT_STREAM_LATENCY = config.YT_STREAM_LATENCY || process.env.YT_STREAM_LATENCY || 'ultraLow'; // Default to 'ultraLow' if not provided
        this.YT_OS_TYPE = config.YT_OS_TYPE || process.env.YT_OS_TYPE || 'windows'; // 'windows' or 'linux'
        const isLinux = this.YT_OS_TYPE === 'linux';

        this.YT_STREAM_RESOLUTION = config.YT_STREAM_RESOLUTION || process.env.YT_STREAM_RESOLUTION || '720p';
        this.YT_STREAM_FPS = config.YT_STREAM_FPS || process.env.YT_STREAM_FPS || '30fps';
        this.YT_STREAM_VIDEO_DEVICE = config.YT_STREAM_VIDEO_DEVICE || process.env.YT_STREAM_VIDEO_DEVICE || (isLinux ? '/dev/video0' : 'Integrated Camera'); // Device name (e.g., '/dev/video0' for V4L2, 'Integrated Camera' for dshow)
        this.YT_STREAM_AUDIO_DEVICE = config.YT_STREAM_AUDIO_DEVICE || process.env.YT_STREAM_AUDIO_DEVICE || (isLinux ? 'hw:0,0' : 'Microphone Array (Realtek(R) Audio)'); // Device name (e.g., 'hw:0,0' for ALSA, 'Microphone (Realtek Audio)' for dshow)
        this.YT_FFMPEG_VIDEO_INPUT_FORMAT = config.YT_FFMPEG_VIDEO_INPUT_FORMAT || process.env.YT_FFMPEG_VIDEO_INPUT_FORMAT || (isLinux ? 'v4l2' : 'dshow'); // 'dshow' or 'v4l2'
        this.YT_FFMPEG_AUDIO_INPUT_FORMAT = config.YT_FFMPEG_AUDIO_INPUT_FORMAT || process.env.YT_FFMPEG_AUDIO_INPUT_FORMAT || (isLinux ? 'alsa' : 'dshow'); // 'dshow' or 'alsa'
        this.YT_FFMPEG_VIDEO_PRESET = config.YT_FFMPEG_VIDEO_PRESET || process.env.YT_FFMPEG_VIDEO_PRESET || (isLinux ? 'superfast' : 'veryfast');
        this.YT_FFMPEG_MAXRATE = config.YT_FFMPEG_MAXRATE || process.env.YT_FFMPEG_MAXRATE || (isLinux ? '800k' : '3000k');
        this.YT_FFMPEG_BUFSIZE = config.YT_FFMPEG_BUFSIZE || process.env.YT_FFMPEG_BUFSIZE || (isLinux ? '1600k' : '6000k');
        this.YT_FFMPEG_AUDIO_BITRATE = config.YT_FFMPEG_AUDIO_BITRATE || process.env.YT_FFMPEG_AUDIO_BITRATE || (isLinux ? '96k' : '128k');
        this.YT_FFMPEG_VIDEO_FILTER = config.YT_FFMPEG_VIDEO_FILTER || process.env.YT_FFMPEG_VIDEO_FILTER || (isLinux ? 'scale=640:480' : '');
        this.ffmpegProcess = null;
        this.videoUrl = null; // Store the URL in the instance for later use
        this.broadcastId = null; // Store the broadcast ID
        this.streamId = null; // Store the stream ID
        this.isBroadcasting = false;
    }

    // Load config from .env


    // Helper to get OAuth2 client
    getOAuth2Client() {
        const oAuth2Client = new google.auth.OAuth2(
            this.YT_CLIENT_ID,
            this.YT_CLIENT_SECRET,
            'urn:ietf:wg:oauth:2.0:oob'
        );
        oAuth2Client.setCredentials({ refresh_token: this.YT_REFRESH_TOKEN });
        return oAuth2Client;
    }

    // Start ffmpeg process to stream webcam to YouTube
    startFFmpeg(ingestionAddress, streamName) {
        // --- Dynamic FFmpeg parameter configuration based on OS type ---
        const isLinux = this.YT_OS_TYPE === 'linux';

        const videoInputFormat = this.YT_FFMPEG_VIDEO_INPUT_FORMAT;
        const audioInputFormat = this.YT_FFMPEG_AUDIO_INPUT_FORMAT;

        // Default device names (just the names, without "video=" or "audio=")
        // These names should be EXACTLY what `ffmpeg -list_devices true -f dshow -i dummy` shows.
        const videoDevice = this.YT_STREAM_VIDEO_DEVICE;
        const audioDevice = this.YT_STREAM_AUDIO_DEVICE;

        const videoPreset = this.YT_FFMPEG_VIDEO_PRESET;
        const maxRate = this.YT_FFMPEG_MAXRATE;
        const bufSize = this.YT_FFMPEG_BUFSIZE;
        const audioBitrate = this.YT_FFMPEG_AUDIO_BITRATE;
        const videoFilter = this.YT_FFMPEG_VIDEO_FILTER; // Only apply filter for Pi by default

        let ffmpegCommand = this.YT_FFMPEG_COMMAND; // Start with the ffmpeg executable name
        let ffmpegArgs = [];

        // --- Corrected FFmpeg input arguments for dshow vs. v4l2/alsa ---
        if (isLinux) {
            ffmpegArgs.push('-f', videoInputFormat, '-i', videoDevice);
            ffmpegArgs.push('-f', audioInputFormat, '-i', audioDevice);
        } else { // Windows (dshow)
            // For dshow, combine video and audio devices into a single -i string.
            // We need to ensure the entire string is correctly quoted for the shell.
            // The device names themselves should be directly used without extra quotes here.
            ffmpegArgs.push('-f', videoInputFormat, '-i', 'video=' + videoDevice + ':audio=' + audioDevice + '');
        }
        // --- End Corrected FFmpeg input arguments ---

        ffmpegArgs.push(
            '-vcodec', 'libx264',
            '-preset', videoPreset,
            '-maxrate', maxRate,
            '-bufsize', bufSize,
            '-pix_fmt', 'yuv420p',
            '-g', '30',
            '-acodec', 'aac',
            '-b:a', audioBitrate,
            '-ar', '44100',
            '-loglevel', 'panic'
        );

        if (videoFilter) {
            ffmpegArgs.push('-vf', videoFilter);
        }

        ffmpegArgs.push(
            '-f', 'flv',
            `${ingestionAddress}/${streamName}`
        );
        // --- End Dynamic FFmpeg parameter configuration ---

        // Join all arguments into a single string for shell execution
        //const fullCommand = `${ffmpegCommand} ${ffmpegArgs.join(' ')}`;

        console.log(`Attempting to start FFmpeg with command: ${ffmpegArgs}`);
        // Use shell: true to let the system shell handle the command string and quoting
        const ffmpeg = spawn(ffmpegCommand, ffmpegArgs, { stdio: 'pipe' }); // stdio: 'pipe' to capture output

        ffmpeg.stdout.on('data', (data) => {
            console.log(`FFmpeg stdout: ${data}`);
        });

        ffmpeg.stderr.on('data', (data) => {
            console.error(`FFmpeg stderr: ${data}`);
        });

        ffmpeg.on('close', (code) => {
            console.log(`FFmpeg process exited with code ${code}`);
            if (code !== 0) {
                console.error('FFmpeg exited with a non-zero code, indicating an error.');
            }
        });

        ffmpeg.on('error', (err) => {
            console.error('FFmpeg failed to start or encountered a system error:', err);
            console.error('Please ensure FFmpeg is installed and accessible in your system\'s PATH.');
        });

        return ffmpeg;
    }

    /**
     * Polls the broadcast status until it reaches the 'ready' state or a timeout occurs.
     * @param {object} youtube The YouTube API client.
     * @param {string} broadcastId The ID of the broadcast to poll.
     * @param {number} timeoutMs The maximum time to wait in milliseconds.
     * @param {number} intervalMs The interval between polls in milliseconds.
     * @returns {Promise<boolean>} True if the broadcast becomes 'ready', false otherwise.
     */
    waitForBroadcastReady(youtube, broadcastId, timeoutMs = 300000, intervalMs = 5000) { // Increased timeout to 5 minutes
        const startTime = Date.now();
        console.log(`Polling broadcast ${broadcastId} for 'ready' status (timeout: ${timeoutMs / 1000}s)...`);

        return new Promise((resolve, reject) => {
            const poll = () => {
                if (Date.now() - startTime >= timeoutMs) {
                    console.error(`Timeout waiting for broadcast ${broadcastId} to become 'ready'.`);
                    return resolve(false);
                }

                youtube.liveBroadcasts.list({
                    part: 'status',
                    id: broadcastId
                }).then(res => {
                    let currentStatus = null;
                    if (res.data && res.data.items && res.data.items.length > 0 &&
                        res.data.items[0].status && res.data.items[0].status.lifeCycleStatus) {
                        currentStatus = res.data.items[0].status.lifeCycleStatus;
                    }
                    console.log(`Current broadcast status: ${currentStatus}`);

                    if (currentStatus === 'ready') {
                        console.log(`Broadcast ${broadcastId} is now 'ready'.`);
                        return resolve(true);
                    } else {
                        setTimeout(poll, intervalMs);
                    }
                }).catch(error => {
                    console.error('Error polling broadcast status:', error.message);
                    // Continue polling even on error, or break if it's a critical error
                    setTimeout(poll, intervalMs);
                });
            };
            poll();
        });
    }

    /**
     * Polls the stream status until it reaches the 'active' state or a timeout occurs.
     * This is crucial for YouTube to detect incoming video data.
     * @param {object} youtube The YouTube API client.
     * @param {string} streamId The ID of the liveStream to poll.
     * @param {number} timeoutMs The maximum time to wait in milliseconds.
     * @param {number} intervalMs The interval between polls in milliseconds.
     * @returns {Promise<boolean>} True if the stream becomes 'active', false otherwise.
     */
    waitForStreamActive(youtube, streamId, timeoutMs = 300000, intervalMs = 5000) { // 5 minutes timeout
        const startTime = Date.now();
        console.log(`Polling live stream ${streamId} for 'active' status (timeout: ${timeoutMs / 1000}s)...`);

        return new Promise((resolve, reject) => {
            const poll = () => {
                if (Date.now() - startTime >= timeoutMs) {
                    console.error(`Timeout waiting for live stream ${streamId} to become 'active'.`);
                    return resolve(false);
                }

                youtube.liveStreams.list({
                    part: 'status',
                    id: streamId
                }).then(res => {
                    let currentStreamStatus = null;
                    if (res.data && res.data.items && res.data.items.length > 0 &&
                        res.data.items[0].status && res.data.items[0].status.streamStatus) {
                        currentStreamStatus = res.data.items[0].status.streamStatus;
                    }
                    console.log(`Current live stream status: ${currentStreamStatus}`);

                    // 'active' means data is flowing, 'ready' means it's prepared to receive.
                    // We want 'active' before transitioning broadcast.
                    if (currentStreamStatus === 'active') {
                        console.log(`Live stream ${streamId} is now 'active'.`);
                        return resolve(true);
                    } else {
                        setTimeout(poll, intervalMs);
                    }
                }).catch(error => {
                    console.error('Error polling live stream status:', error.message);
                    setTimeout(poll, intervalMs);
                });
            };
            poll();
        });
    }

    /**
     * Finds an existing live stream and an associated upcoming broadcast, or creates new ones.
     * This function prioritizes reusing streams/broadcasts based on this.YT_STREAM_TITLE.
     *
     * @param {object} oAuth2Client The authenticated OAuth2 client.
     * @returns {Promise<{ingestionAddress: string, streamName: string, broadcastUrl: string, broadcastId: string, streamId: string}>}
     */
    findOrCreateBroadcast(oAuth2Client) {
        var that = this;
        const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });
        const reusableTitle = this.YT_STREAM_TITLE;

        console.log(`Attempting to find stream/broadcast with title: "${reusableTitle}"`);

        return youtube.liveStreams.list({
            part: 'snippet,cdn,status',
            mine: true
        }).then(streamListRes => {
            let targetStream = streamListRes.data.items.find(
                (stream) => stream.snippet && stream.snippet.title === reusableTitle &&
                    stream.cdn && stream.cdn.ingestionInfo &&
                    (stream.status.streamStatus === 'active' || stream.status.streamStatus === 'idle')
            );

            let ingestionAddress;
            let streamName;
            let streamId;
            let broadcastId;
            let broadcastUrl;
            let targetBroadcast = null;

            if (targetStream) {
                console.log(`Found reusable live stream: ${targetStream.id}`);
                ingestionAddress = targetStream.cdn.ingestionInfo.ingestionAddress;
                streamName = targetStream.cdn.ingestionInfo.streamName;
                streamId = targetStream.id;

                return youtube.liveBroadcasts.list({
                    part: 'snippet,contentDetails,status',
                    streamId: streamId,
                    mine: true
                }).then(broadcastListRes => {
                    targetBroadcast = broadcastListRes.data.items.find(
                        (broadcast) => broadcast.contentDetails &&
                            broadcast.contentDetails.boundStreamId === streamId &&
                            (broadcast.status.lifeCycleStatus === 'created' ||
                                broadcast.status.lifeCycleStatus === 'upcoming')
                    );

                    if (targetBroadcast) {
                        console.log(`Found reusable broadcast: ${targetBroadcast.id}`);
                        broadcastId = targetBroadcast.id;
                        broadcastUrl = `https://www.youtube.com/watch?v=${broadcastId}`;
                        return { ingestionAddress, streamName, broadcastUrl, broadcastId, streamId };
                    } else {
                        console.log(`No suitable upcoming broadcast found for stream ${streamId}. Creating a new one.`);
                        return youtube.liveBroadcasts.insert({
                            part: 'snippet,contentDetails,status',
                            requestBody: {
                                snippet: {
                                    title: reusableTitle,
                                    description: that.YT_STREAM_DESCRIPTION,
                                    scheduledStartTime: new Date(Date.now() + 60 * 1000).toISOString()
                                },
                                status: {
                                    privacyStatus: that.YT_STREAM_PRIVACY
                                },
                                contentDetails: {
                                    monitorStream: {
                                        enableMonitorStream: false,
                                        latencyPreference: that.YT_STREAM_LATENCY
                                    }
                                }
                            }
                        }).then(broadcastRes => {
                            console.log(`New broadcast created: ${broadcastRes.data.id}`);
                            return youtube.liveBroadcasts.bind({
                                part: 'id,contentDetails',
                                id: broadcastRes.data.id,
                                streamId: streamId
                            }).then(() => {
                                console.log('Stream bound to new broadcast.');
                                return {
                                    ingestionAddress: ingestionAddress,
                                    streamName: streamName,
                                    broadcastUrl: `https://www.youtube.com/watch?v=${broadcastRes.data.id}`,
                                    broadcastId: broadcastRes.data.id,
                                    streamId: streamId
                                };
                            });
                        });
                    }
                });
            } else {
                console.log('No reusable stream found. Creating a new live stream and broadcast...');
                return youtube.liveStreams.insert({
                    part: 'snippet,cdn',
                    requestBody: {
                        snippet: {
                            title: reusableTitle,
                            description: that.YT_STREAM_DESCRIPTION,
                        },
                        cdn: {
                            frameRate: that.YT_STREAM_FPS || '30fps',
                            ingestionType: 'rtmp',
                            resolution: that.YT_STREAM_RESOLUTION || '720p',
                        }
                    }
                }).then(streamRes => {
                    console.log(`Live stream created: ${streamRes.data.id}`);
                    return youtube.liveBroadcasts.insert({
                        part: 'snippet,contentDetails,status',
                        requestBody: {
                            snippet: {
                                title: reusableTitle,
                                description: that.YT_STREAM_DESCRIPTION || 'Live stream from HomeCam',
                                scheduledStartTime: new Date(Date.now() + 60 * 1000).toISOString()
                            },
                            status: {
                                privacyStatus: that.YT_STREAM_PRIVACY || 'private'
                            },
                            contentDetails: {
                                monitorStream: {
                                    enableMonitorStream: false,
                                    latencyPreference: 'ultraLow' // Set ultra low latency
                                }
                            }
                        }
                    }).then(broadcastRes => {
                        console.log(`Live broadcast created: ${broadcastRes.data.id}`);
                        return youtube.liveBroadcasts.bind({
                            part: 'id,contentDetails',
                            id: broadcastRes.data.id,
                            streamId: streamRes.data.id
                        }).then(() => {
                            console.log('Stream bound to broadcast.');
                            return {
                                ingestionAddress: streamRes.data.cdn.ingestionInfo.ingestionAddress,
                                streamName: streamRes.data.cdn.ingestionInfo.streamName,
                                broadcastUrl: `https://www.youtube.com/watch?v=${broadcastRes.data.id}`,
                                broadcastId: broadcastRes.data.id,
                                streamId: streamRes.data.id
                            };
                        });
                    });
                });
            }
        });
    }

    /**
     * Starts a YouTube Live Broadcast. It finds or creates a stream/broadcast,
     * initiates the process to wait for it to be ready, starts FFmpeg, and
     * transitions the broadcast to 'live'. Returns the broadcast URL immediately.
     * @returns {Promise<string>} The URL of the live broadcast.
     */
    start() {
        var that = this;
        if (!this.YT_CLIENT_ID || !this.YT_CLIENT_SECRET || !this.YT_REFRESH_TOKEN) {
            throw 'Credentials for YouTube Live Streaming are not set. Please check config parameters or .env file.';
        }
        this.isBroadcasting = true;
        const oAuth2Client = this.getOAuth2Client();
        const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });

        return this.findOrCreateBroadcast(oAuth2Client)
            .then(({ ingestionAddress, streamName, broadcastUrl, broadcastId, streamId }) => { // Capture streamId here
                console.log(`Broadcast found/created. URL: ${broadcastUrl}`);
                console.log('Initiating transition to live status in background...');

                // --- Detached process to handle going live ---
                Promise.resolve().then(() => {
                    // 1. Wait for broadcast to be 'ready'
                    return that.waitForBroadcastReady(youtube, broadcastId);
                })
                    .then(isBroadcastReady => {
                        if (!isBroadcastReady) {
                            throw new Error(`Broadcast ${broadcastId} did not become 'ready' within the timeout period. Cannot start stream.`);
                        }

                        // Start ffmpeg streaming
                        that.ffmpegProcess = that.startFFmpeg(ingestionAddress, streamName);

                        // 2. Give FFmpeg some time to start sending data
                        console.log('Giving FFmpeg 10 seconds to initiate connection...');
                        return new Promise(resolve => setTimeout(resolve, 10000));
                    })
                    .then(() => {
                        // 3. Wait for the live stream to become 'active' (receiving data)
                        return that.waitForStreamActive(youtube, streamId);
                    })
                    .then(isStreamActive => {
                        if (!isStreamActive) {
                            throw new Error(`Live stream ${streamId} did not become 'active' within the timeout period. Cannot transition broadcast.`);
                        }

                        // 4. Final check of broadcast status before transition
                        console.log(`Performing final check on broadcast ${broadcastId} status...`);
                        return youtube.liveBroadcasts.list({
                            part: 'status',
                            id: broadcastId
                        }).then(res => {
                            let finalBroadcastStatus = null;
                            if (res.data && res.data.items && res.data.items.length > 0 &&
                                res.data.items[0].status && res.data.items[0].status.lifeCycleStatus) {
                                finalBroadcastStatus = res.data.items[0].status.lifeCycleStatus;
                            }

                            if (finalBroadcastStatus !== 'ready') {
                                throw new Error(`Broadcast ${broadcastId} is not in 'ready' state for final transition (current: ${finalBroadcastStatus}).`);
                            }
                            console.log(`Broadcast ${broadcastId} confirmed 'ready' for transition.`);
                            return true; // Proceed
                        });
                    })
                    .then(() => {
                        // 5. Transition broadcast to 'live'
                        console.log(`Transitioning broadcast ${broadcastId} to 'live' status...`);
                        return youtube.liveBroadcasts.transition({
                            broadcastStatus: 'live',
                            id: broadcastId,
                            part: 'status'
                        });
                    })
                    .then(() => {
                        console.log('Broadcast transitioned to live.');
                    })
                    .catch(transitionErr => {
                        console.error('Error in background transition to live:', transitionErr);
                        if (transitionErr.response && transitionErr.response.data) {
                            console.error('API Error Details:', JSON.stringify(transitionErr.response.data, null, 2));
                        }
                        if (that.ffmpegProcess) {
                            console.log('Killing FFmpeg process due to background broadcast transition error.');
                            that.ffmpegProcess.kill('SIGINT');
                            that.ffmpegProcess = null;
                        }
                        // Do NOT re-throw here, as this is a detached promise chain
                    });

                // --- Return the URL immediately ---
                that.videoUrl = broadcastUrl; // Store the URL in the instance for later use
                that.broadcastId = broadcastId; // Store the broadcast ID
                that.streamId = streamId; // Store the stream ID
                return { videoUrl: broadcastUrl, broadcastId: broadcastId, streamId: streamId };
            })
            .catch(err => {
                console.error('An error occurred during broadcast setup:', err);
                if (err.response && err.response.data) {
                    console.error('API Error Details:', JSON.stringify(err.response.data, null, 2));
                }
                throw err; // Re-throw to propagate the error if setup itself fails
            });
    }

    /**
     * Gracefully stops the active YouTube live broadcast and the FFmpeg process.
     * @param {string} broadcastId The ID of the broadcast to stop.
     * @returns {Promise<void>}
     */
    stop() {
        var that = this;
        const oAuth2Client = this.getOAuth2Client();
        const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });
        return new Promise((resolve, reject) => {
            console.log(`Attempting to stop broadcast ${that.broadcastId}...`);
            youtube.liveBroadcasts.transition({
                broadcastStatus: 'complete',
                id: that.broadcastId,
                part: 'status'
            }).then(() => {
                console.log(`Broadcast ${that.broadcastId} transitioned to 'complete' status.`);
            }).catch(error => {
                console.error(`Error transitioning broadcast ${that.broadcastId} to 'complete':`, error);
                if (error.response && error.response.data) {
                    console.error('API Error Details:', JSON.stringify(error.response.data, null, 2));
                }
                return reject(error);
            }).finally(() => { // Use finally to ensure FFmpeg is always terminated
                if (that.ffmpegProcess) {
                    console.log('Stopping FFmpeg process...');
                    try {
                        // Using process.kill with the PID directly, which is more reliable
                        // than childProcess.kill() when shell:true was involved previously.
                        // SIGKILL is a forceful termination. SIGTERM is more graceful.
                        // Let's try SIGTERM first, then SIGKILL if it doesn't exit.
                        process.kill(that.ffmpegProcess.pid, 'SIGTERM');
                        console.log(`Sent SIGTERM to FFmpeg process (PID: ${that.ffmpegProcess.pid}).`);

                        // Set a timeout to forcefully kill if SIGTERM doesn't work
                        setTimeout(() => {
                            if (that.ffmpegProcess) { // Check if it's still alive
                                try {
                                    process.kill(that.ffmpegProcess.pid, 'SIGKILL');
                                    console.log(`Sent SIGKILL to FFmpeg process (PID: ${that.ffmpegProcess.pid}, force kill).`);
                                } catch (forceKillError) {
                                    console.error('Error sending SIGKILL to FFmpeg process:', forceKillError);
                                    return reject(error);
                                }
                            }
                            that.isBroadcasting = false;
                            return resolve(true);
                        }, 2000); // Give 5 seconds for SIGTERM to work

                    } catch (killError) {
                        console.error('Error attempting to kill FFmpeg process:', killError);
                        return reject(error);
                    } finally {
                        that.isBroadcasting = false;
                        that.ffmpegProcess = null; // Clear the global reference regardless of success
                        console.log('FFmpeg process reference cleared.');
                    }

                } else {
                    console.log('No active FFmpeg process to stop.');
                    return resolve(true);
                }
            });
        });
    }

    /**
     * Lists all YouTube live broadcasts created by the authenticated user.
     * @returns {Promise<Array<Object>>} An array of broadcast objects with title and URL.
     */
    list(params) {
        const oAuth2Client = this.getOAuth2Client();
        const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });

        console.log('Fetching all live broadcasts...');
        return youtube.liveBroadcasts.list({
            part: 'snippet,status',
            mine: true,
            maxResults: 50,
            pageToken: params && params.pageToken ? params.pageToken : undefined
        }).then(res => {
            const broadcasts = res.data.items.map(item => ({
                id: item.id,
                channelId: item.snippet.channelId,
                publishedAt: item.snippet.publishedAt,
                title: item.snippet.title,
                description: item.snippet.description,
                url: `https://www.youtube.com/watch?v=${item.id}`,
                status: item.status.lifeCycleStatus,
                privacy: item.status.privacyStatus,
                madeForKids: item.status.madeForKids,
                thumbnails: {
                    default: item.snippet.thumbnails.default ? item.snippet.thumbnails.default.url : undefined,
                    high: item.snippet.thumbnails.high ? item.snippet.thumbnails.high.url : undefined,
                    standard: item.snippet.thumbnails.standard ? item.snippet.thumbnails.standard.url : undefined,
                    maxres: item.snippet.thumbnails.maxres ? item.snippet.thumbnails.maxres.url : undefined,
                },
                nextPageToken: res.data.nextPageToken || undefined
            }));
            return broadcasts;
        }).catch(error => {
            console.error('Error listing broadcasts:', error);
            if (error.response && error.response.data) {
                console.error('API Error Details:', JSON.stringify(error.response.data, null, 2));
            }
            return [];
        });
    }
}

module.exports = YoutubeLiveStream
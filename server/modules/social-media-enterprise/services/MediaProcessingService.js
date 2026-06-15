const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

/**
 * MediaProcessingService handles asynchronous media merging and rendering
 * using FFmpeg. Operations are wrapped in Promises to prevent thread blocking.
 */
class MediaProcessingService {
    /**
     * Merges a background audio file onto a video file for formatting as Story/Reel.
     * Uses ffmpeg: ffmpeg -i input.mp4 -i audio.mp3 -shortest -c:v copy -c:a aac output.mp4
     * 
     * @param {string} videoPath - Absolute path to the original video file
     * @param {string} audioPath - Absolute path to the audio/music file
     * @param {string} outputPath - Absolute path where the rendered video should be saved
     * @returns {Promise<string>} The output path of the merged file
     */
    static mergeAudioVideo(videoPath, audioPath, outputPath) {
        return new Promise((resolve, reject) => {
            console.log(`[MediaProcessing] Starting merge. Video: ${videoPath} | Audio: ${audioPath}`);

            if (!fs.existsSync(videoPath)) return reject(new Error('Video file not found'));
            if (!fs.existsSync(audioPath)) return reject(new Error('Audio file not found'));

            ffmpeg()
                .input(videoPath)
                .input(audioPath)
                // If audio is longer than video, end the file when the shortest input (video) ends
                .outputOptions([
                    '-map 0:v:0',
                    '-map 1:a:0',
                    '-shortest'
                ])
                // Copy the video stream without re-encoding to preserve quality and process fast
                .videoCodec('copy')
                // Re-encode audio to AAC which is broadly supported on social platforms
                .audioCodec('aac')
                .on('start', (commandLine) => {
                    console.log(`[MediaProcessing] Spawned FFmpeg with command: ${commandLine}`);
                })
                .on('progress', (progress) => {
                    // Log progress if possible (avoids blocking main thread as fluent-ffmpeg uses child processes)
                    if (progress.percent) {
                        console.log(`[MediaProcessing] Processing: ${Math.round(progress.percent)}% done`);
                    } else if (progress.timemark) {
                        console.log(`[MediaProcessing] Processing: At frame/time ${progress.timemark}...`);
                    }
                })
                .on('end', () => {
                    console.log(`[MediaProcessing] Merge finished successfully. Output: ${outputPath}`);
                    resolve(outputPath);
                })
                .on('error', (err, stdout, stderr) => {
                    console.error(`[MediaProcessing] FFmpeg error: ${err.message}`);
                    console.error(`[MediaProcessing] FFmpeg stderr: ${stderr}`);
                    reject(new Error(`Failed to process media: ${err.message}`));
                })
                .save(outputPath);
        });
    }

    /**
     * Normalizes a video for social media standards (Reels/Stories/Feed).
     * Ensures: H.264 Video, AAC Audio, and correct Aspect Ratio (9:16 for Reels/Stories).
     * 
     * @param {string} inputPath - Current local path of the video
     * @param {string} outputPath - Destination for normalized video
     * @param {string} mode - 'reel' | 'story' | 'feed'
     */
    static normalizeVideoForSocial(inputPath, outputPath, mode = 'feed') {
        return new Promise((resolve, reject) => {
            // console.log(`[MediaProcessing] Normalizing video for ${mode}: ${inputPath}`);

            let proc = ffmpeg(inputPath);

            // 1. Enforce H.264 and AAC (Strict industry standards for IG/FB)
            proc = proc
                .format('mp4')
                .videoCodec('libx264')
                .audioCodec('aac')
                .audioBitrate('128k')
                .audioChannels(2)
                .outputOptions([
                    '-pix_fmt yuv420p',   // Required for compatibility
                    '-profile:v main',    // High compatibility profile
                    '-level 4.0',         // Stable level for HD videos
                    '-crf 23',            // Standard quality
                    '-movflags +faststart' // Enables progressive processing by Meta
                ]);

            // 2. Handle Aspect Ratio for Reels (9:16)
            if (mode === 'reel' || mode === 'story') {
                proc = proc.size('1080x1920').autopad('black');
            } else {
                // Ensure even dimensions (required by libx264)
                proc = proc.videoFilters('scale=w=trunc(iw/2)*2:h=trunc(ih/2)*2');
            }

            proc
                .on('start', (cmd) => { console.log(`[FFmpeg] Full Command: ${cmd}`); })
                .on('end', () => {
                    console.log(`[FFmpeg] Done normalized: ${outputPath}`);
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    console.error(`[FFmpeg] FAILED: ${err.message}`);
                    reject(new Error(`Normalization Engine Error: ${err.message}`));
                })
                .save(outputPath);
        });
    }

    /**
     * Delete temporary media files securely matching a prefix or direct paths
     */
    static cleanupFiles(filePaths) {
        filePaths.forEach(filePath => {
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (e) {
                    console.warn(`[MediaProcessing] Failed to clean up file ${filePath}: ${e.message}`);
                }
            }
        });
    }
}

module.exports = MediaProcessingService;

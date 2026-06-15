const Music = require('../models/social/Music');

const getMusic = async (req, res) => {
    try {
        const { search } = req.query;
        let query = {};
        let music = [];

        if (!search || search.trim() === '') {
            // Return trending/recent if no search
            music = await Music.find({}).sort({ createdAt: -1 }).limit(50);
        } else {
            const searchRegex = new RegExp(search, 'i');
            const startRegex = new RegExp('^' + search, 'i');

            // Find all matching candidates
            let candidates = await Music.find({
                $or: [
                    { title: searchRegex },
                    { artist: searchRegex }
                ]
            }).limit(100);

            // Assign weights/scores for Instagram-like intelligent sorting
            music = candidates.map(item => {
                let score = 0;
                const title = item.title.toLowerCase();
                const artist = item.artist.toLowerCase();
                const s = search.toLowerCase();

                // Exact match (Highest priority)
                if (title === s) score += 100;
                else if (artist === s) score += 90;
                
                // Starts with match (Medium priority)
                else if (title.startsWith(s)) score += 50;
                else if (artist.startsWith(s)) score += 40;
                
                // Contains match (Lowest priority)
                else score += 10;

                return { ...item.toObject(), score };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 50);
        }

        // console.log(`[Music Smart Search] Query: "${search || ''}" | Found: ${music.length} prioritized results`);
        return res.status(200).json(music);
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

const uploadMusic = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'No audio file provided' });
        }

        let audioUrl = `/uploads/music/${req.file.filename}`;
        const CloudinaryService = require('../services/CloudinaryService');
        if (CloudinaryService.isConfigured()) {
            try {
                const cloudRes = await CloudinaryService.uploadFile(
                    req.file.path,
                    'hrms/social/music',
                    true
                );
                audioUrl = cloudRes.url;
            } catch (err) {
                console.warn("[uploadMusic] Audio cloud upload failed:", err.message);
            }
        }
        const { title, artist, duration, thumbnail } = req.body;

        const newMusic = await Music.create({
            title: title || 'Unknown Title',
            artist: artist || 'Unknown Artist',
            audioUrl,
            duration: duration || 0,
            thumbnail: thumbnail || 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?q=80&w=200&auto=format&fit=crop'
        });

        return res.status(201).json({
            success: true,
            data: newMusic,
            message: 'Music uploaded successfully'
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

module.exports = {
    getMusic,
    uploadMusic
};

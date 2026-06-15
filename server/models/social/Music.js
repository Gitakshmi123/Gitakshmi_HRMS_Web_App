const mongoose = require('mongoose');

const MusicSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    artist: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    audioUrl: {
        type: String,
        required: true
    },
    thumbnail: {
        type: String,
        default: 'https://via.placeholder.com/150'
    },
    duration: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
    collection: 'music'
});

// Case-insensitive search index combining title and artist
MusicSchema.index({ title: 'text', artist: 'text' });

module.exports = mongoose.model('Music', MusicSchema);

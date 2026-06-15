const mongoose = require('mongoose');
const Music = require('./models/social/Music');
require('dotenv').config();

const dummyMusic = [
    {
        title: "Levitating",
        artist: "Dua Lipa",
        audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        thumbnail: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150&q=80",
        duration: 200
    },
    {
        title: "Blinding Lights",
        artist: "The Weeknd",
        audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        thumbnail: "https://images.unsplash.com/photo-1493225457124-7eb3268846c4?w=150&q=80",
        duration: 200
    },
    {
        title: "Watermelon Sugar",
        artist: "Harry Styles",
        audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        thumbnail: "https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=150&q=80",
        duration: 174
    },
    {
        title: "Peaches",
        artist: "Justin Bieber",
        audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
        thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&q=80",
        duration: 198
    },
    {
        title: "Stay",
        artist: "The Kid LAROI & Justin Bieber",
        audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
        thumbnail: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=150&q=80",
        duration: 141
    }
];

async function seedMusic() {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to DB');
        
        await Music.deleteMany({});
        console.log('Cleared existing music collection');
        
        await Music.insertMany(dummyMusic);
        console.log('Inserted dummy music data');
    } catch (err) {
        console.error('Error seeding music:', err);
    } finally {
        mongoose.disconnect();
    }
}

seedMusic();

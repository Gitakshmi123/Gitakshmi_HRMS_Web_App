require('dotenv').config({ path: require('path').resolve(__dirname, 'server', '.env') });
console.log('PORT:', process.env.PORT);
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'FOUND' : 'MISSING');
console.log('MONGO_URI:', process.env.MONGO_URI ? 'FOUND' : 'MISSING');

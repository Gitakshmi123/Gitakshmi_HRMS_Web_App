const io = require('socket.io-client');
const socket = io('http://localhost:5003', {
  transports: ['websocket'],
  withCredentials: true,
  // we don't have a token, but let's see if we get a 401 or a connection refused
});

socket.on('connect_error', (err) => {
  console.log('Connect error:', err.message);
  process.exit(1);
});

socket.on('connect', () => {
  console.log('Connected!');
  process.exit(0);
});

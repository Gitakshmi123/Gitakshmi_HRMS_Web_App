const dns = require('dns');
const host = 'nitesh.mfy5jc4.mongodb.net';

dns.resolveSrv(`_mongodb._tcp.${host}`, (err, addresses) => {
    if (err) {
        console.error('SRV Resolution failed:', err);
        // Try with 8.8.8.8
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        dns.resolveSrv(`_mongodb._tcp.${host}`, (err2, addresses2) => {
            if (err2) {
                console.error('SRV Resolution failed even with Google DNS:', err2);
            } else {
                console.log('SRV Resolution worked with Google DNS:', addresses2);
            }
        });
    } else {
        console.log('SRV Resolution worked:', addresses);
    }
});

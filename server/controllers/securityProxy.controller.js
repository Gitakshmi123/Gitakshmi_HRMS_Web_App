const axios = require('axios');

function forwardHeaders() {
    return {
        'User-Agent': 'GT-HRMS-Security-Proxy/1.0',
        'Accept': 'application/json',
    };
}

exports.lookupPincode = async (req, res, next) => {
    try {
        const pin = String(req.params.pin || '').trim();
        if (!/^\d{5,10}$/.test(pin)) {
            return res.status(400).json({ message: 'invalid_pincode' });
        }

        const response = await axios.get(`https://api.postalpincode.in/pincode/${encodeURIComponent(pin)}`, {
            headers: forwardHeaders(),
            timeout: 10000,
        });

        return res.json(response.data);
    } catch (error) {
        return next(error);
    }
};

exports.lookupPostOffice = async (req, res, next) => {
    try {
        const city = String(req.params.city || '').trim();
        if (city.length < 3) {
            return res.status(400).json({ message: 'invalid_city' });
        }

        const response = await axios.get(`https://api.postalpincode.in/postoffice/${encodeURIComponent(city)}`, {
            headers: forwardHeaders(),
            timeout: 10000,
        });

        return res.json(response.data);
    } catch (error) {
        return next(error);
    }
};

exports.lookupIfsc = async (req, res, next) => {
    try {
        const code = String(req.params.code || '').trim().toUpperCase();
        if (!/^[A-Z]{4}0[0-9A-Z]{6}$/.test(code)) {
            return res.status(400).json({ message: 'invalid_ifsc' });
        }

        const response = await axios.get(`https://ifsc.razorpay.com/${encodeURIComponent(code)}`, {
            headers: forwardHeaders(),
            timeout: 10000,
        });

        return res.json(response.data);
    } catch (error) {
        return next(error);
    }
};

exports.lookupGeo = async (req, res, next) => {
    try {
        const city = String(req.params.city || '').trim();
        if (city.length < 3) {
            return res.status(400).json({ message: 'invalid_city' });
        }

        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            headers: {
                ...forwardHeaders(),
                'Accept-Language': 'en',
            },
            params: {
                city,
                format: 'json',
                addressdetails: 1,
                limit: 1,
            },
            timeout: 10000,
        });

        return res.json(response.data);
    } catch (error) {
        return next(error);
    }
};

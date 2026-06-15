/**
 * backend idUtils.js
 * ═══════════════════════════════════════════════════════════════════
 * Standardised ID stringification common to all backend modules.
 * Prevents [object Object] leakage in API responses.
 * ═══════════════════════════════════════════════════════════════════
 */

function stringifyId(id) {
    if (!id) return null;
    if (typeof id === 'string') return id;

    if (typeof id === 'object') {
        // 1. Handle Mongoose ObjectId first to avoid self-referential _id recursion
        if (id.toHexString && typeof id.toHexString === 'function') {
            return id.toHexString();
        }

        // 2. Handle { _id: ... } nesting
        if (id._id && id._id !== id) return stringifyId(id._id);

        // 3. Handle { buffer: { "0": ... } } discovery
        if (id.buffer && typeof id.buffer === 'object') {
            const buf = id.buffer;
            if (buf.type === 'Buffer' && Array.isArray(buf.data)) {
                return Buffer.from(buf.data).toString('hex');
            }
            const keys = Object.keys(buf).filter(k => /^\d+$/.test(k));
            if (keys.length > 0) {
                const bytes = [];
                keys.forEach(k => { bytes[parseInt(k)] = buf[k]; });
                return Buffer.from(bytes).toString('hex');
            }
        }

        // 4. Handle standard Node.js Buffer
        if (Buffer.isBuffer(id)) {
            return id.toString('hex');
        }

        // 5. Handle JSON-serialized Buffer
        if (id.type === 'Buffer' && Array.isArray(id.data)) {
            return Buffer.from(id.data).toString('hex');
        }

        // 6. Handle toString() if not default
        if (id.toString && id.toString() !== '[object Object]') {
            return id.toString();
        }
    }

    const s = String(id);
    return s === '[object Object]' ? null : s;
}

module.exports = { stringifyId };

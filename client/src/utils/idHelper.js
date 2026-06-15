/**
 * Robustly converts any MongoDB-style identifier (String, ObjectId, Buffer object, etc.)
 * into a clean hexadecimal string representation suitable for API URLs and React keys.
 * 
 * @param {any} id - The identifier to normalize
 * @returns {string} - The stringified identifier
 */
export function safeId(id) {
  if (!id) return "";
  
  // 1. If already a string, return it
  if (typeof id === "string") return id;
  
  let result = "";
  if (typeof id === "object") {
    // 2. Handle standard _id object with internal _id (recursion)
    if (id._id) {
        result = safeId(id._id);
    }
    
    // 3. Handle specific discovered format: { buffer: { "0": 105, "1": 214, ... } }
    else if (id.buffer && typeof id.buffer === 'object') {
        const buf = id.buffer;
        if (buf.type === 'Buffer' && Array.isArray(buf.data)) {
            result = buf.data.map(b => b.toString(16).padStart(2, "0")).join("");
        } else {
            const keys = Object.keys(buf).filter(k => /^\d+$/.test(k));
            if (keys.length > 0) {
                const bytes = [];
                keys.forEach(k => { bytes[parseInt(k)] = buf[k]; });
                result = bytes.map(b => (b || 0).toString(16).padStart(2, "0")).join("");
            }
        }
    }
    
    // 4. Handle direct JSON-serialized buffer: { type: 'Buffer', data: [...] }
    else if (id.type === 'Buffer' && Array.isArray(id.data)) {
        result = id.data.map(b => b.toString(16).padStart(2, "0")).join("");
    }
    
    // 5. Handle MongoDB $oid property (EJSON)
    else if (id.$oid) result = String(id.$oid);
    
    // 6. Handle Mongoose ObjectId toString() (if not default [object Object])
    else if (id.toString && id.toString() !== '[object Object]') {
        const s = id.toString();
        if (s && s !== '[object Object]') result = s;
    }
    
    // 7. Last resort fallback for other object shapes
    if (!result) {
        try {
            const s = String(id);
            if (s && s !== '[object Object]') result = s;
            else result = "";
        } catch {
            result = "";
        }
    }
  } else {
    result = String(id);
  }

  if (!result || String(result).includes('[object Object]')) {
      if (id) console.warn('[safeId] Invalid ID detected:', id);
      return "";
  }
  
  return String(result);
}

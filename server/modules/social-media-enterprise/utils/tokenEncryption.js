const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-secret-key-32-chars-long-!!!'; // Should be 32 bytes
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Encrypts sensitive text using AES-256-CBC
 * @param {string} text 
 * @returns {string} iv:encryptedData
 */
function encrypt(text) {
    if (!text) return null;

    // Ensure key is 32 bytes
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypts text encrypted by the encrypt function
 * @param {string} text 
 * @returns {string} 
 */
function decrypt(text) {
    if (!text) return null;

    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');

        // Ensure key is 32 bytes
        const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString();
    } catch (error) {
        console.error('Decryption failed:', error.message);
        return null;
    }
}

module.exports = { encrypt, decrypt };

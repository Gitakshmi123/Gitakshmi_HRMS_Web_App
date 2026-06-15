/**
 * Data Encryption Service
 * Encrypts/Decrypts sensitive BGV data (Aadhaar, PAN, etc.)
 * Uses AES-256-GCM encryption
 */

const crypto = require('crypto');

class EncryptionService {
    constructor() {
        // Get encryption key from environment or generate one
        this.encryptionKey = process.env.BGV_ENCRYPTION_KEY || this.generateKey();
        this.algorithm = 'aes-256-gcm';
        this.ivLength = 16;
        this.saltLength = 64;
        this.tagLength = 16;
        this.tagPosition = this.saltLength + this.ivLength;
        this.encryptedPosition = this.tagPosition + this.tagLength;

        if (!process.env.BGV_ENCRYPTION_KEY) {
            // console.warn('⚠️ BGV_ENCRYPTION_KEY not set in .env. Using generated key (NOT RECOMMENDED FOR PRODUCTION)');
            // console.warn('Generated Key:', this.encryptionKey);
        }
    }

    /**
     * Generate a secure encryption key
     */
    generateKey() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Get key buffer from hex string
     */
    getKey(salt) {
        return crypto.pbkdf2Sync(this.encryptionKey, salt, 100000, 32, 'sha512');
    }

    /**
     * Encrypt sensitive data
     * @param {string} text - Plain text to encrypt
     * @returns {string} - Encrypted text in hex format
     */
    encrypt(text) {
        if (!text) return text;

        try {
            // Generate random salt and IV
            const salt = crypto.randomBytes(this.saltLength);
            const iv = crypto.randomBytes(this.ivLength);
            const key = this.getKey(salt);

            // Create cipher
            const cipher = crypto.createCipheriv(this.algorithm, key, iv);

            // Encrypt the text
            const encrypted = Buffer.concat([
                cipher.update(String(text), 'utf8'),
                cipher.final()
            ]);

            // Get authentication tag
            const tag = cipher.getAuthTag();

            // Combine salt + iv + tag + encrypted data
            const result = Buffer.concat([salt, iv, tag, encrypted]);

            return result.toString('hex');
        } catch (error) {
            console.error('[ENCRYPTION_ERROR]', error);
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt sensitive data
     * @param {string} encryptedHex - Encrypted text in hex format
     * @returns {string} - Decrypted plain text
     */
    decrypt(encryptedHex) {
        if (!encryptedHex) return encryptedHex;

        try {
            // Convert hex to buffer
            const data = Buffer.from(encryptedHex, 'hex');

            // Extract components
            const salt = data.slice(0, this.saltLength);
            const iv = data.slice(this.saltLength, this.tagPosition);
            const tag = data.slice(this.tagPosition, this.encryptedPosition);
            const encrypted = data.slice(this.encryptedPosition);

            // Get key
            const key = this.getKey(salt);

            // Create decipher
            const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
            decipher.setAuthTag(tag);

            // Decrypt
            const decrypted = decipher.update(encrypted) + decipher.final('utf8');

            return decrypted;
        } catch (error) {
            console.error('[DECRYPTION_ERROR]', error);
            throw new Error('Failed to decrypt data');
        }
    }

    /**
     * Encrypt object fields
     * @param {object} obj - Object with fields to encrypt
     * @param {array} fields - Array of field names to encrypt
     * @returns {object} - Object with encrypted fields
     */
    encryptFields(obj, fields) {
        const result = { ...obj };

        fields.forEach(field => {
            if (result[field]) {
                result[field] = this.encrypt(result[field]);
            }
        });

        return result;
    }

    /**
     * Decrypt object fields
     * @param {object} obj - Object with encrypted fields
     * @param {array} fields - Array of field names to decrypt
     * @returns {object} - Object with decrypted fields
     */
    decryptFields(obj, fields) {
        const result = { ...obj };

        fields.forEach(field => {
            if (result[field]) {
                try {
                    result[field] = this.decrypt(result[field]);
                } catch (error) {
                    console.error(`[DECRYPT_FIELD_ERROR] Field: ${field}`, error.message);
                    // Keep encrypted value if decryption fails
                }
            }
        });

        return result;
    }

    /**
     * Hash sensitive data (one-way, for comparison only)
     * @param {string} text - Text to hash
     * @returns {string} - Hashed text
     */
    hash(text) {
        if (!text) return text;

        return crypto
            .createHash('sha256')
            .update(String(text))
            .digest('hex');
    }

    /**
     * Mask sensitive data for display
     * @param {string} text - Text to mask
     * @param {number} visibleChars - Number of characters to show at end
     * @returns {string} - Masked text
     */
    mask(text, visibleChars = 4) {
        if (!text) return text;

        const textStr = String(text);
        if (textStr.length <= visibleChars) {
            return '*'.repeat(textStr.length);
        }

        const masked = '*'.repeat(textStr.length - visibleChars);
        const visible = textStr.slice(-visibleChars);

        return masked + visible;
    }

    /**
     * Encrypt Aadhaar number
     */
    encryptAadhaar(aadhaar) {
        return this.encrypt(aadhaar);
    }

    /**
     * Decrypt Aadhaar number
     */
    decryptAadhaar(encryptedAadhaar) {
        return this.decrypt(encryptedAadhaar);
    }

    /**
     * Mask Aadhaar for display (show last 4 digits)
     */
    maskAadhaar(aadhaar) {
        return this.mask(aadhaar, 4);
    }

    /**
     * Encrypt PAN number
     */
    encryptPAN(pan) {
        return this.encrypt(pan);
    }

    /**
     * Decrypt PAN number
     */
    decryptPAN(encryptedPAN) {
        return this.decrypt(encryptedPAN);
    }

    /**
     * Mask PAN for display (show last 4 characters)
     */
    maskPAN(pan) {
        return this.mask(pan, 4);
    }
}

// Singleton instance
const encryptionService = new EncryptionService();

module.exports = encryptionService;

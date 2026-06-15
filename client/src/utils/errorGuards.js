/**
 * Frontend Error Guards & Toast Utilities
 * 
 * Prevents undefined handlers and provides consistent error messages
 * Usage in React components:
 *   const { showError, showSuccess, guardValue } = useErrorGuards();
 *   showError(error); // Handles both string and error objects
 *   guardValue(value, 'fallback') // Returns value or fallback
 */



/**
 * Safe value getter - prevents undefined errors
 * @param {*} value - Value to guard
 * @param {*} fallback - Fallback if value is null/undefined
 * @returns {*} - Safe value
 */
export const guardValue = (value, fallback = 0) => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'number' && isNaN(value)) return fallback;
    return value;
};

/**
 * Safe number formatter
 * @param {number} num - Number to format
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (num) => {
    const safe = guardValue(num, 0);
    if (!Number.isFinite(safe)) return '₹ 0.00';
    return `₹ ${Math.round(safe).toLocaleString('en-IN')}`;
};

/**
 * Safe percentage formatter
 * @param {number} num - Number to format
 * @returns {string} - Formatted percentage
 */
export const formatPercent = (num) => {
    const safe = guardValue(num, 0);
    if (!Number.isFinite(safe)) return '0.00%';
    return `${(safe || 0).toFixed(2)}%`;
};

/**
 * Extract meaningful error message from API response
 * @param {Error|Object} error - Error object or response
 * @returns {string} - User-friendly error message
 */
export const getErrorMessage = (error) => {
    if (!error) return 'An unknown error occurred';

    // API error response
    if (error.response?.data?.message) {
        return error.response.data.message;
    }

    // String error
    if (typeof error === 'string') {
        return error;
    }

    // Error object
    if (error.message) {
        // Extract meaningful part from error message
        const msg = error.message;
        if (msg.includes('no active')) return 'No active compensation record found. Please set up Employee Compensation first.';
        if (msg.includes('not found')) return 'Required data not found. Please check employee setup.';
        if (msg.includes('Schema')) return 'System error: Model not registered. Please contact support.';
        return msg;
    }

    return 'An unexpected error occurred. Please try again.';
};

/**
 * Hook for safe error/success messages
 * Usage: const { showError, showSuccess } = useErrorGuards();
 */
export const useErrorGuards = (messageApi) => {
    return {
        /**
         * Show error message
         */
        showError: (error, fallbackMsg = 'Operation failed') => {
            if (!messageApi) {
                console.error('[ERROR]', getErrorMessage(error || fallbackMsg));
                return;
            }
            const msg = getErrorMessage(error || fallbackMsg);
            messageApi.error({
                content: msg,
                duration: 5,
                top: 24
            });
        },

        /**
         * Show success message
         */
        showSuccess: (msg = 'Operation successful') => {
            if (!messageApi) {
                console.log('[SUCCESS]', msg);
                return;
            }
            messageApi.success({
                content: msg,
                duration: 3,
                top: 24
            });
        },

        /**
         * Show warning message
         */
        showWarning: (msg = 'Warning') => {
            if (!messageApi) {
                console.warn('[WARNING]', msg);
                return;
            }
            messageApi.warning({
                content: msg,
                duration: 4,
                top: 24
            });
        },

        /**
         * Safe handler wrapper
         * Usage: <button onClick={safeHandler(() => doSomething())} />
         */
        safeHandler: (fn, onError) => {
            return async (...args) => {
                try {
                    return await fn(...args);
                } catch (error) {
                    const msg = getErrorMessage(error);
                    if (messageApi) {
                        messageApi.error({ content: msg, duration: 5, top: 24 });
                    } else {
                        console.error('[ERROR]', msg);
                    }
                    if (onError) onError(error);
                }
            };
        }
    };
};

/**
 * Safe object accessor - prevents "Cannot read property of undefined"
 * Usage: safeGet(obj, 'a.b.c.d', 'default')
 */
export const safeGet = (obj, path, defaultValue = undefined) => {
    try {
        const value = path.split('.').reduce((current, prop) => current?.[prop], obj);
        return value !== undefined ? value : defaultValue;
    } catch {
        return defaultValue;
    }
};

/**
 * Safe array access
 * Usage: safeArray(data.items).map(...) - never crashes on undefined
 */
export const safeArray = (arr) => {
    return Array.isArray(arr) ? arr : [];
};

/**
 * Safe preview data guard
 * Ensures all payroll preview fields exist
 */
export const guardPreviewData = (preview) => {
    if (!preview) return null;

    return {
        employeeId: guardValue(preview.employeeId),
        name: guardValue(preview.employeeInfo?.name, 'Unknown'),
        grossEarnings: guardValue(preview.grossEarnings, 0),
        preTaxDeductionsTotal: guardValue(preview.preTaxDeductionsTotal, 0),
        incomeTax: guardValue(preview.incomeTax, 0),
        postTaxDeductionsTotal: guardValue(preview.postTaxDeductionsTotal, 0),
        netPay: guardValue(preview.netPay, 0),
        compensationSource: guardValue(preview.compensationSource, 'UNKNOWN'),
        isLegacyFallback: guardValue(preview.isLegacyFallback, false),
        error: preview.error || null
    };
};

/**
 * Safe compensation check
 * Returns true if compensation data is valid for payroll
 */
export const isValidCompensation = (preview) => {
    if (!preview) return false;
    if (preview.error) return false;
    // Must have positive gross earnings
    const gross = guardValue(preview.grossEarnings, 0);
    return gross > 0;
};

/**
 * Safe payroll run response guard
 * Ensures response structure is valid
 */
export const guardPayrollResponse = (response) => {
    if (!response) return null;

    return {
        status: guardValue(response.status, 'UNKNOWN'),
        totalEmployees: guardValue(response.totalEmployees, 0),
        processedEmployees: guardValue(response.processedEmployees, 0),
        failedEmployees: guardValue(response.failedEmployees, 0),
        totalGross: guardValue(response.totalGross, 0),
        totalNetPay: guardValue(response.totalNetPay, 0),
        errors: safeArray(response.errors),
        message: guardValue(response.message, '')
    };
};

export default {
    guardValue,
    formatCurrency,
    formatPercent,
    getErrorMessage,
    useErrorGuards,
    safeGet,
    safeArray,
    guardPreviewData,
    isValidCompensation,
    guardPayrollResponse
};

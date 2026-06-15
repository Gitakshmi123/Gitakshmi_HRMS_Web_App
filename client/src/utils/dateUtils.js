/**
 * Formats a given date string or Date object to 'DD-MM-YYYY' format.
 * @param {string|Date} date - The date to format.
 * @returns {string} - Date formatted as 'DD-MM-YYYY'.
 */
export const formatDateDDMMYYYY = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return `${day}-${month}-${year}`;
};

/**
 * Formats a given date string or Date object to 'DD-MM-YYYY HH:mm' format.
 * @param {string|Date} date - The date to format.
 * @returns {string} - Date formatted as 'DD-MM-YYYY HH:mm'.
 */
export const formatDateTimeDDMMYYYY = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${day}-${month}-${year} ${hours}:${minutes}`;
};

/**
 * Formats duration to 'XXh YYm' format.
 * @param {number} value - The time value.
 * @param {boolean} isSeconds - Whether the input is in seconds (default is hours).
 * @returns {string} - Formatted duration (e.g., '01h 30m').
 */
export const formatDuration = (value, isSeconds = false) => {
    if (typeof value !== 'number' || isNaN(value)) return '00h 00m';
    const totalSeconds = isSeconds ? Math.round(value) : Math.round(value * 3600);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    return `${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
};

/**
 * Formats seconds to 'HH:mm:ss' format.
 * @param {number} totalSeconds - Total seconds.
 * @returns {string} - Formatted time (e.g., '01:30:15').
 */
export const formatSecondsToHMS = (totalSeconds) => {
    if (typeof totalSeconds !== 'number' || isNaN(totalSeconds)) return '00:00:00';
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

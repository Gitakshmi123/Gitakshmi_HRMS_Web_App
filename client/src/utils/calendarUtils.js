export const STATUS = Object.freeze({
    HOLIDAY: 'HOLIDAY',
    WEEKLY_OFF: 'WEEKLY_OFF',
    LEAVE: 'LEAVE',
    HALF_DAY: 'HALF_DAY',
    PRESENT: 'PRESENT',
    ABSENT: 'ABSENT',
    ON_DUTY: 'ON_DUTY',
    DEFAULT: 'DEFAULT'
});

export function getStatusStyles(status) {
    const s = (status || '').toString().toUpperCase();
    switch (s) {
        case STATUS.HOLIDAY:
            return { container: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' };
        case STATUS.WEEKLY_OFF:
            return { container: 'bg-slate-100 dark:bg-white/5', border: 'border-slate-200 dark:border-white/10', text: 'text-slate-400 dark:text-slate-500', dot: 'bg-slate-300 dark:bg-slate-700' };
        case STATUS.LEAVE:
            return { container: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' };
        case STATUS.HALF_DAY:
            return { container: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' };
        case STATUS.PRESENT:
            return { container: 'bg-teal-500/10', border: 'border-teal-500/20', text: 'text-teal-600 dark:text-teal-400', dot: 'bg-teal-500' };
        case STATUS.ON_DUTY:
            return { container: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400', dot: 'bg-indigo-500' };
        case STATUS.ABSENT:
            return { container: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' };
        default:
            return { container: 'bg-transparent', border: 'border-slate-100 dark:border-white/5', text: 'text-slate-400', dot: 'bg-slate-200 dark:bg-white/10' };
    }
}

// Single helper for UI mapping per requirement
export function getCalendarUI(status, leaveType) {
    const s = (status || '').toString().toUpperCase();
    const styles = getStatusStyles(s);
    let label = '';

    switch (s) {
        case STATUS.HOLIDAY:
            label = 'Holiday';
            break;
        case STATUS.WEEKLY_OFF:
            label = 'Weekly Off';
            break;
        case STATUS.HALF_DAY:
            label = 'Half Day';
            break;
        case STATUS.LEAVE:
            label = (leaveType || 'Leave').toString().toUpperCase();
            break;
        case STATUS.PRESENT:
            label = 'Present';
            break;
        case STATUS.ABSENT:
            label = 'Absent';
            break;
        case STATUS.ON_DUTY:
            label = 'On Duty';
            break;
        default:
            label = '';
    }

    return { ...styles, label };
}

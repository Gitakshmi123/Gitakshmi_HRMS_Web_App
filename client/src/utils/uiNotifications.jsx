import { Button } from 'antd';
import { antdInstances } from './antdGlobal';

/*
 * Standardized Toast Notification Wrapper
 * Use this for success, error, info messages
 */
import { toast } from 'react-hot-toast';

export const showToast = (type, message, description, duration) => {
    // If message is just "Error" or "Success", and description is provided,
    // use description as the primary message to keep it slim.
    const isGenericTitle = ['Error', 'Success', 'Info', 'Warning'].includes(message);
    const mainMessage = (isGenericTitle && description) ? description : message;
    const secondaryMessage = (isGenericTitle && description) ? '' : description;
    
    const finalText = secondaryMessage ? `${mainMessage}: ${secondaryMessage}` : mainMessage;

    const options = {
        duration: (duration || 3) * 1000,
        position: 'top-right',
        style: {
            background: '#ffffff',
            color: '#1e293b',
            fontSize: '13px',
            fontWeight: '600',
            padding: '8px 16px',
            borderRadius: '12px',
            border: '1px solid #f1f5f9',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
            maxWidth: '450px',
        },
    };

    if (type === 'success') {
        toast.success(finalText, options);
    } else if (type === 'error') {
        toast.error(finalText, options);
    } else {
        toast(finalText, options);
    }
};

// Expose to window for global access (e.g. from api.js)
if (typeof window !== 'undefined') {
    window.showToast = showToast;
}

/*
 * Toast-based Confirmation Dialog
 * Replaces Modal.confirm with a non-blocking toast at top-right
 * containing confirm/cancel buttons.
 */
export const showConfirmToast = ({
    title,
    description,
    onConfirm,
    okText = 'Confirm',
    cancelText = 'Cancel',
    okType = 'primary', // 'primary', 'default', 'dashed', 'link', 'text'
    danger = false
}) => {
    const key = `confirm-${Date.now()}`;
    const notify = antdInstances.notification;

    if (!notify) {
        console.warn('[uiNotifications] Cannot show confirm toast: antd App instance not yet initialized.');
        return;
    }

    const handleConfirm = () => {
        notify.destroy(key);
        if (onConfirm) onConfirm();
    };

    const handleCancel = () => {
        notify.destroy(key);
    };

    const btn = (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button size="small" onClick={handleCancel}>
                {cancelText}
            </Button>
            <Button
                type={okType}
                size="small"
                danger={danger}
                onClick={handleConfirm}
            >
                {okText}
            </Button>
        </div>
    );

    notify.warning({
        message: title,
        description,
        actions: btn,
        key,
        duration: 0, // Persist until interaction
        placement: 'topRight',
    });
};

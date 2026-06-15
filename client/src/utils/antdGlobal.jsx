/* eslint-disable react-refresh/only-export-components */
import { App } from 'antd';
import { useEffect } from 'react';

export const antdInstances = {
    message: null,
    notification: null,
    modal: null
};

/** Context-aware message: use this instead of import { message } from 'antd' to avoid antd warning. */
export const message = {
    success: (...args) => antdInstances.message?.success(...args),
    error: (...args) => antdInstances.message?.error(...args),
    info: (...args) => antdInstances.message?.info(...args),
    warning: (...args) => antdInstances.message?.warning(...args),
    loading: (...args) => antdInstances.message?.loading(...args),
    open: (...args) => antdInstances.message?.open(...args),
    destroy: (...args) => antdInstances.message?.destroy(...args),
};

export const notification = {
    success: (msg, desc) => {
        if (typeof msg === 'object' && msg !== null) {
            return window.showToast 
                ? window.showToast('success', msg.message, msg.description, msg.duration)
                : antdInstances.notification?.success(msg);
        }
        return window.showToast ? window.showToast('success', msg, desc) : antdInstances.notification?.success({ message: msg, description: desc });
    },
    error: (msg, desc) => {
        if (typeof msg === 'object' && msg !== null) {
            return window.showToast 
                ? window.showToast('error', msg.message, msg.description, msg.duration)
                : antdInstances.notification?.error(msg);
        }
        return window.showToast ? window.showToast('error', msg, desc) : antdInstances.notification?.error({ message: msg, description: desc });
    },
    info: (msg, desc) => {
        if (typeof msg === 'object' && msg !== null) {
            return window.showToast 
                ? window.showToast('info', msg.message, msg.description, msg.duration)
                : antdInstances.notification?.info(msg);
        }
        return window.showToast ? window.showToast('info', msg, desc) : antdInstances.notification?.info({ message: msg, description: desc });
    },
    warning: (msg, desc) => {
        if (typeof msg === 'object' && msg !== null) {
            return window.showToast 
                ? window.showToast('warning', msg.message, msg.description, msg.duration)
                : antdInstances.notification?.warning(msg);
        }
        return window.showToast ? window.showToast('warning', msg, desc) : antdInstances.notification?.warning({ message: msg, description: desc });
    },
    open: (args) => antdInstances.notification?.open(args),
};

export const modal = {
    confirm: (...args) => antdInstances.modal?.confirm(...args),
    success: (...args) => antdInstances.modal?.success(...args),
    error: (...args) => antdInstances.modal?.error(...args),
    info: (...args) => antdInstances.modal?.info(...args),
    warning: (...args) => antdInstances.modal?.warning(...args),
    destroyAll: (...args) => antdInstances.modal?.destroyAll(...args),
};

export const AppHelper = () => {
    const { message: msg, notification: notify, modal: mdl } = App.useApp();

    useEffect(() => {
        antdInstances.message = msg;
        antdInstances.notification = notify;
        antdInstances.modal = mdl;
    }, [msg, notify, mdl]);

    return null;
};

import React, { useEffect } from 'react';
import { notification } from '../../utils/antdGlobal';
import { Outlet } from 'react-router-dom';
import EnterpriseSocialDashboard from '../../modules/social-media-enterprise/EnterpriseSocialDashboard';

const SocialMediaPage = () => {
    // handle notifications from redirects
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const oauthStatus = urlParams.get('oauth');
        const platform = urlParams.get('platform');
        const errorMessage = urlParams.get('message');
        const count = urlParams.get('count');

        if (oauthStatus === 'success' && platform) {
            notification.success({
                message: 'Accounts Connected',
                description: `Successfully connected ${count || 'new'} ${platform} account(s)! ✓`,
                duration: 4
            });
            window.history.replaceState({}, '', window.location.pathname);
        } else if (oauthStatus === 'error') {
            notification.error({
                message: 'Connection Failed',
                description: errorMessage || 'OAuth connection failed',
                duration: 5
            });
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    return <EnterpriseSocialDashboard />;
};

export default SocialMediaPage;

import { useEffect } from 'react';

/**
 * Hook to implement basic frontend security by disabling common development inspection methods.
 */
export const useSecurity = () => {
    useEffect(() => {
        // Prevent context menu (right click)
        const handleContextMenu = (e) => {
            e.preventDefault();
        };

        // Prevent common keyboard shortcuts
        const handleKeyDown = (e) => {
            // F12 key
            if (e.key === 'F12') {
                e.preventDefault();
                alert('Security Notice: Developer tools are disabled for security reasons.');
            }

            // Ctrl+Shift+I (Inspect), Ctrl+Shift+J (Console), Ctrl+Shift+C (Elements)
            if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) {
                e.preventDefault();
                alert('Security Notice: Inspection shortcuts are disabled.');
            }

            // Ctrl+U (View Source)
            if (e.ctrlKey && e.key === 'u' || e.ctrlKey && e.key === 'U') {
                e.preventDefault();
                alert('Security Notice: Source view is restricted.');
            }
        };

        // Add event listeners
        window.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('keydown', handleKeyDown);

        // Cleanup on unmount
        return () => {
            window.removeEventListener('contextmenu', handleContextMenu);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);
};

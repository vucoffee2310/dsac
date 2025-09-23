function initializeContent() {
    if (document.body) {
        try {
            console.log('Attempting to initialize AdUnit');
            GiveFreely.initializeAdUnit();
            console.log('AdUnit initialized successfully');
        } catch (error) {
            console.error('Error initializing AdUnit:', error);
        }
    } else {
        console.warn('Document body not available yet');
        // Try again in a moment if body isn't available
        setTimeout(initializeContent, 50);
    }
}

// Check if DOMContentLoaded has already fired
if (document.readyState === 'loading') {
    console.log('Document still loading, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', initializeContent);
} else {
    console.log('Document already loaded, running initialization immediately');
    initializeContent();
}
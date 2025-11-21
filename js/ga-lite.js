/**
 * GA4 Lite - Shared GA initialization and tracking
 * Handles PROLIFIC_ID from query string or localStorage
 */

(function() {
    'use strict';
    
    // Configuration  
    const GA_MEASUREMENT_ID = 'G-BXHHQPMWHG'; // Update with video study measurement ID
    const PROLIFIC_ID_KEY = 'prolific_id';
    
    // Global tracking state
    window.GALite = {
        isLoaded: false,
        userId: null,
        measurementId: GA_MEASUREMENT_ID
    };
    
    /**
     * Get PROLIFIC_ID from URL query string or mandatory prompt (no localStorage storage)
     */
    function getProlificId() {
        console.log('Getting PROLIFIC_ID...');
        
        // Check URL query string first
        const urlParams = new URLSearchParams(window.location.search);
        const prolificFromUrl = urlParams.get('PROLIFIC_ID');
        console.log('PROLIFIC_ID from URL:', prolificFromUrl);
        
        if (prolificFromUrl) {
            console.log('Using PROLIFIC_ID from URL:', prolificFromUrl);
            return prolificFromUrl;
        }
        
        // If no URL parameter, MANDATORY prompt - cannot be escaped
        console.log('No PROLIFIC_ID in URL, prompting user (mandatory)...');
        
        let prolificId = null;
        while (!prolificId || prolificId.trim() === '') {
            prolificId = prompt('⚠️ REQUIRED: Please enter your Participant ID to continue.\n\n(This cannot be skipped - press OK after entering your ID)');
            
            // If user pressed Cancel/Escape, show warning and try again
            if (prolificId === null) {
                alert('❌ Participant ID is required to participate in this study.\n\nPlease enter your ID when prompted.');
                continue;
            }
            
            // If user entered empty/whitespace, show warning and try again
            if (prolificId.trim() === '') {
                alert('❌ Please enter a valid Participant ID.\n\nEmpty entries are not allowed.');
                continue;
            }
            
            // Valid ID entered
            prolificId = prolificId.trim();
            console.log('User entered valid PROLIFIC_ID:', prolificId);
            break;
        }
        
        console.log('Using PROLIFIC_ID from mandatory prompt:', prolificId);
        return prolificId;
    }
    
    /**
     * Initialize GA4 with gtag.js
     */
    function initializeGA() {
        return new Promise((resolve, reject) => {
            try {
                // Get user ID
                window.GALite.userId = getProlificId();
                
                // Load gtag.js
                const script = document.createElement('script');
                script.async = true;
                script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
                script.onerror = () => reject(new Error('Failed to load gtag.js'));
                
                script.onload = () => {
                    // Initialize gtag
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    window.gtag = gtag;
                    
                    gtag('js', new Date());
                    
                    // Configure GA with user_id if available
                    const config = {
                        send_page_view: true,
                        debug_mode: false
                    };
                    
                    if (window.GALite.userId) {
                        config.user_id = window.GALite.userId;
                        gtag('set', 'user_properties', { participant_id: window.GALite.userId });
                    }
                    
                    gtag('config', GA_MEASUREMENT_ID, config);
                    
                    window.GALite.isLoaded = true;
                    resolve();
                };
                
                document.head.appendChild(script);
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * Track custom event with automatic user_id and participant_id inclusion
     */
    function track(eventName, parameters = {}) {
        if (!window.GALite.isLoaded || typeof window.gtag !== 'function') {
            return; // Fail silently if GA is blocked
        }
        
        try {
            const eventData = { ...parameters };
            
            // Always include user_id if available
            if (window.GALite.userId) {
                eventData.user_id = window.GALite.userId;
                // Add participant_id as duplicate for GA4 reporting
                eventData.participant_id = window.GALite.userId;
            }
            
            window.gtag('event', eventName, eventData);
        } catch (error) {
            // Fail silently - no console errors
        }
    }
    
    /**
     * Track page view
     */
    function trackPageView(pageTitle = document.title, pagePath = window.location.pathname) {
        track('page_view', {
            page_title: pageTitle,
            page_location: window.location.href,
            page_path: pagePath
        });
    }
    
    // Expose public API
    window.GALite.init = initializeGA;
    window.GALite.track = track;
    window.GALite.trackPageView = trackPageView;
    
    // No localStorage storage - each session is independent
    
    // Clear any existing stored PROLIFIC_ID on page load (for research study independence)
    try {
        localStorage.removeItem(PROLIFIC_ID_KEY);
        console.log('Cleared any existing PROLIFIC_ID for fresh session');
    } catch (e) {
        // Fail silently
    }
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeGA().catch(() => {
                // Fail silently if GA initialization fails
            });
        });
    } else {
        initializeGA().catch(() => {
            // Fail silently if GA initialization fails
        });
    }
    
})();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeGA().catch(() => {
                // Fail silently if GA initialization fails
            });
        });
    } else {
        initializeGA().catch(() => {
            // Fail silently if GA initialization fails
        });
    }
    
})();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeGA().catch(() => {
                // Fail silently if GA initialization fails
            });
        });
    } else {
        initializeGA().catch(() => {
            // Fail silently if GA initialization fails
        });
    }
    
})();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeGA().catch(() => {
                // Fail silently if GA initialization fails
            });
        });
    } else {
        initializeGA().catch(() => {
            // Fail silently if GA initialization fails
        });
    }
    
})();


/**
 * MongoDB Tracker - Base Implementation
 * Sends tracking events to MongoDB via backend API
 * Works alongside or replaces GA4 tracking
 */

(function() {
    'use strict';
    
    // Configuration - Auto-detect API URL (works for localhost and Vercel)
    const getApiBaseUrl = () => {
        // If running on Vercel or production, use relative URLs
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            return '/api';
        }
        // Local development
        return 'http://localhost:3000/api';
    };
    
    const API_BASE = getApiBaseUrl();
    const API_URL = `${API_BASE}/track`;
    const BATCH_API_URL = `${API_BASE}/track/batch`;
    const BATCH_SIZE = 10;
    const BATCH_INTERVAL = 5000; // 5 seconds
    const RETRY_DELAY = 1000; // 1 second
    const MAX_RETRIES = 3;
    
    // Global tracking state
    window.MongoTracker = {
        isInitialized: false,
        participantId: null,
        studyType: null,
        sessionId: null,
        eventQueue: [],
        batchTimer: null,
        isCollectingPid: false  // Prevent multiple simultaneous PID prompts
    };
    
    /**
     * Get participant ID (from URL or prompt)
     * MongoDB-only tracking - no GA4 dependency
     */
    function getParticipantId() {
        // If we already have a participant ID, return it
        if (window.MongoTracker.participantId) {
            console.log('MongoTracker: Using existing participant ID:', window.MongoTracker.participantId);
            return window.MongoTracker.participantId;
        }
        
        // Read pid from URL parameter (from Qualtrics)
        const urlParams = new URLSearchParams(window.location.search);
        const pidFromUrl = urlParams.get('pid');
        
        if (pidFromUrl) {
            console.log('MongoTracker: Using pid from URL:', pidFromUrl);
            window.MongoTracker.participantId = pidFromUrl.trim();
            return window.MongoTracker.participantId;
        }
        
        // If no pid in URL, use "unknown" (shouldn't happen in production)
        console.warn('MongoTracker: No pid found in URL, using "unknown"');
        window.MongoTracker.participantId = 'unknown';
        return 'unknown';
            break;
        }
        
        window.MongoTracker.isCollectingPid = false;
        window.MongoTracker.participantId = prolificId;
        
        // Don't store in localStorage - each session should be independent
        return prolificId;
    }
    
    /**
     * Generate session ID
     */
    function generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Detect study type from URL or page
     */
    function detectStudyType() {
        const path = window.location.pathname;
        const hostname = window.location.hostname;
        
        if (path.includes('carousel') || path.includes('reel-carousel')) {
            return hostname.includes('feed') ? 'feed_carousel' : 'reel_carousel';
        } else if (path.includes('video') || path.includes('reel-video')) {
            return hostname.includes('feed') ? 'feed_video' : 'reel_video';
        }
        
        // Fallback: check page content or data attributes
        const studyTypeElement = document.querySelector('[data-study-type]');
        if (studyTypeElement) {
            return studyTypeElement.getAttribute('data-study-type');
        }
        
        return 'unknown';
    }
    
    /**
     * Send event to API
     */
    async function sendEvent(eventName, properties = {}) {
        const event = {
            event_name: eventName,
            participant_id: window.MongoTracker.participantId,
            study_type: window.MongoTracker.studyType,
            session_id: window.MongoTracker.sessionId,
            properties: properties,
            page_url: window.location.href,
            timestamp: new Date().toISOString()
        };
        
        // Add to queue for batch processing
        window.MongoTracker.eventQueue.push(event);
        
        // Try immediate send (non-blocking)
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(event)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('MongoTracker: Event tracked:', eventName, result);
                // Remove from queue if successfully sent
                const index = window.MongoTracker.eventQueue.indexOf(event);
                if (index > -1) {
                    window.MongoTracker.eventQueue.splice(index, 1);
                }
                return result;
            } else {
                console.warn('MongoTracker: Event tracking failed:', response.status);
                // Keep in queue for retry
            }
        } catch (error) {
            console.warn('MongoTracker: Event tracking error (will retry):', error);
            // Keep in queue for retry
        }
    }
    
    /**
     * Send batch of events
     */
    async function sendBatch() {
        if (window.MongoTracker.eventQueue.length === 0) {
            return;
        }
        
        const batch = window.MongoTracker.eventQueue.splice(0, BATCH_SIZE);
        
        try {
            const response = await fetch(BATCH_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ events: batch })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('MongoTracker: Batch tracked:', result.inserted_count, 'events');
            } else {
                console.warn('MongoTracker: Batch tracking failed:', response.status);
                // Put events back in queue
                window.MongoTracker.eventQueue.unshift(...batch);
            }
        } catch (error) {
            console.warn('MongoTracker: Batch tracking error:', error);
            // Put events back in queue
            window.MongoTracker.eventQueue.unshift(...batch);
        }
    }
    
    /**
     * Initialize MongoDB tracker
     */
    function initialize(studyType = null) {
        if (window.MongoTracker.isInitialized) {
            console.log('MongoTracker: Already initialized');
            return;
        }
        
        console.log('MongoTracker: Initializing...');
        
        // Get participant ID
        window.MongoTracker.participantId = getParticipantId();
        
        // Detect or set study type
        window.MongoTracker.studyType = studyType || detectStudyType();
        
        // Generate session ID
        window.MongoTracker.sessionId = generateSessionId();
        
        // Mark as initialized
        window.MongoTracker.isInitialized = true;
        
        // Start batch processing timer
        window.MongoTracker.batchTimer = setInterval(sendBatch, BATCH_INTERVAL);
        
        // Track page view
        sendEvent('page_view', {
            page_title: document.title,
            referrer: document.referrer || null
        });
        
        // Track session start
        sendEvent('session_start', {
            session_id: window.MongoTracker.sessionId
        });
        
        // Send queued events on page unload
        window.addEventListener('beforeunload', () => {
            // Send remaining events synchronously
            if (window.MongoTracker.eventQueue.length > 0) {
                // Use sendBeacon for reliability
                const events = window.MongoTracker.eventQueue;
                navigator.sendBeacon(BATCH_API_URL, JSON.stringify({ events: events }));
            }
        });
        
        console.log('MongoTracker: Initialized successfully');
        console.log('MongoTracker: Participant ID:', window.MongoTracker.participantId);
        console.log('MongoTracker: Study Type:', window.MongoTracker.studyType);
        console.log('MongoTracker: Session ID:', window.MongoTracker.sessionId);
    }
    
    /**
     * Track custom event
     */
    function track(eventName, properties = {}) {
        if (!window.MongoTracker.isInitialized) {
            console.warn('MongoTracker: Not initialized, initializing now...');
            initialize();
        }
        
        sendEvent(eventName, properties);
    }
    
    // Expose API
    window.MongoTracker.initialize = initialize;
    window.MongoTracker.track = track;
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Don't auto-initialize - let each study initialize with its type
        });
    }
    
    console.log('MongoTracker: Base tracker loaded');
    
})();


/**
 * MongoDB Tracker for Reel Video Study
 * Extends base tracker with video-specific events
 */

// Load base tracker first (should be loaded before this)
if (typeof window.MongoTracker === 'undefined') {
    console.error('MongoTracker: Base tracker not loaded. Include mongo-tracker-base.js first.');
}

(function() {
    'use strict';
    
    // Initialize with study type
    if (window.MongoTracker && !window.MongoTracker.isInitialized) {
        window.MongoTracker.initialize('reel_video');
    }
    
    // Video tracking state
    let videoState = {
        isStarted: false,
        isPlaying: false,
        milestonesReached: [],
        totalWatchTime: 0,
        videoStartTime: null,
        lastMilestone: 0
    };
    
    /**
     * Track video start
     */
    function trackVideoStart(videoDuration) {
        if (window.MongoTracker && !videoState.isStarted) {
            videoState.isStarted = true;
            videoState.videoStartTime = Date.now();
            window.MongoTracker.track('video_start', {
                video_duration: videoDuration,
                video_type: 'reel_video',
                video_id: 'nyu_reel_video'
            });
        }
    }
    
    /**
     * Track video play
     */
    function trackVideoPlay(currentTime, videoDuration) {
        if (window.MongoTracker) {
            videoState.isPlaying = true;
            window.MongoTracker.track('video_play', {
                current_time: currentTime,
                video_duration: videoDuration,
                video_type: 'reel_video'
            });
        }
    }
    
    /**
     * Track video pause
     */
    function trackVideoPause(currentTime, videoDuration) {
        if (window.MongoTracker) {
            videoState.isPlaying = false;
            window.MongoTracker.track('video_pause', {
                current_time: currentTime,
                video_duration: videoDuration,
                video_type: 'reel_video'
            });
        }
    }
    
    /**
     * Track video progress milestone
     */
    function trackVideoProgress(milestone, currentTime, videoDuration) {
        if (window.MongoTracker && !videoState.milestonesReached.includes(milestone)) {
            videoState.milestonesReached.push(milestone);
            videoState.lastMilestone = milestone;
            
            window.MongoTracker.track('video_progress', {
                milestone: milestone,
                milestone_percent: milestone,
                current_time: currentTime,
                video_duration: videoDuration,
                video_type: 'reel_video',
                milestones_reached: [...videoState.milestonesReached]
            });
        }
    }
    
    /**
     * Track video session complete
     */
    function trackVideoSessionComplete(totalWatchTime, videoDuration, milestonesReached) {
        if (window.MongoTracker && videoState.isStarted) {
            window.MongoTracker.track('video_session_complete', {
                total_watch_time_seconds: totalWatchTime,
                video_duration: videoDuration,
                watch_percentage: Math.round((totalWatchTime / videoDuration) * 100),
                milestones_reached: milestonesReached || videoState.milestonesReached,
                milestone_25_reached: videoState.milestonesReached.includes(25),
                milestone_50_reached: videoState.milestonesReached.includes(50),
                milestone_75_reached: videoState.milestonesReached.includes(75),
                milestone_100_reached: videoState.milestonesReached.includes(100),
                video_type: 'reel_video'
            });
        }
    }
    
    /**
     * Track CTA click
     */
    function trackCTAClick(ctaType, ctaId) {
        if (window.MongoTracker) {
            window.MongoTracker.track('cta_click', {
                cta_type: ctaType,
                cta_id: ctaId,
                video_type: 'reel_video'
            });
        }
    }
    
    // Expose functions globally for integration
    window.MongoVideoTracker = {
        trackVideoStart: trackVideoStart,
        trackVideoPlay: trackVideoPlay,
        trackVideoPause: trackVideoPause,
        trackVideoProgress: trackVideoProgress,
        trackVideoSessionComplete: trackVideoSessionComplete,
        trackCTAClick: trackCTAClick
    };
    
    console.log('MongoTracker: Reel Video tracker loaded');
    
})();


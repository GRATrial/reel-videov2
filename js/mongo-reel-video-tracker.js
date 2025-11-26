/**
 * MongoDB Tracker - REEL VIDEO Study Only
 * Tracks total time spent watching the video using YouTube API
 * Based on GA4 version but sends to MongoDB instead
 */

(function() {
    'use strict';
    
    if (typeof window.MongoTracker === 'undefined') {
        console.error('MongoReelVideoTracker: Base tracker not loaded');
        return;
    }
    
    if (!window.MongoTracker.isInitialized) {
        window.MongoTracker.initialize('reel_video');
    }
    
    // Video tracking state (similar to GA4 version)
    const videoState = {
        isTrackingEnabled: false,
        totalWatchTimeSeconds: 0,
        sessionStartTime: null,
        currentPlayStartTime: null,
        player: null,
        duration: 0,
        hasStartedOnce: false,
        playCount: 0,
        lastReportedTime: 0,
        milestonesReached: new Set(),
        completionCount: 0,
        maxProgressReached: 0,
        // Enhanced metrics
        pauseCount: 0,
        totalPauseTimeSeconds: 0,
        pauseStartTime: null,
        unmuted: false,
        unmutedAtSecond: null,
        firstInteractionTime: null,
        pageLoadTime: Date.now(),
        sessionEndTime: null
    };
    
    // YouTube API ready flag
    let youTubeAPIReady = false;
    
    /**
     * Load YouTube iframe API
     */
    function loadYouTubeAPI() {
        if (window.YT && window.YT.Player) {
            youTubeAPIReady = true;
            initVideoPlayer();
            return;
        }
        
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        
        window.onYouTubeIframeAPIReady = function() {
            youTubeAPIReady = true;
            initVideoPlayer();
        };
    }
    
    /**
     * Initialize YouTube player
     */
    function initVideoPlayer() {
        const iframe = document.getElementById('adVideo');
        if (!iframe) {
            setTimeout(initVideoPlayer, 500);
            return;
        }
        
        try {
            videoState.player = new YT.Player('adVideo', {
                events: {
                    'onStateChange': onPlayerStateChange,
                    'onReady': onPlayerReady
                }
            });
            console.log('MongoReelVideoTracker: YouTube player initialized');
        } catch (error) {
            console.error('MongoReelVideoTracker: Error initializing player:', error);
        }
    }
    
    /**
     * Player ready event
     */
    function onPlayerReady(event) {
        videoState.duration = event.target.getDuration();
        console.log('MongoReelVideoTracker: Video ready, duration:', videoState.duration, 'seconds');
        
        // Ensure video is unmuted (autoplay is disabled, so no need to mute)
        try {
            if (event.target.isMuted()) {
                event.target.unMute();
                console.log('MongoReelVideoTracker: Video unmuted');
            }
        } catch (error) {
            console.error('MongoReelVideoTracker: Error unmuting video:', error);
        }
        
        // Start milestone tracking
        setupMilestoneTracking();
    }
    
    /**
     * Player state change event
     */
    function onPlayerStateChange(event) {
        if (!videoState.isTrackingEnabled) return;
        
        const state = event.data;
        const player = event.target;
        
        // PLAYING (1)
        if (state === YT.PlayerState.PLAYING) {
            // Track first interaction
            if (!videoState.firstInteractionTime) {
                videoState.firstInteractionTime = Date.now();
            }
            
            // Track pause time if we were paused
            if (videoState.pauseStartTime !== null) {
                const pauseDuration = (Date.now() - videoState.pauseStartTime) / 1000;
                videoState.totalPauseTimeSeconds += pauseDuration;
                videoState.pauseStartTime = null;
            }
            
            // Force unmute when video starts playing
            try {
                if (player.isMuted()) {
                    player.unMute();
                    console.log('MongoReelVideoTracker: Video unmuted on play');
                }
                
                // Track unmute if not already tracked
                if (!videoState.unmuted) {
                    videoState.unmuted = true;
                    videoState.unmutedAtSecond = player.getCurrentTime();
                }
            } catch (error) {
                console.error('MongoReelVideoTracker: Error unmuting:', error);
            }
            
            if (!videoState.hasStartedOnce) {
                videoState.hasStartedOnce = true;
                videoState.sessionStartTime = Date.now();
                trackVideoStart();
            }
            
            videoState.playCount++;
            videoState.currentPlayStartTime = player.getCurrentTime();
            console.log('MongoReelVideoTracker: Video playing, current time:', videoState.currentPlayStartTime);
        }
        
        // PAUSED (2)
        else if (state === YT.PlayerState.PAUSED) {
            // Track first interaction
            if (!videoState.firstInteractionTime) {
                videoState.firstInteractionTime = Date.now();
            }
            
            // Increment pause count
            videoState.pauseCount++;
            videoState.pauseStartTime = Date.now();
            
            if (videoState.currentPlayStartTime !== null) {
                const currentTime = player.getCurrentTime();
                const watchedDuration = currentTime - videoState.currentPlayStartTime;
                if (watchedDuration > 0) {
                    videoState.totalWatchTimeSeconds += watchedDuration;
                    videoState.currentPlayStartTime = null;
                    console.log('MongoReelVideoTracker: Video paused, watched:', watchedDuration, 's, total:', videoState.totalWatchTimeSeconds.toFixed(2), 's');
                    trackWatchTime(videoState.totalWatchTimeSeconds);
                }
            }
        }
        
        // ENDED (0)
        else if (state === YT.PlayerState.ENDED) {
            if (videoState.currentPlayStartTime !== null) {
                const currentTime = player.getCurrentTime();
                const watchedDuration = currentTime - videoState.currentPlayStartTime;
                if (watchedDuration > 0) {
                    videoState.totalWatchTimeSeconds += watchedDuration;
                }
                videoState.currentPlayStartTime = null;
            }
            
            videoState.completionCount++;
            const currentTime = player.getCurrentTime();
            if (currentTime > videoState.maxProgressReached) {
                videoState.maxProgressReached = currentTime;
            }
            
            console.log('MongoReelVideoTracker: Video ended, total watch time:', videoState.totalWatchTimeSeconds.toFixed(2), 's');
            trackVideoComplete();
        }
    }
    
    /**
     * Track video start
     */
    function trackVideoStart() {
        window.MongoTracker.track('reel_video_start', {
            video_duration: videoState.duration,
            video_id: 'nyu_reel_video',
            condition: 'reel_video'
        });
    }
    
    /**
     * Track watch time (periodic updates)
     */
    function trackWatchTime(totalSeconds) {
        window.MongoTracker.track('reel_video_watch_time', {
            watch_time_seconds: totalSeconds,
            watch_time_minutes: Math.round((totalSeconds / 60) * 100) / 100,
            condition: 'reel_video'
        });
    }
    
    /**
     * Track video progress milestones
     */
    function trackVideoProgress(milestone) {
        if (videoState.milestonesReached.has(milestone)) {
            return; // Already tracked
        }
        
        videoState.milestonesReached.add(milestone);
        const currentTime = videoState.player ? videoState.player.getCurrentTime() : 0;
        
        window.MongoTracker.track('reel_video_progress', {
            milestone: milestone,
            milestone_percent: milestone,
            current_time: Math.round(currentTime),
            total_watch_time: Math.round(videoState.totalWatchTimeSeconds),
            condition: 'reel_video'
        });
        
        console.log('MongoReelVideoTracker: Milestone reached:', milestone + '%');
    }
    
    /**
     * Track video completion
     */
    function trackVideoComplete() {
        const completionRate = videoState.duration > 0 ? 
            (videoState.totalWatchTimeSeconds / videoState.duration) * 100 : 0;
        
        window.MongoTracker.track('reel_video_complete', {
            total_watch_time_seconds: Math.round(videoState.totalWatchTimeSeconds),
            total_watch_time_minutes: Math.round((videoState.totalWatchTimeSeconds / 60) * 100) / 100,
            video_duration: videoState.duration,
            completion_rate: Math.min(100, Math.round(completionRate)),
            play_count: videoState.playCount,
            completion_count: videoState.completionCount,
            milestones_reached: Array.from(videoState.milestonesReached).sort((a,b) => a-b),
            milestone_25_reached: videoState.milestonesReached.has(25),
            milestone_50_reached: videoState.milestonesReached.has(50),
            milestone_75_reached: videoState.milestonesReached.has(75),
            milestone_100_reached: videoState.milestonesReached.has(100),
            condition: 'reel_video'
        });
    }
    
    /**
     * Setup milestone tracking
     */
    function setupMilestoneTracking() {
        if (!videoState.player || !videoState.isTrackingEnabled) return;
        
        const checkMilestones = () => {
            if (!videoState.player || !videoState.isTrackingEnabled) return;
            
            try {
                const currentTime = videoState.player.getCurrentTime();
                const progressPercent = videoState.duration > 0 ? 
                    Math.round((currentTime / videoState.duration) * 100) : 0;
                
                if (currentTime > videoState.maxProgressReached) {
                    videoState.maxProgressReached = currentTime;
                }
                
                // Check for milestone achievements
                [25, 50, 75, 100].forEach(milestone => {
                    if (progressPercent >= milestone && !videoState.milestonesReached.has(milestone)) {
                        trackVideoProgress(milestone);
                    }
                });
                
                // Continue checking if video is still playing
                if (videoState.player.getPlayerState() === YT.PlayerState.PLAYING) {
                    setTimeout(checkMilestones, 1000);
                }
            } catch (error) {
                console.error('MongoReelVideoTracker: Error checking milestones:', error);
            }
        };
        
        setTimeout(checkMilestones, 1000);
    }
    
    /**
     * Handle page unload - report final results
     */
    function handleUnload() {
        if (!videoState.isTrackingEnabled || !videoState.hasStartedOnce) return;
        
        // Add any current play time
        if (videoState.currentPlayStartTime !== null && videoState.player) {
            try {
                const currentTime = videoState.player.getCurrentTime();
                const watchedDuration = currentTime - videoState.currentPlayStartTime;
                if (watchedDuration > 0) {
                    videoState.totalWatchTimeSeconds += watchedDuration;
                }
            } catch (error) {
                console.error('MongoReelVideoTracker: Error getting final time:', error);
            }
        }
        
        // Track final summary
        trackVideoSummary();
    }
    
    /**
     * Track final summary with comprehensive metrics
     */
    function trackVideoSummary() {
        // Calculate final pause time if still paused
        if (videoState.pauseStartTime !== null) {
            const pauseDuration = (Date.now() - videoState.pauseStartTime) / 1000;
            videoState.totalPauseTimeSeconds += pauseDuration;
            videoState.pauseStartTime = null;
        }
        
        // Set session end time
        videoState.sessionEndTime = Date.now();
        
        // Calculate metrics
        const completionRate = videoState.duration > 0 ? 
            (videoState.totalWatchTimeSeconds / videoState.duration) * 100 : 0;
        
        const totalTimeOnPage = (videoState.sessionEndTime - videoState.pageLoadTime) / 1000;
        const timeToFirstInteraction = videoState.firstInteractionTime ? 
            (videoState.firstInteractionTime - videoState.pageLoadTime) / 1000 : null;
        
        const videoCompleted = videoState.completionCount > 0 || videoState.maxProgressReached >= videoState.duration * 0.95;
        const replayed = videoState.playCount > 1;
        
        // Prepare comprehensive summary
        const summary = {
            // Basic session metrics
            participant_id: window.MongoTracker.participantId || 'unknown',
            session_start: videoState.sessionStartTime ? new Date(videoState.sessionStartTime).toISOString() : new Date(videoState.pageLoadTime).toISOString(),
            session_end: new Date(videoState.sessionEndTime).toISOString(),
            total_time_on_page: Math.round(totalTimeOnPage),
            
            // Video metrics
            video_completed: videoCompleted ? 'yes' : 'no',
            watch_duration: Math.round(videoState.totalWatchTimeSeconds),
            completion_percentage: Math.min(100, Math.round(completionRate)),
            pause_count: videoState.pauseCount,
            total_pause_time: Math.round(videoState.totalPauseTimeSeconds),
            unmuted: videoState.unmuted ? 'yes' : 'no',
            unmuted_at_second: videoState.unmutedAtSecond !== null ? Math.round(videoState.unmutedAtSecond * 10) / 10 : null,
            replayed: replayed ? 'yes' : 'no',
            time_to_first_interaction: timeToFirstInteraction !== null ? Math.round(timeToFirstInteraction * 10) / 10 : null,
            
            // Additional tracking data
            video_duration: videoState.duration,
            play_count: videoState.playCount,
            completion_count: videoState.completionCount,
            max_progress_reached: Math.round(videoState.maxProgressReached),
            milestones_reached: Array.from(videoState.milestonesReached).sort((a,b) => a-b),
            condition: 'reel_video'
        };
        
        // Log comprehensive summary via logEvent
        if (window.MongoTracker.logEvent) {
            window.MongoTracker.logEvent('video_summary', summary);
        }
        
        // Also track via old system for compatibility
        window.MongoTracker.track('reel_video_summary', summary);
        
        console.log('MongoReelVideoTracker: Final summary -', videoState.totalWatchTimeSeconds.toFixed(2), 'seconds');
        console.log('MongoReelVideoTracker: Comprehensive metrics:', summary);
    }
    
    /**
     * Toggle mute/unmute
     */
    function toggleMute() {
        if (!videoState.player) {
            console.log('MongoReelVideoTracker: Player not ready');
            return;
        }
        
        try {
            // Track first interaction
            if (!videoState.firstInteractionTime) {
                videoState.firstInteractionTime = Date.now();
            }
            
            const isMuted = videoState.player.isMuted();
            if (isMuted) {
                videoState.player.unMute();
                console.log('MongoReelVideoTracker: Video unmuted');
                
                // Track unmute if not already tracked
                if (!videoState.unmuted) {
                    videoState.unmuted = true;
                    videoState.unmutedAtSecond = videoState.player.getCurrentTime();
                }
            } else {
                videoState.player.mute();
                console.log('MongoReelVideoTracker: Video muted');
            }
            return !isMuted; // Return new mute state
        } catch (error) {
            console.error('MongoReelVideoTracker: Error toggling mute:', error);
            return null;
        }
    }
    
    /**
     * Enable tracking (called when tap-to-start is clicked)
     */
    function enableTracking() {
        videoState.isTrackingEnabled = true;
        console.log('MongoReelVideoTracker: Tracking enabled');
        
        // Start video and unmute when tracking is enabled
        if (videoState.player) {
            try {
                // Check if player is ready and has the methods
                if (typeof videoState.player.unMute === 'function') {
                    videoState.player.unMute();
                } else {
                    console.warn('MongoReelVideoTracker: unMute method not available, player may not be ready');
                }
                
                // Then play
                if (typeof videoState.player.playVideo === 'function') {
                    videoState.player.playVideo();
                    console.log('MongoReelVideoTracker: Video started');
                } else {
                    console.warn('MongoReelVideoTracker: playVideo method not available');
                }
            } catch (error) {
                console.error('MongoReelVideoTracker: Error starting video:', error);
            }
        } else {
            console.warn('MongoReelVideoTracker: Player not initialized yet');
        }
    }
    
    /**
     * Wait for tap-to-start overlay
     */
    function waitForTapToStart() {
        const tapOverlay = document.getElementById('tap-to-start-overlay');
        if (tapOverlay) {
            tapOverlay.addEventListener('click', () => {
                enableTracking();
            });
        } else {
            // If no overlay, enable tracking immediately
            setTimeout(() => {
                enableTracking();
            }, 1000);
        }
    }
    
    /**
     * Initialize tracking
     */
    function initTracking() {
        // Load YouTube API
        loadYouTubeAPI();
        
        // Wait for tap-to-start
        waitForTapToStart();
        
        // Setup unload handlers
        window.addEventListener('beforeunload', handleUnload);
        window.addEventListener('pagehide', handleUnload);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && videoState.currentPlayStartTime !== null && videoState.player) {
                try {
                    const currentTime = videoState.player.getCurrentTime();
                    const watchedDuration = currentTime - videoState.currentPlayStartTime;
                    if (watchedDuration > 0) {
                        videoState.totalWatchTimeSeconds += watchedDuration;
                    }
                    videoState.currentPlayStartTime = null;
                } catch (error) {
                    // Ignore errors
                }
            }
        });
    }
    
    /**
     * Expose VideoTracker for compatibility with HTML mute toggle and tap-to-start
     */
    window.VideoTracker = {
        toggleMute: toggleMute,
        enableTracking: enableTracking,
        player: () => videoState.player
    };
    
    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTracking);
    } else {
        initTracking();
    }
    
    console.log('MongoReelVideoTracker: Loaded');
    
})();

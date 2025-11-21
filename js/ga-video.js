/**
 * GA4 YouTube Video Tracking - Session-based Total Watch Time
 * Only reports total watch time when session ends (page close/unload)
 */

(function() {
    'use strict';
    
    // Configuration
    const VIDEO_ID = 'nyu_youtube_ad';
    
    // Session tracking state
    let sessionState = {
        isTrackingEnabled: false, // Only true after "Tap to Start"
        totalWatchTimeSeconds: 0, // Cumulative watch time across all plays
        sessionStartTime: null,
        currentPlayStartTime: null,
        player: null,
        duration: 0,
        hasStartedOnce: false, // Track if video ever started playing
        playCount: 0, // How many times video was played
        lastReportedTime: 0, // Prevent duplicate time counting
        hasReportedFinalResults: false, // Prevent duplicate final reports
        milestonesReached: new Set(), // Track which milestones have been reached (25, 50, 75, 100)
        completionCount: 0, // Track how many times video was completed
        maxProgressReached: 0 // Track furthest point reached in video
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
        
        // Load YouTube iframe API
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        
        // YouTube API calls this when ready
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
            console.log('Video iframe not found');
            return;
        }
        
        try {
            sessionState.player = new YT.Player('adVideo', {
                events: {
                    'onReady': onPlayerReady,
                    'onStateChange': onPlayerStateChange
                }
            });
            
            console.log('YouTube player initialized');
        } catch (error) {
            console.log('Error initializing YouTube player:', error);
        }
    }
    
    /**
     * Player ready - set up tracking but don't start yet
     */
    function onPlayerReady(event) {
        console.log('YouTube player ready');
        sessionState.duration = sessionState.player.getDuration();
        
        // IMPORTANT: Stop any autoplay immediately
        sessionState.player.pauseVideo();
        sessionState.player.mute(); // Ensure it's muted
        console.log('Video paused - waiting for Tap to Start');
        
        // Wait for "Tap to Start" before enabling tracking
        waitForTapToStart();
        
        // Set up page unload tracking
        setupUnloadTracking();
    }
    
    /**
     * Handle player state changes
     */
    function onPlayerStateChange(event) {
        if (!sessionState.isTrackingEnabled) {
            // CRITICAL: Prevent any playback before "Tap to Start"
            if (event.data === YT.PlayerState.PLAYING) {
                console.log('Video tried to autoplay - stopping until Tap to Start');
                sessionState.player.pauseVideo();
            }
            return; // Don't track until "Tap to Start" is clicked
        }
        
        const currentTime = sessionState.player.getCurrentTime();
        
        switch (event.data) {
            case YT.PlayerState.PLAYING:
                handleVideoPlay(currentTime);
                // Set up milestone tracking during playback
                setupMilestoneTracking();
                break;
                
            case YT.PlayerState.PAUSED:
                handleVideoPause(currentTime);
                break;
                
            case YT.PlayerState.ENDED:
                handleVideoEnd(currentTime);
                break;
        }
    }
    
    /**
     * Handle video play start
     */
    function handleVideoPlay(currentTime) {
        console.log('Video started playing at:', currentTime);
        
        if (!sessionState.hasStartedOnce) {
            sessionState.hasStartedOnce = true;
            sessionState.sessionStartTime = Date.now();
        }
        
        sessionState.playCount++;
        sessionState.currentPlayStartTime = currentTime;
        sessionState.lastReportedTime = currentTime;
        
        console.log(`Play #${sessionState.playCount} started at ${currentTime}s`);
    }
    
    /**
     * Handle video pause
     */
    function handleVideoPause(currentTime) {
        if (sessionState.currentPlayStartTime !== null) {
            const watchedDuration = currentTime - sessionState.currentPlayStartTime;
            if (watchedDuration > 0) {
                sessionState.totalWatchTimeSeconds += watchedDuration;
                console.log(`Added ${watchedDuration.toFixed(2)}s to total. Total: ${sessionState.totalWatchTimeSeconds.toFixed(2)}s`);
            }
            sessionState.currentPlayStartTime = null;
        }
    }
    
    /**
     * Handle video end
     */
    function handleVideoEnd(currentTime) {
        console.log('Video ended');
        handleVideoPause(currentTime); // Count the final segment
        
        // Track completion
        sessionState.completionCount++;
        
        // Send 100% milestone if not already sent
        if (!sessionState.milestonesReached.has(100)) {
            sessionState.milestonesReached.add(100);
            sendMilestoneEvent(100);
        }
        
        console.log(`Video completion #${sessionState.completionCount}`);
        
        // Video completed - could restart, so reset for next play
        sessionState.currentPlayStartTime = null;
    }
    
    /**
     * Set up milestone tracking during video playback
     */
    function setupMilestoneTracking() {
        if (!sessionState.player || sessionState.duration <= 0) return;
        
        // Check milestones every second during playback
        const checkMilestones = () => {
            if (!sessionState.isTrackingEnabled) return;
            
            const currentTime = sessionState.player.getCurrentTime();
            const progressPercent = (currentTime / sessionState.duration) * 100;
            
            // Update max progress
            if (currentTime > sessionState.maxProgressReached) {
                sessionState.maxProgressReached = currentTime;
            }
            
            // Check for milestone achievements
            [25, 50, 75].forEach(milestone => {
                if (progressPercent >= milestone && !sessionState.milestonesReached.has(milestone)) {
                    sessionState.milestonesReached.add(milestone);
                    sendMilestoneEvent(milestone);
                }
            });
            
            // Continue checking if video is still playing
            if (sessionState.player.getPlayerState() === YT.PlayerState.PLAYING) {
                setTimeout(checkMilestones, 1000);
            }
        };
        
        // Start milestone checking
        setTimeout(checkMilestones, 1000);
    }
    
    /**
     * Send milestone event to GA4
     */
    function sendMilestoneEvent(percentage) {
        console.log(`🎯 Milestone reached: ${percentage}%`);
        
        if (window.GALite && window.GALite.track) {
            window.GALite.track('video_progress', {
                video_id: VIDEO_ID,
                progress_percentage: percentage,
                current_time_seconds: Math.round(sessionState.player.getCurrentTime()),
                play_count_at_milestone: sessionState.playCount,
                total_watch_time_so_far: Math.round(sessionState.totalWatchTimeSeconds),
                study_id: 'instagram_study'
            });
        }
    }
    
    /**
     * Wait for "Tap to Start" to enable tracking
     */
    function waitForTapToStart() {
        const tapOverlay = document.getElementById('tap-to-start-overlay');
        if (tapOverlay) {
            // Override the existing tap handler to enable our tracking
            tapOverlay.addEventListener('click', () => {
                console.log('Tap to Start clicked - Video tracking enabled');
                sessionState.isTrackingEnabled = true;
                
                // Start the video with browser-compliant autoplay
                setTimeout(() => {
                    startVideoWithAutoplay();
                }, 500);
            });
        }
    }
    
    /**
     * Start video with browser-compliant autoplay strategy
     */
    function startVideoWithAutoplay() {
        try {
            // Start muted (browser allows this)
            sessionState.player.mute();
            sessionState.player.playVideo();
            
            // Then unmute after a short delay (user has interacted)
            setTimeout(() => {
                sessionState.player.unMute();
                updateMuteIcon(false);
                console.log('Video started and unmuted');
            }, 1000);
            
        } catch (error) {
            console.log('Error starting video:', error);
        }
    }
    
    /**
     * Update mute icon
     */
    function updateMuteIcon(isMuted) {
        const muteIcon = document.querySelector('.mute-toggle-overlay svg');
        if (muteIcon) {
            if (isMuted) {
                muteIcon.innerHTML = '<path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-2 2-2-2-2 2 2 2-2 2 2 2 2-2 2 2 2-2-2-2 2-2z"/>';
            } else {
                muteIcon.innerHTML = '<path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93l-1.41 1.41C19.1 7.79 20 9.79 20 12s-.9 4.21-2.34 5.66l1.41 1.41C20.88 17.26 22 14.76 22 12s-1.12-5.26-2.93-7.07zM16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>';
            }
        }
    }
    
    /**
     * Setup page unload tracking to report final results
     */
    function setupUnloadTracking() {
        // Handle page unload - report total watch time
        const reportFinalResults = () => {
            if (!sessionState.isTrackingEnabled || !sessionState.hasStartedOnce || sessionState.hasReportedFinalResults) {
                if (sessionState.hasReportedFinalResults) {
                    console.log('Final results already reported, skipping duplicate');
                } else {
                    console.log('No video interaction to report');
                }
                return;
            }
            
            // Mark as reported to prevent duplicates
            sessionState.hasReportedFinalResults = true;
            
            // Add any current play time
            if (sessionState.currentPlayStartTime !== null && sessionState.player) {
                const currentTime = sessionState.player.getCurrentTime();
                const watchedDuration = currentTime - sessionState.currentPlayStartTime;
                if (watchedDuration > 0) {
                    sessionState.totalWatchTimeSeconds += watchedDuration;
                }
            }
            
            const totalMinutes = sessionState.totalWatchTimeSeconds / 60;
            const completionRate = sessionState.duration > 0 ? 
                (sessionState.totalWatchTimeSeconds / sessionState.duration) * 100 : 0;
            
            console.log('=== FINAL VIDEO SESSION REPORT ===');
            console.log(`Total watch time: ${sessionState.totalWatchTimeSeconds.toFixed(2)} seconds (${totalMinutes.toFixed(2)} minutes)`);
            console.log(`Play count: ${sessionState.playCount}`);
            console.log(`Completion count: ${sessionState.completionCount}`);
            console.log(`Completion rate: ${Math.min(100, completionRate).toFixed(1)}%`);
            console.log(`Milestones reached: ${Array.from(sessionState.milestonesReached).sort((a,b) => a-b).join(', ')}%`);
            console.log(`Max progress reached: ${(sessionState.maxProgressReached / sessionState.duration * 100).toFixed(1)}%`);
            console.log(`Video duration: ${sessionState.duration} seconds`);
            
            // Send to GA4 - comprehensive final report
            if (window.GALite && window.GALite.track) {
                window.GALite.track('video_session_complete', {
                    video_id: VIDEO_ID,
                    total_watch_time_seconds: Math.round(sessionState.totalWatchTimeSeconds),
                    total_watch_time_minutes: Math.round(totalMinutes * 100) / 100, // Round to 2 decimals
                    play_count: sessionState.playCount,
                    completion_count: sessionState.completionCount,
                    completion_rate_percent: Math.min(100, Math.round(completionRate)),
                    milestones_reached: Array.from(sessionState.milestonesReached).sort((a,b) => a-b).join(','),
                    milestone_25_reached: sessionState.milestonesReached.has(25),
                    milestone_50_reached: sessionState.milestonesReached.has(50),
                    milestone_75_reached: sessionState.milestonesReached.has(75),
                    milestone_100_reached: sessionState.milestonesReached.has(100),
                    max_progress_percent: Math.round((sessionState.maxProgressReached / sessionState.duration) * 100),
                    video_duration_seconds: Math.round(sessionState.duration),
                    session_duration_seconds: sessionState.sessionStartTime ? 
                        Math.round((Date.now() - sessionState.sessionStartTime) / 1000) : 0,
                    study_id: 'instagram_study'
                });
                
                console.log('✅ Final video session data sent to GA4');
            }
        };
        
        // Multiple event listeners for different unload scenarios
        window.addEventListener('beforeunload', reportFinalResults);
        window.addEventListener('pagehide', reportFinalResults);
        
        // Also track when page becomes hidden (user switches tabs)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                reportFinalResults();
            }
        });
    }
    
    /**
     * Toggle mute functionality for the overlay
     */
    function toggleMute() {
        if (!sessionState.player) return;
        
        if (sessionState.player.isMuted()) {
            sessionState.player.unMute();
            updateMuteIcon(false);
        } else {
            sessionState.player.mute();
            updateMuteIcon(true);
        }
    }
    
    /**
     * Initialize video tracking when DOM is ready
     */
    function initVideoTracking() {
        console.log('Initializing session-based video tracking...');
        
        // Wait for GALite to be available
        if (!window.GALite) {
            setTimeout(initVideoTracking, 100);
            return;
        }
        
        // Load YouTube API
        loadYouTubeAPI();
        
        // Set up mute toggle
        const muteOverlay = document.querySelector('.mute-toggle-overlay');
        if (muteOverlay) {
            muteOverlay.style.pointerEvents = 'auto';
            muteOverlay.style.opacity = '0.1';
            
            muteOverlay.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleMute();
                
                // Show mute icon briefly
                muteOverlay.classList.add('visible');
                setTimeout(() => {
                    muteOverlay.classList.remove('visible');
                }, 1000);
            });
        }
        
        console.log('Session-based video tracking initialized');
    }
    
    // Expose toggle function for external use
    window.VideoTracker = {
        toggleMute: toggleMute
    };
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initVideoTracking);
    } else {
        initVideoTracking();
    }
    
})();
     * Setup page unload tracking to report final results
     */
    function setupUnloadTracking() {
        // Handle page unload - report total watch time
        const reportFinalResults = () => {
            if (!sessionState.isTrackingEnabled || !sessionState.hasStartedOnce || sessionState.hasReportedFinalResults) {
                if (sessionState.hasReportedFinalResults) {
                    console.log('Final results already reported, skipping duplicate');
                } else {
                    console.log('No video interaction to report');
                }
            return;
            }
            
            // Mark as reported to prevent duplicates
            sessionState.hasReportedFinalResults = true;
            
            // Add any current play time
            if (sessionState.currentPlayStartTime !== null && sessionState.player) {
                const currentTime = sessionState.player.getCurrentTime();
                const watchedDuration = currentTime - sessionState.currentPlayStartTime;
                if (watchedDuration > 0) {
                    sessionState.totalWatchTimeSeconds += watchedDuration;
                }
            }
            
            const totalMinutes = sessionState.totalWatchTimeSeconds / 60;
            const completionRate = sessionState.duration > 0 ? 
                (sessionState.totalWatchTimeSeconds / sessionState.duration) * 100 : 0;
            
            console.log('=== FINAL VIDEO SESSION REPORT ===');
            console.log(`Total watch time: ${sessionState.totalWatchTimeSeconds.toFixed(2)} seconds (${totalMinutes.toFixed(2)} minutes)`);
            console.log(`Play count: ${sessionState.playCount}`);
            console.log(`Completion count: ${sessionState.completionCount}`);
            console.log(`Completion rate: ${Math.min(100, completionRate).toFixed(1)}%`);
            console.log(`Milestones reached: ${Array.from(sessionState.milestonesReached).sort((a,b) => a-b).join(', ')}%`);
            console.log(`Max progress reached: ${(sessionState.maxProgressReached / sessionState.duration * 100).toFixed(1)}%`);
            console.log(`Video duration: ${sessionState.duration} seconds`);
            
            // Send to GA4 - comprehensive final report
            if (window.GALite && window.GALite.track) {
                window.GALite.track('video_session_complete', {
                    video_id: VIDEO_ID,
                    total_watch_time_seconds: Math.round(sessionState.totalWatchTimeSeconds),
                    total_watch_time_minutes: Math.round(totalMinutes * 100) / 100, // Round to 2 decimals
                    play_count: sessionState.playCount,
                    completion_count: sessionState.completionCount,
                    completion_rate_percent: Math.min(100, Math.round(completionRate)),
                    milestones_reached: Array.from(sessionState.milestonesReached).sort((a,b) => a-b).join(','),
                    milestone_25_reached: sessionState.milestonesReached.has(25),
                    milestone_50_reached: sessionState.milestonesReached.has(50),
                    milestone_75_reached: sessionState.milestonesReached.has(75),
                    milestone_100_reached: sessionState.milestonesReached.has(100),
                    max_progress_percent: Math.round((sessionState.maxProgressReached / sessionState.duration) * 100),
                    video_duration_seconds: Math.round(sessionState.duration),
                    session_duration_seconds: sessionState.sessionStartTime ? 
                        Math.round((Date.now() - sessionState.sessionStartTime) / 1000) : 0,
                    study_id: 'instagram_study'
                });
                
                console.log('✅ Final video session data sent to GA4');
            }
        };
        
        // Multiple event listeners for different unload scenarios
        window.addEventListener('beforeunload', reportFinalResults);
        window.addEventListener('pagehide', reportFinalResults);
        
        // Also track when page becomes hidden (user switches tabs)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                reportFinalResults();
            }
        });
    }
    
    /**
     * Toggle mute functionality for the overlay
     */
    function toggleMute() {
        if (!sessionState.player) return;
        
        if (sessionState.player.isMuted()) {
            sessionState.player.unMute();
            updateMuteIcon(false);
        } else {
            sessionState.player.mute();
            updateMuteIcon(true);
        }
    }
    
    /**
     * Initialize video tracking when DOM is ready
     */
    function initVideoTracking() {
        console.log('Initializing session-based video tracking...');
        
        // Wait for GALite to be available
        if (!window.GALite) {
            setTimeout(initVideoTracking, 100);
            return;
        }
        
        // Load YouTube API
        loadYouTubeAPI();
        
        // Set up mute toggle
        const muteOverlay = document.querySelector('.mute-toggle-overlay');
        if (muteOverlay) {
            muteOverlay.style.pointerEvents = 'auto';
            muteOverlay.style.opacity = '0.1';
            
            muteOverlay.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleMute();
                
                // Show mute icon briefly
                muteOverlay.classList.add('visible');
                setTimeout(() => {
                    muteOverlay.classList.remove('visible');
                }, 1000);
            });
        }
        
        console.log('Session-based video tracking initialized');
    }
    
    // Expose toggle function for external use
    window.VideoTracker = {
        toggleMute: toggleMute
    };
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initVideoTracking);
    } else {
        initVideoTracking();
    }
    
})();
        // Track video start
        video.addEventListener('play', () => {
            if (!videoState.isStarted) {
                trackVideoStart();
                videoState.isStarted = true;
                videoState.startTime = Date.now();
            }
        });
        
        // Track progress during playback
        video.addEventListener('timeupdate', () => {
            const currentTime = video.currentTime;
            
            // Anti-skip logic: only update maxWatched if playing forward
            if (currentTime > videoState.maxWatched) {
                videoState.maxWatched = currentTime;
            }
            
            // Use maxWatched for progress tracking (not currentTime)
            trackVideoProgress(videoState.maxWatched);
        });
        
        // Track video completion
        video.addEventListener('ended', () => {
            trackVideoComplete();
        });
        
        // Track pause/resume for watch time calculation
        video.addEventListener('pause', () => {
            if (videoState.startTime) {
                videoState.totalWatchedMs += Date.now() - videoState.startTime;
                videoState.startTime = null;
            }
        });
        
        video.addEventListener('play', () => {
            if (!videoState.startTime) {
                videoState.startTime = Date.now();
            }
        });
    }
    
    /**
     * Set up Vimeo iframe tracking using postMessage API
     */
    function setupVimeoTracking(iframe) {
        videoState.videoType = 'vimeo';
        
        // Enable Vimeo API
        const src = iframe.src;
        if (src.indexOf('api=1') === -1) {
            iframe.src = src + (src.indexOf('?') === -1 ? '?' : '&') + 'api=1';
        }
        
        // Listen for Vimeo events
        window.addEventListener('message', (event) => {
            if (event.origin !== 'https://player.vimeo.com') return;
            
            try {
                const data = JSON.parse(event.data);
                handleVimeoEvent(data);
            } catch (e) {
                // Ignore non-JSON messages
            }
        });
        
        // Request events from Vimeo
        iframe.addEventListener('load', () => {
            const commands = [
                'addEventListener',
                'play',
                'pause',
                'ended',
                'timeupdate',
                'loaded'
            ];
            
            commands.forEach(command => {
                iframe.contentWindow.postMessage(JSON.stringify({
                    method: command,
                    value: command === 'addEventListener' ? 'play' : undefined
                }), 'https://player.vimeo.com');
            });
        });
    }
    
    /**
     * Handle Vimeo player events
     */
    function handleVimeoEvent(data) {
        switch (data.event) {
            case 'ready':
                // Get video duration
                break;
                
            case 'play':
                if (!videoState.isStarted) {
                    trackVideoStart();
                    videoState.isStarted = true;
                    videoState.startTime = Date.now();
                } else if (!videoState.startTime) {
                    videoState.startTime = Date.now();
                }
                break;
                
            case 'pause':
                if (videoState.startTime) {
                    videoState.totalWatchedMs += Date.now() - videoState.startTime;
                    videoState.startTime = null;
                }
                break;
                
            case 'timeupdate':
                if (data.data) {
                    const currentTime = data.data.seconds;
                    const duration = data.data.duration;
                    
                    if (!videoState.duration && duration) {
                        videoState.duration = duration;
                    }
                    
                    // Anti-skip logic
                    if (currentTime > videoState.maxWatched) {
                        videoState.maxWatched = currentTime;
                    }
                    
                    trackVideoProgress(videoState.maxWatched);
                }
                break;
                
            case 'ended':
                trackVideoComplete();
                break;
        }
    }
    
    /**
     * Track video start event
     */
    function trackVideoStart() {
        window.GALite.track('video_start', {
            video_type: videoState.videoType,
            duration_s: videoState.duration
        });
    }
    
    /**
     * Track video progress at specified intervals
     */
    function trackVideoProgress(currentSeconds) {
        if (!videoState.duration) return;
        
        PROGRESS_SECONDS.forEach(second => {
            if (currentSeconds >= second && !videoState.progressTracked.has(second)) {
                videoState.progressTracked.add(second);
                
                window.GALite.track('video_progress', {
                    second: second,
                    duration_s: videoState.duration,
                    video_type: videoState.videoType
                });
            }
        });
    }
    
    /**
     * Track video completion
     */
    function trackVideoComplete() {
        // Calculate final watch time
        if (videoState.startTime) {
            videoState.totalWatchedMs += Date.now() - videoState.startTime;
            videoState.startTime = null;
        }
        
        // Calculate percent watched based on maxWatched (anti-skip)
        const percentWatched = videoState.duration > 0 ? 
            Math.round((videoState.maxWatched / videoState.duration) * 100) : 0;
        
        window.GALite.track('video_complete', {
            watched_ms: videoState.totalWatchedMs,
            percent_watched: percentWatched,
            max_watched_s: videoState.maxWatched,
            duration_s: videoState.duration,
            video_type: videoState.videoType
        });
    }
    
    /**
     * Handle page unload - track completion if video was playing
     */
    function handlePageUnload() {
        if (videoState.isStarted && videoState.startTime) {
            // Add final watch time
            videoState.totalWatchedMs += Date.now() - videoState.startTime;
            
            // Track as incomplete completion
            const percentWatched = videoState.duration > 0 ? 
                Math.round((videoState.maxWatched / videoState.duration) * 100) : 0;
            
            window.GALite.track('video_complete', {
                watched_ms: videoState.totalWatchedMs,
                percent_watched: percentWatched,
                max_watched_s: videoState.maxWatched,
                duration_s: videoState.duration,
                video_type: videoState.videoType,
                completed_naturally: false
            });
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initVideoTracking);
    } else {
        initVideoTracking();
    }
    
    // Track completion on page unload
    window.addEventListener('beforeunload', handlePageUnload);
    window.addEventListener('pagehide', handlePageUnload);
    
    // Expose for debugging (optional)
    window.VideoTracker = {
        getState: () => ({ ...videoState }),
        PROGRESS_SECONDS: PROGRESS_SECONDS
    };
    
})();

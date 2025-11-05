// game-interface.js - Core framework for all mini-games

// Load mock if not in Telegram environment
if (!window.Telegram || !window.Telegram.WebApp) {
    const script = document.createElement('script');
    script.src = 'telegram-web-app-mock.js';
    document.head.appendChild(script);
}

class TelegramMiniGame {
    constructor(gameConfig) {
        this.config = {
            // Game Identity
            gameId: gameConfig.gameId,
            gameName: gameConfig.gameName,
            version: '1.0.0',
            
            // Standard Input Parameters
            difficulty: 1,           // 1=Easy, 2=Medium, 3=Hard, 4=Expert
            timeLimit: null,         // seconds, null = no limit
            timeModifier: 1.0,       // multiplier for time (1.5 = 50% more time)
            hintsEnabled: true,      // allow hints
            hintsCount: 3,           // number of hints available
            soundEnabled: true,      // sound effects
            hapticsEnabled: true,    // vibration feedback
            
            // Scoring modifiers
            scoreModifier: 1.0,      // score multiplier
            penaltyEnabled: true,    // mistakes reduce score
            
            // Session data
            sessionId: null,         // unique session identifier
            userId: null,            // Telegram user ID
            
            // Language support
            language: 'en',          // default language
            
            // Custom game-specific config
            custom: gameConfig.custom || {}
        };
        
        this.state = {
            status: 'idle',          // idle, playing, paused, completed, failed
            score: 0,
            moves: 0,
            mistakes: 0,
            hintsUsed: 0,
            startTime: null,
            endTime: null,
            timeElapsed: 0
        };
        
        // Milestone tracking
        this.milestones = [];
        
        // Language support (to be populated by child class)
        this.translations = {};
        
        this.tg = window.Telegram.WebApp;
        this.initTelegram();
        this.parseInputParams();
    }
    
    // Parse URL parameters and Telegram init data
    parseInputParams() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Override config with URL parameters
        if (urlParams.has('difficulty')) 
            this.config.difficulty = parseInt(urlParams.get('difficulty'));
        if (urlParams.has('timeLimit')) 
            this.config.timeLimit = parseInt(urlParams.get('timeLimit'));
        if (urlParams.has('timeModifier')) 
            this.config.timeModifier = parseFloat(urlParams.get('timeModifier'));
        if (urlParams.has('hints')) 
            this.config.hintsCount = parseInt(urlParams.get('hints'));
        if (urlParams.has('sessionId')) 
            this.config.sessionId = urlParams.get('sessionId');
        if (urlParams.has('scoreModifier')) 
            this.config.scoreModifier = parseFloat(urlParams.get('scoreModifier'));
        
        // Language parameter
        if (urlParams.has('lang') || urlParams.has('language')) {
            this.config.language = urlParams.get('lang') || urlParams.get('language');
        }
        
        // Get user from Telegram
        if (this.tg.initDataUnsafe.user) {
            this.config.userId = this.tg.initDataUnsafe.user.id;
            
            // Auto-detect language from Telegram user if not specified
            if (!urlParams.has('lang') && !urlParams.has('language')) {
                this.config.language = this.tg.initDataUnsafe.user.language_code || 'en';
            }
        }
        
        // Normalize language code (e.g., 'en-US' -> 'en')
        this.config.language = this.config.language.split('-')[0].toLowerCase();
        
        // Apply time modifier
        if (this.config.timeLimit) {
            this.config.timeLimit = Math.floor(this.config.timeLimit * this.config.timeModifier);
        }
        
        console.log('📥 Parsed config:', this.config);
    }
    
    // Initialize Telegram WebApp
    initTelegram() {
        this.tg.ready();
        this.tg.expand();
        
        // Handle back button
        this.tg.BackButton.onClick(() => this.handleExit());
        
        // Listen for theme changes
        this.tg.onEvent('themeChanged', () => this.handleThemeChange());
    }
    
    // ============================================
    // LANGUAGE SUPPORT METHODS
    // ============================================
    
    /**
     * Set translations for this game
     * Should be called by child class in constructor
     * @param {Object} translations - Object with language codes as keys
     * Example: { en: {...}, es: {...}, ru: {...} }
     */
    setTranslations(translations) {
        this.translations = translations;
        console.log(`🌍 Translations loaded for: ${Object.keys(translations).join(', ')}`);
        
        // Apply translations after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.applyTranslations());
        } else {
            this.applyTranslations();
        }
    }
    
    /**
     * Get translation for a key
     * @param {string} key - Translation key
     * @param {string} fallback - Optional fallback text
     * @returns {string} Translated text
     */
    t(key, fallback = null) {
        const lang = this.config.language;
        
        // Try current language
        if (this.translations[lang] && this.translations[lang][key]) {
            return this.translations[lang][key];
        }
        
        // Try English fallback
        if (lang !== 'en' && this.translations.en && this.translations.en[key]) {
            return this.translations.en[key];
        }
        
        // Return fallback or key
        return fallback || key;
    }
    
    /**
     * Apply translations to DOM elements with data-i18n attribute
     */
    applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key);
            
            // Check if element has child elements
            if (el.children.length === 0) {
                el.textContent = translation;
            } else {
                // Find text nodes and replace
                Array.from(el.childNodes).forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                        node.textContent = translation;
                    }
                });
            }
        });
        
        // Also handle data-i18n-placeholder for input fields
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key);
        });
        
        console.log(`✅ Translations applied (${this.config.language})`);
    }
    
    // ============================================
    // MILESTONE CHECKPOINT METHODS
    // ============================================
    
    /**
     * Record a milestone checkpoint
     * @param {string} milestoneName - Name/identifier of the milestone
     * @param {Object} metadata - Additional metadata for this milestone
     * @returns {Object} The recorded milestone object
     */
    recordMilestone(milestoneName, metadata = {}) {
        const milestone = {
            name: milestoneName,
            timestamp: Date.now(),
            gameTime: this.state.startTime ? 
                Math.floor((Date.now() - this.state.startTime) / 1000) : 0,
            
            // Current game state snapshot
            state: {
                score: this.state.score,
                moves: this.state.moves,
                mistakes: this.state.mistakes,
                hintsUsed: this.state.hintsUsed
            },
            
            // Game-specific data (override captureGameState in child class)
            gameData: this.captureGameState(),
            
            // Additional metadata
            metadata: metadata
        };
        
        this.milestones.push(milestone);
        
        console.log(`📍 Milestone: ${milestoneName}`, milestone);
        
        // Send event for analytics
        this.sendEvent('milestone_reached', {
            milestone: milestoneName,
            gameTime: milestone.gameTime,
            score: this.state.score
        });
        
        return milestone;
    }
    
    /**
     * Override this method in child class to capture game-specific state
     * @returns {Object} Game-specific state data
     */
    captureGameState() {
        return {};
    }
    
    /**
     * Get summary of all milestones
     * @returns {Object|null} Milestone summary or null if no milestones
     */
    getMilestonesSummary() {
        if (this.milestones.length === 0) return null;
        
        return {
            count: this.milestones.length,
            milestones: this.milestones,
            firstMilestone: this.milestones[0],
            lastMilestone: this.milestones[this.milestones.length - 1]
        };
    }
    
    // ============================================
    // GAME LIFECYCLE METHODS
    // ============================================
    
    // Start game
    start() {
        this.state.status = 'playing';
        this.state.startTime = Date.now();
        this.sendEvent('game_started', {
            difficulty: this.config.difficulty,
            timeLimit: this.config.timeLimit,
            language: this.config.language
        });
        console.log('🎮 Game started');
    }
    
    // End game
    end(success) {
        this.state.status = success ? 'completed' : 'failed';
        this.state.endTime = Date.now();
        this.state.timeElapsed = Math.floor((this.state.endTime - this.state.startTime) / 1000);
        
        const result = this.generateResult(success);
        this.sendResult(result);
        return result;
    }
    
    // Generate standardized result object
    generateResult(success) {
        const optimalScore = this.getOptimalScore();
        const performance = optimalScore ? Math.min(100, (this.state.score / optimalScore) * 100) : 100;
        
        return {
            // Result metadata
            sessionId: this.config.sessionId,
            gameId: this.config.gameId,
            gameName: this.config.gameName,
            userId: this.config.userId,
            timestamp: new Date().toISOString(),
            
            // Game outcome
            success: success,
            status: this.state.status,
            
            // Performance metrics
            score: this.state.score,
            finalScore: Math.floor(this.state.score * this.config.scoreModifier),
            moves: this.state.moves,
            mistakes: this.state.mistakes,
            hintsUsed: this.state.hintsUsed,
            
            // Time metrics
            timeElapsed: this.state.timeElapsed,
            timeLimit: this.config.timeLimit,
            timeRemaining: this.config.timeLimit ? this.config.timeLimit - this.state.timeElapsed : null,
            
            // Performance rating
            performance: Math.min(100, Math.max(0, performance)),
            rating: this.getRating(performance),
            
            // Configuration used
            difficulty: this.config.difficulty,
            language: this.config.language,
            modifiers: {
                timeModifier: this.config.timeModifier,
                scoreModifier: this.config.scoreModifier,
                hintsEnabled: this.config.hintsEnabled
            },
            
            // Additional context
            optimal: this.isOptimalSolution(),
            achievements: this.checkAchievements(),
            
            // Milestone data
            milestones: this.getMilestonesSummary(),
            
            // Game-specific data
            gameData: this.getGameSpecificData(),
            
            // Output string for bot display
            outputString: this.generateOutputString(success)
        };
    }
    
    // Send result back to Telegram bot
    // Send result back to Telegram bot
    sendResult(result) {
        console.log('📤 Sending result:', result);
        
        // Validate result has required fields
        if (!result.sessionId || !result.gameId) {
            console.error('❌ Invalid result: missing sessionId or gameId');
            return;
        }
        
        try {
            // Convert to JSON string (Telegram requires string)
            const resultString = JSON.stringify(result);
            
            // Check size (Telegram limit is 4096 bytes)
            if (resultString.length > 4096) {
                console.warn(`⚠️ Result size: ${resultString.length} bytes (limit: 4096)`);
                // Could compress or truncate here if needed
            }
            
            console.log(`✅ Result validated: ${resultString.length} bytes`);
            
            // ✅ PRIMARY METHOD: Telegram's native sendData
            if (this.tg && typeof this.tg.sendData === 'function') {
                this.tg.sendData(resultString);
                console.log('✅ Result sent via Telegram.WebApp.sendData()');
                
                // Close the WebApp after a brief delay
                setTimeout(() => {
                    console.log('🚪 Closing WebApp...');
                    this.tg.close();
                }, 1500);
                
                return; // Exit - we're done!
            }
            
            // ⚠️ FALLBACK: If sendData not available (shouldn't happen)
            console.warn('⚠️ Telegram.WebApp.sendData() not available');
            console.log('💾 Saving to localStorage instead');
            
            // Save locally for testing/debugging
            localStorage.setItem(`game_result_${this.config.sessionId}`, resultString);
            localStorage.setItem(`game_result_latest`, resultString);
            
            alert('Game completed!\n\nResult saved to localStorage (testing mode)');
            
        } catch (e) {
            console.error('❌ Error sending result:', e);
            
            // Emergency fallback
            localStorage.setItem(`game_result_error_${Date.now()}`, JSON.stringify({
                error: e.message,
                result: result
            }));
            
            alert('Error sending result. Data saved locally for recovery.');
        }
    }
    
    // Send analytics events
    sendEvent(eventName, eventData = {}) {
        const event = {
            type: 'GAME_EVENT',
            event: eventName,
            gameId: this.config.gameId,
            sessionId: this.config.sessionId,
            timestamp: Date.now(),
            data: eventData
        };
        
        // Send to parent window
        if (window.parent !== window) {
            window.parent.postMessage(event, '*');
        }
        
        // Log for debugging
        console.log('📊 Event:', eventName, eventData);
    }
    
    // Generate human-readable output string
    generateOutputString(success) {
        const emoji = success ? '🎉' : '😔';
        const status = success ? 'Completed' : 'Failed';
        const difficultyNames = ['Easy', 'Medium', 'Hard', 'Expert'];
        
        let output = `${emoji} ${this.config.gameName} - ${status}\n`;
        output += `📊 Difficulty: ${difficultyNames[this.config.difficulty - 1]}\n`;
        output += `⭐ Score: ${this.state.score}\n`;
        output += `🎯 Moves: ${this.state.moves}\n`;
        
        if (this.state.mistakes > 0) {
            output += `❌ Mistakes: ${this.state.mistakes}\n`;
        }
        
        if (this.state.timeElapsed) {
            output += `⏱️ Time: ${this.formatTime(this.state.timeElapsed)}\n`;
        }
        
        if (this.state.hintsUsed > 0) {
            output += `💡 Hints used: ${this.state.hintsUsed}\n`;
        }
        
        return output;
    }
    
    // Rating system
    getRating(performance) {
        if (performance >= 95) return 'S';
        if (performance >= 85) return 'A';
        if (performance >= 75) return 'B';
        if (performance >= 60) return 'C';
        if (performance >= 40) return 'D';
        return 'F';
    }
    
    // Utility methods (to be overridden by specific games)
    getOptimalScore() { return null; }
    isOptimalSolution() { return false; }
    checkAchievements() { return []; }
    getGameSpecificData() { return {}; }
    
    // Helpers
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    }
    
    handleExit() {
        if (this.state.status === 'playing') {
            if (confirm('Exit game? Progress will be lost.')) {
                this.end(false);
            }
        } else {
            this.tg.close();
        }
    }
    
    handleThemeChange() {
        // Update game theme based on Telegram theme
        const theme = this.tg.themeParams;
        document.documentElement.style.setProperty('--tg-bg', theme.bg_color);
        document.documentElement.style.setProperty('--tg-text', theme.text_color);
        console.log('🎨 Theme changed');
    }
}

// ============================================
// 🔧 DEVELOPMENT HELPERS
// ============================================

// Make inspector available immediately (not waiting for localhost check)
window.inspectLastResult = function() {
    const result = localStorage.getItem('game_result_latest');
    if (result) {
        try {
            const parsed = JSON.parse(result);
            console.log('%c📋 Last Game Result:', 'background: #4CAF50; color: white; padding: 8px; font-size: 14px; font-weight: bold;');
            console.table(parsed);
            console.log('Full object:', parsed);
            console.log('%c💡 Tip: Returned object is available as result', 'background: #2196F3; color: white; padding: 4px;');
            return parsed;
        } catch (e) {
            console.error('Error parsing result:', e);
            console.log('Raw data:', result);
            return result;
        }
    } else {
        console.log('ℹ️ No result found in localStorage');
        console.log('Available keys:', Object.keys(localStorage).filter(k => k.includes('game')));
        return null;
    }
};

// Additional helper: check what was sent via sendData
window.inspectTelegramData = function() {
    const data = localStorage.getItem('last_telegram_sendData');
    const time = localStorage.getItem('last_telegram_sendData_time');
    
    if (data) {
        try {
            const parsed = JSON.parse(data);
            console.log('%c📤 Last Telegram sendData:', 'background: #2481cc; color: white; padding: 8px; font-size: 14px; font-weight: bold;');
            console.log('Sent at:', time);
            console.table(parsed);
            console.log('Full object:', parsed);
            return parsed;
        } catch (e) {
            console.error('Error parsing data:', e);
            return data;
        }
    } else {
        console.log('ℹ️ No Telegram data sent yet');
        return null;
    }
};

// Helper: clear all game data
window.clearGameData = function() {
    const keys = Object.keys(localStorage).filter(k => 
        k.includes('game_result') || 
        k.includes('telegram_sendData') ||
        k.includes('mock_telegram')
    );
    
    console.log(`🗑️ Clearing ${keys.length} game-related items...`);
    keys.forEach(key => {
        console.log(`  - ${key}`);
        localStorage.removeItem(key);
    });
    console.log('✅ Cleared!');
};

// Show available commands
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('%c💡 Development Mode Active', 'background: #FF9800; color: white; padding: 8px; font-size: 14px; font-weight: bold;');
    console.log('%cAvailable Commands:', 'font-weight: bold; font-size: 12px;');
    console.log('  📋 inspectLastResult()     - View last game result');
    console.log('  📤 inspectTelegramData()   - View data sent to Telegram');
    console.log('  🗑️ clearGameData()         - Clear all game data from localStorage');
    console.log('  🎮 game                    - Access current game instance');
}

// Make available globally
window.TelegramMiniGame = TelegramMiniGame;

console.log('✅ TelegramMiniGame framework loaded');

// Make available globally
window.TelegramMiniGame = TelegramMiniGame;

console.log('✅ TelegramMiniGame framework loaded');
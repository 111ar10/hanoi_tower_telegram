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
        
        // Get user from Telegram
        if (this.tg.initDataUnsafe.user) {
            this.config.userId = this.tg.initDataUnsafe.user.id;
        }
        
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
    
    // Start game
    start() {
        this.state.status = 'playing';
        this.state.startTime = Date.now();
        this.sendEvent('game_started', {
            difficulty: this.config.difficulty,
            timeLimit: this.config.timeLimit
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
            modifiers: {
                timeModifier: this.config.timeModifier,
                scoreModifier: this.config.scoreModifier,
                hintsEnabled: this.config.hintsEnabled
            },
            
            // Additional context
            optimal: this.isOptimalSolution(),
            achievements: this.checkAchievements(),
            
            // Game-specific data
            gameData: this.getGameSpecificData(),
            
            // Output string for bot display
            outputString: this.generateOutputString(success)
        };
    }
    
    // Send result back to Telegram bot
    sendResult(result) {
        console.log('📤 Sending result:', result);
        
        // Method 1: Using Telegram WebApp API
        if (this.tg.initDataUnsafe.query_id) {
            fetch('/api/game-result', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query_id: this.tg.initDataUnsafe.query_id,
                    result: result
                })
            }).then(() => {
                this.tg.close();
            }).catch(err => {
                console.error('Failed to send result:', err);
            });
        }
        
        // Method 2: Using postMessage (if embedded in iframe)
        if (window.parent !== window) {
            window.parent.postMessage({
                type: 'GAME_RESULT',
                payload: result
            }, '*');
        }
        
        // Method 3: Store in localStorage (for offline/testing)
        localStorage.setItem(`game_result_${this.config.sessionId}`, JSON.stringify(result));
        
        // Send to Telegram
        try {
            this.tg.sendData(JSON.stringify(result));
        } catch (e) {
            console.log('Could not send data to Telegram:', e);
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

// Make available globally
window.TelegramMiniGame = TelegramMiniGame;

console.log('✅ TelegramMiniGame framework loaded');
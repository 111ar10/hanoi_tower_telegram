// telegram-web-app-mock.js - Mock Telegram WebApp for local testing

(function() {
    'use strict';

    // Check if already loaded (real Telegram environment)
    if (window.Telegram && window.Telegram.WebApp) {
        console.log('✅ Real Telegram WebApp detected');
        return;
    }

    console.log('🔧 Loading Mock Telegram WebApp for testing');

    // Mock user data - you can customize this
    const mockUsers = {
        user1: {
            id: 123456789,
            first_name: 'John',
            last_name: 'Doe',
            username: 'johndoe',
            language_code: 'en',
            is_premium: false
        },
        user2: {
            id: 987654321,
            first_name: 'Jane',
            last_name: 'Smith',
            username: 'janesmith',
            language_code: 'en',
            is_premium: true
        }
    };

    // Get current mock user from localStorage or default
    let currentUser = localStorage.getItem('mock_telegram_user') || 'user1';
    
    // Mock Telegram WebApp
    const TelegramWebAppMock = {
        version: '6.0',
        platform: 'web',
        colorScheme: 'light',
        
        themeParams: {
            bg_color: '#ffffff',
            text_color: '#000000',
            hint_color: '#999999',
            link_color: '#2481cc',
            button_color: '#2481cc',
            button_text_color: '#ffffff',
            secondary_bg_color: '#f4f4f5'
        },

        isExpanded: false,
        viewportHeight: window.innerHeight,
        viewportStableHeight: window.innerHeight,

        headerColor: '#ffffff',
        backgroundColor: '#ffffff',

        BackButton: {
            isVisible: false,
            onClick: function(callback) {
                this._callback = callback;
                this.show();
            },
            offClick: function(callback) {
                this._callback = null;
            },
            show: function() {
                this.isVisible = true;
                this._render();
            },
            hide: function() {
                this.isVisible = false;
                this._removeButton();
            },
            _callback: null,
            _button: null,
            _render: function() {
                if (!this._button) {
                    this._button = document.createElement('button');
                    this._button.innerHTML = '← Back';
                    this._button.style.cssText = `
                        position: fixed;
                        top: 10px;
                        left: 10px;
                        z-index: 10000;
                        padding: 10px 20px;
                        background: #2481cc;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-size: 14px;
                        cursor: pointer;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    `;
                    this._button.onclick = () => {
                        if (this._callback) this._callback();
                    };
                    document.body.appendChild(this._button);
                }
            },
            _removeButton: function() {
                if (this._button) {
                    this._button.remove();
                    this._button = null;
                }
            }
        },

        MainButton: {
            text: 'CONTINUE',
            color: '#2481cc',
            textColor: '#ffffff',
            isVisible: false,
            isActive: true,
            isProgressVisible: false,
            
            setText: function(text) {
                this.text = text;
                this._render();
            },
            onClick: function(callback) {
                this._callback = callback;
            },
            offClick: function(callback) {
                this._callback = null;
            },
            show: function() {
                this.isVisible = true;
                this._render();
            },
            hide: function() {
                this.isVisible = false;
                this._removeButton();
            },
            enable: function() {
                this.isActive = true;
                this._render();
            },
            disable: function() {
                this.isActive = false;
                this._render();
            },
            showProgress: function(leaveActive) {
                this.isProgressVisible = true;
                this._render();
            },
            hideProgress: function() {
                this.isProgressVisible = false;
                this._render();
            },
            setParams: function(params) {
                Object.assign(this, params);
                this._render();
            },
            _callback: null,
            _button: null,
            _render: function() {
                if (!this.isVisible) {
                    this._removeButton();
                    return;
                }
                
                if (!this._button) {
                    this._button = document.createElement('button');
                    this._button.style.cssText = `
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        z-index: 10000;
                        padding: 16px;
                        border: none;
                        font-size: 16px;
                        font-weight: bold;
                        cursor: pointer;
                        transition: opacity 0.3s;
                    `;
                    this._button.onclick = () => {
                        if (this.isActive && this._callback) this._callback();
                    };
                    document.body.appendChild(this._button);
                }
                
                this._button.textContent = this.isProgressVisible ? 'Loading...' : this.text;
                this._button.style.background = this.color;
                this._button.style.color = this.textColor;
                this._button.style.opacity = this.isActive ? '1' : '0.5';
                this._button.style.cursor = this.isActive ? 'pointer' : 'not-allowed';
            },
            _removeButton: function() {
                if (this._button) {
                    this._button.remove();
                    this._button = null;
                }
            }
        },

        HapticFeedback: {
            impactOccurred: function(style) {
                console.log(`🔔 Haptic: impact ${style}`);
                // Could add actual vibration for testing
                if (navigator.vibrate) {
                    const patterns = {
                        light: 10,
                        medium: 20,
                        heavy: 30,
                        rigid: 25,
                        soft: 15
                    };
                    navigator.vibrate(patterns[style] || 20);
                }
            },
            notificationOccurred: function(type) {
                console.log(`🔔 Haptic: notification ${type}`);
                if (navigator.vibrate) {
                    const patterns = {
                        error: [10, 50, 10],
                        success: [10, 30, 10, 30, 10],
                        warning: [10, 40, 10]
                    };
                    navigator.vibrate(patterns[type] || 20);
                }
            },
            selectionChanged: function() {
                console.log('🔔 Haptic: selection changed');
                if (navigator.vibrate) {
                    navigator.vibrate(5);
                }
            }
        },

        initData: '',
        initDataUnsafe: {
            query_id: 'mock_query_' + Date.now(),
            user: mockUsers[currentUser],
            auth_date: Math.floor(Date.now() / 1000),
            hash: 'mock_hash_' + Math.random().toString(36).substring(7)
        },

        sendData: function(data) {
            console.log('📤 sendData called:', data);
            alert('Data sent to bot:\n\n' + (typeof data === 'string' ? data : JSON.stringify(data, null, 2)));
        },

        ready: function() {
            console.log('✅ WebApp ready');
            this._isReady = true;
        },

        expand: function() {
            console.log('📱 WebApp expanded');
            this.isExpanded = true;
            document.body.style.minHeight = '100vh';
        },

        close: function() {
            console.log('❌ WebApp close requested');
            if (confirm('Close WebApp?')) {
                window.close();
            }
        },

        onEvent: function(eventType, callback) {
            console.log(`👂 Event listener added: ${eventType}`);
            if (!this._events) this._events = {};
            if (!this._events[eventType]) this._events[eventType] = [];
            this._events[eventType].push(callback);
        },

        offEvent: function(eventType, callback) {
            if (this._events && this._events[eventType]) {
                this._events[eventType] = this._events[eventType].filter(cb => cb !== callback);
            }
        },

        _triggerEvent: function(eventType, data) {
            if (this._events && this._events[eventType]) {
                this._events[eventType].forEach(callback => callback(data));
            }
        },

        // Testing helpers
        _setUser: function(userId) {
            if (mockUsers[userId]) {
                currentUser = userId;
                this.initDataUnsafe.user = mockUsers[userId];
                localStorage.setItem('mock_telegram_user', userId);
                console.log('👤 User switched to:', mockUsers[userId]);
            }
        },

        _setTheme: function(theme) {
            if (theme === 'dark') {
                this.colorScheme = 'dark';
                this.themeParams = {
                    bg_color: '#212121',
                    text_color: '#ffffff',
                    hint_color: '#aaaaaa',
                    link_color: '#8774e1',
                    button_color: '#8774e1',
                    button_text_color: '#ffffff',
                    secondary_bg_color: '#181818'
                };
            } else {
                this.colorScheme = 'light';
                this.themeParams = {
                    bg_color: '#ffffff',
                    text_color: '#000000',
                    hint_color: '#999999',
                    link_color: '#2481cc',
                    button_color: '#2481cc',
                    button_text_color: '#ffffff',
                    secondary_bg_color: '#f4f4f5'
                };
            }
            this._triggerEvent('themeChanged');
            console.log('🎨 Theme changed to:', theme);
        }
    };

    // Create Telegram namespace
    window.Telegram = {
        WebApp: TelegramWebAppMock
    };

    console.log('✅ Mock Telegram WebApp loaded');
    console.log('📝 Available testing commands:');
    console.log('  Telegram.WebApp._setUser("user1" or "user2")');
    console.log('  Telegram.WebApp._setTheme("light" or "dark")');
})();
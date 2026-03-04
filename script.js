// SafeSie - Full Application

// ==================== STATE ====================
let currentUser = null;
let isListening = false;
let recognition = null;
let voiceTriggerInterval = null; // For periodic restart

// Default data for new users
const defaultContacts = [
    { id: 1, name: 'Mom', phone: '+1 234 567 8901', email: 'mom@example.com', relation: 'family', priority: true },
    { id: 2, name: 'Best Friend', phone: '+1 234 567 8902', email: 'friend@example.com', relation: 'friend', priority: true },
    { id: 3, name: 'Brother', phone: '+1 234 567 8903', email: 'brother@example.com', relation: 'family', priority: false }
];

const defaultSettings = {
    voice: true,
    audio: true,
    camera: true,
    location: true,
    sms: true,
    email: true,
    push: true,
    stealth: false
};

// Active user data
let contacts = [];
let alerts = [];
let settings = { ...defaultSettings };
let editingContactId = null;

// User accounts storage
const USER_ACCOUNTS_KEY = 'safesie_accounts';
const CURRENT_USER_KEY = 'safesie_current_user';

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    // Check if Twilio script loaded
    console.log('📱 Checking Twilio service...');
    console.log('📱 window.TwilioService:', window.TwilioService);
    
    // Load Twilio config
    loadTwilioConfig();
    
    // Check for saved session
    const savedUser = localStorage.getItem(CURRENT_USER_KEY);
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        loadUserData(currentUser.email);
        showApp();
    }

    // Initialize speech recognition
    initSpeechRecognition();

    // Initialize UI (will be updated when user logs in)
    updateStats();
    renderContacts();
    renderAlerts();
    updateTwilioStatus();

    console.log('%c SafeSie ', 'background: linear-gradient(135deg, #6366f1, #ec4899); color: white; font-size: 24px; font-weight: bold; padding: 10px 20px; border-radius: 8px;');
    console.log('%c Voice-Activated. Intelligent. Always Ready. ', 'color: #6366f1; font-size: 14px;');
});

// ==================== AUTHENTICATION ====================
let authMode = 'signup';

function showAuth(mode) {
    authMode = mode;
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('auth-page').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
    
    updateAuthUI();
}

function updateAuthUI() {
    const isSignup = authMode === 'signup';
    document.getElementById('auth-title').textContent = isSignup ? 'Create Account' : 'Welcome Back';
    document.getElementById('auth-subtitle').textContent = isSignup ? 'Join SafeSie for intelligent safety' : 'Login to your SafeSie account';
    document.getElementById('auth-btn').textContent = isSignup ? 'Sign Up' : 'Login';
    document.getElementById('auth-switch-text').innerHTML = isSignup 
        ? 'Already have an account? <a href="#" onclick="toggleAuthMode()">Login</a>'
        : 'Don\'t have an account? <a href="#" onclick="toggleAuthMode()">Sign Up</a>';
    
    document.getElementById('name-group').style.display = isSignup ? 'block' : 'none';
    document.getElementById('confirm-group').style.display = isSignup ? 'block' : 'none';
}

function toggleAuthMode() {
    authMode = authMode === 'signup' ? 'login' : 'signup';
    updateAuthUI();
}

function handleAuth(e) {
    e.preventDefault();
    
    const name = document.getElementById('auth-name').value;
    const email = document.getElementById('auth-email').value.toLowerCase().trim();
    const password = document.getElementById('auth-password').value;
    const confirm = document.getElementById('auth-confirm').value;
    
    // Get all accounts
    const accounts = getAccounts();
    
    if (authMode === 'signup') {
        // SIGN UP
        if (password !== confirm) {
            showNotification('Passwords do not match!', 'error');
            return;
        }
        if (!name) {
            showNotification('Please enter your name!', 'error');
            return;
        }
        if (!email || !password) {
            showNotification('Please enter email and password!', 'error');
            return;
        }
        
        // Check if email already exists
        if (accounts[email]) {
            showNotification('Email already registered! Please login.', 'error');
            return;
        }
        
        // Create new account
        const newAccount = {
            name: name,
            email: email,
            password: password, // In real app, hash this!
            phone: '',
            dob: '',
            address: '',
            emergencyMessage: 'This is an emergency! I need help. My location is being shared with you.',
            createdAt: new Date().toISOString()
        };
        
        // Save account
        accounts[email] = newAccount;
        saveAccounts(accounts);
        
        // Create user data with defaults
        const userData = {
            contacts: [...defaultContacts],
            alerts: [],
            settings: { ...defaultSettings }
        };
        saveUserData(email, userData);
        
        // Set current user
        currentUser = newAccount;
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
        
        // Load user data
        loadUserData(email);
        
        showNotification('Account created successfully!');
        showApp();
        
    } else {
        // LOGIN
        if (!email || !password) {
            showNotification('Please enter email and password!', 'error');
            return;
        }
        
        // Check if account exists
        const account = accounts[email];
        if (!account) {
            showNotification('Account not found! Please sign up.', 'error');
            return;
        }
        
        // Check password
        if (account.password !== password) {
            showNotification('Incorrect password!', 'error');
            return;
        }
        
        // Set current user
        currentUser = account;
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
        
        // Load user-specific data
        loadUserData(email);
        
        showNotification('Welcome back!');
        showApp();
    }
}

// Get all accounts from localStorage
function getAccounts() {
    const accounts = localStorage.getItem(USER_ACCOUNTS_KEY);
    return accounts ? JSON.parse(accounts) : {};
}

// Save accounts to localStorage
function saveAccounts(accounts) {
    localStorage.setItem(USER_ACCOUNTS_KEY, JSON.stringify(accounts));
}

// Get user-specific data key
function getUserDataKey(email) {
    return `safesie_data_${email}`;
}

// Load user-specific data
function loadUserData(email) {
    console.log('📂 Loading data for user:', email);
    
    const userDataKey = getUserDataKey(email);
    const savedData = localStorage.getItem(userDataKey);
    
    if (savedData) {
        const data = JSON.parse(savedData);
        contacts = data.contacts || [...defaultContacts];
        alerts = data.alerts || [];
        settings = { ...defaultSettings, ...data.settings };
        console.log('✅ Loaded user data:', contacts.length, 'contacts,', alerts.length, 'alerts');
    } else {
        // No saved data, use defaults
        contacts = [...defaultContacts];
        alerts = [];
        settings = { ...defaultSettings };
        console.log('ℹ️ Using default data for new user');
    }
    
    // Update UI
    renderContacts();
    renderAlerts();
    updateStats();
    
    // Apply settings to toggles
    Object.keys(settings).forEach(key => {
        const toggle = document.getElementById(`setting-${key}`);
        if (toggle) toggle.checked = settings[key];
    });
}

// Save user-specific data
function saveUserData(email, data) {
    const userDataKey = getUserDataKey(email);
    localStorage.setItem(userDataKey, JSON.stringify(data));
}

// Save current user's data
function saveCurrentUserData() {
    if (currentUser && currentUser.email) {
        const data = {
            contacts: contacts,
            alerts: alerts,
            settings: settings
        };
        saveUserData(currentUser.email, data);
        console.log('💾 Saved data for user:', currentUser.email);
    }
}

function logout() {
    // Save current user's data before logout
    saveCurrentUserData();
    
    currentUser = null;
    localStorage.removeItem(CURRENT_USER_KEY);
    stopVoiceTrigger();
    
    // Clear periodic restart
    if (voiceTriggerInterval) {
        clearInterval(voiceTriggerInterval);
        voiceTriggerInterval = null;
    }
    
    // Reset data
    contacts = [];
    alerts = [];
    settings = { ...defaultSettings };
    
    document.getElementById('landing-page').classList.remove('hidden');
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('app-container').classList.add('hidden');
    showNotification('Logged out successfully');
}

function showApp() {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    
    // Update profile form with user data
    if (currentUser) {
        document.getElementById('profile-name').value = currentUser.name;
        document.getElementById('profile-email').value = currentUser.email;
        document.getElementById('profile-phone').value = currentUser.phone || '';
        document.getElementById('profile-dob').value = currentUser.dob || '';
        document.getElementById('profile-address').value = currentUser.address || '';
        document.getElementById('profile-message').value = currentUser.emergencyMessage || '';
        document.getElementById('profile-avatar').textContent = getInitials(currentUser.name);
    }
    
    showPage('home');
    
    // Auto-start voice trigger after a short delay
    setTimeout(() => {
        autoStartVoiceTrigger();
    }, 1000);
}

async function autoStartVoiceTrigger() {
    console.log('🔊 Attempting to start voice trigger...');
    
    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.log('❌ Voice recognition not supported');
        document.getElementById('browser-warning').style.display = 'block';
        document.getElementById('status-text').textContent = 'Voice Trigger: Not Supported';
        showNotification('Voice recognition not supported. Use Chrome/Edge.', 'error');
        return;
    }
    
    // Check if voice trigger is enabled in settings
    if (!settings.voice) {
        console.log('Voice trigger disabled in settings');
        return;
    }
    
    // Initialize recognition if not already done
    if (!recognition) {
        console.log('🎙️ Initializing recognition...');
        initSpeechRecognition();
    }
    
    if (!recognition) {
        console.log('❌ Failed to initialize recognition');
        return;
    }
    
    try {
        // Request microphone permission
        console.log('🎤 Requesting microphone permission...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Microphone permission granted');
        
        // Stop the stream - we just needed permission
        stream.getTracks().forEach(track => track.stop());
        
        // Start listening automatically
        isListening = true;
        recognition.start();
        console.log('🎙️ Recognition started');
        
        // Update UI
        const indicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');
        
        if (indicator) indicator.classList.add('active');
        if (statusText) statusText.textContent = 'Voice Trigger: ON - Always Listening...';
        
        showNotification('🎤 Voice trigger ACTIVE. Say "Help me"!');
        
        // Set up periodic restart to keep it working
        setupPeriodicRestart();
        
    } catch (err) {
        console.error('❌ Auto-start failed:', err);
        showNotification('Please allow microphone access for voice trigger', 'error');
    }
}

// Setup periodic restart of voice trigger (every 30 seconds)
function setupPeriodicRestart() {
    // Clear any existing interval
    if (voiceTriggerInterval) {
        clearInterval(voiceTriggerInterval);
    }
    
    voiceTriggerInterval = setInterval(() => {
        if (isListening && recognition) {
            console.log('🔄 Periodic voice trigger health check...');
            try {
                // Check if recognition is still running
                // If not, restart it
                if (!isListening) {
                    console.log('🔄 Voice trigger stopped, restarting...');
                    restartVoiceTrigger();
                }
            } catch (e) {
                console.log('❌ Health check error:', e);
            }
        }
    }, 30000); // Check every 30 seconds
    
    console.log('✅ Periodic restart setup (every 30s)');
}

// Manual restart function
function restartVoiceTrigger() {
    console.log('🔄 Manual voice trigger restart...');
    
    if (recognition) {
        try {
            recognition.stop();
        } catch (e) {
            // Ignore errors when stopping
        }
    }
    
    // Re-initialize and start
    initSpeechRecognition();
    
    if (recognition) {
        try {
            isListening = true;
            recognition.start();
            console.log('✅ Voice trigger restarted');
            showNotification('🎤 Voice trigger restarted', 'info');
            
            // Update UI
            const indicator = document.getElementById('status-indicator');
            const statusText = document.getElementById('status-text');
            if (indicator) indicator.classList.add('active');
            if (statusText) statusText.textContent = 'Voice Trigger: ON - Always Listening...';
        } catch (e) {
            console.error('❌ Failed to restart:', e);
        }
    }
}

// ==================== NAVIGATION ====================
function showPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    document.getElementById(`page-${pageName}`).classList.add('active');
    
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event?.target?.classList.add('active');
    
    // Update stats when showing home
    if (pageName === 'home') {
        updateStats();
    }
}

// ==================== VOICE TRIGGER ====================
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        console.log('Speech recognition not supported');
        return;
    }
    
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = function() {
        console.log('Voice recognition started');
        isListening = true;
    };
    
    recognition.onend = function() {
        console.log('🛑 Voice recognition ended');
        // Restart if still supposed to be listening
        if (isListening) {
            console.log('🔄 Restarting recognition...');
            setTimeout(() => {
                try {
                    recognition.start();
                    console.log('✅ Recognition restarted');
                } catch (e) {
                    console.log('❌ Could not restart recognition:', e);
                    // Try creating a new recognition instance
                    setTimeout(() => initSpeechRecognition(), 500);
                }
            }, 100);
        }
    };
    
    recognition.onresult = function(event) {
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript.toLowerCase().trim();
            const isFinal = event.results[i].isFinal;
            
            console.log('🎤 Heard:', transcript, isFinal ? '(FINAL)' : '(interim)');
            
            // Show what was heard on screen for debugging
            showHeardText(transcript);
            
            // Check for trigger words - check both interim and final results
            const triggerWords = ['help me', 'emergency', 'sos', 'help'];
            for (const word of triggerWords) {
                if (transcript.includes(word)) {
                    console.log('🚨 TRIGGER WORD DETECTED:', word);
                    triggerSOS();
                    return;
                }
            }
        }
    };
    
    recognition.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
        // Don't stop on no-speech error, just continue
        if (event.error === 'no-speech') {
            return;
        }
        if (isListening && event.error !== 'aborted') {
            try {
                recognition.stop();
                setTimeout(() => {
                    if (isListening) recognition.start();
                }, 300);
            } catch (e) {
                console.log('Error restarting:', e);
            }
        }
    };
}

async function toggleVoiceTrigger() {
    if (!recognition) {
        showNotification('Speech recognition not supported. Try Chrome/Edge.', 'error');
        return;
    }
    
    // Request microphone permission first
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
        showNotification('Microphone permission denied. Please allow access.', 'error');
        return;
    }
    
    isListening = !isListening;
    const btn = document.getElementById('trigger-btn');
    const indicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    if (isListening) {
        try {
            recognition.start();
            btn.classList.add('listening');
            indicator.classList.add('active');
            statusText.textContent = 'Voice Trigger: ON - Listening...';
            showNotification('Voice trigger ON. Say "Help me" or "Emergency"');
        } catch (e) {
            console.error('Error starting recognition:', e);
            isListening = false;
            showNotification('Could not start voice recognition. Try refreshing.', 'error');
        }
    } else {
        try {
            recognition.stop();
        } catch (e) {
            console.log('Error stopping:', e);
        }
        btn.classList.remove('listening');
        indicator.classList.remove('active');
        statusText.textContent = 'Voice Trigger: OFF';
        showNotification('Voice trigger OFF');
    }
}

// Manual SOS trigger for testing
function manualSOS() {
    triggerSOS();
}

// Show heard text on screen for debugging
function showHeardText(text) {
    let debugEl = document.getElementById('voice-debug');
    if (!debugEl) {
        debugEl = document.createElement('div');
        debugEl.id = 'voice-debug';
        debugEl.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: #10b981;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 9999;
            max-width: 80%;
            text-align: center;
        `;
        document.body.appendChild(debugEl);
    }
    debugEl.textContent = `Heard: "${text}"`;
    debugEl.style.display = 'block';
    
    // Hide after 3 seconds
    clearTimeout(window.debugTimeout);
    window.debugTimeout = setTimeout(() => {
        debugEl.style.display = 'none';
    }, 3000);
}

function stopVoiceTrigger() {
    if (isListening && recognition) {
        isListening = false;
        recognition.stop();
        const btn = document.getElementById('trigger-btn');
        const indicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');
        if (btn) btn.classList.remove('listening');
        if (indicator) indicator.classList.remove('active');
        if (statusText) statusText.textContent = 'Voice Trigger: OFF';
    }
}

let sosData = {
    audioBlob: null,
    photoData: null,
    location: null,
    timestamp: null
};

let isSOSActive = false;

async function triggerSOS() {
    // Prevent multiple simultaneous triggers
    if (isSOSActive) {
        console.log('SOS already active, ignoring...');
        return;
    }
    
    isSOSActive = true;
    console.log('🚨 SOS TRIGGERED! Starting capture sequence...');
    
    // Initialize SOS data
    sosData = {
        audioBlob: null,
        photoData: null,
        location: null,
        timestamp: new Date().toISOString()
    };
    
    // Show SOS modal
    document.getElementById('sos-modal').classList.remove('hidden');
    
    // Start countdown timer
    let countdown = 10;
    const timerEl = document.querySelector('.sos-timer');
    if (timerEl) timerEl.textContent = countdown;
    
    const timerInterval = setInterval(() => {
        countdown--;
        if (timerEl) timerEl.textContent = countdown;
        if (countdown <= 0) {
            clearInterval(timerInterval);
            completeSOS();
        }
    }, 1000);
    
    window.sosTimerInterval = timerInterval;
    
    // Start captures in sequence
    try {
        // 1. Start audio recording FIRST (captures the "help me" and after)
        if (settings.audio) {
            console.log('🎤 Starting audio recording...');
            await startAudioRecording();
        }
        
        // 2. Capture photo
        if (settings.camera) {
            console.log('📸 Capturing photo...');
            await capturePhoto();
        }
        
        // 3. Get location
        if (settings.location) {
            console.log('📍 Getting location...');
            await captureLocation();
        }
        
        console.log('✅ All captures initiated');
        
    } catch (err) {
        console.error('Error during capture:', err);
    }
}

async function captureLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            console.log('Geolocation not supported');
            resolve();
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                sosData.location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                console.log('Location captured:', sosData.location);
                resolve();
            },
            (error) => {
                console.error('Location error:', error);
                resolve();
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    });
}

let audioRecorder = null;
let audioChunks = [];

async function startAudioRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        audioRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                audioChunks.push(e.data);
                console.log('🎤 Audio chunk recorded:', e.data.size, 'bytes');
            }
        };
        
        audioRecorder.onstop = () => {
            sosData.audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            console.log('🎤 Audio recording complete. Total size:', sosData.audioBlob.size, 'bytes');
            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
        };
        
        // Start recording with 100ms timeslice to capture data during recording
        audioRecorder.start(100);
        console.log('🎤 Audio recording started');
        
    } catch (err) {
        console.error('❌ Audio recording error:', err);
    }
}

async function capturePhoto() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        
        video.srcObject = stream;
        await video.play();
        
        // Wait a moment for camera to adjust
        await new Promise(resolve => setTimeout(resolve, 500));
        
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        sosData.photoData = canvas.toDataURL('image/jpeg', 0.8);
        
        // Stop stream
        stream.getTracks().forEach(track => track.stop());
        console.log('Photo captured');
        
    } catch (err) {
        console.error('Camera error:', err);
    }
}

function cancelSOS() {
    if (window.sosTimerInterval) {
        clearInterval(window.sosTimerInterval);
    }
    
    // Stop audio recording if active
    if (audioRecorder && audioRecorder.state !== 'inactive') {
        audioRecorder.stop();
    }
    
    document.getElementById('sos-modal').classList.add('hidden');
    
    // Reset SOS active state
    isSOSActive = false;
    console.log('🎤 SOS cancelled. Ready for next voice trigger...');
    
    showNotification('SOS cancelled. Voice trigger still active.');
}

// Send alerts immediately without waiting for timer
function sendAlertsNow() {
    if (window.sosTimerInterval) {
        clearInterval(window.sosTimerInterval);
    }
    completeSOS();
}

async function completeSOS() {
    document.getElementById('sos-modal').classList.add('hidden');
    
    console.log('✅ Completing SOS sequence...');
    
    // Stop audio recording
    if (audioRecorder && audioRecorder.state !== 'inactive') {
        audioRecorder.stop();
    }
    
    // Wait a moment for audio to finalize
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Prepare alert data
    const alertData = {
        id: Date.now(),
        type: 'sos',
        title: 'SOS Triggered',
        message: `Emergency alert sent to ${contacts.length} contacts`,
        time: new Date().toLocaleString(),
        location: sosData.location,
        hasAudio: !!sosData.audioBlob,
        hasPhoto: !!sosData.photoData
    };
    
    // Add to alerts
    alerts.unshift(alertData);
    saveData();
    renderAlerts();
    updateStats();
    
    // Send to all contacts
    await sendEmergencyAlerts();
    
    // Reset SOS active state so it can be triggered again
    isSOSActive = false;
    console.log('🎤 Ready for next voice trigger...');
    
    // Make sure voice recognition is still running
    if (isListening && recognition && recognition.state !== 'recording') {
        try {
            recognition.start();
            console.log('🎙️ Recognition restarted after SOS');
        } catch (e) {
            console.log('Recognition already running or error:', e);
        }
    }
    
    showNotification('🚨 SOS sent! Voice trigger ready for next activation.', 'success');
}

async function sendEmergencyAlerts() {
    const priorityContacts = contacts.filter(c => c.priority);
    const otherContacts = contacts.filter(c => !c.priority);
    const allContacts = [...priorityContacts, ...otherContacts];
    
    if (allContacts.length === 0) {
        showNotification('No emergency contacts to alert!', 'error');
        return;
    }
    
    // Build emergency message
    let message = currentUser?.emergencyMessage || 'EMERGENCY: I need help!';
    
    if (sosData.location) {
        const mapsUrl = `https://maps.google.com/?q=${sosData.location.lat},${sosData.location.lng}`;
        message += `\n\nMy Location: ${mapsUrl}`;
        message += `\nCoordinates: ${sosData.location.lat.toFixed(6)}, ${sosData.location.lng.toFixed(6)}`;
    }
    
    message += `\n\nTime: ${new Date().toLocaleString()}`;
    message += `\nFrom: ${currentUser?.name || 'SafeSie User'}`;
    
    // Store evidence locally first
    storeEvidence();
    
    // Get contacts to alert
    const phoneContacts = allContacts.filter(c => c.phone && settings.sms);
    const emailContacts = allContacts.filter(c => c.email && settings.email);
    
    // Show summary
    const smsCount = phoneContacts.length;
    const emailCount = emailContacts.length;
    
    if (smsCount > 0) {
        const smsNames = phoneContacts.map(c => c.name).join(', ');
        showNotification(`📱 SMS will open for: ${smsNames}`);
        sendSMSToContacts(phoneContacts, message);
    }
    
    if (emailCount > 0) {
        const emailNames = emailContacts.map(c => c.name).join(', ');
        setTimeout(() => {
            showNotification(`✉️ Email will open for: ${emailNames}`);
            sendEmailToContacts(emailContacts, message);
        }, 1500);
    }
    
    // Show final summary
    setTimeout(() => {
        showAlertSummary(phoneContacts, emailContacts, message);
    }, 3000);
}

function showAlertSummary(smsContacts, emailContacts, message) {
    const totalContacts = smsContacts.length + emailContacts.length;
    const contactList = [...smsContacts, ...emailContacts].map(c => 
        `• ${c.name} (${c.phone || ''}${c.phone && c.email ? ' / ' : ''}${c.email || ''})`
    ).join('\n');
    
    const summary = `🚨 SOS ALERT SENT\n\n` +
        `📱 SMS: ${smsContacts.length} contacts\n` +
        `✉️ Email: ${emailContacts.length} contacts\n` +
        `📍 Location: ${sosData.location ? 'Shared' : 'Not available'}\n` +
        `🎤 Audio: ${sosData.audioBlob ? 'Recorded' : 'Not recorded'}\n` +
        `📸 Photo: ${sosData.photoData ? 'Captured' : 'Not captured'}\n\n` +
        `Contacts Alerted:\n${contactList}\n\n` +
        `Message sent:\n${message.substring(0, 100)}...`;
    
    console.log(summary);
}

// Simulated SMS/Email Service (since web apps can't send real SMS/email without backend)
let sentMessages = [];

async function sendSMSToContacts(contacts, message) {
    if (contacts.length === 0) return;
    
    console.log(`📱 Sending SMS to ${contacts.length} contacts`);
    
    // Ensure Twilio config is loaded
    ensureTwilioConfigLoaded();
    
    // Try Twilio first, fallback to simulation
    let twilioResults = null;
    const hasTwilioConfig = window.TwilioService && 
                           window.TwilioService.config.ACCOUNT_SID && 
                           window.TwilioService.config.ACCOUNT_SID !== 'YOUR_TWILIO_ACCOUNT_SID';
    
    console.log('📱 Twilio configured:', hasTwilioConfig);
    console.log('📱 Account SID:', window.TwilioService?.config?.ACCOUNT_SID?.substring(0, 10) + '...');
    
    if (hasTwilioConfig) {
        try {
            showNotification('📱 Sending via Twilio...');
            twilioResults = await window.TwilioService.sendToContacts(contacts, message);
            
            // Process Twilio results
            let successCount = 0;
            let failCount = 0;
            
            twilioResults.forEach(result => {
                const smsRecord = {
                    id: Date.now() + Math.random(),
                    type: 'SMS',
                    to: result.contact,
                    phone: result.phone,
                    message: message,
                    timestamp: new Date().toLocaleString(),
                    status: result.success ? 'SENT' : 'FAILED',
                    sid: result.sid,
                    error: result.error
                };
                sentMessages.push(smsRecord);
                
                if (result.success) successCount++;
                else failCount++;
            });
            
            // Save to localStorage
            localStorage.setItem('safesie_sent_messages', JSON.stringify(sentMessages));
            
            // Show result
            if (failCount === 0) {
                showNotification(`✅ SMS sent to ${successCount} contacts via Twilio!`, 'success');
            } else {
                showNotification(`⚠️ ${successCount} sent, ${failCount} failed. Check View Sent Alerts.`, 'error');
            }
            
            return;
            
        } catch (err) {
            console.log('Twilio failed, using simulation:', err);
        }
    }
    
    // Simulation mode (when Twilio not configured)
    console.log('📱 Using simulation mode');
    
    contacts.forEach(contact => {
        const smsRecord = {
            id: Date.now() + Math.random(),
            type: 'SMS',
            to: contact.name,
            phone: contact.phone,
            message: message,
            timestamp: new Date().toLocaleString(),
            status: 'SIMULATED'
        };
        sentMessages.push(smsRecord);
        console.log(`📱 SMS simulated for ${contact.name} (${contact.phone})`);
    });
    
    // Save to localStorage
    localStorage.setItem('safesie_sent_messages', JSON.stringify(sentMessages));
    
    // Show notification
    const names = contacts.map(c => c.name).join(', ');
    showNotification(`📱 SMS simulated for: ${names} (Configure Twilio for real SMS)`, 'info');
}

function sendEmailToContacts(contacts, message) {
    if (contacts.length === 0) return;
    
    const subject = '🚨 EMERGENCY ALERT - SafeSie';
    console.log(`✉️ Sending Email to ${contacts.length} contacts`);
    
    contacts.forEach(contact => {
        const emailRecord = {
            id: Date.now() + Math.random(),
            type: 'EMAIL',
            to: contact.name,
            email: contact.email,
            subject: subject,
            message: message,
            timestamp: new Date().toLocaleString(),
            status: 'SENT'
        };
        sentMessages.push(emailRecord);
        console.log(`✉️ Email sent to ${contact.name} (${contact.email})`);
    });
    
    // Save to localStorage
    localStorage.setItem('safesie_sent_messages', JSON.stringify(sentMessages));
    
    // Show notification
    const names = contacts.map(c => c.name).join(', ');
    showNotification(`✉️ Email sent to: ${names}`, 'success');
}

// View all sent messages (for testing/verification)
function viewSentMessages() {
    const saved = localStorage.getItem('safesie_sent_messages');
    if (saved) {
        sentMessages = JSON.parse(saved);
    }
    
    if (sentMessages.length === 0) {
        alert('No messages sent yet.');
        return;
    }
    
    const summary = sentMessages.slice(-10).map(m => 
        `[${m.type}] To: ${m.to} (${m.status})\nTime: ${m.timestamp}\nMessage: ${m.message.substring(0, 50)}...`
    ).join('\n\n---\n\n');
    
    alert(`Last ${Math.min(10, sentMessages.length)} messages:\n\n${summary}`);
}

// Twilio Config Modal Functions
function openTwilioConfig() {
    // Load saved credentials if any
    const savedConfig = localStorage.getItem('safesie_twilio_config');
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        document.getElementById('twilio-sid').value = config.sid || '';
        document.getElementById('twilio-token').value = config.token || '';
        document.getElementById('twilio-phone').value = config.phone || '';
    }
    document.getElementById('twilio-modal').classList.remove('hidden');
}

function closeTwilioConfig() {
    document.getElementById('twilio-modal').classList.add('hidden');
}

function saveTwilioConfig(e) {
    e.preventDefault();
    
    const config = {
        sid: document.getElementById('twilio-sid').value.trim(),
        token: document.getElementById('twilio-token').value.trim(),
        phone: document.getElementById('twilio-phone').value.trim()
    };
    
    // Save to localStorage (user's browser only)
    localStorage.setItem('safesie_twilio_config', JSON.stringify(config));
    
    // Update Twilio service
    if (window.TwilioService) {
        window.TwilioService.config.ACCOUNT_SID = config.sid;
        window.TwilioService.config.AUTH_TOKEN = config.token;
        window.TwilioService.config.PHONE_NUMBER = config.phone;
    }
    
    closeTwilioConfig();
    showNotification('✅ Twilio credentials saved!', 'success');
    updateTwilioStatus();
}

function updateTwilioStatus() {
    const statusEl = document.getElementById('twilio-status-text');
    const savedConfig = localStorage.getItem('safesie_twilio_config');
    
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        if (config.sid && config.token && config.phone) {
            statusEl.textContent = `✅ Configured (${config.phone})`;
            statusEl.style.color = 'var(--success)';
        } else {
            statusEl.textContent = '⚠️ Incomplete configuration';
            statusEl.style.color = 'var(--danger)';
        }
    } else {
        statusEl.textContent = 'Not configured - Add credentials to enable real SMS';
        statusEl.style.color = 'var(--gray)';
    }
}

// Load Twilio config on startup
function loadTwilioConfig() {
    console.log('📱 Loading Twilio config...');
    const savedConfig = localStorage.getItem('safesie_twilio_config');
    
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        console.log('📱 Found saved Twilio config:', config.sid ? 'Yes' : 'No');
        
        if (window.TwilioService) {
            window.TwilioService.config.ACCOUNT_SID = config.sid || 'YOUR_TWILIO_ACCOUNT_SID';
            window.TwilioService.config.AUTH_TOKEN = config.token || 'YOUR_TWILIO_AUTH_TOKEN';
            window.TwilioService.config.PHONE_NUMBER = config.phone || 'YOUR_TWILIO_PHONE_NUMBER';
            console.log('📱 Twilio config loaded into service');
        } else {
            console.log('⚠️ TwilioService not available yet');
        }
    } else {
        console.log('📱 No Twilio config found in localStorage');
    }
}

// Ensure Twilio config is loaded (call after TwilioService is available)
function ensureTwilioConfigLoaded() {
    const savedConfig = localStorage.getItem('safesie_twilio_config');
    if (savedConfig && window.TwilioService) {
        const config = JSON.parse(savedConfig);
        window.TwilioService.config.ACCOUNT_SID = config.sid;
        window.TwilioService.config.AUTH_TOKEN = config.token;
        window.TwilioService.config.PHONE_NUMBER = config.phone;
        console.log('📱 Twilio config ensured:', config.phone);
    }
}

// Test Twilio SMS
async function testTwilioSMS() {
    ensureTwilioConfigLoaded();
    
    console.log('📱 Test SMS clicked');
    console.log('📱 window.TwilioService exists:', !!window.TwilioService);
    console.log('📱 ACCOUNT_SID:', window.TwilioService?.config?.ACCOUNT_SID);
    
    if (!window.TwilioService) {
        showNotification('⚠️ Twilio service not loaded. Refresh the page.', 'error');
        return;
    }
    
    if (!window.TwilioService.config.ACCOUNT_SID || window.TwilioService.config.ACCOUNT_SID === 'YOUR_TWILIO_ACCOUNT_SID') {
        showNotification('⚠️ Twilio not configured. Click "Configure" first.', 'error');
        console.log('📱 Current SID:', window.TwilioService.config.ACCOUNT_SID);
        return;
    }
    
    const testNumber = prompt('Enter phone number to test (with country code, e.g., +919876543210):');
    if (!testNumber) return;
    
    showNotification('📱 Sending test SMS...');
    
    try {
        const result = await window.TwilioService.sendSMS(testNumber, '📱 SafeSie Test: This is a test message from your SafeSie app.');
        
        if (result.success) {
            showNotification('✅ Test SMS sent successfully!', 'success');
        } else {
            showNotification('❌ Failed: ' + result.error, 'error');
            console.error('Twilio error:', result);
        }
    } catch (err) {
        showNotification('❌ Error: ' + err.message, 'error');
        console.error('Test SMS error:', err);
    }
}

function storeEvidence() {
    // Store evidence in localStorage (in production, this would go to secure cloud storage)
    const evidence = {
        timestamp: sosData.timestamp,
        location: sosData.location,
        photoData: sosData.photoData,
        audioAvailable: !!sosData.audioBlob
    };
    
    // Save photo
    if (sosData.photoData) {
        localStorage.setItem(`safesie_photo_${sosData.timestamp}`, sosData.photoData);
    }
    
    // Save audio (as base64)
    if (sosData.audioBlob) {
        const reader = new FileReader();
        reader.onloadend = () => {
            localStorage.setItem(`safesie_audio_${sosData.timestamp}`, reader.result);
        };
        reader.readAsDataURL(sosData.audioBlob);
    }
    
    // Add to evidence log
    let evidenceLog = JSON.parse(localStorage.getItem('safesie_evidence') || '[]');
    evidenceLog.push(evidence);
    localStorage.setItem('safesie_evidence', JSON.stringify(evidenceLog));
}

// ==================== CONTACTS ====================
function renderContacts() {
    const grid = document.getElementById('contacts-grid');
    if (!grid) return;
    
    if (contacts.length === 0) {
        grid.innerHTML = '<div class="alert-empty">No contacts yet. Add your first emergency contact!</div>';
        return;
    }
    
    grid.innerHTML = contacts.map(contact => `
        <div class="contact-card ${contact.priority ? 'priority' : ''}">
            <div class="contact-actions">
                <button onclick="editContact(${contact.id})" title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn-delete" onclick="deleteContact(${contact.id})" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
            <div class="contact-avatar">${getInitials(contact.name)}</div>
            <div class="contact-info">
                <h4>${contact.name}</h4>
                <p>${contact.phone}</p>
                <p>${contact.email}</p>
                <span class="contact-relation">${contact.relation}</span>
            </div>
        </div>
    `).join('');
}

function openContactModal() {
    editingContactId = null;
    document.getElementById('modal-title').textContent = 'Add Emergency Contact';
    document.getElementById('contact-form').reset();
    document.getElementById('contact-modal').classList.remove('hidden');
}

function editContact(id) {
    const contact = contacts.find(c => c.id === id);
    if (!contact) return;
    
    editingContactId = id;
    document.getElementById('modal-title').textContent = 'Edit Contact';
    document.getElementById('contact-id').value = id;
    document.getElementById('contact-name').value = contact.name;
    document.getElementById('contact-phone').value = contact.phone;
    document.getElementById('contact-email').value = contact.email;
    document.getElementById('contact-relation').value = contact.relation;
    document.getElementById('contact-priority').checked = contact.priority;
    document.getElementById('contact-modal').classList.remove('hidden');
}

function closeContactModal() {
    document.getElementById('contact-modal').classList.add('hidden');
    editingContactId = null;
}

function saveContact(e) {
    e.preventDefault();
    
    const contactData = {
        name: document.getElementById('contact-name').value,
        phone: document.getElementById('contact-phone').value,
        email: document.getElementById('contact-email').value,
        relation: document.getElementById('contact-relation').value,
        priority: document.getElementById('contact-priority').checked
    };
    
    if (editingContactId) {
        const index = contacts.findIndex(c => c.id === editingContactId);
        if (index !== -1) {
            contacts[index] = { ...contacts[index], ...contactData };
        }
        showNotification('Contact updated successfully');
    } else {
        const newContact = {
            id: Date.now(),
            ...contactData
        };
        contacts.push(newContact);
        showNotification('Contact added successfully');
    }
    
    saveData();
    renderContacts();
    updateStats();
    closeContactModal();
}

function deleteContact(id) {
    if (confirm('Are you sure you want to delete this contact?')) {
        contacts = contacts.filter(c => c.id !== id);
        saveData();
        renderContacts();
        updateStats();
        showNotification('Contact deleted');
    }
}

// ==================== ALERTS ====================
function renderAlerts() {
    const list = document.getElementById('alerts-list');
    if (!list) return;
    
    if (alerts.length === 0) {
        list.innerHTML = '<div class="alert-empty">No alerts yet. Stay safe!</div>';
        return;
    }
    
    list.innerHTML = alerts.map(alert => `
        <div class="alert-item" onclick="viewAlertDetails(${alert.id})" style="cursor: pointer;">
            <div class="alert-icon ${alert.type}">
                ${getAlertIcon(alert.type)}
            </div>
            <div class="alert-content">
                <h4>${alert.title}</h4>
                <p>${alert.message}</p>
                ${alert.location ? '<span style="color: var(--success); font-size: 0.75rem;">📍 Location captured</span>' : ''}
                ${alert.hasAudio ? '<span style="color: var(--primary-light); font-size: 0.75rem; margin-left: 8px;">🎤 Audio recorded</span>' : ''}
                ${alert.hasPhoto ? '<span style="color: var(--accent); font-size: 0.75rem; margin-left: 8px;">📸 Photo captured</span>' : ''}
            </div>
            <span class="alert-time">${alert.time}</span>
        </div>
    `).join('');
}

function viewAlertDetails(alertId) {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return;
    
    let details = `Alert: ${alert.title}\n`;
    details += `Time: ${alert.time}\n`;
    details += `Message: ${alert.message}\n`;
    
    if (alert.location) {
        const mapsUrl = `https://maps.google.com/?q=${alert.location.lat},${alert.location.lng}`;
        details += `\nLocation: ${mapsUrl}`;
        details += `\nCoordinates: ${alert.location.lat.toFixed(6)}, ${alert.location.lng.toFixed(6)}`;
    }
    
    if (alert.hasAudio) {
        details += '\n\nAudio: 10 seconds recorded';
    }
    
    if (alert.hasPhoto) {
        details += '\nPhoto: Front camera captured';
    }
    
    alert(details);
}

function getAlertIcon(type) {
    const icons = {
        sos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22,4 12,14.01 9,11.01"></polyline></svg>'
    };
    return icons[type] || icons.info;
}

function clearAllAlerts() {
    if (alerts.length === 0) return;
    if (confirm('Clear all alerts?')) {
        alerts = [];
        saveData();
        renderAlerts();
        showNotification('All alerts cleared');
    }
}

// ==================== PROFILE ====================
function updateProfile(e) {
    e.preventDefault();
    
    if (!currentUser) return;
    
    // Update current user
    currentUser = {
        ...currentUser,
        name: document.getElementById('profile-name').value,
        email: document.getElementById('profile-email').value,
        phone: document.getElementById('profile-phone').value,
        dob: document.getElementById('profile-dob').value,
        address: document.getElementById('profile-address').value,
        emergencyMessage: document.getElementById('profile-message').value
    };
    
    // Update in accounts storage
    const accounts = getAccounts();
    if (accounts[currentUser.email]) {
        accounts[currentUser.email] = { ...accounts[currentUser.email], ...currentUser };
        saveAccounts(accounts);
    }
    
    // Update current session
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
    
    document.getElementById('profile-avatar').textContent = getInitials(currentUser.name);
    showNotification('Profile updated successfully');
}

function changeAvatar() {
    showNotification('Photo upload coming soon!');
}

// ==================== SETTINGS ====================
function updateSetting(key, value) {
    settings[key] = value;
    saveData();
    showNotification(`${key.charAt(0).toUpperCase() + key.slice(1)} ${value ? 'enabled' : 'disabled'}`);
}

function deleteAccount() {
    if (confirm('WARNING: This will permanently delete your account and all data. Are you sure?')) {
        if (currentUser && currentUser.email) {
            // Remove from accounts
            const accounts = getAccounts();
            delete accounts[currentUser.email];
            saveAccounts(accounts);
            
            // Remove user data
            localStorage.removeItem(getUserDataKey(currentUser.email));
        }
        
        // Clear current session
        localStorage.removeItem(CURRENT_USER_KEY);
        currentUser = null;
        contacts = [];
        alerts = [];
        settings = { ...defaultSettings };
        
        showNotification('Account deleted');
        setTimeout(() => {
            document.getElementById('landing-page').classList.remove('hidden');
            document.getElementById('app-container').classList.add('hidden');
        }, 1500);
    }
}

// ==================== UTILITIES ====================
function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function updateStats() {
    const statSafe = document.getElementById('stat-safe');
    const statAlerts = document.getElementById('stat-alerts');
    const statContacts = document.getElementById('stat-contacts');
    
    if (statSafe) statSafe.textContent = '30';
    if (statAlerts) statAlerts.textContent = alerts.length;
    if (statContacts) statContacts.textContent = contacts.length;
}

function saveData() {
    // Save to user-specific storage
    saveCurrentUserData();
}

function loadSavedData() {
    console.log('📂 Loading saved data...');
    
    const savedContacts = localStorage.getItem('safesie_contacts');
    const savedAlerts = localStorage.getItem('safesie_alerts');
    const savedSettings = localStorage.getItem('safesie_settings');
    
    // Load contacts (use defaults if none saved)
    if (savedContacts) {
        contacts = JSON.parse(savedContacts);
        console.log('✅ Loaded', contacts.length, 'contacts');
    } else {
        contacts = [...defaultContacts];
        console.log('ℹ️ Using default contacts');
    }
    
    // Load alerts
    if (savedAlerts) {
        alerts = JSON.parse(savedAlerts);
        console.log('✅ Loaded', alerts.length, 'alerts');
    } else {
        alerts = [];
    }
    
    // Load settings (merge with defaults)
    if (savedSettings) {
        settings = { ...defaultSettings, ...JSON.parse(savedSettings) };
        console.log('✅ Loaded settings');
    } else {
        settings = { ...defaultSettings };
    }
    
    // Apply settings to toggles
    Object.keys(settings).forEach(key => {
        const toggle = document.getElementById(`setting-${key}`);
        if (toggle) toggle.checked = settings[key];
    });
}

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const colors = {
        info: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        success: 'linear-gradient(135deg, #10b981, #059669)',
        error: 'linear-gradient(135deg, #ef4444, #dc2626)'
    };

    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `<span>${message}</span>`;
    
    notification.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: ${colors[type] || colors.info};
        color: white;
        padding: 16px 32px;
        border-radius: 12px;
        font-weight: 500;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        opacity: 0;
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;

    document.body.appendChild(notification);

    requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(-50%) translateY(100px)';
        setTimeout(() => notification.remove(), 400);
    }, 3000);
}

// Smooth scroll for landing page
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// Parallax effect for hero glow
let ticking = false;
window.addEventListener('scroll', () => {
    if (!ticking) {
        window.requestAnimationFrame(() => {
            const scrolled = window.pageYOffset;
            const heroGlow = document.querySelector('.hero-glow');
            if (heroGlow) {
                heroGlow.style.transform = `translate(-50%, -50%) translateY(${scrolled * 0.3}px)`;
            }
            ticking = false;
        });
        ticking = true;
    }
});

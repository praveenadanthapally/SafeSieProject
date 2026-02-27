// Twilio Configuration Example
// Copy this file to twilio-config.js and add your real credentials

const TWILIO_CONFIG = {
    // Get these from https://www.twilio.com/console
    ACCOUNT_SID: 'YOUR_TWILIO_ACCOUNT_SID',
    AUTH_TOKEN: 'YOUR_TWILIO_AUTH_TOKEN',
    PHONE_NUMBER: 'YOUR_TWILIO_PHONE_NUMBER', // Format: +1234567890
    
    // Trial mode settings
    IS_TRIAL: true,
    
    // API endpoint
    API_URL: 'https://api.twilio.com/2010-04-01'
};

// Instructions:
// 1. Sign up at https://www.twilio.com/try-twilio
// 2. Get your Account SID and Auth Token from the console
// 3. Get a phone number (free during trial)
// 4. Copy this file to twilio-config.js
// 5. Replace the placeholder values with your actual credentials

async function sendTwilioSMS(toPhoneNumber, message) {
    if (TWILIO_CONFIG.ACCOUNT_SID === 'YOUR_TWILIO_ACCOUNT_SID') {
        console.log('⚠️ Twilio not configured. Using simulation mode.');
        return { success: false, error: 'Not configured', simulated: true };
    }
    
    try {
        const url = `${TWILIO_CONFIG.API_URL}/Accounts/${TWILIO_CONFIG.ACCOUNT_SID}/Messages.json`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + btoa(TWILIO_CONFIG.ACCOUNT_SID + ':' + TWILIO_CONFIG.AUTH_TOKEN),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                'To': toPhoneNumber,
                'From': TWILIO_CONFIG.PHONE_NUMBER,
                'Body': message
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ SMS sent via Twilio:', data.sid);
            return { success: true, sid: data.sid };
        } else {
            console.error('❌ Twilio error:', data.message);
            return { success: false, error: data.message };
        }
        
    } catch (error) {
        console.error('❌ Network error:', error);
        return { success: false, error: error.message };
    }
}

window.TwilioService = {
    sendSMS: sendTwilioSMS,
    config: TWILIO_CONFIG
};

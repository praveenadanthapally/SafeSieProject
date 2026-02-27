// Twilio Configuration for SafeSie
// Get your credentials from: https://www.twilio.com/console

const TWILIO_CONFIG = {
    // These will be overridden by user settings from localStorage
    ACCOUNT_SID: 'YOUR_TWILIO_ACCOUNT_SID',
    AUTH_TOKEN: 'YOUR_TWILIO_AUTH_TOKEN',
    PHONE_NUMBER: 'YOUR_TWILIO_PHONE_NUMBER',
    
    // Trial mode settings
    IS_TRIAL: true,
    
    // API endpoint (using Twilio's REST API via fetch)
    API_URL: 'https://api.twilio.com/2010-04-01'
};

// Instructions to get started:
// 1. Sign up at https://www.twilio.com/try-twilio
// 2. Get your Account SID and Auth Token from the console
// 3. Get a phone number (free during trial)
// 4. Replace the placeholder values above
// 5. Verify emergency contact phone numbers in Twilio console

// Send SMS using Twilio
async function sendTwilioSMS(toPhoneNumber, message) {
    // Use the current config (may be updated from localStorage)
    const config = window.TwilioService ? window.TwilioService.config : TWILIO_CONFIG;
    
    // Check if credentials are configured
    if (!config.ACCOUNT_SID || config.ACCOUNT_SID === 'YOUR_TWILIO_ACCOUNT_SID') {
        console.log('⚠️ Twilio not configured. Using simulation mode.');
        return { success: false, error: 'Not configured', simulated: true };
    }
    
    console.log('📱 Sending SMS to:', toPhoneNumber);
    console.log('📱 Using Twilio number:', config.PHONE_NUMBER);
    
    try {
        const url = `${config.API_URL}/Accounts/${config.ACCOUNT_SID}/Messages.json`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + btoa(config.ACCOUNT_SID + ':' + config.AUTH_TOKEN),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                'To': toPhoneNumber,
                'From': config.PHONE_NUMBER,
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

// Send SMS to multiple contacts
async function sendTwilioSMSToContacts(contacts, message) {
    const results = [];
    
    for (const contact of contacts) {
        if (!contact.phone) continue;
        
        const result = await sendTwilioSMS(contact.phone, message);
        results.push({
            contact: contact.name,
            phone: contact.phone,
            ...result
        });
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return results;
}

// Check Twilio balance/status
async function checkTwilioStatus() {
    // Use the current config (may be updated from localStorage)
    const config = window.TwilioService ? window.TwilioService.config : TWILIO_CONFIG;
    
    if (!config.ACCOUNT_SID || config.ACCOUNT_SID === 'YOUR_TWILIO_ACCOUNT_SID') {
        return { configured: false, message: 'Twilio not configured' };
    }
    
    try {
        const url = `${config.API_URL}/Accounts/${config.ACCOUNT_SID}.json`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + btoa(config.ACCOUNT_SID + ':' + config.AUTH_TOKEN)
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            return {
                configured: true,
                status: data.status,
                type: data.type,
                balance: data.balance,
                currency: data.currency
            };
        } else {
            return { configured: false, error: data.message };
        }
        
    } catch (error) {
        return { configured: false, error: error.message };
    }
}

// Export for use in main app
window.TwilioService = {
    sendSMS: sendTwilioSMS,
    sendToContacts: sendTwilioSMSToContacts,
    checkStatus: checkTwilioStatus,
    config: TWILIO_CONFIG
};

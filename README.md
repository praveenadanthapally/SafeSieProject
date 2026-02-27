# SafeSie - Women's Safety App

A voice-activated women's safety web application with SOS alerts, emergency contacts, and real-time location sharing.

## Features

- 🎤 **Voice Trigger**: Say "Help me" to activate SOS
- 📍 **Location Sharing**: Automatic GPS coordinates
- 🎤 **Audio Recording**: 10-second audio capture
- 📸 **Photo Capture**: Front camera snapshot
- 📱 **SMS Alerts**: Twilio integration for emergency SMS
- ✉️ **Email Alerts**: Emergency email notifications
- 👥 **Emergency Contacts**: Manage trusted contacts
- 🔒 **User Accounts**: Secure login/signup

## Deployment

This app is deployed on GitHub Pages.

## Setup

1. Clone the repository
2. Configure Twilio in `twilio-config.js` (see below)
3. Open `index.html` in a browser

## Twilio Configuration

To enable real SMS alerts:

1. Sign up at [twilio.com](https://www.twilio.com)
2. Get your Account SID and Auth Token
3. Get a Twilio phone number
4. Update `twilio-config.js` with your credentials

## Note

This is a frontend-only demo. For production use, a backend server is recommended for:
- Secure credential storage
- Database persistence
- Real SMS/email delivery

## License

MIT License

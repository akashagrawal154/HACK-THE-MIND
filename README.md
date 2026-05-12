# Nexo — Lightweight EdTech Platform

## 🚀 Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Your `.env` file is already set up with Twilio credentials.
To use WhatsApp OTP, you **must first join the Twilio Sandbox**:
- Open WhatsApp and message **+1 415 523 8886**
- Send the message: `join <your-sandbox-keyword>`
  (Find your keyword at: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn)

### 3. Start the Server
```bash
node app.js
```
Or with auto-restart on file changes:
```bash
npx nodemon app.js
```

### 4. Open the App
Visit: **http://localhost:3000/homepage.html**

---

## 📁 File Structure
```
nexo/
├── app.js                  ← Backend server (Express + Twilio)
├── .env                    ← Twilio credentials (keep secret!)
├── package.json
├── homepage.html           ← Landing page
├── loginpage.html          ← Login (Email + WhatsApp OTP)
├── signuppage.html         ← Registration
├── dashboard.html          ← Student dashboard
├── dashboardteacher.html   ← Teacher dashboard
├── library.html            ← Audio/text resource library
├── liveclasses.html        ← Live class joining
├── analytics.html          ← Student analytics
├── network.html            ← Network monitor
├── myclasses.html          ← Teacher: class list
├── createnewclass.html     ← Teacher: create class
├── grading.html            ← Teacher: grade students
├── studentlist.html        ← Teacher: attendance
├── settingsstudent.html    ← Student settings
├── settingteacher.html     ← Teacher settings
└── meet.html               ← Live class workspace
```

---

## 🔐 WhatsApp OTP Flow
1. Enter phone number in **international format**: `+919876543210`
2. Click **Send OTP via WhatsApp**
3. Receive OTP on WhatsApp within seconds
4. Enter OTP and click **Verify & Login**

---

## ⚙️ API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Sign up new user |
| POST | `/login` | Login with username/password |
| POST | `/send-otp` | Send WhatsApp OTP |
| POST | `/verify-otp` | Verify OTP and get token |

---

## ⚠️ Notes
- Data is stored **in-memory** — it resets when the server restarts
- The Twilio Sandbox requires the recipient to opt-in once
- OTPs expire after **5 minutes**
- Rate limit: **1 OTP per phone number per minute**

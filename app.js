require("dotenv").config();
const express = require("express");
const cors = require("cors");
const twilio = require("twilio");

// ─── TWILIO CLIENT ────────────────────────────────────────────────────────────
const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// Validate that required env vars are present at startup
const requiredEnv = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_NUMBER"];
requiredEnv.forEach((key) => {
    if (!process.env[key]) {
        console.error(`❌ Missing environment variable: ${key}`);
        process.exit(1);
    }
});

// ─── APP SETUP ────────────────────────────────────────────────────────────────
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());
app.use(express.static("./"));

// ─── IN-MEMORY DATABASE ───────────────────────────────────────────────────────
const db = {
    users: [],
};

// ─── OTP STORE  { phone: { code, expiresAt } } ───────────────────────────────
const otpStore = {};
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── RATE LIMITER (simple in-memory) ─────────────────────────────────────────
// Prevents the same phone number from requesting more than 1 OTP per minute
const lastSentAt = {};
const RATE_LIMIT_MS = 60 * 1000; // 1 minute cooldown

// ─── HELPER ───────────────────────────────────────────────────────────────────
function isValidPhone(phone) {
    // Must start with + and contain 7-15 digits
    return /^\+\d{7,15}$/.test(phone);
}

// =============================================================================
//  AUTH ROUTES
// =============================================================================

// ─── SIGNUP ───────────────────────────────────────────────────────────────────
app.post("/register", (req, res) => {
    const { username, password, role, email, name } = req.body;

    const userExists = db.users.find((u) => u.username === username);
    if (userExists) {
        return res.status(400).json({ error: "Signup failed. User already exists." });
    }

    const newUser = { username, password, role, email, name };
    db.users.push(newUser);

    console.log(`👤 New User Registered: ${username} [${role}]`);
    res.json({ message: "Account created successfully!" });
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
app.post("/login", (req, res) => {
    const { username, password, role } = req.body;

    const user = db.users.find(
        (u) => u.username === username && u.password === password && u.role === role
    );

    if (user) {
        console.log(`✅ Login: ${username} [${role}]`);
        res.json({
            message: "Login successful!",
            token: "mock-jwt-token",
            role: user.role,
        });
    } else {
        res.status(401).json({ error: "Invalid credentials or role selected." });
    }
});

// =============================================================================
//  WHATSAPP OTP ROUTES
// =============================================================================

// ─── SEND OTP ─────────────────────────────────────────────────────────────────
app.post("/send-otp", async (req, res) => {
    const { phone } = req.body;

    // 1. Validate phone format
    if (!phone || !isValidPhone(phone)) {
        return res.status(400).json({
            error: "Invalid phone number. Use international format e.g. +919876543210",
        });
    }

    // 2. Rate limiting — block if last OTP was sent less than 1 minute ago
    const now = Date.now();
    if (lastSentAt[phone] && now - lastSentAt[phone] < RATE_LIMIT_MS) {
        const wait = Math.ceil((RATE_LIMIT_MS - (now - lastSentAt[phone])) / 1000);
        return res.status(429).json({
            error: `Please wait ${wait}s before requesting another OTP.`,
        });
    }

    // 3. Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 4. Store OTP with expiry timestamp
    otpStore[phone] = {
        code: otp,
        expiresAt: now + OTP_TTL_MS,
    };
    lastSentAt[phone] = now;

    // 5. Send via Twilio WhatsApp
    //    IMPORTANT: TWILIO_WHATSAPP_NUMBER in your .env must be: whatsapp:+14155238886
    //    For sandbox: first send "join <keyword>" to +14155238886 on WhatsApp
    try {
        const message = await client.messages.create({
            body: `🔐 Your Nexo OTP is: *${otp}*\n\nThis code expires in 5 minutes. Do not share it with anyone.`,
            from: process.env.TWILIO_WHATSAPP_NUMBER.startsWith("whatsapp:")
                ? process.env.TWILIO_WHATSAPP_NUMBER
                : `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
            to: `whatsapp:${phone}`,
        });

        console.log(`📲 OTP sent to ${phone} | SID: ${message.sid}`);
        res.json({ message: "OTP sent successfully via WhatsApp!" });

    } catch (err) {
        console.error("❌ Twilio Error:", err.message);

        // Clean up store so user can retry immediately
        delete otpStore[phone];
        delete lastSentAt[phone];

        // Surface a readable error to the frontend
        if (err.code === 63007) {
            return res.status(500).json({
                error: "WhatsApp not enabled. Send 'join <your-keyword>' to +14155238886 on WhatsApp first.",
            });
        }

        res.status(500).json({
            error: `Failed to send OTP: ${err.message}`,
        });
    }
});

// ─── VERIFY OTP ───────────────────────────────────────────────────────────────
app.post("/verify-otp", (req, res) => {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
        return res.status(400).json({ error: "Phone and OTP are required." });
    }

    const record = otpStore[phone];

    // 1. Check if OTP exists for this phone
    if (!record) {
        return res.status(400).json({ error: "No OTP found for this number. Please request a new one." });
    }

    // 2. Check expiry
    if (Date.now() > record.expiresAt) {
        delete otpStore[phone];
        return res.status(400).json({ error: "OTP has expired. Please request a new one." });
    }

    // 3. Check if OTP matches (strict string comparison)
    if (record.code !== otp.trim()) {
        return res.status(400).json({ error: "Incorrect OTP. Please try again." });
    }

    // 4. OTP valid — clean up and respond
    delete otpStore[phone];
    console.log(`✅ WhatsApp OTP verified for ${phone}`);

    res.json({
        message: "Login successful!",
        token: "mock-jwt-token",
        role: "student",
    });
});

// =============================================================================
//  START SERVER
// =============================================================================
app.listen(PORT, () => {
    console.log(`\n🚀 Nexo server running at http://localhost:${PORT}`);
    console.log(`📲 WhatsApp OTP via: ${process.env.TWILIO_WHATSAPP_NUMBER}`);
    console.log(`⚠️  In-memory DB: all data clears on restart.\n`);
    console.log(`📖 Open http://localhost:${PORT}/homepage.html to start\n`);
});

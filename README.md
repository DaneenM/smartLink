# SmartLink.io

**Track smarter. Share better.**

SmartLink.io is a lightweight link tracker that turns any URL into a powerful analytics tool. With clean UI, real-time GPS logging, and browser insights, SmartLink is perfect for campaigns, personal use, or link testing.

---

## 🚀 Features
- Generate custom SmartLinks
- Live click tracking
- Geo + IP-based location logging
- Device, browser, OS, and referrer detection
- Export to CSV and PDF
- Mobile web optimized
- Copy-to-clipboard support

---

## 📂 Project Structure

```
smartlink_tracker/
├── public/
│   ├── index.html            # Generator UI
│   ├── report.html           # Report UI
│   ├── logo.png              # Brand logo
│   └── ...                   # CSS/JS assets
├── server.js                # Node.js Express backend
└── README.md                # You're here
```

---

## 💻 Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Run the server
```bash
node server.js
```

App will be live at:
```
http://localhost:3000
```

---

## 🔗 How It Works
1. Enter a destination URL
2. Optionally add a custom path and query
3. Generate SmartLink + access the tracking dashboard

### Example Output:
```
SmartLink: http://localhost:3000/my-promo?ref=summer
View Report: http://localhost:3000/report/view/my-promo
```

---

## 📦 Export Options
- 📄 CSV: List of all logs
- 🧾 PDF: Formatted snapshot for clients/stakeholders
- 🖨️ Print: Full styled page with geo/map info

---

## 🌍 Future Ideas
- User accounts for managing links
- SMS or email-based SmartLinks
- QR code generation
- Unique visitor fingerprinting
- Map heat visualization

---

## 🛡️ Privacy & Security
- No data is stored permanently.
- All logs exist in memory (in-memory array only).
- Designed for local or temporary use unless extended.

---

## 🧠 Branding
- **Logo**: `/public/logo.png`
- **Tagline**: *Track smarter. Share better.*

---

## ❤️ Credits
Made with passion by [You]. Powered by Node.js + HTML.

---

## 📬 Contact
For questions, features, or fun ideas — reach out!


const express = require('express');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

let links = [];
let personas = [];

// 🔗 SmartLink Generator
app.post('/create-link', (req, res) => {
  const { path, query, target } = req.body;
  const link = `${path}${query ? '?' + query : ''}`;
  links.push({ link, target, logs: [], type: 'standard' });
  res.json({ link });
});

// 🧠 AI Persona Generator
app.post('/generate-persona', (req, res) => {
  const { platform, firstName, lastName, age, location, niche, style, followers } = req.body;

  if (!age || !location || !niche || !style) {
    return res.status(400).json({ error: 'Missing required persona details.' });
  }

  const fullName = (firstName || lastName) 
    ? `${firstName || ''} ${lastName || ''}`.trim() 
    : generateRandomName();

  const id = `${fullName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

  const persona = {
    id,
    name: fullName,
    platform,
    age,
    location,
    niche,
    style,
    followers: followers || 'New',
    profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`
  };

  // Save as JSON (you can change to DB later)
  const filePath = path.join(__dirname, 'public', 'personas', `${id}.json`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(persona, null, 2));

  personas.push(persona);

  res.json({ success: true, persona });
});

function generateRandomName() {
  const first = ['Jade', 'Lana', 'Maya', 'Ava', 'Zara', 'Nova', 'Skye', 'Rae'];
  const last = ['Monroe', 'Blake', 'Reign', 'Storm', 'King', 'Brooks', 'James'];
  const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
  return `${random(first)} ${random(last)}`;
}

// 📍 GPS Logger
app.post('/log-location', (req, res) => {
  const { path, coords } = req.body;
  const matchedLink = links.find(l => l.link.startsWith(path));
  if (matchedLink && matchedLink.logs.length > 0) {
    matchedLink.logs[matchedLink.logs.length - 1].gps = coords;
    return res.json({ success: true });
  }
  res.status(404).send('Link not found or no visit to attach location');
});

// 📊 Visual Report Page
app.get('/report/view/:path', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'report.html'));
});

// 📄 Report Data API
app.get('/api/report/:path', (req, res) => {
  const matchedLink = links.find(l => l.link.startsWith(req.params.path));
  if (matchedLink) {
    res.json({
      link: matchedLink.link,
      destination: matchedLink.target,
      totalClicks: matchedLink.logs.length,
      type: matchedLink.type,
      logs: matchedLink.logs
    });
  } else {
    res.status(404).json({ error: 'Report not found' });
  }
});

// 🚦 Redirect & Log Catch-All Handler
app.get('/:path', (req, res) => {
  const fullUrl = req.originalUrl.slice(1);
  const matchedLink = links.find(l => l.link === fullUrl || l.link === req.params.path);

  if (matchedLink) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const referrer = req.get('Referrer') || 'Direct';

    matchedLink.logs.push({
      time: new Date().toISOString(),
      ip,
      referrer,
      userAgent
    });

    return res.redirect(matchedLink.target);
  }

  res.status(404).send('Link not found');
});

app.listen(PORT, () => {
  console.log(`🚀 SmartLink Tracker running at http://localhost:${PORT}`);
});

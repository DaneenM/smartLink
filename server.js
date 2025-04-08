require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const OpenAI = require('openai'); // ✅ NEW

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});


let links = [];
let personas = [];

// 🔗 SmartLink Generator
app.post('/create-link', (req, res) => {
  const { path, query, target } = req.body;
  const link = `${path}${query ? '?' + query : ''}`;
  links.push({ link, target, logs: [], type: 'standard' });
  res.json({ link });
});

// 🧠 AI Persona Generator (OpenAI + Scalability AI)
app.post('/generate-persona', async (req, res) => {
  const { platform, firstName, lastName, nickname, age, location, niche, style, followers } = req.body;

  if (!age || !location || !niche || !style) {
    return res.status(400).json({ error: 'Missing required persona details.' });
  }

  const fullName = (firstName || lastName)
    ? `${firstName || ''} ${lastName || ''}`.trim()
    : generateRandomName();

  const id = `${fullName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

  let generatedNickname = nickname;
  let generatedBio = '';

  // If nickname is not manually provided, use AI
  if (!nickname) {
    const prompt = `Create a realistic social media username (no @ symbol) and short engaging bio for a fake ${platform} influencer, aged ${age}, based in ${location}, working in the ${niche} niche with a ${style} vibe. Return it in the format:
Username: [value]
Bio: [value]`;

    try {
      // Primary: OpenAI
      const aiRes = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9
      });

      const text = aiRes.data.choices[0].message.content;
      const [usernameLine, bioLine] = text.split('\n').filter(Boolean);

      generatedNickname = usernameLine?.replace(/^Username:\s*/i, '').replace('@', '').trim() || 'user_' + Date.now();
      generatedBio = bioLine?.replace(/^Bio:\s*/i, '').trim() || '';

    } catch (err) {
      console.warn('⚠️ OpenAI failed. Switching to Scalability AI...');

      try {
        // Fallback: Scalability AI
        const scaleRes = await fetch('https://api.scalability.ai/v1/text/generate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SCALABILITY_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.9
          })
        });

        const scaleData = await scaleRes.json();
        const scaleText = scaleData.choices?.[0]?.message?.content || '';
        const [usernameLine, bioLine] = scaleText.split('\n').filter(Boolean);

        generatedNickname = usernameLine?.replace(/^Username:\s*/i, '').replace('@', '').trim() || 'user_' + Date.now();
        generatedBio = bioLine?.replace(/^Bio:\s*/i, '').trim() || '';

      } catch (fallbackErr) {
        console.error('❌ Both OpenAI and Scalability AI failed:', fallbackErr.message);
        generatedNickname = 'user_' + Date.now();
        generatedBio = '';
      }
    }
  }

  const persona = {
    id,
    name: fullName,
    platform,
    username: generatedNickname,
    age,
    location,
    niche,
    style,
    followers: followers || 'New',
    bio: generatedBio,
    profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`
  };

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

// 🚦 Redirect Handler
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

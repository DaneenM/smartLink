// 📁 server.js (clean — using .env for API URL)
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mustache = require('mustache');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));
app.use('/images', express.static('images'));

// 🔮 Generate Persona + Profile Page
app.post('/generate-persona', async (req, res) => {
  const { platform, firstName, lastName, nickname, age, location, niche, style, race, gender, followers } = req.body;

  if (!age || !location || !niche || !style || !race || !gender) {
    return res.status(400).json({ error: 'Missing required persona fields.' });
  }

  const fullName = (firstName || lastName)
    ? `${firstName || ''} ${lastName || ''}`.trim()
    : generateRandomName();
  const id = `${fullName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

  const generatedNickname = nickname || `user_${Date.now()}`;
  const generatedBio = `${niche} influencer from ${location}. Style: ${style}.`;

  const imgPrompt = `${age}-year-old ${race} ${gender}, ${style} aesthetic, ${niche} niche, ultra-realistic, natural lighting, consistent face, same person across images, Instagram-style`;
  let imageUrls = [];

  try {
    const response = await axios.post(
      process.env.AI_IMAGE_API_URL || 'http://127.0.0.1:5000/generate',
      { prompt: imgPrompt },
      { responseType: 'stream' }
    );

    const filename = `persona-${Date.now()}.png`;
    const filePath = path.join(__dirname, 'public', 'images', filename);
    const writer = fs.createWriteStream(filePath);

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    imageUrls.push(`/images/${filename}`);
  } catch (err) {
    console.error('❌ Local API image generation failed:', err.message);
    imageUrls = ['/images/default.png']; // fallback
  }

  const posts = imageUrls.map((url) => ({
    image: url,
    caption: `Loving this vibe today ✨ #${niche.replace(/\s+/g, '')} #${style.replace(/\s+/g, '')}`,
    likes: Math.floor(Math.random() * 5000 + 100),
    comments: Math.floor(Math.random() * 300 + 5),
    timestamp: `${Math.floor(Math.random() * 10) + 1}h`
  }));

  const persona = {
    id,
    name: fullName,
    platform,
    username: generatedNickname,
    age,
    location,
    niche,
    style,
    race,
    gender,
    followers: followers || 'New',
    bio: generatedBio,
    profileImage: imageUrls[0],
    posts
  };

  const personaPath = path.join(__dirname, 'public', 'personas', `${id}.json`);
  fs.mkdirSync(path.dirname(personaPath), { recursive: true });
  fs.writeFileSync(personaPath, JSON.stringify(persona, null, 2));

  const templatePath = path.join(__dirname, 'public', 'templates', 'instagram-template.html');
  const outputPath = path.join(__dirname, 'public', 'profiles', `${generatedNickname}.html`);
  const template = fs.readFileSync(templatePath, 'utf-8');
  const html = mustache.render(template, persona);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html);

  res.json({
    success: true,
    persona,
    profileUrl: `/profiles/${generatedNickname}.html`,
    message: 'Persona created using local AI 🎯'
  });
});

function generateRandomName() {
  const first = ['Lana', 'Nova', 'Ava', 'Zara', 'Jay', 'Kai', 'Leo', 'Zion'];
  const last = ['Storm', 'James', 'Reign', 'Blake', 'Stone', 'Miles'];
  return `${first[Math.floor(Math.random() * first.length)]} ${last[Math.floor(Math.random() * last.length)]}`;
}

app.listen(PORT, () => {
  console.log(`✅ SmartLink backend running at http://localhost:${PORT}`);
});

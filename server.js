// 📁 server.js (updated — supports 50 image gen + user selection of 1-25 photos for profile)
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

// 🔥 Dynamic local image generation with influencer vibes
async function generateImagesWithLocalAPI({ age, race, gender, style, niche, count = 50 }) {
  const imageUrls = [];
  const basePrompt = `${age}-year-old attractive ${race} ${gender}, symmetrical facial features, flawless skin, sharp jawline, expressive eyes, fashion-model face, full-body photo, dynamic pose, candid angle, professional photography, photorealistic, cinematic lighting, ${style} aesthetic`;

  const vibeByNiche = {
    gamer: [
      "posing in a RGB-lit gaming room with headphones",
      "gaming chair setup with LED background",
      "streaming moment with dual monitors in frame",
      "peace sign selfie with neon keyboard",
      "posing in front of gaming PC setup",
      "mid-action gaming shot with console"
    ],
    chef: [
      "cooking in a modern kitchen, plating food",
      "chopping vegetables with a smile",
      "posing proudly beside a gourmet dish",
      "mixing batter in glass bowl",
      "chef’s hat on, presenting food",
      "prepping ingredients on a clean counter"
    ],
    fashion: [
      "strutting through fashion district, designer outfit",
      "posing against a pastel wall with luxury handbag",
      "streetwear editorial shoot, city backdrop",
      "outfit of the day mirror selfie",
      "high-fashion sidewalk strut",
      "editorial shot in front of modern architecture"
    ],
    fitness: [
      "posing with gym equipment, toned muscles",
      "in mid-squat with weights, athletic wear",
      "stretching outside before a morning run",
      "doing yoga on a balcony",
      "flexing biceps post workout",
      "sipping protein shake with gym towel"
    ],
    travel: [
      "photo at a scenic viewpoint, travel blogger style",
      "posing near a waterfall with backpack",
      "taking a selfie in front of a famous landmark",
      "on a bike by the beach",
      "drinking coffee in a mountain lodge",
      "airport runway fashion shot"
    ],
    default: [
      "posing in a chic urban street, editorial-style",
      "rooftop evening shot with city lights",
      "relaxing with coffee at a trendy cafe",
      "mid-laugh candid in soft lighting",
      "headshot with blurred background",
      "holding a phone, checking messages on sidewalk"
    ]
  };

  const selectedVibes = vibeByNiche[niche.toLowerCase()] || vibeByNiche.default;

  for (let i = 0; i < count; i++) {
    const prompt = `${basePrompt}, ${selectedVibes[i % selectedVibes.length]}`;

    try {
      const response = await axios.post(
        process.env.LOCAL_API_ENDPOINT || 'http://127.0.0.1:5000/generate',
        { prompt },
        { responseType: 'stream' }
      );

      const filename = `persona-${Date.now()}-${i}.png`;
      const filePath = path.join(__dirname, 'public', 'images', filename);
      const writer = fs.createWriteStream(filePath);

      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      imageUrls.push(`/images/${filename}`);
    } catch (err) {
      console.error(`❌ Image ${i + 1} failed:`, err.message);
      imageUrls.push('/images/default.png');
    }
  }

  return imageUrls;
}

// 🔮 Generate Persona + return images for user to select
app.post('/generate-photos', async (req, res) => {
  const { age, race, gender, style, niche } = req.body;
  if (!age || !race || !gender || !style || !niche) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const imageUrls = await generateImagesWithLocalAPI({ age, race, gender, style, niche, count: 50 });
    return res.json({ success: true, imageUrls });
  } catch (err) {
    console.error('⚠️ Image batch generation failed:', err.message);
    return res.status(500).json({ error: 'Failed to generate images.' });
  }
});

// ✅ Finalize persona with selected photos
app.post('/finalize-persona', async (req, res) => {
  const { platform, firstName, lastName, nickname, age, location, niche, style, race, gender, followers, selectedPhotos } = req.body;
  if (!age || !location || !niche || !style || !race || !gender || !selectedPhotos || !selectedPhotos.length) {
    return res.status(400).json({ error: 'Missing required persona fields or images.' });
  }

  const fullName = (firstName || lastName)
    ? `${firstName || ''} ${lastName || ''}`.trim()
    : generateRandomName();
  const id = `${fullName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
  const generatedNickname = nickname || `user_${Date.now()}`;
  const generatedBio = `${niche} influencer from ${location}. Style: ${style}.`;

  const posts = selectedPhotos.slice(0, 25).map((url) => ({
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
    profileImage: selectedPhotos[0],
    posts,
    postCount: posts.length 
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
    message: 'Persona finalized 🎯'
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

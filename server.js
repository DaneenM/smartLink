// 📁 server.js (complete)
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const OpenAI = require('openai');
const mustache = require('mustache');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🔥 Replicate image generation function
async function generateImagesFromReplicate(prompt, count = 27) {
  const replicateRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      version: "c8c9fc4c50fc0ce2d5e3c0cfc29206d7bb9c38fd6089d444e5d18e9b5e65dcae", // Model that supports consistent faces
      input: {
        prompt,
        num_outputs: count,
        guidance_scale: 7.5,
        num_inference_steps: 30
      }
    })
  });

  const replicateJson = await replicateRes.json();
  const predictionUrl = replicateJson.urls?.get;
  if (!predictionUrl) throw new Error('No Replicate prediction URL.');

  let images = [];
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(predictionUrl, {
      headers: { 'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}` }
    });
    const statusJson = await statusRes.json();
    if (statusJson.status === 'succeeded') {
      images = statusJson.output;
      break;
    } else if (statusJson.status === 'failed') {
      throw new Error('Image generation failed.');
    }
  }
  return images;
}

// 🧠 Generate Persona
app.post('/generate-persona', async (req, res) => {
  const { platform, firstName, lastName, nickname, age, location, niche, style, race, followers } = req.body;

  if (!age || !location || !niche || !style || !race) {
    return res.status(400).json({ error: 'Missing required persona fields.' });
  }

  const fullName = (firstName || lastName)
    ? `${firstName || ''} ${lastName || ''}`.trim()
    : generateRandomName();
  const id = `${fullName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

  const aiPrompt = `Create a username and Instagram bio for a ${age}-year-old ${race} influencer from ${location}, niche: ${niche}, style: ${style}. Format:
Username: [username]
Bio: [bio]`;

  let generatedNickname = nickname;
  let generatedBio = '';

  try {
    const aiRes = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: aiPrompt }],
      temperature: 0.8
    });

    const text = aiRes.data.choices[0].message.content;
    const [usernameLine, bioLine] = text.split('\n').filter(Boolean);
    generatedNickname = nickname || usernameLine?.replace(/^Username:\s*/i, '').replace('@', '').trim();
    generatedBio = bioLine?.replace(/^Bio:\s*/i, '').trim();
  } catch (err) {
    console.error('❌ AI username/bio fallback:', err.message);
    generatedNickname = 'user_' + Date.now();
    generatedBio = `${niche} influencer.`;
  }

  // 🖼 Generate images
  const imgPrompt = `${age}-year-old ${race} woman, ${style} aesthetic, ${niche} niche, ultra-realistic, consistent face`;
  let imageUrls = [];
  try {
    imageUrls = await generateImagesFromReplicate(imgPrompt, 27);
  } catch (err) {
    console.error('Image generation failed:', err);
    imageUrls = Array(9).fill('https://placehold.co/300x300?text=Image');
  }

  const posts = imageUrls.map((url, i) => ({
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
    followers: followers || 'New',
    bio: generatedBio,
    profileImage: imageUrls[0],
    posts
  };

  // 📝 Save JSON
  const personaPath = path.join(__dirname, 'public', 'personas', `${id}.json`);
  fs.mkdirSync(path.dirname(personaPath), { recursive: true });
  fs.writeFileSync(personaPath, JSON.stringify(persona, null, 2));

  // 📄 Render profile
  const templatePath = path.join(__dirname, 'public', 'templates', 'instagram-template.html');
  const outputPath = path.join(__dirname, 'public', 'profiles', `${generatedNickname}.html`);
  const template = fs.readFileSync(templatePath, 'utf-8');
  const html = mustache.render(template, persona);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html);

  res.json({ success: true, persona, profileUrl: `/profiles/${generatedNickname}.html` });
});

// Utility name generator
function generateRandomName() {
  const first = ['Lana', 'Nova', 'Ava', 'Zara'];
  const last = ['Storm', 'James', 'Reign', 'Blake'];
  return `${first[Math.floor(Math.random() * first.length)]} ${last[Math.floor(Math.random() * last.length)]}`;
}

// Start the server
app.listen(PORT, () => {
  console.log(`✅ SmartLink backend running at http://localhost:${PORT}`);
});

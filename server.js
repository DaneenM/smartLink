// 📁 server.js (final updated)
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { OpenAI } = require('openai');
const mustache = require('mustache');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🔥 AI Image Generator with Replicate + DALL·E fallback
async function generateImagesWithFallback(prompt, count = 3) {
  console.log('🧠 Generating AI images for:', prompt);

  const replicateVersion = "lucataco/realistic-vision-v5:8aeee50b868f06a1893e3b95a8bb639a8342e846836f3e0211d6a13c158505b1";

  try {
    const replicateRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: replicateVersion,
        input: {
          prompt,
          seed: Math.floor(Math.random() * 10000)
        }
      })
    });

    const replicateJson = await replicateRes.json();
    const predictionUrl = replicateJson?.urls?.get;
    if (!predictionUrl) throw new Error('Replicate returned no URL.');

    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const statusRes = await fetch(predictionUrl, {
        headers: { 'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}` }
      });
      const statusJson = await statusRes.json();
      console.log(`⏳ Replicate status: ${statusJson.status}`);

      if (statusJson.status === 'succeeded') {
        console.log('📷 Replicate image output:', statusJson.output);
        return Array.isArray(statusJson.output) ? statusJson.output : [statusJson.output];
      } else if (statusJson.status === 'failed') {
        throw new Error('Replicate image generation failed.');
      }
    }

    throw new Error('Replicate timed out.');
  } catch (err) {
    console.warn('⚠️ Replicate failed, trying DALL·E:', err.message);

    // Fallback: DALL·E
    try {
      const dalleImages = [];
      for (let i = 0; i < count; i++) {
        const dalleRes = await openai.images.generate({
          model: 'dall-e-3',
          prompt,
          n: 1,
          size: "1024x1024"
        });

        const dalleUrl = dalleRes.data?.[0]?.url;
        if (dalleUrl) dalleImages.push(dalleUrl);
      }

      if (!dalleImages.length) throw new Error('DALL·E returned no images.');
      return dalleImages;
    } catch (dalleErr) {
      console.error('❌ DALL·E fallback failed too:', dalleErr.message);
      return Array(count).fill('https://placehold.co/300x300?text=Post');
    }
  }
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

  const aiPrompt = `Create a username and Instagram bio for a ${age}-year-old ${race} influencer from ${location}, niche: ${niche}, style: ${style}. Format:\nUsername: [username]\nBio: [bio]`;

  let generatedNickname = nickname;
  let generatedBio = '';

  try {
    const aiRes = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: aiPrompt }],
      temperature: 0.8
    });

    const text = aiRes.choices[0].message.content;
    const [usernameLine, bioLine] = text.split('\n').filter(Boolean);
    generatedNickname = nickname || usernameLine?.replace(/^Username:\s*/i, '').replace('@', '').trim();
    generatedBio = bioLine?.replace(/^Bio:\s*/i, '').trim();
  } catch (err) {
    console.error('❌ AI fallback triggered:', err.message);
    generatedNickname = 'user_' + Date.now();
    generatedBio = `${niche} influencer.`;
  }

  // 🖼 Generate images (Replicate + DALL·E fallback)
  const imgPrompt = `${age}-year-old ${race} woman, ${style} aesthetic, ${niche} niche, ultra-realistic, consistent face`;
  let imageUrls = [];
  try {
    imageUrls = await generateImagesWithFallback(imgPrompt, 3);
  } catch (err) {
    console.error('⚠️ Image generation totally failed:', err.message);
    imageUrls = Array(3).fill('https://placehold.co/300x300?text=Post');
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
    followers: followers || 'New',
    bio: generatedBio,
    profileImage: imageUrls[0],
    posts
  };

  // 💾 Save JSON
  const personaPath = path.join(__dirname, 'public', 'personas', `${id}.json`);
  fs.mkdirSync(path.dirname(personaPath), { recursive: true });
  fs.writeFileSync(personaPath, JSON.stringify(persona, null, 2));

  // 🧾 Render HTML profile
  const templatePath = path.join(__dirname, 'public', 'templates', 'instagram-template.html');
  const outputPath = path.join(__dirname, 'public', 'profiles', `${generatedNickname}.html`);
  const template = fs.readFileSync(templatePath, 'utf-8');
  const html = mustache.render(template, persona);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html);

  // ✅ Return success
  res.json({
    success: true,
    persona,
    profileUrl: `/profiles/${generatedNickname}.html`,
    message: 'Persona created. Images may take 1–2 minutes. Profile is ready.'
  });
});

// 🧰 Random name generator
function generateRandomName() {
  const first = ['Lana', 'Nova', 'Ava', 'Zara'];
  const last = ['Storm', 'James', 'Reign', 'Blake'];
  return `${first[Math.floor(Math.random() * first.length)]} ${last[Math.floor(Math.random() * last.length)]}`;
}

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`✅ SmartLink backend running at http://localhost:${PORT}`);
});

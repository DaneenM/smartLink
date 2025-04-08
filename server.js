const express = require('express');
// const bodyParser = require('body-parser'); // Remove this line
const app = express();
const PORT = 3000;

// app.use(bodyParser.json()); // Replace this line
app.use(express.json()); // Use built-in JSON parser
app.use(express.static('public'));

let links = [];

// 🔗 Create tracking link
app.post('/create-link', (req, res) => {
  const { path, query, target } = req.body;
  const link = `${path}${query ? '?' + query : ''}`;
  links.push({ link, target, logs: [] });
  res.json({ link });
});

// 📍 Log GPS location
app.post('/log-location', (req, res) => {
  const { path, coords } = req.body;
  const matchedLink = links.find(l => l.link.startsWith(path));
  if (matchedLink && matchedLink.logs.length > 0) {
    const lastLog = matchedLink.logs[matchedLink.logs.length - 1];
    lastLog.gps = coords;
    res.json({ success: true });
  } else {
    res.status(404).send('Link not found or no visit to attach location');
  }
});

// ✅ Serve the visual report UI (HTML)
app.get('/report/view/:path', (req, res) => {
  res.sendFile(__dirname + '/public/report.html'); // Ensure this serves the correct file
});

// 📄 JSON data used by report.html
app.get('/api/report/:path', (req, res) => {
  const matchedLink = links.find(l => l.link.startsWith(req.params.path));
  if (matchedLink) {
    res.json({
      link: matchedLink.link,
      destination: matchedLink.target,
      totalClicks: matchedLink.logs.length,
      logs: matchedLink.logs
    });
  } else {
    res.status(404).json({ error: 'Report not found' });
  }
});

// 🚦 Redirect handler + logging
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
    res.redirect(matchedLink.target);
  } else {
    res.status(404).send('Link not found');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 SmartLink Tracker running at http://localhost:${PORT}`);
});

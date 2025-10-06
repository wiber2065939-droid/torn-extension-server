// api/validate.js
const rateLimit = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export default function handler(req, res) {
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const now = Date.now();
  
  // Check rate limit
  if (rateLimit.has(clientIP)) {
    const attempts = rateLimit.get(clientIP);
    if (attempts.count >= MAX_ATTEMPTS && now - attempts.firstAttempt < WINDOW_MS) {
      return res.status(429).json({ 
        error: 'Too many requests. Try again later.' 
      });
    }
    
    if (now - attempts.firstAttempt >= WINDOW_MS) {
      // Reset window
      rateLimit.set(clientIP, { count: 1, firstAttempt: now });
    } else {
      attempts.count++;
    }
  } else {
    rateLimit.set(clientIP, { count: 1, firstAttempt: now });
  }
  
  // Your validation logic here...
export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the request body
    const { factionId } = req.body;

    // Get allowed factions from environment variable
    const allowedFactions = process.env.ALLOWED_FACTIONS
      ? process.env.ALLOWED_FACTIONS.split(',').map(id => id.trim())
      : [];

    // Check if faction is allowed
    const isAllowed = allowedFactions.includes(String(factionId));

    res.status(200).json({ 
      authorized: isAllowed,
      message: isAllowed ? 'Faction authorized' : 'Faction not authorized'
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid request' });
  }
}

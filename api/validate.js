// api/validate.js - Complete working version

// Rate limiting setup
const rateLimit = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Discord webhook function
async function sendDiscordAlert(data) {
  const webhookUrl = process.env.DISCORD_WEBHOOK;
  
  console.log('Discord webhook URL present:', !!webhookUrl);
  
  if (!webhookUrl) {
    console.log('No Discord webhook URL configured');
    return false;
  }
  
  try {
    console.log('Attempting to send Discord alert:', data.title);
    
    const payload = {
      embeds: [{
        title: data.title,
        color: data.color || 0xff0000,
        fields: Object.entries(data)
          .filter(([key]) => key !== 'title' && key !== 'color')
          .map(([key, value]) => ({
            name: key,
            value: String(value),
            inline: true
          })),
        timestamp: new Date().toISOString()
      }]
    };
    
    console.log('Sending to Discord...');
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    console.log('Discord response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Discord webhook failed:', response.status, errorText);
      return false;
    }
    
    console.log('Discord alert sent successfully');
    return true;
    
  } catch (error) {
    console.error('Failed to send Discord alert:', error.message);
    return false;
  }
}

// Main handler
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting check
  const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const now = Date.now();
  
  if (rateLimit.has(clientIP)) {
    const attempts = rateLimit.get(clientIP);
    if (attempts.count >= MAX_ATTEMPTS && now - attempts.firstAttempt < WINDOW_MS) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      
      // Send Discord alert for rate limit
      await sendDiscordAlert({
        title: '⚠️ Rate Limit Exceeded',
        ip: clientIP,
        attempts: attempts.count,
        color: 0xffa500
      });
      
      return res.status(429).json({ 
        error: 'Too many requests. Try again later.' 
      });
    }
    
    if (now - attempts.firstAttempt >= WINDOW_MS) {
      rateLimit.set(clientIP, { count: 1, firstAttempt: now });
    } else {
      attempts.count++;
    }
  } else {
    rateLimit.set(clientIP, { count: 1, firstAttempt: now });
  }

  try {
    // Parse request body
    const { factionId, userId, timestamp } = req.body;

    // Input validation
    if (!factionId || typeof factionId !== 'number' || factionId < 1 || factionId > 999999) {
      console.warn(`Invalid faction ID attempt from IP: ${clientIP}`);
      return res.status(400).json({ error: 'Invalid faction ID' });
    }
    
    if (userId && (typeof userId !== 'number' || userId < 1)) {
      console.warn(`Invalid user ID attempt from IP: ${clientIP}`);
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Check timestamp
    if (timestamp && Math.abs(Date.now() - timestamp) > 60000) {
      return res.status(400).json({ error: 'Request expired' });
    }

    // Get allowed factions
    const allowedFactions = process.env.ALLOWED_FACTIONS
      ? process.env.ALLOWED_FACTIONS.split(',').map(id => id.trim())
      : [];

    // Check authorization
    const isAuthorized = allowedFactions.includes(String(factionId));

    if (!isAuthorized) {
      console.warn(`Unauthorized access attempt: Faction ${factionId} from IP ${clientIP}`);
      
      // Send Discord alert
      await sendDiscordAlert({
        title: '🚫 Unauthorized Access Attempt',
        faction: factionId,
        user: userId || 'Unknown',
        ip: clientIP,
        color: 0xff0000
      });

      return res.status(403).json({ 
        authorized: false,
        message: 'Faction not authorized' 
      });
    }

    // Successful authorization
    console.log(`Authorized access: Faction ${factionId}, User ${userId || 'Unknown'}`);

    // Generate session token
    const sessionToken = Buffer.from(
      `${userId}-${factionId}-${Date.now()}-${Math.random()}`
    ).toString('base64');

    return res.status(200).json({ 
      authorized: true,
      message: 'Faction authorized',
      sessionToken,
      expiresIn: 86400
    });

  } catch (error) {
    console.error('Validation error:', error.message);
    console.error('Full error:', error);
    
    // Send alert for server errors
    await sendDiscordAlert({
      title: '❌ Server Error',
      error: error.message,
      ip: clientIP,
      color: 0x8b0000
    });

    return res.status(500).json({ error: 'Internal server error' });
  }
}

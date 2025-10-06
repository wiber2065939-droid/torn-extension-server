// api/validate.js - Complete version with all security features

// Step 1: Rate limiting setup (at the START)
const rateLimit = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Step 4: Discord webhook function (defined early so it can be used later)
async function sendDiscordAlert(data) {
  const webhookUrl = process.env.DISCORD_WEBHOOK;
  
  console.log('Discord webhook URL present:', !!webhookUrl);
  
  if (!webhookUrl) {
    console.log('No Discord webhook URL configured');
    return;
  }
  
  try {
    console.log('Attempting to send Discord alert:', data.title);
    
    const payload = {
      embeds: [{
        title: data.title,
        color: data.color || 0xff0000,
        fields: Object.entries(data).filter(([key]) => key !== 'title' && key !== 'color')
          .map(([key, value]) => ({
            name: key,
            value: String(value),
            inline: true
          })),
        timestamp: new Date().toISOString()
      }]
    };
    
    console.log('Sending payload to Discord...');
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    console.log('Discord response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Discord webhook failed:', response.status, errorText);
    } else {
      console.log('Discord alert sent successfully');
    }
    
    return response.ok;
    
  } catch (error) {
    console.error('Failed to send Discord alert - Error:', error.message);
    console.error('Full error:', error);
    return false;
  }
}
// Main handler function
export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Step 1: Rate limiting check (BEFORE any processing)
  const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const now = Date.now();
  
  if (rateLimit.has(clientIP)) {
    const attempts = rateLimit.get(clientIP);
    if (attempts.count >= MAX_ATTEMPTS && now - attempts.firstAttempt < WINDOW_MS) {
      // Log the rate limit hit
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      sendDiscordAlert({
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
      // Reset window
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

    // Step 2: Input validation (AFTER rate limiting, BEFORE main logic)
    if (!factionId || typeof factionId !== 'number' || factionId < 1 || factionId > 999999) {
      console.warn(`Invalid faction ID attempt from IP: ${clientIP}`);
      return res.status(400).json({ error: 'Invalid faction ID' });
    }
    
    if (userId && (typeof userId !== 'number' || userId < 1)) {
      console.warn(`Invalid user ID attempt from IP: ${clientIP}`);
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Check if timestamp is recent (prevent replay attacks)
    if (timestamp && Math.abs(Date.now() - timestamp) > 60000) { // 1 minute window
      return res.status(400).json({ error: 'Request expired' });
    }

    // Step 5: Get API secrets (for future use with signatures)
    const apiSecret = process.env.API_SECRET;
    
    // Get allowed factions from environment variable
    const allowedFactions = process.env.ALLOWED_FACTIONS
      ? process.env.ALLOWED_FACTIONS.split(',').map(id => id.trim())
      : [];

    // Check if faction is authorized
    const isAuthorized = allowedFactions.includes(String(factionId));

    // Step 4: Log unauthorized attempts
    if (!isAuthorized) {
      console.warn(`Unauthorized access attempt: Faction ${factionId} from IP ${clientIP}`);
      
      // Send Discord alert for unauthorized attempt
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
    
    // Optional: Send Discord alert for successful authorization (for monitoring)
    // Uncomment if you want to track all successful accesses
    /*
    sendDiscordAlert({
      title: '✅ Successful Authorization',
      faction: factionId,
      user: userId || 'Unknown',
      ip: clientIP,
      color: 0x00ff00
    });
    */

    // Generate a session token (optional, for future use)
    const sessionToken = Buffer.from(
      `${userId}-${factionId}-${Date.now()}-${Math.random()}`
    ).toString('base64');

    res.status(200).json({ 
      authorized: true,
      message: 'Faction authorized',
      sessionToken, // Send this back to the extension
      expiresIn: 86400 // 24 hours in seconds
    });

  } catch (error) {
    console.error('Validation error:', error);
    
    // Log serious errors to Discord
    sendDiscordAlert({
      title: '❌ Server Error',
      error: error.message,
      ip: clientIP,
      color: 0x8b0000
    });

    res.status(500).json({ error: 'Internal server error' });
  }
}

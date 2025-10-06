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

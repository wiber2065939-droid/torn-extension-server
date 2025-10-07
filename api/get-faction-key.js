// api/get-faction-key.js
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionToken, factionId } = req.body;

  // Verify session exists
  if (!sessionToken) {
    return res.status(403).json({ error: 'No session token' });
  }

  // Get faction licenses from environment
  const licenses = JSON.parse(process.env.FACTION_LICENSES || '{}');
  
  // Check if faction is licensed
  if (!licenses[factionId]) {
    console.log(`Faction ${factionId} not licensed`);
    return res.status(403).json({ 
      licensed: false,
      message: 'Your faction does not have a license for this extension'
    });
  }

  // Return the faction's decryption key
  console.log(`Providing key for licensed faction ${factionId}`);
  return res.json({
    licensed: true,
    decryptionKey: licenses[factionId],
    factionId: factionId
  });
}

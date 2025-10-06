export default function handler(req, res) {
  // Enable CORS so your extension can access this
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

  // Get the secret from environment variables
  const apiSecret = process.env.API_SECRET;

  // For now, just echo back success
  res.status(200).json({ 
    message: 'Validation endpoint ready!',
    serverTime: new Date().toISOString(),
    // Never send the actual secret back!
    hasSecret: apiSecret ? true : false
  });
}

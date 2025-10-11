export default function handler(req, res) {
  res.status(200).json({ 
    message: 'goodbye! Your server is working!',
    timestamp: new Date().toISOString()
  });
}

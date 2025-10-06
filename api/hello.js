export default function handler(req, res) {
  res.status(200).json({ 
    message: 'Hello! Your server is working!',
    timestamp: new Date().toISOString()
  });
}

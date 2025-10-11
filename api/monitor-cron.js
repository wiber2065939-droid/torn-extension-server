const MonitoringService = require('./monitoring-service');

export default async function handler(req, res) {
    // Security: Verify request is from Vercel Cron
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        await MonitoringService.monitorAll();
        res.status(200).json({ 
            success: true, 
            timestamp: new Date().toISOString(),
            message: 'Monitoring cycle completed'
        });
    } catch (error) {
        console.error('Cron job error:', error);
        res.status(500).json({ 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

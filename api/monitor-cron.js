import MonitoringService from './monitoring-service.js';
import db from './database.js';

export default async function handler(req, res) {
    console.log('Cron job triggered at:', new Date().toISOString());
    
    const authHeader = req.headers.authorization;
    console.log('Auth header received:', authHeader ? 'YES' : 'NO');
    
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.log('Auth failed');
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        console.log('Starting monitoring service...');
        await MonitoringService.monitorAll();
        console.log('Monitoring completed successfully');
        
        // Cleanup old claims (older than 1 hour)
        console.log('Cleaning up old alert claims...');
        const cleanupResult = await db.query(
            `DELETE FROM alert_claims 
             WHERE claimed_at < NOW() - INTERVAL '1 hour'`
        );
        console.log(`Deleted ${cleanupResult.rowCount} old claims`);
        
        res.status(200).json({ 
            success: true, 
            timestamp: new Date().toISOString(),
            message: 'Monitoring cycle completed',
            cleanedClaims: cleanupResult.rowCount
        });
    } catch (error) {
        console.error('Cron job error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
}

// monitor-cron.js - SIMPLIFIED VERSION
import db from './database.js';

export default async function handler(req, res) {
    console.log('Cron job triggered at:', new Date().toISOString());
    
    const authHeader = req.headers.authorization;
    
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.log('Auth failed');
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        // NOTE: Monitoring service disabled (premium feature - no active factions)
        console.log('Skipping monitoring (no active factions)');
        
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
            message: 'Cleanup completed',
            cleanedClaims: cleanupResult.rowCount
        });
    } catch (error) {
        console.error('Cron job error:', error);
        res.status(500).json({ 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

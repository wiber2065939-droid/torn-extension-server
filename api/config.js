const MonitoringDB = require('./monitoring-db');

// Helper function to check if user is faction leader
// TODO: Replace this with your actual logic
async function isLeader(userId, factionId) {
    // For now, we'll return false - you'll need to integrate with your existing user/faction system
    // You might check your database or call the Torn API
    return false;
}

export default async function handler(req, res) {
    // Get session token from headers
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    // TODO: Validate token and get user info using your existing auth system
    // For now, this is a placeholder
    // const session = await validateSession(token);
    // if (!session) {
    //     return res.status(401).json({ error: 'Invalid token' });
    // }
    // const userId = session.userId;
    // const userFactionId = session.factionId;
    
    // TEMPORARY: Remove this once you integrate with your auth
    const userId = 1; // Placeholder
    const userFactionId = parseInt(req.query.factionId); // Placeholder
    
    const factionId = parseInt(req.query.factionId);
    
    // Verify user belongs to this faction
    if (userFactionId !== factionId) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        // GET - Retrieve configuration
        if (req.method === 'GET') {
            const config = await MonitoringDB.getConfig(factionId);
            const permission = await MonitoringDB.getUserPermission(factionId, userId);
            const leader = await isLeader(userId, factionId);
            
            return res.status(200).json({
                config,
                userPermission: leader ? 'manage' : permission
            });
        }
        
        // PUT - Update configuration
        if (req.method === 'PUT') {
            const { config } = req.body;
            
            // Check permission
            const permission = await MonitoringDB.getUserPermission(factionId, userId);
            const leader = await isLeader(userId, factionId);
            
            if (permission !== 'modify' && permission !== 'manage' && !leader) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
            
            // Validate config
            if (!config.webhooks || !Array.isArray(config.webhooks)) {
                return res.status(400).json({ error: 'Invalid configuration' });
            }
            
            await MonitoringDB.saveConfig(factionId, config, userId);
            return res.status(200).json({ success: true });
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
        
    } catch (error) {
        console.error('Config endpoint error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

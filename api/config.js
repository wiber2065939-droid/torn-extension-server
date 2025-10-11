import MonitoringDB from './monitoring-db.js';

async function isLeader(userId, factionId) {
    return false; // TODO: Implement
}

export default async function handler(req, res) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    const userId = 1; // TODO: Validate token
    const userFactionId = parseInt(req.query.factionId);
    const factionId = parseInt(req.query.factionId);
    
    if (userFactionId !== factionId) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        if (req.method === 'GET') {
            const config = await MonitoringDB.getConfig(factionId);
            const permission = await MonitoringDB.getUserPermission(factionId, userId);
            const leader = await isLeader(userId, factionId);
            
            return res.status(200).json({
                config,
                userPermission: leader ? 'manage' : permission
            });
        }
        
        if (req.method === 'PUT') {
            const { config } = req.body;
            const permission = await MonitoringDB.getUserPermission(factionId, userId);
            const leader = await isLeader(userId, factionId);
            
            if (permission !== 'modify' && permission !== 'manage' && !leader) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
            
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

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
            const permissions = await MonitoringDB.getFactionPermissions(factionId);
            const leader = await isLeader(userId, factionId);
            
            return res.status(200).json({
                permissions,
                canManage: leader
            });
        }
        
        if (req.method === 'PUT') {
            const { targetUserId, permissionLevel } = req.body;
            const leader = await isLeader(userId, factionId);
            
            if (!leader) {
                return res.status(403).json({ error: 'Only leaders can manage permissions' });
            }
            
            if (!['view', 'modify', 'manage'].includes(permissionLevel)) {
                return res.status(400).json({ error: 'Invalid permission level' });
            }
            
            await MonitoringDB.setUserPermission(factionId, targetUserId, permissionLevel, userId);
            return res.status(200).json({ success: true });
        }
        
        if (req.method === 'DELETE') {
            const { targetUserId } = req.query;
            const leader = await isLeader(userId, factionId);
            
            if (!leader) {
                return res.status(403).json({ error: 'Only leaders can manage permissions' });
            }
            
            await MonitoringDB.removeUserPermission(factionId, parseInt(targetUserId));
            return res.status(200).json({ success: true });
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
        
    } catch (error) {
        console.error('Permissions endpoint error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

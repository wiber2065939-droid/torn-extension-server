const MonitoringDB = require('./monitoring-db');

// Helper function to check if user is faction leader
// TODO: Replace this with your actual logic
async function isLeader(userId, factionId) {
    return false; // Placeholder - integrate with your auth system
}

export default async function handler(req, res) {
    // Get session token from headers
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    // TODO: Validate token using your existing auth system
    // TEMPORARY placeholders:
    const userId = 1;
    const userFactionId = parseInt(req.query.factionId);
    
    const factionId = parseInt(req.query.factionId);
    
    // Verify user belongs to this faction
    if (userFactionId !== factionId) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        // GET - Get all permissions
        if (req.method === 'GET') {
            const permissions = await MonitoringDB.getFactionPermissions(factionId);
            const leader = await isLeader(userId, factionId);
            
            return res.status(200).json({
                permissions,
                canManage: leader
            });
        }
        
        // PUT - Update permission
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
        
        // DELETE - Remove permission
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

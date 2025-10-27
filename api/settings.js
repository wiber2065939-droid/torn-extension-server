// api/settings.js - Unified settings endpoint
// Handles: config, permissions, CPR data writes
import db from './database.js';
const { MonitoringDB } = db;

// Permission levels
const PERMISSION = {
    VIEW: 'view',
    MODIFY: 'modify', 
    MANAGE: 'manage'
};

// God mode user ID (Wiber)
const GOD_USER_ID = 2065939;

// Check if user is faction leader/co-leader
async function isLeader(userId, factionId) {
    // God mode for Wiber
    if (userId === GOD_USER_ID) {
        console.log(`🔑 God access granted to user ${userId}`);
        return true;
    }
    
    // TODO: Implement Torn API check for Leader/Co-leader status
    // For now, only Wiber has MANAGE access
    // Later: Fetch faction data and check if userId matches leader_id or co-leader_id
    
    return false;
}

// Get effective permission (leader overrides database permissions)
async function getUserPermission(factionId, userId) {
    const isLeaderUser = await isLeader(userId, factionId);
    if (isLeaderUser) return PERMISSION.MANAGE;
    
    const dbPermission = await MonitoringDB.getUserPermission(factionId, userId);
    return dbPermission || PERMISSION.VIEW;
}

// Validate faction is allowed
function validateFaction(factionId) {
    const allowedFactions = process.env.ALLOWED_FACTIONS?.split(',').map(f => parseInt(f.trim())) || [];
    return allowedFactions.includes(parseInt(factionId));
}

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Parse request (handle both GET and POST)
    const params = req.method === 'GET' ? req.query : req.body;
    const { action, factionId, userId, ...additionalParams } = params;
    
    // Basic validation
    if (!factionId) {
        return res.status(400).json({ error: 'Missing factionId parameter' });
    }
    
    if (!userId) {
        return res.status(400).json({ error: 'Missing userId parameter' });
    }
    
    // Validate faction authorization
    if (!validateFaction(factionId)) {
        console.warn(`Unauthorized faction access attempt: ${factionId} by user ${userId}`);
        return res.status(403).json({ error: 'Faction not authorized' });
    }
    
    try {
        // Get user's permission level
        const userPermission = await getUserPermission(parseInt(factionId), parseInt(userId));
        
        console.log(`Settings API: User ${userId}, Faction ${factionId}, Action: ${action}, Permission: ${userPermission}`);
        
        // Route to appropriate handler based on action
        switch(action) {
            // ==================== CONFIG OPERATIONS ====================
            case 'get_config': {
                // Anyone can read config (but webhook URLs should be masked for non-MANAGE)
                const config = await MonitoringDB.getConfig(parseInt(factionId));
                
                // Mask webhook URLs for non-MANAGE users
                if (userPermission !== PERMISSION.MANAGE && config.webhooks) {
                    config.webhooks = config.webhooks.map(w => ({
                        ...w,
                        url: w.url ? '***HIDDEN***' : null
                    }));
                }
                
                return res.status(200).json({ 
                    success: true,
                    config,
                    userPermission 
                });
            }
            
            case 'update_config': {
                // Requires MODIFY or MANAGE
                if (userPermission === PERMISSION.VIEW) {
                    return res.status(403).json({ 
                        error: 'Insufficient permissions',
                        required: 'MODIFY or MANAGE',
                        current: userPermission
                    });
                }
                
                if (!additionalParams.config) {
                    return res.status(400).json({ error: 'Missing config parameter' });
                }
                
                await MonitoringDB.saveConfig(
                    parseInt(factionId), 
                    additionalParams.config, 
                    parseInt(userId)
                );
                
                console.log(`✅ Config updated by user ${userId}`);
                return res.status(200).json({ success: true });
            }
            
            case 'update_webhook': {
                // Requires MANAGE only
                if (userPermission !== PERMISSION.MANAGE) {
                    return res.status(403).json({ 
                        error: 'Only faction leaders can update webhooks',
                        required: 'MANAGE',
                        current: userPermission
                    });
                }
                
                if (!additionalParams.webhookUrl) {
                    return res.status(400).json({ error: 'Missing webhookUrl parameter' });
                }
                
                // Get current config
                const currentConfig = await MonitoringDB.getConfig(parseInt(factionId));
                
                // Update webhook (supporting single webhook for now)
                currentConfig.webhooks = [{
                    type: 'general',
                    url: additionalParams.webhookUrl
                }];
                
                await MonitoringDB.saveConfig(
                    parseInt(factionId), 
                    currentConfig, 
                    parseInt(userId)
                );
                
                console.log(`✅ Webhook updated by user ${userId}`);
                return res.status(200).json({ success: true });
            }
            
            // ==================== PERMISSION OPERATIONS ====================
            case 'get_permissions': {
                // Anyone can view permissions
                const permissions = await MonitoringDB.getFactionPermissions(parseInt(factionId));
                
                return res.status(200).json({ 
                    success: true,
                    permissions,
                    userPermission,
                    canManage: userPermission === PERMISSION.MANAGE 
                });
            }
            
            case 'grant_permission': {
                // Requires MANAGE
                if (userPermission !== PERMISSION.MANAGE) {
                    return res.status(403).json({ 
                        error: 'Only faction leaders can grant permissions',
                        required: 'MANAGE',
                        current: userPermission
                    });
                }
                
                const { targetUserId, permissionLevel } = additionalParams;
                
                if (!targetUserId || !permissionLevel) {
                    return res.status(400).json({ error: 'Missing targetUserId or permissionLevel' });
                }
                
                if (!['view', 'modify', 'manage'].includes(permissionLevel)) {
                    return res.status(400).json({ 
                        error: 'Invalid permission level',
                        valid: ['view', 'modify', 'manage']
                    });
                }
                
                await MonitoringDB.setUserPermission(
                    parseInt(factionId), 
                    parseInt(targetUserId), 
                    permissionLevel, 
                    parseInt(userId)
                );
                
                console.log(`✅ Permission granted: User ${targetUserId} → ${permissionLevel} by ${userId}`);
                return res.status(200).json({ success: true });
            }
            
            case 'revoke_permission': {
                // Requires MANAGE
                if (userPermission !== PERMISSION.MANAGE) {
                    return res.status(403).json({ 
                        error: 'Only faction leaders can revoke permissions',
                        required: 'MANAGE',
                        current: userPermission
                    });
                }
                
                const { targetUserId } = additionalParams;
                
                if (!targetUserId) {
                    return res.status(400).json({ error: 'Missing targetUserId' });
                }
                
                await MonitoringDB.removeUserPermission(
                    parseInt(factionId), 
                    parseInt(targetUserId)
                );
                
                console.log(`✅ Permission revoked: User ${targetUserId} by ${userId}`);
                return res.status(200).json({ success: true });
            }
            
            // ==================== CPR DATA OPERATIONS ====================
            case 'get_cpr_data': {
                // Anyone can read CPR data
                const cprResult = await db.query(
                    `SELECT crime_name, role_name, cpr_value, last_updated, updated_by_user_id
                     FROM faction_cpr_data
                     WHERE faction_id = $1
                     ORDER BY crime_name, role_name`,
                    [parseInt(factionId)]
                );
                
                console.log(`✅ CPR data retrieved: ${cprResult.rows.length} entries`);
                
                return res.status(200).json({ 
                    success: true,
                    count: cprResult.rows.length,
                    data: cprResult.rows
                });
            }
            
            case 'write_cpr_data': {
                // Requires MODIFY or MANAGE
                if (userPermission === PERMISSION.VIEW) {
                    return res.status(403).json({ 
                        error: 'Insufficient permissions to write CPR data',
                        required: 'MODIFY or MANAGE',
                        current: userPermission
                    });
                }
                
                const { crimeName, roleName, cprValue } = additionalParams;
                
                // Validate required fields
                if (!crimeName || !roleName || cprValue === undefined) {
                    return res.status(400).json({ 
                        error: 'Missing required fields',
                        required: ['crimeName', 'roleName', 'cprValue']
                    });
                }
                
                // Validate CPR value range
                const cprNum = parseFloat(cprValue);
                if (isNaN(cprNum) || cprNum < 0 || cprNum > 100) {
                    return res.status(400).json({ 
                        error: 'CPR value must be between 0 and 100',
                        received: cprValue
                    });
                }
                
                // UPSERT CPR data
                const cprWriteResult = await db.query(
                    `INSERT INTO faction_cpr_data 
                        (faction_id, crime_name, role_name, cpr_value, updated_by_user_id, last_updated)
                     VALUES ($1, $2, $3, $4, $5, NOW())
                     ON CONFLICT (faction_id, crime_name, role_name) 
                     DO UPDATE SET 
                        cpr_value = $4,
                        updated_by_user_id = $5,
                        last_updated = NOW()
                     RETURNING id, last_updated`,
                    [parseInt(factionId), crimeName, roleName, cprNum, parseInt(userId)]
                );
                
                console.log(`✅ CPR Write: ${crimeName} - ${roleName} = ${cprNum} (by user ${userId})`);
                
                return res.status(200).json({ 
                    success: true,
                    id: cprWriteResult.rows[0].id,
                    last_updated: cprWriteResult.rows[0].last_updated,
                    message: 'CPR data saved successfully'
                });
            }
            
            default:
                return res.status(400).json({ 
                    error: 'Unknown action',
                    received: action,
                    valid: [
                        'get_config', 'update_config', 'update_webhook',
                        'get_permissions', 'grant_permission', 'revoke_permission',
                        'get_cpr_data', 'write_cpr_data'
                    ]
                });
        }
        
    } catch (error) {
        console.error('Settings API error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

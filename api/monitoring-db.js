const db = require('./database');

class MonitoringDB {
    // Get configuration for a faction
    static async getConfig(factionId) {
        const result = await db.query(
            'SELECT * FROM faction_config WHERE faction_id = $1',
            [factionId]
        );
        
        if (result.rows.length === 0) {
            // Return default config if none exists
            return {
                factionId,
                version: 1,
                webhooks: [],
                enabledAlerts: { oc: false, pa: false, chain: false, territory: false, armory: false },
                thresholds: { oc_crimes: 10, pa_crimes: 5, chain_warning: 25, chain_timeout_warning: 5 },
                quietHours: null,
                cooldowns: { oc: 60, pa: 60, chain: 15, territory: 30, armory: 120 }
            };
        }
        
        const config = result.rows[0];
        return {
            factionId: config.faction_id,
            version: config.config_version,
            webhooks: JSON.parse(config.webhooks),
            enabledAlerts: JSON.parse(config.enabled_alerts),
            thresholds: JSON.parse(config.thresholds),
            quietHours: config.quiet_hours ? JSON.parse(config.quiet_hours) : null,
            cooldowns: JSON.parse(config.cooldowns),
            lastUpdated: config.last_updated,
            updatedBy: config.updated_by
        };
    }
    
    // Save configuration
    static async saveConfig(factionId, config, userId) {
        await db.query(
            `INSERT INTO faction_config 
            (faction_id, webhooks, enabled_alerts, thresholds, quiet_hours, cooldowns, updated_by, config_version)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (faction_id) DO UPDATE SET
            webhooks = EXCLUDED.webhooks,
            enabled_alerts = EXCLUDED.enabled_alerts,
            thresholds = EXCLUDED.thresholds,
            quiet_hours = EXCLUDED.quiet_hours,
            cooldowns = EXCLUDED.cooldowns,
            updated_by = EXCLUDED.updated_by,
            config_version = faction_config.config_version + 1,
            last_updated = CURRENT_TIMESTAMP`,
            [
                factionId,
                JSON.stringify(config.webhooks),
                JSON.stringify(config.enabledAlerts),
                JSON.stringify(config.thresholds),
                config.quietHours ? JSON.stringify(config.quietHours) : null,
                JSON.stringify(config.cooldowns),
                userId,
                config.version + 1
            ]
        );
    }
    
    // Get user's permission level
    static async getUserPermission(factionId, userId) {
        const result = await db.query(
            'SELECT permission_level FROM faction_permissions WHERE faction_id = $1 AND user_id = $2',
            [factionId, userId]
        );
        return result.rows.length === 0 ? 'view' : result.rows[0].permission_level;
    }
    
    // Get all permissions for a faction
    static async getFactionPermissions(factionId) {
        const result = await db.query(
            `SELECT user_id, permission_level, granted_at
             FROM faction_permissions
             WHERE faction_id = $1
             ORDER BY permission_level DESC, granted_at ASC`,
            [factionId]
        );
        return result.rows;
    }
    
    // Set user permission
    static async setUserPermission(factionId, userId, permissionLevel, grantedBy) {
        await db.query(
            `INSERT INTO faction_permissions (faction_id, user_id, permission_level, granted_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (faction_id, user_id) DO UPDATE SET
             permission_level = EXCLUDED.permission_level,
             granted_by = EXCLUDED.granted_by,
             granted_at = CURRENT_TIMESTAMP`,
            [factionId, userId, permissionLevel, grantedBy]
        );
    }
    
    // Remove user permission
    static async removeUserPermission(factionId, userId) {
        await db.query(
            'DELETE FROM faction_permissions WHERE faction_id = $1 AND user_id = $2',
            [factionId, userId]
        );
    }
    
    // Log alert
    static async logAlert(factionId, alertType, alertData, webhookUrl, success, errorMessage = null) {
        await db.query(
            `INSERT INTO alert_history (faction_id, alert_type, alert_data, webhook_url, success, error_message)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [factionId, alertType, JSON.stringify(alertData), webhookUrl, success, errorMessage]
        );
    }
    
    // Check if alert was recently sent
    static async wasRecentlySent(factionId, alertType, cooldownMinutes) {
        const result = await db.query(
            `SELECT COUNT(*) as count FROM alert_history
             WHERE faction_id = $1 AND alert_type = $2 
             AND sent_at > NOW() - INTERVAL '1 minute' * $3
             AND success = TRUE`,
            [factionId, alertType, cooldownMinutes]
        );
        return parseInt(result.rows[0].count) > 0;
    }
    
    // Get monitoring state
    static async getMonitoringState(factionId) {
        const result = await db.query(
            'SELECT * FROM monitoring_state WHERE faction_id = $1',
            [factionId]
        );
        
        if (result.rows.length === 0) {
            return {
                factionId,
                lastCheck: null,
                currentChainCount: 0,
                checkFailures: 0
            };
        }
        
        const state = result.rows[0];
        return {
            factionId: state.faction_id,
            lastCheck: state.last_check,
            currentChainCount: state.current_chain_count,
            checkFailures: state.check_failures,
            lastError: state.last_error
        };
    }
    
    // Update monitoring state
    static async updateMonitoringState(factionId, updates) {
        const fields = [];
        const values = [];
        let paramCount = 1;
        
        // Build dynamic UPDATE query
        if (updates.lastCheck !== undefined) {
            fields.push(`last_check = $${paramCount++}`);
            values.push(updates.lastCheck);
        }
        if (updates.lastOcReady !== undefined) {
            fields.push(`last_oc_ready = $${paramCount++}`);
            values.push(updates.lastOcReady);
        }
        if (updates.lastPaReady !== undefined) {
            fields.push(`last_pa_ready = $${paramCount++}`);
            values.push(updates.lastPaReady);
        }
        if (updates.currentChainCount !== undefined) {
            fields.push(`current_chain_count = $${paramCount++}`);
            values.push(updates.currentChainCount);
        }
        if (updates.checkFailures !== undefined) {
            fields.push(`check_failures = $${paramCount++}`);
            values.push(updates.checkFailures);
        }
        if (updates.lastError !== undefined) {
            fields.push(`last_error = $${paramCount++}`);
            values.push(updates.lastError);
        }
        
        values.push(factionId);
        
        await db.query(
            `INSERT INTO monitoring_state (faction_id) VALUES ($${paramCount})
             ON CONFLICT (faction_id) DO UPDATE SET ${fields.join(', ')}`,
            values
        );
    }
    
    // Get active factions (those with valid licenses)
    static async getActiveFactions() {
        // TODO: Replace this with your actual query based on your license table structure
        // This is a placeholder - you'll need to adjust based on your database schema
        const r

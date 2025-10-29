import db from './database.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { factionId, alertType, clientId, cooldownMinutes = 60 } = req.body;
    
    console.log(`📋 Claim received: ${alertType}, cooldown: ${cooldownMinutes} minutes`);
    
    if (!factionId || !alertType || !clientId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        // Check if alert was recently sent (respecting cooldown)
        const recentAlert = await db.query(
            `SELECT * FROM alert_claims
             WHERE faction_id = $1 
             AND alert_type = $2
             AND webhook_sent = TRUE
             AND claimed_at > NOW() - INTERVAL '1 minute' * $3
             ORDER BY claimed_at DESC
             LIMIT 1`,
            [factionId, alertType, cooldownMinutes]
        );
        
        if (recentAlert.rows.length > 0) {
            return res.json({
                claimAccepted: false,
                reason: 'cooldown',
                message: 'Alert was recently sent',
                lastSent: recentAlert.rows[0].claimed_at
            });
        }
        
        // Check if there's already an active claim window for this alert
        const activeClaim = await db.query(
            `SELECT * FROM alert_claims
             WHERE faction_id = $1 
             AND alert_type = $2
             AND resolved = FALSE
             AND claimed_at > NOW() - INTERVAL '10 seconds'`,
            [factionId, alertType]
        );
        
        // Stake claim
        const result = await db.query(
            `INSERT INTO alert_claims (faction_id, alert_type, client_id)
             VALUES ($1, $2, $3)
             RETURNING id, claimed_at`,
            [factionId, alertType, clientId]
        );
        
        return res.json({
            claimAccepted: true,
            claimId: result.rows[0].id,
            claimedAt: result.rows[0].claimed_at,
            waitSeconds: 3,
            competingClaims: activeClaim.rows.length,
            message: activeClaim.rows.length > 0 
                ? 'Multiple claims detected - waiting for resolution'
                : 'Claim staked - you may be the winner'
        });
        
    } catch (error) {
        console.error('Claim error:', error);
        return res.status(500).json({ error: 'Failed to stake claim' });
    }
}

// api/alert-winner.js
import db from './database.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { factionId, alertType, clientId } = req.query;
    
    if (!factionId || !alertType || !clientId) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    try {
        // Get all unresolved claims for this alert from the last 10 seconds
        const claims = await db.query(
            `SELECT id, client_id, claimed_at
             FROM alert_claims
             WHERE faction_id = $1 
             AND alert_type = $2
             AND resolved = FALSE
             AND claimed_at > NOW() - INTERVAL '10 seconds'
             ORDER BY claimed_at ASC`,
            [parseInt(factionId), alertType]
        );
        
        if (claims.rows.length === 0) {
            return res.json({
                isWinner: false,
                reason: 'no_active_claims',
                message: 'No active claim window found'
            });
        }
        
        // Determine winner
        let winnerId;
        
        if (claims.rows.length === 1) {
            // Only one claim - they win automatically
            winnerId = claims.rows[0].client_id;
        } else {
            // Multiple claims - check timestamps
            const firstClaimTime = new Date(claims.rows[0].claimed_at).getTime();
            
            // Group claims within 500ms of first claim (nearly simultaneous)
            const simultaneousClaims = claims.rows.filter(claim => {
                const claimTime = new Date(claim.claimed_at).getTime();
                return (claimTime - firstClaimTime) < 500;
            });
            
            if (simultaneousClaims.length === 1) {
                // Clear winner by timestamp
                winnerId = simultaneousClaims[0].client_id;
            } else {
                // Truly simultaneous - pick randomly
                const randomIndex = Math.floor(Math.random() * simultaneousClaims.length);
                winnerId = simultaneousClaims[randomIndex].client_id;
            }
        }
        
        // Mark all claims as resolved and designate winner
        await db.query(
            `UPDATE alert_claims
             SET resolved = TRUE,
                 winner = (client_id = $3)
             WHERE faction_id = $1 
             AND alert_type = $2
             AND resolved = FALSE`,
            [parseInt(factionId), alertType, winnerId]
        );
        
        const isWinner = (winnerId === clientId);
        
        return res.json({
            isWinner,
            winnerId,
            totalClaims: claims.rows.length,
            message: isWinner 
                ? 'You won! Send the alert.'
                : `Another client (${winnerId}) will handle this alert.`
        });
        
    } catch (error) {
        console.error('Winner check error:', error);
        return res.status(500).json({ error: 'Failed to determine winner' });
    }
}

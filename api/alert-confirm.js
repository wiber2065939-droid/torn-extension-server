import db from './database.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { factionId, alertType, clientId, success = true } = req.body;
    
    if (!factionId || !alertType || !clientId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        // Mark webhook as sent (or failed)
        const result = await db.query(
            `UPDATE alert_claims
             SET webhook_sent = $4
             WHERE faction_id = $1 
             AND alert_type = $2
             AND client_id = $3
             AND winner = TRUE
             AND resolved = TRUE
             RETURNING id`,
            [factionId, alertType, clientId, success]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'No winning claim found for this client',
                message: 'You may not have won the claim, or it was already confirmed'
            });
        }
        
        return res.json({
            success: true,
            confirmed: success,
            message: success 
                ? 'Alert confirmation recorded successfully'
                : 'Alert failure recorded'
        });
        
    } catch (error) {
        console.error('Confirm error:', error);
        return res.status(500).json({ error: 'Failed to confirm alert' });
    }
}

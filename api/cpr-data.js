// Combined API endpoint for CPR data operations
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
    const { method } = req;

    // Validate faction is allowed (for both GET and POST)
    const allowedFactions = process.env.ALLOWED_FACTIONS?.split(',').map(f => parseInt(f.trim())) || [];
    
    try {
        // GET: Retrieve all CPR data for a faction
        if (method === 'GET') {
            const { faction_id } = req.query;

            if (!faction_id) {
                return res.status(400).json({ error: 'Missing faction_id parameter' });
            }

            if (!allowedFactions.includes(parseInt(faction_id))) {
                return res.status(403).json({ error: 'Faction not authorized' });
            }

            const query = `
                SELECT crime_name, role_name, cpr_value, last_updated, updated_by_user_id
                FROM faction_cpr_data
                WHERE faction_id = $1
                ORDER BY crime_name, role_name;
            `;

            const result = await pool.query(query, [faction_id]);

            console.log(`✅ Retrieved ${result.rows.length} CPR entries for faction ${faction_id}`);

            return res.status(200).json({ 
                success: true,
                count: result.rows.length,
                data: result.rows
            });
        }

        // POST: Save CPR data
        if (method === 'POST') {
            const { faction_id, crime_name, role_name, cpr_value, user_id } = req.body;

            // Validate required fields
            if (!faction_id || !crime_name || !role_name || cpr_value === undefined) {
                return res.status(400).json({ 
                    error: 'Missing required fields',
                    required: ['faction_id', 'crime_name', 'role_name', 'cpr_value']
                });
            }

            // Validate CPR value range
            if (cpr_value < 0 || cpr_value > 100) {
                return res.status(400).json({ 
                    error: 'CPR value must be between 0 and 100' 
                });
            }

            if (!allowedFactions.includes(parseInt(faction_id))) {
                return res.status(403).json({ error: 'Faction not authorized' });
            }

            // UPSERT: Insert or update if exists
            const query = `
                INSERT INTO faction_cpr_data 
                    (faction_id, crime_name, role_name, cpr_value, updated_by_user_id, last_updated)
                VALUES 
                    ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (faction_id, crime_name, role_name) 
                DO UPDATE SET 
                    cpr_value = $4,
                    updated_by_user_id = $5,
                    last_updated = NOW()
                RETURNING id, last_updated;
            `;

            const values = [faction_id, crime_name, role_name, cpr_value, user_id || null];
            const result = await pool.query(query, values);

            console.log(`✅ Saved CPR: Faction ${faction_id} - ${crime_name} - ${role_name} = ${cpr_value}`);

            return res.status(200).json({ 
                success: true,
                id: result.rows[0].id,
                last_updated: result.rows[0].last_updated,
                message: 'CPR data saved successfully'
            });
        }

        // Method not allowed
        return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });

    } catch (error) {
        console.error('Error in CPR data operation:', error);
        return res.status(500).json({ 
            error: 'Database error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

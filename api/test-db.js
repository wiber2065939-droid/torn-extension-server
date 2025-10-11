import db from './database.js';

export default async function handler(req, res) {
    try {
        // Test database connection
        const result = await db.query('SELECT NOW() as current_time');
        
        // Check if tables exist
        const tables = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        
        return res.status(200).json({
            success: true,
            database_time: result.rows[0].current_time,
            tables: tables.rows.map(t => t.table_name),
            message: 'Database connection successful!'
        });
    } catch (error) {
        // Log the full error server-side (visible in Vercel logs only)
        console.error('Database connection error:', error);
        
        // Return sanitized error to client (no sensitive info)
        return res.status(500).json({
            success: false,
            error: 'Database connection failed',
            message: 'Check server logs for details'
        });
    }
}

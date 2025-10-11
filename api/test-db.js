const db = require('./database');

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
        return res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
}

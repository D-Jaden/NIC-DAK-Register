//===============================
//DESPATCH ROUTES
//===============================

//================
//VARIABLES
//================

require('@dotenvx/dotenvx').config();
const session = require('express-session');
const express = require('express');
const router = express.Router();
const pool = require('../utils/db.js');

const { authenticateJWT } = require('../utils/auth');
const { formatDateForPostgres, formatDateForFrontend } = require('../utils/helpers');

// Save despatch data to database (EXISTING ROUTE - KEEP THIS)
router.post('/save', authenticateJWT, async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { data } = req.body;
        const userId = req.user ? req.user.user_id : null;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized: Please log in first'
            });
        }

        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid data provided'
            });
        }
        
        await client.query('BEGIN');
        
        let savedCount = 0;
        for (const row of data) {
            const query = `
                INSERT INTO despatch (
                    serial_no, 
                    date, 
                    eng_to_whom_sent, 
                    hi_to_whom_sent, 
                    eng_place, 
                    hi_place, 
                    eng_subject, 
                    hi_subject, 
                    eng_sent_by, 
                    hi_sent_by,
                    letter_no,
                    delivery_method,
                    language,
                    zone,
                    user_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            `;
            const pgDate = formatDateForPostgres(row.date);
            const values = [
                row.serialNo || null,
                pgDate,
                row.toWhom || null,
                row.toWhomHindi || null,
                row.place || null,
                row.placeHindi || null,
                row.subject || null,
                row.subjectHindi || null,
                row.sentBy || null,
                row.sentByHindi || null,
                row.letterNo || null,
                row.deliveryMethod || null,
                row.letterLanguage || null,
                row.zone || null,
                userId
            ];
            
            await client.query(query, values);
            savedCount++;
        }
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: `Successfully saved ${savedCount} rows`,
            rowsSaved: savedCount
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(' Database save error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    } finally {
        client.release();
    }
});

//======================================
// NEW ROUTES 
//======================================

// Load user's existing data
router.get('/load', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        const result = await pool.query(
            `SELECT 
                id,
                serial_no, 
                date, 
                eng_to_whom_sent, 
                hi_to_whom_sent, 
                eng_place, 
                hi_place, 
                eng_subject, 
                hi_subject, 
                eng_sent_by, 
                hi_sent_by,
                letter_no,
                delivery_method,
                language,
                zone,
                created_at,
                updated_at
            FROM despatch 
            WHERE user_id = $1 
            ORDER BY serial_no ASC`,
            [userId]
        );
        
        const transformedData = result.rows.map(row => ({
            id: row.id,
            serialNo: row.serial_no,
            date: formatDateForFrontend(row.date),
            toWhom: row.eng_to_whom_sent || '',
            toWhomHindi: row.hi_to_whom_sent || '',
            place: row.eng_place || '',
            placeHindi: row.hi_place || '',
            subject: row.eng_subject || '',
            subjectHindi: row.hi_subject || '',
            sentBy: row.eng_sent_by || '',
            sentByHindi: row.hi_sent_by || '',
            letterNo: row.letter_no || '',
            deliveryMethod: row.delivery_method || '',
            letterLanguage: row.language || '',
            zone: row.zone || '',
            isFromDatabase: true,
            hasChanges: false
        }));
        
        res.json({
            success: true,
            data: transformedData,
            message: `Loaded ${result.rows.length} records`
        });
        
    } catch (error) {
        console.error(' Database load error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }

});

// Save only changed/new rows (optimized save)
router.post('/save-changes', authenticateJWT, async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { changedRows, newRows } = req.body;
        const userId = req.user.user_id;

        await client.query('BEGIN');
        
        let updatedCount = 0;
        let insertedCount = 0;
        const newRowIds = {};

        // Update existing rows
        if (changedRows && changedRows.length > 0) {
            for (const row of changedRows) {
                const updateQuery = `
                    UPDATE despatch SET
                        date = $1,
                        eng_to_whom_sent = $2,
                        hi_to_whom_sent = $3,
                        eng_place = $4,
                        hi_place = $5,
                        eng_subject = $6,
                        hi_subject = $7,
                        eng_sent_by = $8,
                        hi_sent_by = $9,
                        letter_no = $10,
                        delivery_method = $11,
                        language = $12,
                        zone = $13,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $14 AND user_id = $15
                `;
                
                const pgDate = formatDateForPostgres(row.date);
                const updateValues = [
                    pgDate,
                    row.toWhom || null,
                    row.toWhomHindi || null,
                    row.place || null,
                    row.placeHindi || null,
                    row.subject || null,
                    row.subjectHindi || null,
                    row.sentBy || null,
                    row.sentByHindi || null,
                    row.letterNo || null,
                    row.deliveryMethod || null,
                    row.letterLanguage || null,
                    row.zone || null,
                    row.id,
                    userId
                ];
                
                const result = await client.query(updateQuery, updateValues);
                if (result.rowCount > 0) {
                    updatedCount++;
                }
            }
        }

        // Insert new rows
        if (newRows && newRows.length > 0) {
            for (const row of newRows) {
                const insertQuery = `
                    INSERT INTO despatch (
                        serial_no,
                        date,
                        eng_to_whom_sent,
                        hi_to_whom_sent,
                        eng_place,
                        hi_place,
                        eng_subject,
                        hi_subject,
                        eng_sent_by,
                        hi_sent_by,
                        letter_no,
                        delivery_method,
                        language,
                        zone,
                        user_id,
                        created_at,
                        updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING id
                `;
                
                const pgDate = formatDateForPostgres(row.date);
                const insertValues = [
                    row.serialNo,
                    pgDate,
                    row.toWhom || null,
                    row.toWhomHindi || null,
                    row.place || null,
                    row.placeHindi || null,
                    row.subject || null,
                    row.subjectHindi || null,
                    row.sentBy || null,
                    row.sentByHindi || null,
                    row.letterNo || null,
                    row.deliveryMethod || null,
                    row.letterLanguage || null,
                    row.zone || null,
                    userId
                ];
                
                const result = await client.query(insertQuery, insertValues);
                if (result.rows.length > 0) {
                    const newId = result.rows[0].id;
                    newRowIds[row.serialNo - 1] = newId;
                    insertedCount++;
                }
            }
        }

        await client.query('COMMIT');
        
        const totalOperations = updatedCount + insertedCount;
        
        res.json({
            success: true,
            message: `Successfully saved ${totalOperations} changes`,
            updatedCount,
            insertedCount,
            newRowIds,
            totalChanges: totalOperations
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(' Optimized save error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    } finally {
        client.release();
    }
});

//======================================
// DASHBOARD STATS ROUTE
//======================================

router.get('/stats', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { from, to } = req.query;

        // Build date filter clause
        let dateFilter = '';
        const params = [userId];
        if (from && to) {
            params.push(from, to);
            dateFilter = `AND date BETWEEN $2 AND $3`;
        } else if (from) {
            params.push(from);
            dateFilter = `AND date >= $2`;
        } else if (to) {
            params.push(to);
            dateFilter = `AND date <= $2`;
        }

        const base = `FROM despatch WHERE user_id = $1 ${dateFilter}`;

        // Total count
        const totalResult = await pool.query(`SELECT COUNT(*) as total ${base}`, params);
        const total = parseInt(totalResult.rows[0].total);

        // By zone
        const zoneResult = await pool.query(
            `SELECT COALESCE(zone, 'Not Set') as label, COUNT(*) as count ${base} GROUP BY zone ORDER BY count DESC`,
            params
        );

        // By delivery method
        const methodResult = await pool.query(
            `SELECT COALESCE(delivery_method, 'Not Set') as label, COUNT(*) as count ${base} GROUP BY delivery_method ORDER BY count DESC`,
            params
        );

        // By language
        const langResult = await pool.query(
            `SELECT COALESCE(language, 'Not Set') as label, COUNT(*) as count ${base} GROUP BY language ORDER BY count DESC`,
            params
        );

        // Top places (top 10)
        const placeResult = await pool.query(
            `SELECT COALESCE(eng_place, 'Not Set') as label, COUNT(*) as count ${base} AND eng_place IS NOT NULL AND eng_place != '' GROUP BY eng_place ORDER BY count DESC LIMIT 10`,
            params
        );

        // By month — last 12 months
        const monthResult = await pool.query(
            `SELECT TO_CHAR(date, 'Mon YYYY') as label,
                    TO_CHAR(date, 'YYYY-MM') as sort_key,
                    COUNT(*) as count
             FROM despatch
             WHERE user_id = $1
               AND date >= NOW() - INTERVAL '12 months'
             GROUP BY TO_CHAR(date, 'Mon YYYY'), TO_CHAR(date, 'YYYY-MM')
             ORDER BY sort_key ASC`,
            [userId]
        );

        res.json({
            success: true,
            total,
            byZone: zoneResult.rows.map(r => ({ label: r.label, count: parseInt(r.count) })),
            byMethod: methodResult.rows.map(r => ({ label: r.label, count: parseInt(r.count) })),
            byLanguage: langResult.rows.map(r => ({ label: r.label, count: parseInt(r.count) })),
            byPlace: placeResult.rows.map(r => ({ label: r.label, count: parseInt(r.count) })),
            byMonth: monthResult.rows.map(r => ({ label: r.label, count: parseInt(r.count) }))
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    }
});

module.exports = router;

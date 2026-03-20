//===============================
//ACQUIRED ROUTES
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

// Save acquired data to database (BULK SAVE)
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
                INSERT INTO acquired (
                    serial_no, 
                    acquired_date, 
                    acquired_on_date,
                    eng_received_from, 
                    hi_received_from,
                    specific_person,
                    specific_person_hindi,
                    letter_no, 
                    eng_subject, 
                    hi_subject,
                    language,
                    zone,
                    acquisition_method,
                    user_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `;
            const values = [
                row.serialNo || null,
                row.letterDate || row.acquiredDate || null,
                row.acquiredOn || null,
                row.officeName || row.receivedFrom || null,
                row.officeNameHindi || row.receivedFromHindi || null,
                row.specificPerson || null,
                row.specificPersonHindi || null,
                row.letterNo || row.letterNumber || null,  
                row.subject || null,
                row.subjectHindi || null,
                row.letterLanguage || null,
                row.zone || null,
                row.acquisitionMethod || null,
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
// LOAD USER'S EXISTING DATA
//======================================

router.get('/load', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        const result = await pool.query(
            `SELECT 
                id,
                serial_no, 
                acquired_date, 
                acquired_on_date,
                eng_received_from, 
                hi_received_from,
                specific_person,
                specific_person_hindi,
                letter_no, 
                eng_subject, 
                hi_subject,
                language,
                zone,
                acquisition_method,
                created_at,
                updated_at
            FROM acquired 
            WHERE user_id = $1 
            ORDER BY serial_no ASC`,
            [userId]
        );
        
        
        const transformedData = result.rows.map(row => ({
            id: row.id,
            serialNo: row.serial_no,
            // kept both old + new names for JS compatibility
            letterDate: row.acquired_date || '',
            acquiredOn: row.acquired_on_date || '',
            officeName: row.eng_received_from || '',
            officeNameHindi: row.hi_received_from || '',
            specificPerson: row.specific_person || '',
            specificPersonHindi: row.specific_person_hindi || '',
            letterNo: row.letter_no || '', 
            subject: row.eng_subject || '',
            subjectHindi: row.hi_subject || '',
            letterLanguage: row.language || '',
            zone: row.zone || '',
            acquisitionMethod: row.acquisition_method || '',
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

//======================================
// SAVE ONLY CHANGED/NEW ROWS (OPTIMIZED)
//======================================

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
                    UPDATE acquired SET
                        acquired_date = $1,
                        acquired_on_date = $2,
                        eng_received_from = $3,
                        hi_received_from = $4,
                        specific_person = $5,
                        specific_person_hindi = $6,
                        letter_no = $7,
                        eng_subject = $8,
                        hi_subject = $9,
                        language = $10,
                        zone = $11,
                        acquisition_method = $12,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $13 AND user_id = $14
                `;
                
                const updateValues = [
                    row.letterDate || row.acquiredDate || null,
                    row.acquiredOn || null,
                    row.officeName || row.receivedFrom || null,
                    row.officeNameHindi || row.receivedFromHindi || null,
                    row.specificPerson || null,
                    row.specificPersonHindi || null,
                    row.letterNo || row.letterNumber || null,
                    row.subject || null,
                    row.subjectHindi || null,
                    row.letterLanguage || null,
                    row.zone || null,
                    row.acquisitionMethod || null,
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
                    INSERT INTO acquired (
                        serial_no,
                        acquired_date,
                        acquired_on_date,
                        eng_received_from,
                        hi_received_from,
                        specific_person,
                        specific_person_hindi,
                        letter_no,
                        eng_subject,
                        hi_subject,
                        language,
                        zone,
                        acquisition_method,
                        user_id,
                        created_at,
                        updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING id
                `;
                
                const insertValues = [
                    row.serialNo,
                    row.letterDate || row.acquiredDate || null,
                    row.acquiredOn || null,
                    row.officeName || row.receivedFrom || null,
                    row.officeNameHindi || row.receivedFromHindi || null,
                    row.specificPerson || null,
                    row.specificPersonHindi || null,
                    row.letterNo || row.letterNumber || null, 
                    row.subject || null,
                    row.subjectHindi || null,
                    row.letterLanguage || null,
                    row.zone || null,
                    row.acquisitionMethod || null,
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
        console.error(' Optimized acquired save error:', error);
        res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
        });
    } finally {
        client.release();
    }
});
//======================================
// DASHBOARD STATS
//======================================

router.get('/stats', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.user_id;
        let dateFilter = '';
        const params = [userId];
        
        // Add date filtering if provided
        if (req.query.from_date && req.query.to_date) {
            dateFilter = `AND TO_DATE(NULLIF(acquired_date, ''), 'DD/MM/YYYY') >= $2::date AND TO_DATE(NULLIF(acquired_date, ''), 'DD/MM/YYYY') <= $3::date`;
            params.push(req.query.from_date, req.query.to_date);
        }

        // 1. Total Count
        const totalResult = await pool.query(
            `SELECT COUNT(*) FROM acquired WHERE user_id = $1 ${dateFilter}`,
            params
        );
        const total = parseInt(totalResult.rows[0].count);

        // 2. By Language (Hindi, English, Bilingual)
        const byLanguage = await pool.query(
            `SELECT language, COUNT(*) as count 
             FROM acquired 
             WHERE user_id = $1 ${dateFilter} 
             GROUP BY language`,
            params
        );

        // 3. Top 10 Senders (Received From)
        const bySender = await pool.query(
            `SELECT 
                COALESCE(eng_received_from, hi_received_from, 'Unknown') as sender, 
                COUNT(*) as count 
             FROM acquired 
             WHERE user_id = $1 ${dateFilter} 
             GROUP BY sender 
             ORDER BY count DESC 
             LIMIT 10`,
            params
        );

        // 4. By Month (Last 12 Months)
        const monthParams = [userId];
        let monthFilter = '';
        if (req.query.from_date && req.query.to_date) {
            monthFilter = `AND TO_DATE(NULLIF(acquired_date, ''), 'DD/MM/YYYY') >= $2::date AND TO_DATE(NULLIF(acquired_date, ''), 'DD/MM/YYYY') <= $3::date`;
            monthParams.push(req.query.from_date, req.query.to_date);
        } else {
            monthFilter = `AND TO_DATE(NULLIF(acquired_date, ''), 'DD/MM/YYYY') >= CURRENT_DATE - INTERVAL '12 months'`;
        }

        const byMonth = await pool.query(
            `SELECT 
                TO_CHAR(TO_DATE(NULLIF(acquired_date, ''), 'DD/MM/YYYY'), 'YYYY-MM') as month,
                COUNT(*) as count 
             FROM acquired 
             WHERE user_id = $1 AND acquired_date != '' AND acquired_date IS NOT NULL ${monthFilter}
             GROUP BY month 
             ORDER BY month ASC`,
            monthParams
        );

        // 5. Total Letters by Zone
        const byZone = await pool.query(
            `SELECT zone, COUNT(*) as count 
             FROM acquired 
             WHERE user_id = $1 ${dateFilter} 
             GROUP BY zone
             ORDER BY count DESC`,
            params
        );

        // 6. Zone Breakdown by Language
        const zoneByLanguage = await pool.query(
            `SELECT 
                zone,
                language,
                COUNT(*) as count
             FROM acquired
             WHERE user_id = $1 AND zone IS NOT NULL ${dateFilter}
             GROUP BY zone, language
             ORDER BY zone ASC, language ASC`,
            params
        );

        res.json({
            success: true,
            total,
            byLanguage: byLanguage.rows,
            bySender: bySender.rows,
            byMonth: byMonth.rows,
            byZone: byZone.rows,
            zoneByLanguage: zoneByLanguage.rows
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics'
        });
    }
});

module.exports = router;

import { getDB } from '../db.js';
import logger from '../../../utils/logger.js';
import { translateAllTransactions, translateBatch } from '../../../utils/translator.js';

/**
 * POST /api/translations/translate - Start batch translation process
 * GET /api/translations/translate - Get translation status
 */
export default async function handler(req, res) {
    if (req.method === 'GET') {
        return getTranslationStatus(req, res);
    } else if (req.method === 'POST') {
        return startTranslation(req, res);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
}

/**
 * GET handler - Get translation statistics
 */
async function getTranslationStatus(req, res) {
    const client = await getDB();

    try {
        // Get total transaction count
        const totalResult = await client.query(
            'SELECT COUNT(*) as count FROM transactions WHERE name IS NOT NULL'
        );

        // Get translated count
        const translatedResult = await client.query(
            `SELECT COUNT(*) as count FROM transactions
             WHERE translation_status = 'translated'
             AND name_en IS NOT NULL
             AND name_ru IS NOT NULL`
        );

        // Get pending count
        const pendingResult = await client.query(
            `SELECT COUNT(*) as count FROM transactions
             WHERE (translation_status IS NULL OR translation_status = 'pending')
             AND name IS NOT NULL`
        );

        // Get error count
        const errorResult = await client.query(
            `SELECT COUNT(*) as count FROM transactions
             WHERE translation_status = 'error'`
        );

        // Get unique names needing translation
        const uniqueNamesResult = await client.query(
            `SELECT COUNT(DISTINCT name) as count FROM transactions
             WHERE (translation_status IS NULL OR translation_status = 'pending' OR translation_status = 'error')
             AND name IS NOT NULL
             AND TRIM(name) != ''`
        );

        // Get current language setting
        const langResult = await client.query(
            `SELECT value FROM app_settings WHERE key = 'display_language'`
        );

        const currentLanguage = langResult.rows.length > 0
            ? langResult.rows[0].value.replace(/"/g, '')
            : 'he';

        const stats = {
            total: parseInt(totalResult.rows[0].count),
            translated: parseInt(translatedResult.rows[0].count),
            pending: parseInt(pendingResult.rows[0].count),
            errors: parseInt(errorResult.rows[0].count),
            uniquePending: parseInt(uniqueNamesResult.rows[0].count),
            currentLanguage,
            percentageTranslated: totalResult.rows[0].count > 0
                ? Math.round((translatedResult.rows[0].count / totalResult.rows[0].count) * 100)
                : 0
        };

        logger.info({ stats }, 'Translation status retrieved');

        return res.status(200).json(stats);

    } catch (error) {
        logger.error({ error: error.message, stack: error.stack }, 'Failed to get translation status');
        return res.status(500).json({
            error: 'Failed to retrieve translation status',
            details: error.message
        });
    } finally {
        client.release();
    }
}

/**
 * POST handler - Start translation process
 * Body: { batchSize?: number, limit?: number, forceRetranslate?: boolean }
 */
async function startTranslation(req, res) {
    try {
        const {
            batchSize = 20,
            limit = null,
            forceRetranslate = false
        } = req.body || {};

        logger.info({
            batchSize,
            limit,
            forceRetranslate
        }, 'Starting translation process via API');

        // Validate parameters
        if (batchSize && (batchSize < 1 || batchSize > 100)) {
            return res.status(400).json({
                error: 'batchSize must be between 1 and 100'
            });
        }

        if (limit && limit < 1) {
            return res.status(400).json({
                error: 'limit must be greater than 0'
            });
        }

        // Start translation (this could take a while for large datasets)
        const stats = await translateAllTransactions({
            batchSize,
            limit,
            forceRetranslate
        });

        logger.info({ stats }, 'Translation process completed via API');

        return res.status(200).json({
            success: true,
            message: 'Translation completed',
            stats
        });

    } catch (error) {
        logger.error({
            error: error.message,
            stack: error.stack
        }, 'Translation process failed');

        return res.status(500).json({
            success: false,
            error: 'Translation failed',
            details: error.message
        });
    }
}

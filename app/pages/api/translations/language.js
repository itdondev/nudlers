import { getDB } from '../db.js';
import logger from '../../../utils/logger.js';

/**
 * GET /api/translations/language - Get current display language
 * POST /api/translations/language - Set display language
 */
export default async function handler(req, res) {
    if (req.method === 'GET') {
        return getLanguage(req, res);
    } else if (req.method === 'POST') {
        return setLanguage(req, res);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
}

/**
 * GET handler - Get current display language
 */
async function getLanguage(req, res) {
    const client = await getDB();

    try {
        const result = await client.query(
            `SELECT value FROM app_settings WHERE key = 'display_language'`
        );

        const language = result.rows.length > 0
            ? result.rows[0].value.replace(/"/g, '')
            : 'he'; // Default to Hebrew

        return res.status(200).json({ language });

    } catch (error) {
        logger.error({ error: error.message }, 'Failed to get display language');
        return res.status(500).json({
            error: 'Failed to retrieve language setting',
            details: error.message
        });
    } finally {
        client.release();
    }
}

/**
 * POST handler - Set display language
 * Body: { language: 'he' | 'en' | 'ru' }
 */
async function setLanguage(req, res) {
    const client = await getDB();

    try {
        const { language } = req.body;

        // Validate language
        const validLanguages = ['he', 'en', 'ru'];
        if (!language || !validLanguages.includes(language)) {
            return res.status(400).json({
                error: 'Invalid language',
                details: `Language must be one of: ${validLanguages.join(', ')}`
            });
        }

        // Update or insert language setting
        await client.query(
            `INSERT INTO app_settings (key, value, description)
             VALUES ('display_language', $1, 'Display language for transaction names: he (Hebrew), en (English), ru (Russian)')
             ON CONFLICT (key)
             DO UPDATE SET value = $1`,
            [`"${language}"`]
        );

        logger.info({ language }, 'Display language updated');

        return res.status(200).json({
            success: true,
            language
        });

    } catch (error) {
        logger.error({
            error: error.message,
            stack: error.stack
        }, 'Failed to set display language');

        return res.status(500).json({
            error: 'Failed to update language setting',
            details: error.message
        });
    } finally {
        client.release();
    }
}

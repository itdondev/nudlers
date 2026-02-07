import { GoogleGenerativeAI } from "@google/generative-ai";
import { getDB } from '../pages/api/db.js';
import logger from './logger.js';

/**
 * Detects if text contains Hebrew characters
 * @param {string} text - Text to check
 * @returns {boolean} True if text contains Hebrew
 */
export function isHebrew(text) {
    if (!text) return false;
    return /[\u0590-\u05FF]/.test(text);
}

/**
 * Translates a batch of transaction names using Gemini AI
 * @param {Array<string>} names - Array of Hebrew transaction names to translate
 * @param {string} apiKey - Gemini API key
 * @param {string} modelName - Gemini model name (default: gemini-2.5-flash)
 * @returns {Promise<Object>} Object with translations: { name_he: { en: "...", ru: "..." } }
 */
export async function translateBatch(names, apiKey, modelName = 'gemini-2.5-flash') {
    if (!names || names.length === 0) {
        return {};
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Create numbered list for batch translation
    const numberedList = names.map((name, idx) => `${idx + 1}. ${name}`).join('\n');

    const prompt = `You are a Hebrew to English/Russian translator for Israeli bank transaction descriptions.

TASK: Translate the following Hebrew transaction names into BOTH English and Russian.

RULES:
1. Keep merchant names/brands in their original form (e.g., "סופר פארם" → "Super-Pharm", not "Super Pharmacy")
2. For common Israeli stores, use their known English names
3. Translate descriptive parts (e.g., "חנות" → "Store", "סניף" → "Branch")
4. Keep abbreviations and numbers as-is
5. Be concise - don't add explanations
6. Maintain professional financial terminology

TRANSACTION NAMES:
${numberedList}

RESPOND IN THIS EXACT JSON FORMAT (no markdown, no code blocks, just pure JSON):
{
  "translations": [
    { "original": "exact Hebrew text 1", "en": "English translation", "ru": "Russian translation" },
    { "original": "exact Hebrew text 2", "en": "English translation", "ru": "Russian translation" }
  ]
}

EXAMPLES:
- "רמי לוי שיווק השקמה" → en: "Rami Levy Hashikma Branch", ru: "Рами Леви филиал Ашикма"
- "ויקטורי" → en: "Victory", ru: "Виктори"
- "תחנת דלק סונול" → en: "Sonol Gas Station", ru: "Заправка Сонол"

NOW TRANSLATE:`;

    try {
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                maxOutputTokens: 8000,
                temperature: 0.3, // Lower temperature for more consistent translations
            }
        });

        logger.info({ count: names.length, model: modelName }, 'Translating batch of transaction names');

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();

        logger.info({
            responseLength: text.length,
            finishReason: response.candidates?.[0]?.finishReason
        }, 'Translation response received');

        // Parse JSON response
        let jsonText = text;
        // Remove markdown code blocks if present
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?$/g, '').trim();
        }

        const parsed = JSON.parse(jsonText);

        if (!parsed.translations || !Array.isArray(parsed.translations)) {
            throw new Error('Invalid response format from Gemini');
        }

        // Convert array to object keyed by original Hebrew name
        const translationMap = {};
        for (const item of parsed.translations) {
            if (item.original && item.en && item.ru) {
                translationMap[item.original] = {
                    en: item.en,
                    ru: item.ru
                };
            }
        }

        logger.info({ translatedCount: Object.keys(translationMap).length }, 'Batch translation completed');

        return translationMap;

    } catch (error) {
        logger.error({
            error: error.message,
            stack: error.stack,
            namesCount: names.length
        }, 'Translation batch failed');
        throw error;
    }
}

/**
 * Translates all untranslated transactions in the database
 * @param {Object} options - Translation options
 * @param {number} options.batchSize - Number of transactions to translate at once (default: 20)
 * @param {number} options.limit - Maximum number of transactions to translate (default: unlimited)
 * @param {boolean} options.forceRetranslate - Re-translate all transactions even if already translated
 * @returns {Promise<Object>} Statistics about translation process
 */
export async function translateAllTransactions(options = {}) {
    const {
        batchSize = 20,
        limit = null,
        forceRetranslate = false
    } = options;

    const client = await getDB();

    try {
        // Get Gemini settings
        const settingsResult = await client.query(
            'SELECT key, value FROM app_settings WHERE key IN ($1, $2)',
            ['gemini_api_key', 'gemini_model']
        );

        const settings = {};
        for (const row of settingsResult.rows) {
            settings[row.key] = typeof row.value === 'string' ? row.value.replace(/"/g, '') : row.value;
        }

        const apiKey = settings.gemini_api_key || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('Gemini API key not configured. Please add it in App Settings.');
        }

        const modelName = settings.gemini_model || 'gemini-2.5-flash';

        // Get unique transaction names that need translation
        const whereClause = forceRetranslate
            ? "name_original IS NOT NULL"
            : "(translation_status IS NULL OR translation_status = 'pending' OR translation_status = 'error')";

        const limitClause = limit ? `LIMIT ${parseInt(limit)}` : '';

        // Get distinct Hebrew names
        const namesQuery = `
            SELECT DISTINCT name as original_name,
                   COUNT(*) as transaction_count
            FROM transactions
            WHERE ${whereClause}
                  AND name IS NOT NULL
                  AND TRIM(name) != ''
            GROUP BY name
            ORDER BY transaction_count DESC
            ${limitClause}
        `;

        const namesResult = await client.query(namesQuery);
        const uniqueNames = namesResult.rows.map(row => row.original_name);

        if (uniqueNames.length === 0) {
            logger.info('No transactions need translation');
            return {
                totalProcessed: 0,
                successfullyTranslated: 0,
                errors: 0,
                batches: 0
            };
        }

        logger.info({
            uniqueNames: uniqueNames.length,
            batchSize,
            forceRetranslate
        }, 'Starting translation of transactions');

        let totalProcessed = 0;
        let successfullyTranslated = 0;
        let errors = 0;
        let batches = 0;

        // Process in batches
        for (let i = 0; i < uniqueNames.length; i += batchSize) {
            const batch = uniqueNames.slice(i, i + batchSize);
            batches++;

            try {
                logger.info({
                    batch: batches,
                    progress: `${i + 1}-${Math.min(i + batchSize, uniqueNames.length)}/${uniqueNames.length}`
                }, 'Processing batch');

                const translations = await translateBatch(batch, apiKey, modelName);

                // Update database for each translation
                for (const [hebrewName, translation] of Object.entries(translations)) {
                    try {
                        await client.query(
                            `UPDATE transactions
                             SET name_en = $1,
                                 name_ru = $2,
                                 name_original = COALESCE(name_original, name),
                                 translation_status = 'translated'
                             WHERE name = $3`,
                            [translation.en, translation.ru, hebrewName]
                        );
                        successfullyTranslated++;
                        totalProcessed++;
                    } catch (dbError) {
                        logger.error({
                            name: hebrewName,
                            error: dbError.message
                        }, 'Failed to save translation to database');
                        errors++;
                    }
                }

                // Small delay between batches to avoid rate limiting
                if (i + batchSize < uniqueNames.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

            } catch (batchError) {
                logger.error({
                    batch: batches,
                    error: batchError.message
                }, 'Batch translation failed');

                // Mark these transactions as error
                for (const name of batch) {
                    try {
                        await client.query(
                            `UPDATE transactions
                             SET translation_status = 'error'
                             WHERE name = $1`,
                            [name]
                        );
                    } catch (e) {
                        // Ignore DB errors when marking as error
                    }
                }

                errors += batch.length;
                totalProcessed += batch.length;
            }
        }

        const stats = {
            totalProcessed,
            successfullyTranslated,
            errors,
            batches
        };

        logger.info(stats, 'Translation process completed');

        return stats;

    } catch (error) {
        logger.error({ error: error.message, stack: error.stack }, 'Translation process failed');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get translated transaction name based on user's language preference
 * @param {Object} transaction - Transaction object with name, name_en, name_ru, name_original
 * @param {string} language - Language code: 'he', 'en', 'ru'
 * @returns {string} Translated name or original if translation not available
 */
export function getTranslatedName(transaction, language = 'he') {
    if (!transaction) return '';

    switch (language) {
        case 'en':
            return transaction.name_en || transaction.name_original || transaction.name;
        case 'ru':
            return transaction.name_ru || transaction.name_original || transaction.name;
        case 'he':
        default:
            return transaction.name_original || transaction.name;
    }
}

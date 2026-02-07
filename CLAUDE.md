# CLAUDE.md - AI Assistant Guidelines for Nudlers

This document provides comprehensive guidance for AI assistants working with the Nudlers codebase.

## Project Overview

Nudlers is a personal finance management application built with Next.js that aggregates transactions from Israeli banks and credit card companies. It provides expense tracking, budgeting, categorization, and reporting features.

### Core Features
- **Transaction Scraping**: Automated fetching from Israeli banks (Hapoalim, Leumi, Discount, etc.) and credit card providers (Visa Cal, Max, Isracard, Amex)
- **Multi-Language Translation**: AI-powered translation of Hebrew transaction names to English and Russian using Gemini 2.5 Flash
- **Category Management**: Auto-categorization with rules and manual override
- **Budget Tracking**: Monthly budgets with category-level tracking
- **WhatsApp Notifications**: Daily/weekly summary reports via WhatsApp
- **AI Assistant**: Gemini-powered chat for financial insights
- **MCP Integration**: Model Context Protocol support for AI tools

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16+ (Pages Router) |
| Language | TypeScript / JavaScript |
| Database | PostgreSQL |
| UI Framework | Material-UI (MUI) v6 |
| Styling | CSS Variables + MUI ThemeProvider |
| Testing | Vitest |
| Component Dev | Storybook 10 |
| Scraping | israeli-bank-scrapers + Puppeteer |
| Logging | Pino |
| Runtime | Node.js 22+ |

## Directory Structure

```
nudlers/
├── app/                          # Main application directory
│   ├── components/               # React components
│   │   ├── CategoryDashboard/    # Main dashboard with sub-components
│   │   ├── Layout.tsx            # App layout with view switching
│   │   └── *.tsx                 # Feature components
│   ├── config/                   # Configuration modules
│   │   └── resource-config.js    # Resource mode settings (normal/low/ultra-low)
│   ├── context/                  # React contexts
│   │   ├── ThemeContext.tsx      # Light/dark theme management
│   │   ├── StatusContext.tsx     # App status (DB connection, etc.)
│   │   └── DateSelectionContext.tsx
│   ├── pages/                    # Next.js pages
│   │   ├── api/                  # API routes
│   │   │   ├── transactions/     # Transaction CRUD
│   │   │   ├── categories/       # Category management
│   │   │   ├── scrapers/         # Scraper control
│   │   │   ├── reports/          # Financial reports
│   │   │   ├── credentials/      # Encrypted bank credentials
│   │   │   ├── settings/         # App settings
│   │   │   └── db.js             # Database connection pool
│   │   └── index.tsx             # Main page entry
│   ├── scrapers/                 # Bank scraper logic
│   │   ├── core.js               # Shared scraper utilities
│   │   └── CustomVisaCalScraper.js
│   ├── styles/                   # Styling
│   │   ├── design-tokens.css     # CSS custom properties
│   │   ├── theme.ts              # MUI theme configuration
│   │   └── globals.css
│   ├── stories/                  # Storybook stories
│   ├── tests/                    # Test files
│   └── utils/                    # Shared utilities
│       ├── constants.js          # App constants and vendor lists
│       ├── logger.js             # Pino logger instance
│       ├── whatsapp.js           # WhatsApp integration
│       └── transaction_logic.js  # Business logic for transactions
└── .gitignore
```

## Development Commands

All commands should be run from the `app/` directory:

```bash
# Development
npm run dev          # Start dev server on port 6969

# Build & Production
npm run build        # Build for production
npm start            # Start production server

# Testing
npm run test         # Run Vitest tests

# Linting
npm run lint         # Run ESLint

# Storybook
npm run storybook    # Start Storybook on port 6006
```

## Code Conventions

### API Routes

API routes follow a consistent pattern using `createApiHandler`:

```javascript
// pages/api/example/index.js
import { createApiHandler } from "../utils/apiHandler";
import { getDB } from "../db";

const handler = async (req, res) => {
    if (req.method === 'GET') {
        return getHandler(req, res);
    } else if (req.method === 'POST') {
        return postHandler(req, res);
    }
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
};

const getHandler = createApiHandler({
    validate: (req) => {
        // Return error string if invalid, undefined if valid
        if (!req.query.required) return "required is required";
    },
    query: async (req) => ({
        sql: 'SELECT * FROM table WHERE column = $1',
        params: [req.query.param]
    }),
    transform: (result) => result.rows
});

export default handler;
```

### Database Queries

Always use parameterized queries and release clients:

```javascript
import { getDB } from "../db";

const client = await getDB();
try {
    const result = await client.query('SELECT * FROM table WHERE id = $1', [id]);
    // Handle result
} finally {
    client.release();
}
```

### React Components

Components use TypeScript with MUI styling:

```tsx
import React from 'react';
import { Box, Typography } from '@mui/material';

interface ComponentProps {
    title: string;
    onAction?: () => void;
}

const MyComponent: React.FC<ComponentProps> = ({ title, onAction }) => {
    return (
        <Box sx={{
            p: 2,
            backgroundColor: 'var(--n-bg-surface)',
            borderRadius: 'var(--n-radius-lg)'
        }}>
            <Typography variant="h6" color="var(--n-text-primary)">
                {title}
            </Typography>
        </Box>
    );
};

export default MyComponent;
```

### Testing

Tests use Vitest with mocks for database and external services:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../pages/api/db', () => ({
    getDB: vi.fn()
}));

vi.mock('../utils/logger.js', () => ({
    default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

describe('Feature', () => {
    let mockClient;

    beforeEach(() => {
        vi.clearAllMocks();
        mockClient = {
            query: vi.fn(),
            release: vi.fn()
        };
        (getDB as any).mockResolvedValue(mockClient);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should do something', async () => {
        mockClient.query.mockResolvedValue({ rows: [] });
        // Test logic
    });
});
```

## Styling System

### Design Tokens

The app uses CSS custom properties for theming (see `styles/design-tokens.css`):

```css
/* Usage in components */
.element {
    background: var(--n-bg-surface);
    color: var(--n-text-primary);
    border: 1px solid var(--n-border);
    border-radius: var(--n-radius-lg);
    box-shadow: var(--n-shadow-md);
}
```

Key token prefixes:
- `--n-bg-*`: Background colors
- `--n-text-*`: Text colors
- `--n-border*`: Border colors
- `--n-primary-*`: Primary/accent colors
- `--n-space-*`: Spacing values
- `--n-radius-*`: Border radius
- `--n-shadow-*`: Box shadows

### Theme Switching

Themes are controlled via `data-theme` attribute on `<html>`:
- `[data-theme='light']` - Light theme tokens
- `[data-theme='dark']` - Dark theme tokens (default)

## Key Concepts

### Vendors

Vendors are categorized into:
- **Credit Card**: `visaCal`, `max`, `isracard`, `amex`
- **Standard Banks**: `hapoalim`, `leumi`, `mizrahi`, `discount`, etc.
- **Beinleumi Group**: `otsarHahayal`, `beinleumi`, `massad`, `pagi`

### Billing Cycle

Transactions are grouped by billing cycle (configurable start day, default: 10th) rather than calendar month for credit card charges.

### Resource Modes

The app supports different resource configurations via `RESOURCE_MODE` environment variable:
- `normal`: Standard servers (2GB+ RAM)
- `low`: NAS devices (Synology, QNAP)
- `ultra-low`: Raspberry Pi, minimal RAM devices

## Environment Variables

```bash
# Database
NUDLERS_DB_USER=
NUDLERS_DB_HOST=
NUDLERS_DB_NAME=
NUDLERS_DB_PASSWORD=
NUDLERS_DB_PORT=5432

# Encryption
ENCRYPTION_KEY=   # 32-byte hex for credential encryption

# Resource Mode
RESOURCE_MODE=normal  # normal | low | ultra-low

# Optional
GEMINI_API_KEY=       # For AI assistant
LOG_LEVEL=info        # Logging level
```

## Important Files to Know

| File | Purpose |
|------|---------|
| `app/pages/api/db.js` | PostgreSQL connection pool |
| `app/config/resource-config.js` | Resource optimization settings |
| `app/utils/constants.js` | Vendor lists, settings keys, timeouts |
| `app/utils/translator.js` | Translation utilities using Gemini AI |
| `app/scrapers/core.js` | Shared scraper utilities and anti-detection |
| `app/components/Layout.tsx` | Main app layout with view routing |
| `app/context/ThemeContext.tsx` | Theme provider |
| `app/context/LanguageContext.tsx` | Language preference provider |
| `app/styles/design-tokens.css` | CSS custom properties |
| `app/styles/theme.ts` | MUI theme configuration |

## Common Tasks

### Adding a New API Endpoint

1. Create file in `app/pages/api/[feature]/index.js`
2. Use `createApiHandler` pattern for database operations
3. Add validation, query, and transform functions
4. Handle multiple HTTP methods in main handler

### Adding a New Component

1. Create in `app/components/[ComponentName].tsx`
2. Use TypeScript interfaces for props
3. Use MUI components and CSS variables for styling
4. Add to relevant view in `Layout.tsx` if it's a main view

### Adding Tests

1. Create `app/tests/[feature].test.ts`
2. Mock `getDB`, `logger`, and external services
3. Use `beforeEach`/`afterEach` for setup/teardown
4. Test both success and error paths

### Modifying Scraper Behavior

1. Check `app/scrapers/core.js` for shared options
2. Rate-limited vendors need special handling (delays, longer timeouts)
3. Test changes with `npm run scrape` before committing

## Gotchas and Tips

1. **Database connections**: Always call `client.release()` in a `finally` block
2. **Encryption**: Credentials are encrypted at rest; use `encrypt()`/`decrypt()` from `utils/encryption.js`
3. **Scraper timeouts**: Default 90s, configurable via settings or resource mode
4. **Theme colors**: Always use CSS variables (`var(--n-*)`) for theme compatibility
5. **Date handling**: Use `date-fns` for date manipulation
6. **Logging**: Use the `logger` from `utils/logger.js`, not `console.log`
7. **Tests**: Database tests should mock `getDB`, not use real connections

## Storybook

Stories are located in `app/stories/`. Run with `npm run storybook`.

Component stories should follow this pattern:
```tsx
// ComponentName.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import ComponentName from '../components/ComponentName';

const meta: Meta<typeof ComponentName> = {
    title: 'Components/ComponentName',
    component: ComponentName,
};

export default meta;
type Story = StoryObj<typeof ComponentName>;

export const Default: Story = {
    args: {
        // Default props
    },
};
```

## Translation System

### Overview

The app includes an AI-powered translation system that translates Hebrew transaction names from Israeli banks into English and Russian using Gemini 2.5 Flash. This allows users to view their transactions in their preferred language.

### Database Schema

Transaction translations are stored in the `transactions` table:

```sql
-- Translation fields
name_original VARCHAR(100)  -- Original Hebrew name from bank
name_en VARCHAR(100)        -- English translation
name_ru VARCHAR(100)        -- Russian translation
translation_status VARCHAR(20) -- Status: pending, translated, error

-- Indexes for performance
CREATE INDEX idx_transactions_name_en ON transactions(name_en);
CREATE INDEX idx_transactions_name_ru ON transactions(name_ru);
CREATE INDEX idx_transactions_translation_status ON transactions(translation_status);
```

### Language Preference

User language preference is stored in `app_settings`:

```sql
-- Language setting
INSERT INTO app_settings (key, value, description)
VALUES ('display_language', '"he"', 'Display language: he (Hebrew), en (English), ru (Russian)');
```

### Key Components

#### 1. Translation Utility (`app/utils/translator.js`)

Core translation logic using Gemini AI:

```javascript
import { translateBatch, translateAllTransactions, getTranslatedName } from '../utils/translator.js';

// Translate a batch of Hebrew names
const translations = await translateBatch(['חנות אלקטרוניקה', 'סופר פארם'], apiKey);
// Returns: { 'חנות אלקטרוניקה': { en: 'Electronics Store', ru: 'Магазин электроники' } }

// Translate all untranslated transactions
const stats = await translateAllTransactions({
    batchSize: 20,      // Process 20 names at once
    limit: null,        // No limit (translate all)
    forceRetranslate: false  // Skip already translated
});
```

#### 2. Language Context (`app/context/LanguageContext.tsx`)

React context for managing display language:

```tsx
import { useLanguage } from '../context/LanguageContext';

const MyComponent = () => {
    const { language, setLanguage, getTranslatedName } = useLanguage();

    // Get translated name based on current language
    const displayName = getTranslatedName(transaction);
    // language='en' → returns transaction.name_en
    // language='ru' → returns transaction.name_ru
    // language='he' → returns transaction.name_original

    // Change language
    await setLanguage('ru'); // Updates DB and state
};
```

#### 3. API Endpoints

**Translation Management**

```bash
# Get translation statistics
GET /api/translations/translate
Response: {
    total: 1000,
    translated: 850,
    pending: 150,
    errors: 0,
    uniquePending: 45,
    percentageTranslated: 85
}

# Start translation process
POST /api/translations/translate
Body: {
    batchSize: 20,
    limit: null,
    forceRetranslate: false
}
Response: {
    success: true,
    stats: {
        totalProcessed: 45,
        successfullyTranslated: 45,
        errors: 0,
        batches: 3
    }
}
```

**Language Preference**

```bash
# Get current language
GET /api/translations/language
Response: { language: 'en' }

# Set language
POST /api/translations/language
Body: { language: 'ru' }
Response: { success: true, language: 'ru' }
```

### Usage in Components

All components that display transaction names should use `useLanguage`:

```tsx
import { useLanguage } from '../context/LanguageContext';

interface Transaction {
    name: string;           // Original field (Hebrew)
    name_en?: string;       // English translation
    name_ru?: string;       // Russian translation
    name_original?: string; // Preserved original
}

const TransactionDisplay = ({ transaction }: { transaction: Transaction }) => {
    const { getTranslatedName } = useLanguage();

    return (
        <div>
            {getTranslatedName(transaction)}
        </div>
    );
};
```

### Translation Process

1. **User triggers translation** (Settings → Translation → "Translate All Transactions")
2. **System fetches unique Hebrew names** from transactions table
3. **Batch translation via Gemini**:
   - Groups names in batches of 20
   - Sends to Gemini 2.5 Flash with specialized prompt
   - Receives JSON with English and Russian translations
4. **Updates database**:
   - Saves `name_en` and `name_ru`
   - Sets `translation_status = 'translated'`
   - Preserves original in `name_original`
5. **UI updates automatically** via LanguageContext

### Migration

Migration `007_add_translation_fields.sql` adds translation support to existing installations:

```bash
cd app
npm run migrate  # Applies migration automatically
```

### Cost Estimation

Gemini 2.5 Flash pricing (as of 2025):
- ~$0.0001 per transaction translation
- 1,000 transactions ≈ $0.10 USD
- Practically free for personal use

### Important Files

| File | Purpose |
|------|---------|
| `app/utils/translator.js` | Translation logic and batch processing |
| `app/context/LanguageContext.tsx` | React context for language management |
| `app/pages/api/translations/translate.js` | Translation API endpoint |
| `app/pages/api/translations/language.js` | Language preference API |
| `app/migrations/007_add_translation_fields.sql` | Database migration |
| `app/components/SettingsModal.tsx` | Translation settings UI |

### Best Practices

1. **Always use `getTranslatedName()`** instead of accessing `transaction.name` directly
2. **Preserve original Hebrew** in `name_original` field
3. **Batch translations** to minimize API costs and time
4. **Handle missing translations gracefully** - fall back to original if translation unavailable
5. **Update API endpoints** to return all translation fields (`name`, `name_en`, `name_ru`, `name_original`)

## Contributing Guidelines

1. Run `npm run lint` before committing
2. Add tests for new features
3. Use TypeScript for new files when possible
4. Follow existing patterns for consistency
5. Update this CLAUDE.md if adding significant new patterns or conventions

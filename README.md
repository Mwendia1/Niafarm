# NiaFarm - Poultry Farm Management System

A complete, professional poultry farm management system built with Node.js, Express, SQLite, and vanilla JavaScript.

## Features

- **12 Full Modules**: Dashboard, Farm Registration, Flock Management, Feeding, Health & Vaccination, Egg Production, Inventory, Sales & Customers, Expenses & Finances, Reports & Analytics, Notifications, Settings
- **Kenyan Currency**: KSh (KES) as default
- **Offline Mode**: Records saved locally when offline, auto-syncs when reconnected
- **Batch-based**: Every record linked to a specific poultry batch
- **Role-based Access**: Admin, Farm Owner, Farm Manager, Farm Worker, Accountant
- **Real Database**: SQLite with full relational structure
- **Charts & Reports**: Interactive charts, printable reports, CSV export

## Quick Start

### Requirements
- Node.js v16+
- npm

### Installation

```bash
cd Niafarm
npm install
```

### Run

```bash
bash start.sh
```

Then open **http://localhost:3000** in your browser.

Or manually:
```bash
node backend/server.js
```

## First Time Setup

1. Open http://localhost:3000
2. Click **"Register here"** to create your account
3. After login, click **"Farm Registration"** to add your first farm
4. Select your farm from the sidebar dropdown
5. Start adding batches, recording feeds, eggs, health records, etc.

## Project Structure

```
Niafarm/
├── backend/
│   ├── server.js           # Express server entry point
│   ├── db/schema.js        # SQLite database + schema
│   ├── middleware/auth.js  # JWT authentication
│   └── routes/
│       ├── auth.js         # Register, login, profile
│       ├── farms.js        # Farm management
│       ├── flocks.js       # Batch/flock management
│       ├── feeding.js      # Feed records & schedules
│       ├── health.js       # Health & vaccination
│       ├── eggs.js         # Egg production
│       ├── inventory.js    # Inventory management
│       ├── sales.js        # Sales & customers
│       ├── expenses.js     # Expenses & income
│       ├── reports.js      # Dashboard & reports
│       └── notifications.js# Notifications
├── frontend/
│   ├── index.html          # Main SPA
│   ├── css/style.css       # All styles
│   └── js/
│       ├── app.js          # API client, state, utilities
│       ├── auth.js         # Login/register logic
│       ├── dashboard.js    # Dashboard charts
│       ├── farms.js        # Farm CRUD
│       ├── flocks.js       # Batch management
│       ├── feeding.js      # Feeding records
│       ├── health.js       # Health & vaccination
│       ├── eggs.js         # Egg production
│       ├── inventory.js    # Inventory
│       ├── sales.js        # Sales & receipts
│       ├── expenses.js     # Finances
│       ├── reports.js      # Report generation
│       ├── notifications.js# Notifications
│       ├── settings.js     # Profile & settings
│       └── main.js         # Page router & init
├── start.sh                # Quick start script
└── package.json
```

## User Roles

| Role | Access |
|------|--------|
| Admin | Full system access |
| Farm Owner | All farm modules + user management |
| Farm Manager | Daily operations (no financial settings) |
| Farm Worker | Data entry only |
| Accountant | Financial records & reports |

## Database

SQLite database stored at `backend/db/niafarm.db`. All tables are auto-created on first run.

## Offline Support

The system detects when you go offline and queues any write operations. When internet is restored, queued records are automatically synced to the server.

# Hospital Bed Availability & Management System

A robust, secure, and real-time application designed to manage hospital bed inventories, staff workflows, document verifications, and external HIS integrations. This project consists of a high-performance backend API built with FastAPI and a modern frontend single-page application built with React, Vite, and Tailwind CSS.

---

## 🚀 Key Features

### 🔒 Security & Authentication
- **Multi-Factor Authentication (MFA):** Supports MFA setups (TOTP) utilizing encrypted secret keys.
- **JWT Session Management:** Secure token rotation via Access and Refresh Tokens with a 401 automatic refresh handler.
- **Role-Based Access Control (RBAC):** Distinct dashboards and features for `Admin` and `Hospital Staff` roles.
- **Secure Middleware:** Implements custom security headers (X-Content-Type-Options, Content-Security-Policy, etc.), rate limiting, and request logging.
- **Flexible Secret Management:** Ready-to-go integrations with local environment configurations, HashiCorp Vault, or AWS Secrets Manager.

### ⚡ Real-Time Synchronization & HIS Integration
- **Live Bed Tracking:** Real-time bed inventory updates broadcasted via WebSockets.
- **Scalable Pub/Sub Broker:** Utilizes Redis Pub/Sub for multi-instance production environments, falling back gracefully to in-memory broadcasting.
- **HIS (Hospital Information System) Sync API:** Secure, automated external integration endpoint using cryptographically signed requests (SHA-256 API key signature).

### 🛠️ Data & Resilience
- **Automated Database Seeding:** Checks and seeds essential bed categories (`ICU`, `GENERAL`, `EMERGENCY`, `VENTILATOR`, `ISOLATION`, `PEDIATRIC`) on boot.
- **Disaster Recovery Drill:** Fully functional automated recovery validation script (`backup_and_restore_drill.py`) to test database backups, restore tables, and verify 100% data integrity with calculated RTO (Recovery Time Objective).
- **Comprehensive Audit Trail:** Logs state changes, inventory modifications, and administrative updates.

---

## 📁 Project Structure

```
HOSPITAL_BED_MANAGEMENT/
├── backend/                  # FastAPI Backend application
│   ├── app/
│   │   ├── api/              # API Route endpoints (v1 auth, users, hospitals, admin, etc.)
│   │   ├── core/             # Configuration, logging, database connections
│   │   ├── middleware/       # Rate-limiting, security headers, request logging
│   │   ├── models/           # SQLAlchemy DB Models (Base, User, Hospital, BedInventory, AuditLog, etc.)
│   │   ├── schemas/          # Pydantic Schemas for request/response validation
│   │   ├── services/         # Business logic layer (sync, backup, verification)
│   │   └── websocket/        # Real-time WebSocket manager (Redis Pub/Sub)
│   ├── alembic/              # Database migration configuration
│   ├── requirements.txt      # Python dependencies
│   ├── verify_db.py          # Database setup and default data seeding
│   ├── backup_and_restore_drill.py  # DR backup & recovery validation script
│   └── test_*.py             # Suite of unit and integration tests (pytest)
│
└── frontend/                 # React Frontend application
    ├── src/
    │   ├── context/          # React Context providers (Auth context)
    │   ├── layouts/          # Reusable page layouts
    │   ├── pages/            # Page components (Dashboards, Login, Register, etc.)
    │   ├── routes/           # Routing configuration
    │   ├── services/         # API client wrapping fetch calls with token rotation
    │   └── index.css / App.css
    ├── package.json          # Frontend packages & scripts
    └── vite.config.js        # Vite build tool config
```

---

## 🛠️ Installation & Setup

### Prerequisites
Make sure you have the following installed:
- Python 3.10+
- Node.js (v18+)
- MySQL or MariaDB instance
- Redis Server (optional, falls back to in-memory broadcast)

---

### 1. Backend Setup

1. **Navigate to the Backend Directory:**
   ```bash
   cd backend
   ```

2. **Create a Virtual Environment & Activate it:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Variables Configuration:**
   Copy the example environment file and configure your database and system credentials:
   ```bash
   cp .env.example .env
   ```
   *Edit the `.env` file to set your database URL (`DATABASE_URL`), Redis URL (`REDIS_URL`), secrets provider configurations, and authentication key values.*

5. **Initialize Database & Seed Data:**
   Run the verification and seed script. This connects to your database, creates all schemas, and seeds default bed types:
   ```bash
   python verify_db.py
   ```

6. **Start the FastAPI Server:**
   ```bash
   uvicorn app.main:app --reload
   ```
   *The backend server will run at http://localhost:8000. Open http://localhost:8000/docs in your browser to view the interactive Swagger UI API documentation.*

---

### 2. Frontend Setup

1. **Navigate to the Frontend Directory:**
   ```bash
   cd ../frontend
   ```

2. **Install Packages:**
   ```bash
   npm install
   ```

3. **Run Development Server:**
   ```bash
   npm run dev
   ```
   *The frontend application will boot up, typically at http://localhost:5173.*

---

## 🧪 Running Tests

To run the suite of backend unit and integration tests (covering Auth, MFA, Bed Updates, Syncing, Observability, and Documents):
```bash
cd backend
pytest -v
```

---

## 🛟 Disaster Recovery Drill

The project contains a performance evaluation tool to execute database backup and recovery drills. It evaluates the RTO (Recovery Time Objective) and verifies 100% data integrity before and after restoring:

```bash
cd backend
python backup_and_restore_drill.py
```
This script will:
1. Capture database statistics.
2. Dump all rows across dependent database models safely to a local JSON backup file (`backup_export.json`).
3. Clean all active database tables (disabling foreign keys temporarily).
4. Restore data from the backup file in correct hierarchical order.
5. Benchmark RTO performance and validate that counts match exactly, confirming zero data loss.

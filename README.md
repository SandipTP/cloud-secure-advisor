# 🛡️ CloudSecure Advisor

**CloudSecure Advisor** is an automated Cloud Security Posture Management (CSPM) platform and infrastructure-as-code configuration scanner. It detects security misconfigurations, overly permissive IAM access, exposed network perimeters, unencrypted storage, and secret leaks across AWS environments, mapping all findings directly to **NIST SP 800-53**, **CIS AWS Benchmark**, and **SOC 2 Type II** controls.

---

## 🌟 Key Features

- **Dual-Engine Security Scanner**:
  - **Structured AST Engine**: Deep structural analysis of AWS IAM policies, S3 bucket policies, and VPC Security Groups using Python AST parsing (`iam_rules.py`, `s3_rules.py`, `sg_rules.py`, `config_validator.py`). Accurately evaluates `Effect: "Allow"` vs `Effect: "Deny"` to eliminate false positives on security-hardening policies (e.g., KMS-enforced deny statements).
  - **Multi-Format Support**: Native parsing for both **JSON** and **YAML** (`.json`, `.yaml`, `.yml`) cloud configuration files.
  - **Pattern Fallback**: Comprehensive supplemental rule coverage for public RDS instances, disabled CloudTrail logging, plaintext credentials (`AKIA`), deprecated TLS versions, and unencrypted volumes.
- **Enterprise Compliance Framework Alignment**:
  - **NIST SP 800-53 Rev. 5**: Automated mapping to AC-3, AC-6, AC-17, AU-2, AU-12, CP-9, IA-2, IA-5, SC-7, SC-8, SC-13, and SC-28.
  - **CIS AWS Foundations Benchmark**: Category-level posture evaluation across IAM, S3, Logging, Networking, Database, and Encryption.
  - **SOC 2 Type II (Estimated Mapping)**: Alignment across Trust Services Criteria (CC6.1 Logical Access, CC6.2 Credential Management, CC6.3 Least Privilege, CC6.6 Boundary Protection, CC6.7 Cryptography, CC7.1 Monitoring, CC7.2 Audit Logging).
- **AI Executive Summary Engine**:
  - Integrates with Groq Cloud (Llama 3.3 70B Versatile) to generate executive-ready summaries containing risk assessment, threat analysis, actionable remediation steps, and long-term prevention strategies rendered in a formatted `AISummaryPanel`.
- **Export & Reporting**:
  - Export full finding reports to CSV or formatted print-ready PDF with severity-coded badges and NIST references.
- **Hardened Security Architecture**:
  - Password hashing with salted **bcrypt**.
  - Token-based authentication using **Flask-JWT-Extended**.
  - Cryptographically secure password reset codes using `secrets`, stored hashed with SHA-256 in SQLite, with brute-force rate-limiting and automatic TTL expiration.
  - Unique filesystem storage naming preventing file overwrite collisions.
  - Strict file-extension validation on all upload endpoints.
  - Werkzeug debugger secured against public interface exposure.

---

## 📁 Repository Structure

```
cloud-secure-advisor/
├── backend/
│   ├── app.py                     # Main Flask application and REST endpoints
│   ├── rules.json                 # Supplemental pattern rules
│   ├── rules/
│   │   ├── iam_rules.py           # Structured IAM policy rules (least privilege, admin access)
│   │   ├── s3_rules.py            # Structured S3 bucket policy rules (public access)
│   │   └── sg_rules.py            # Structured Security Group rules (port 22, 3389, 80, 0.0.0.0/0)
│   ├── ingest/
│   │   └── parser.py              # Unified JSON & YAML config parser & rule orchestrator
│   ├── validate/
│   │   └── config_validator.py    # IAM policy schema validator
│   ├── sample_configs/            # Sample misconfigured and secure configurations
│   ├── tests/
│   │   └── test_api.py            # Automated test suite
│   ├── requirements.txt           # Python dependencies
│   └── .env.example               # Backend configuration example
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Main dashboard, router, scanner, history, and compliance
│   │   ├── FindingsPage.jsx       # Detailed findings view and AISummaryPanel
│   │   ├── LoginPage.jsx          # Sign-in, registration, and password reset flows
│   │   └── apiConfig.js           # Centralized API endpoint configuration
│   ├── package.json               # Frontend dependencies
│   └── vite.config.js             # Vite configuration
├── requirements.txt               # Root Python dependencies
├── .env.example                   # Root environment template
└── README.md                      # Platform documentation
```

---

## 🚀 Quick Start Guide

### 1. Backend Setup

1. **Navigate to the backend directory and activate a Python virtual environment**:
   ```bash
   cd backend
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On Linux / macOS:
   source venv/bin/activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to configure your keys (e.g. `FLASK_SECRET_KEY`, `JWT_SECRET_KEY`, `GROQ_API_KEY`, `SENDGRID_API_KEY`).

4. **Run the backend server**:
   ```bash
   python app.py
   ```
   The API will start at `http://127.0.0.1:5000`. Database tables (`users`, `uploads`, `findings`, `password_reset_tokens`) are created automatically on launch.

---

### 2. Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

3. **Build for production**:
   ```bash
   npm run build
   ```

---

## 🧪 Running Automated Tests

Run the test suite using Python:

```bash
python backend/tests/test_api.py
```

The test suite validates:
- User signup and login authentication flow.
- Batch upload storing NIST references and remediation controls.
- Upload deletion (`DELETE /history/<id>`) and orphan cascade cleanup.
- False positive prevention on KMS-enforced S3 deny policies (`secure_s3_kms_deny.json`).
- YAML configuration scanning and rule evaluation.
- Backend file type restriction rejecting non-cloud config files.
- Cryptographic password reset token generation, expiration, and rate-limiting.

---

## 📡 REST API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/signup` | None | Register a new user account |
| `POST` | `/login` | None | Authenticate and obtain JWT access token |
| `POST` | `/forgot-password` | None | Request a secure 6-digit password reset code |
| `POST` | `/reset-password` | None | Verify code and update user password |
| `POST` | `/upload` | Bearer | Scan single or multiple config files (`.json`, `.yaml`, `.yml`) |
| `POST` | `/upload/batch` | Bearer | Batch upload and scan multiple files |
| `GET` | `/history` | Bearer | Retrieve scan history and scores for authenticated user |
| `DELETE`| `/history/<upload_id>` | Bearer | Delete a scan and all associated findings |
| `GET` | `/findings` | Bearer | Retrieve all findings across all uploads for dashboard metrics |
| `GET` | `/findings/<upload_id>` | Bearer | Retrieve all findings for a specific upload |
| `POST` | `/findings/<upload_id>/ai-summary` | Bearer | Generate Groq Llama 3.3 AI Executive Summary |

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


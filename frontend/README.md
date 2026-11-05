# CloudSecure Advisor - Frontend

Modern, cybersecurity-grade React dashboard built with Vite, Tailwind-style design tokens, and SVG data visualizations for cloud security posture analysis.

## Features

- **Security Posture Dashboard**: Real-time KPI metrics, interactive severity mix donut chart, category breakdown bar chart, and average security score gauge.
- **Multi-File & Drag-and-Drop Scanner**: Scan multiple AWS cloud configurations simultaneously (supports `.json`, `.yaml`, `.yml`).
- **Scan History**: Full historical log of scans with search, score badges, details routing, and one-click deletion.
- **Compliance Alignment**: Evaluates findings against NIST SP 800-53 controls, CIS AWS Benchmark categories, and SOC 2 Type II common criteria.
- **Interactive AI Executive Summary**: Rendered via `AISummaryPanel` with structured sections for Executive Risk Level, Key Threats, Immediate Action Items, and Prevention Strategies.
- **Report Exports**: Instant one-click export to CSV and formatted printable PDF.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or pnpm

### Installation

```bash
cd frontend
npm install
```

### Environment Configuration

By default, the frontend connects to the backend at `http://127.0.0.1:5000`. To customize the API endpoint, create a `.env.local` file:

```env
VITE_API_URL=http://127.0.0.1:5000
```

### Development Server

```bash
npm run dev
```

The Vite dev server will start at `http://localhost:5173`.

### Production Build

```bash
npm run build
```

Build outputs are generated in `frontend/dist/`.

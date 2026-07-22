# Spatiotemporal AI Disaster Resilience Framework for Fire & Smoke Surveillance

## 1. Project Overview

This project is a **production-ready, multi-tenant AI disaster monitoring framework** designed for **early fire and smoke detection** in critical infrastructure. It combines:

- **Edge AI** (spatiotemporal deep learning model for fire/smoke),
- **IoT sensors** (gas and temperature),
- A **MERN web platform** (React, Node.js, Express, MongoDB),
- **JWT-based authentication** with **role-based access control**, and
- **Socket.io** for real-time monitoring and alerting.

The system is built to be **cloud-deployable**, **modular**, and **scalable**, suitable both as a **final year project (FYP)** and as a foundation for a **real-world SaaS platform**.

---

## 2. Problem Statement

Conventional fire detection systems (e.g. smoke alarms, heat detectors) are:

- Often **slow to respond** in large or open environments,
- Susceptible to **false alarms** (fog, steam, welding, dust, etc.),
- Limited to **single-modality sensing** (smoke or temperature only),
- Hard to **monitor at scale** across buildings, campuses, or cities.

There is a growing need for an **intelligent, multi-modal, real-time fire and smoke surveillance system** that:

- Uses **video analytics (CCTV)** + **environmental sensors** (gas, temperature),
- Generates **structured alerts** with lifecycle tracking,
- Enforces **strict access control** across multiple organizations,
- Is **deployable on edge devices** as well as in the cloud.

---

## 3. Proposed Solution

The system provides a **Spatiotemporal AI Disaster Resilience Framework** with:

- A **3D CNN + lightweight Transformer** model for **fire & smoke detection** on video,
- **Temporal validation** & **confidence smoothing** to reduce false alarms,
- Architectural hooks for **sensor fusion** (gas + temperature),
- A **multi-tenant, role-based web portal** for monitoring and administration,
- A robust **alert lifecycle** (ACTIVE → ACKNOWLEDGED → RESOLVED / FALSE_ALARM),
- **Real-time dashboards** using Socket.io,
- A codebase structured for **scalability, security, and cloud deployment**.

---

## 4. System Architecture

### 4.1 High-Level Components

- **Edge AI Layer**
  - Raspberry Pi / edge device with CCTV feed.
  - Spatiotemporal fire & smoke model (TensorFlow / TensorFlow.js).
  - Optional integration with Arduino-based **gas** and **temperature** sensors.

- **Backend (Node.js + Express + MongoDB)**
  - Multi-tenant data model (organizations, cameras, users, subscriptions).
  - REST APIs for auth, organizations, cameras, alerts, notifications, etc.
  - Alert engine: lifecycle, audit trail, stats, Socket.io broadcasting.
  - Role-based authorization and rate limiting.

- **Frontend (React + Vite + Redux Toolkit)**
  - Dashboards for **SUPER_ADMIN**, **ORG_ADMIN**, and **OPERATOR**.
  - Live camera grid with **TensorFlow.js inference** and confidence overlays.
  - Real-time alerts, notifications, and analytics.

- **Real-Time Layer (Socket.io)**
  - Organization-scoped rooms (`org:<organizationId>`) for alerts and camera status.
  - Client-side `socketService` integrates with Redux to keep UI live.

### 4.2 Logical Architecture Diagram (Textual)

- **Edge Device**
  - Captures frames from CCTV.
  - Runs spatiotemporal model → `fireConfidence`, `smokeConfidence`.
  - Sends structured detections / alerts to backend via HTTPS or WebSocket.

- **Backend**
  - Validates organization and camera.
  - Applies **alert logic & lifecycle**.
  - Persists events to MongoDB.
  - Broadcasts via **Socket.io** to relevant org / operators.
  - Triggers **emails / notifications**.

- **Frontend**
  - Authenticates with JWT.
  - Subscribes to org rooms via Socket.io.
  - Renders dashboards, camera grid, alerts, and analytics per role.

---

## 5. Technology Stack

- **Frontend**
  - React 18 + Vite
  - Redux Toolkit + React Redux
  - Tailwind CSS
  - Recharts (analytics)
  - Socket.io Client
  - TensorFlow.js (`@tensorflow/tfjs`)

- **Backend**
  - Node.js + Express
  - MongoDB + Mongoose
  - JWT Authentication
  - Socket.io
  - Nodemailer (email notifications)
  - Helmet, CORS, Express Rate Limit

- **AI / ML**
  - Python 3 (for training)
  - TensorFlow / Keras
  - TensorFlow.js Converter

- **Hardware**
  - Raspberry Pi with camera module (CCTV ingestion)
  - Arduino microcontroller with gas and temperature sensors

---

## 6. Project Structure

At a high level:

```text
.
├─ backend/                # Node.js + Express API & Socket.io server
│  ├─ config/              # DB connection
│  ├─ controllers/         # Route controllers (auth, alerts, cameras, etc.)
│  ├─ middleware/          # auth, validation, error handling, audit logging
│  ├─ models/              # Mongoose models (User, Organization, Camera, Alert, ...)
│  ├─ routes/              # Express routers
│  ├─ sockets/             # Socket.io connection handling
│  └─ server.js            # App entrypoint
│
├─ frontend/               # React + Vite frontend
│  ├─ src/
│  │  ├─ pages/            # Role-based pages (superadmin, orgadmin, operator)
│  │  ├─ layouts/          # Shared layouts per role
│  │  ├─ components/       # Shared UI components
│  │  ├─ services/         # Axios API client, Socket service
│  │  ├─ store/            # Redux Toolkit slices (auth, alerts, cameras, notifications)
│  │  ├─ hooks/            # Custom hooks (e.g., useFireSmokeDetection)
│  │  └─ main.jsx, App.jsx # App bootstrap & routing
│  └─ public/
│     └─ models/           # TF.js model assets (model.json + shards)
│
├─ ml/                     # Python training & TF.js conversion utilities
│  ├─ train_fire_smoke_model.py
│  └─ convert_to_tfjs.md
│
├─ .env                    # Environment configuration (local)
├─ package.json            # Root scripts to run backend + frontend
└─ README.md               # This document
```

---

## 7. Installation Guide

### 7.1 Prerequisites

- Node.js 18+ and npm
- MongoDB (local or remote)
- Python 3.9+ (for training the model)
- Git (optional, for version control)

### 7.2 Environment Setup

1. Duplicate `.env` and adjust values for your environment:

   - `PORT` – backend port (default `5000`)
   - `FRONTEND_URL` – usually `http://localhost:5173`
   - `MONGODB_URI` – MongoDB connection string
   - JWT secrets and expiry
   - Email settings for alert notifications
   - Socket.io CORS origin

2. Install backend + frontend dependencies (from project root):

```bash
npm run install-all
```

This runs:

- `npm install` in root (backend dependencies)
- `cd frontend && npm install` for the React app

### 7.3 Running in Development

From the project root:

```bash
npm run dev
```

This starts:

- Backend server at `http://localhost:5000`
- Frontend (Vite dev) at `http://localhost:5173`

---

## 8. AI Model Setup

### 8.1 Model Architecture (ML Phase)

The Python script `ml/train_fire_smoke_model.py` implements a **spatiotemporal model**:

- **3D CNN stem** for spatio-temporal feature extraction,
- **Residual 3D blocks** for stable training,
- **Spatial attention** over feature maps,
- **Temporal transformer encoder** with **positional encoding**,
- **Positional Gating Unit (PGU)** for time-dependent gating,
- Multi-head outputs:
  - `fire_conf` (fire confidence, 0–1),
  - `smoke_conf` (smoke confidence, 0–1),
  - `binary` (fire/smoke presence, 0–1).

The architecture is designed to be **lightweight enough** for edge deployment, with configurable input size and sequence length.

### 8.2 Training (Offline)

In a Python virtual environment:

```bash
cd ml
pip install -r requirements.txt  # if you create one
python train_fire_smoke_model.py --epochs 10 --batch_size 8
```

This:

- Constructs the model with the desired configuration,
- Trains on your fire/smoke datasets (extend the script’s dataset loader),
- Exports a TensorFlow **SavedModel** under `ml_output/saved_model`.

> **Note:** For a real deployment, replace the dummy dataset in the script with actual fire/smoke video datasets and negative samples (fog, clouds, fire-colored objects, etc.).

### 8.3 TF.js Conversion

Use the guide in `ml/convert_to_tfjs.md`. Typical command:

```bash
tensorflowjs_converter \
  --input_format=tf_saved_model \
  --output_format=tfjs_graph_model \
  --quantization_bytes=2 \
  ./ml_output/saved_model \
  ./frontend/public/models/fire_smoke_tfjs
```

This creates:

- `frontend/public/models/fire_smoke_tfjs/model.json`
- weight shard `.bin` files

These are then served directly by the frontend.

---

## 9. TensorFlow.js Integration Guide

### 9.1 Frontend Model Loading

The frontend uses **TensorFlow.js** with the **WebGL backend**:

- A shared loader is implemented in a custom hook: `src/hooks/useFireSmokeDetection.js`.
- The model is loaded once and cached across components:
  - URL from `VITE_TFJS_MODEL_URL` or default `/models/fire_smoke_tfjs/model.json`.

### 9.2 Live Inference Pipeline

For each camera tile:

1. A `<video>` element displays the **live CCTV stream** (e.g., from `camera.streamUrl`).
2. `useFireSmokeDetection`:
   - Captures frames from the video element every **X milliseconds**:
     - Configurable via `VITE_DETECTION_INTERVAL_MS` (default `500` ms).
   - Resizes the frame to the model’s expected input (e.g. `112 × 112`).
   - Normalizes pixels and runs inference via TF.js + WebGL.
   - Produces:
     - `fireConfidence` (0–100%),
     - `smokeConfidence` (0–100%),
     - `binaryConfidence` (0–100%).
3. The hook maintains a **sliding window** of recent predictions to:
   - Compute average confidence,
   - Enforce **N consecutive detections**.

4. When the conditions are satisfied and a **cooldown** period has passed, the hook sends an alert to the backend via:

```http
POST /api/alerts
```

with `cameraId`, `fireConfidence`, `smokeConfidence`, and `averageConfidence`.

### 9.3 Configuration Knobs

Defined as Vite environment variables (in `frontend/.env` or `.env.local`):

- `VITE_TFJS_MODEL_URL` – TF.js model URL (default: `/models/fire_smoke_tfjs/model.json`)
- `VITE_DETECTION_INTERVAL_MS` – inference interval per camera (default: `500`)
- `VITE_FIRE_THRESHOLD` – fire confidence threshold (default: `70`)
- `VITE_SMOKE_THRESHOLD` – smoke confidence threshold (default: `70`)
- `VITE_MIN_CONSECUTIVE` – min consecutive frames above threshold (default: `3`)
- `VITE_WINDOW_SIZE` – number of recent frames for averaging (default: `5`)
- `VITE_ALERT_COOLDOWN_MS` – alert debounce / cooldown in ms (default: `60000`)

These allow tuning the trade-off between **sensitivity**, **false alarms**, and **performance**.

---

## 10. Hardware Integration Overview

### 10.1 Raspberry Pi (Edge AI + CCTV)

- Runs a lightweight client application that:
  - Pulls frames from an attached camera or IP CCTV stream.
  - Either:
    - Runs the **TF.js / TF Lite model locally** (edge inference), and sends **only confidences** to backend, or
    - Streams video to the central server for browser-side inference.
- Communicates with the backend via HTTPS or WebSocket, sending structured data:

```json
{
  "cameraId": "<MongoCameraId>",
  "fireConfidence": 85.4,
  "smokeConfidence": 62.1,
  "timestamp": "2026-02-25T12:34:56.789Z"
}
```

### 10.2 Arduino (Gas & Temperature Sensors)

- Reads **gas concentration** (e.g., MQ-series sensors) and **temperature**.
- Sends readings (via serial/Wi-Fi/MQTT/HTTP) to either:
  - Raspberry Pi (aggregated edge fusion),
  - Or directly to the backend (via a small microservice or HTTP endpoint).

### 10.3 Multimodal Fusion (Conceptual)

The system architecture supports **sensor fusion** by:

- Storing sensor snapshots with alerts (e.g., gas ppm, °C at trigger time),
- Combining video confidence with sensor conditions (e.g., high gas + high temp + visual fire),
- Future enhancement: apply weighted fusion to further reduce false alarms.

> **Note:** The current codebase primarily demonstrates video-based detection; sensor fusion can be integrated by extending alert creation endpoints and data models without breaking the existing design.

---

## 11. Role-Based Access Description

Roles are enforced both **on the backend** (via middleware) and **in the frontend** (route guards and layouts).

### 11.1 SUPER_ADMIN

**Can:**

- Manage organizations (approve, reject, suspend),
- Manage subscription plans and orders,
- Verify `org_admin` and `operator` users,
- View **global alerts** across all organizations,
- View system-level analytics (alert counts, false alarm rates),
- View audit logs.

**Cannot:**

- Access raw live streams by default (to preserve privacy); can be given explicit access if desired.

### 11.2 ORG_ADMIN

**Can:**

- Manage their organization profile,
- Manage cameras (add / update / soft-delete),
- Manage operators and assignments,
- View all cameras in their organization,
- View live streams and AI confidence overlays,
- View and manage all alerts for their organization,
- Resolve alerts and mark false alarms,
- View organization-level analytics and reports.

### 11.3 OPERATOR

**Can:**

- View **only assigned cameras**,
- View live streams with AI overlays,
- Receive alerts (real-time via Socket.io),
- Acknowledge and resolve alerts for assigned cameras,
- Mark alerts as false alarms.

**Cannot:**

- See subscription plans, billing, or organization configuration,
- See other operators or global analytics.

---

## 12. Alert Workflow Explanation

### 12.1 Detection & Trigger Logic

The alert logic is **multi-step** to reduce false alarms:

1. **Frame-level confidences** from AI model:
   - `fireConfidence`, `smokeConfidence` (0–100%).
2. **Threshold check**:
   - `fireConfidence >= FIRE_THRESHOLD` OR `smokeConfidence >= SMOKE_THRESHOLD`
3. **Temporal validation**:
   - Condition above must hold for **N consecutive frames**.
4. **Confidence averaging**:
   - Average of recent `WINDOW_SIZE` frames must also exceed threshold.
5. **Cooldown**:
   - If a recent alert was triggered for this camera, new alerts are suppressed until `COOLDOWN_MS` has passed.

Only when all of these are satisfied is an alert **created**.

### 12.2 Alert Lifecycle States

- `ACTIVE` – default on creation (AI detection triggered).
- `ACKNOWLEDGED` – operator/admin has seen and accepted the alert.
- `RESOLVED` – issue has been handled (extinguished, evacuated, drill, etc.).
- `FALSE_ALARM` – confirmed non-fire event.

Corresponding timestamps and fields:

- `timestamp` – when alert was created.
- `acknowledgedAt` – when acknowledged.
- `resolvedAt` – when resolved.
- `resolvedBy` – user who resolved / marked false alarm.
- `resolutionType` – e.g. `EXTINGUISHED`, `EVACUATED`, `TEST_DRILL`, `FALSE_ALARM`, `OTHER`.
- `isFalseAlarm` – boolean flag for analytics.

### 12.3 Audit Trail

Each alert keeps an **`actions` history**:

- `CREATED` (by AI / system),
- `ACKNOWLEDGED` (by operator / org_admin),
- `RESOLVED`,
- `FALSE_ALARM`.

Each action records:

- `byUserId`,
- `at` (timestamp),
- Optional `note`.

### 12.4 Notification & Broadcasting

On alert creation:

- A MongoDB `Alert` document is created.
- Related `Notification` records are created for org_admin and operators.
- Emails are sent to organization admins via Nodemailer.
- Socket.io emits `alert:new` to:
  - `org:<organizationId>` room (all connected org users),
  - Redux updates the UI in real time.

On lifecycle change (ack/resolved/false_alarm):

- DB is updated,
- Socket.io emits `alert:updated` / `alert:resolved` / `alert:false_alarm`,
- Redux state updates, and dashboards refresh automatically.

---

## 13. Database Schema Overview

### 13.1 Core Collections (Simplified)

- **User**
  - Fields: `name`, `email`, `password`, `role`, `organizationId`, `isVerified`, `isActive`, `isDeleted`, etc.
  - Indexes: by `organizationId`, `role`, verification and deletion status.

- **Organization**
  - Fields: `name`, `email`, `status` (`PENDING`, `ACTIVE`, `SUSPENDED`, ...), subscription details, `maxCameras`, `maxOperators`, etc.
  - Supports multi-tenant isolation via `organizationId` references.

- **Camera**
  - Fields: `name`, `label`, `ipAddress`, `streamUrl`, `location`, `organizationId`, `status`, `lastHeartbeat`, `metadata` (resolution, fps).
  - Soft delete via `isDeleted`.

- **Alert**
  - Fields:
    - `organizationId`, `cameraId`,
    - `fireConfidence`, `smokeConfidence`, `averageConfidence`,
    - `intensityLevel` (`low`, `medium`, `high`, `critical`),
    - `status` (`active`, `acknowledged`, `resolved`, `false_alarm`),
    - `acknowledgedAt`, `resolvedAt`, `resolvedBy`, `resolutionType`, `isFalseAlarm`,
    - `frameSnapshotURL` (optional),
    - `timestamp`, `actions` (audit trail).
  - Indexes: by `organizationId`, `status`, `timestamp`, for efficient analytics.

- **Notification**
  - Fields: `userId`, `organizationId`, `alertId`, `type`, `title`, `message`, `priority`, `isRead`.

- **OperatorCameraAssignment**
  - Fields: `operatorId`, `cameraId`, `organizationId`.
  - Used to restrict operator visibility at the backend and frontend.

> **Note:** Additional collections (e.g., `SubscriptionPlan`, `Order`, `Subscription`) support SaaS-style billing; they are optional for FYP but useful for a production SaaS product.

---

## 14. API Documentation Summary

This section lists key endpoints (paths are prefixed with `/api`).

### 14.1 Authentication

- `POST /auth/register` – register user.
- `POST /auth/login` – log in and obtain JWTs.
- `POST /auth/logout` – log out and clear tokens.
- `GET /auth/me` – get current user profile.

### 14.2 Organizations (SUPER_ADMIN + ORG_ADMIN)

- `GET /organizations` – list organizations (super admin).
- `POST /organizations` – create organization.
- `PUT /organizations/:id` – update organization.
- Additional routes for approving / rejecting / suspending.

### 14.3 Cameras

- `GET /cameras` – list cameras (scoped by role & organization).
- `POST /cameras` – create camera (org_admin).
- `PUT /cameras/:id` – update camera.
- `DELETE /cameras/:id` – soft delete camera.

### 14.4 Alerts

- `GET /alerts` – list alerts (scoped by role; operator sees only assigned cameras).
- `GET /alerts/stats` – summary statistics and false alarm rate.
- `GET /alerts/:id` – retrieve single alert.
- `POST /alerts` – create alert (usually called by AI/edge logic).
- `PUT /alerts/:id/acknowledge` – set to `ACKNOWLEDGED`.
- `PUT /alerts/:id/resolve` – set to `RESOLVED`.
- `PUT /alerts/:id/false-alarm` – set to `FALSE_ALARM`.

### 14.5 Operators, Subscriptions, Notifications

- `GET /operator-assignments` / `POST /operator-assignments` – assign cameras to operators.
- `GET /notifications` – list user notifications.
- Subscription-related routes for managing plans and orders (super admin focused).

For a production deployment, this can be documented with **OpenAPI/Swagger** or Postman collections.

---

## 15. Deployment Instructions

### 15.1 Local Deployment

1. Ensure MongoDB is running locally (or update `MONGODB_URI` to a cloud instance).
2. Configure `.env` as described earlier.
3. Install dependencies:

   ```bash
   npm run install-all
   ```

4. Run development servers:

   ```bash
   npm run dev
   ```

5. Access frontend at `http://localhost:5173` and backend health check at:

   ```bash
   curl http://localhost:5000/health
   ```

### 15.2 Docker (Suggested Structure)

For a cloud-ready deployment, you can define:

- A **backend Dockerfile** for the Node.js API & Socket.io.
- A **frontend Dockerfile** that builds the React app and serves it via a static HTTP server.
- A **docker-compose.yml** to orchestrate:
  - `mongo`
  - `backend`
  - `frontend`

Environment variables (JWT secrets, DB URIs, etc.) should be injected via:

- `.env` (development),
- Docker secrets / platform env vars (production).

### 15.3 Cloud Platforms

The system can be deployed on:

- **Render / Railway / Heroku-style PaaS** for the backend,
- **Vercel / Netlify / S3 + CloudFront** for the frontend static bundle,
- **MongoDB Atlas** for the database,
- **NGINX / Traefik** reverse proxy terminating HTTPS.

Core production recommendations:

- Terminate **HTTPS** at the reverse proxy.
- Ensure `FRONTEND_URL` and `SOCKET_CORS_ORIGIN` match deployed URLs.
- Use **strong JWT secrets** and rotate them periodically.

---

## 16. Performance & Scalability Considerations

- **Under 2 seconds end-to-end latency**
  - Per-camera inference throttling via `VITE_DETECTION_INTERVAL_MS`.
  - Temporal validation and cooldown to avoid alert storms.
  - Socket.io for instant push to clients.

- **Horizontal scalability**
  - Stateless Node.js backend (suitable for multiple replicas).
  - MongoDB indexes on `organizationId`, `status`, `timestamp`.
  - Socket.io can scale with a Redis adapter for multi-instance setups.

- **Future microservice separation**
  - Dedicated **inference service** (Node + `@tensorflow/tfjs-node` or Python TF) for heavy models.
  - Separate **notification service** for email/SMS/push.
  - **Message queue** (Kafka/RabbitMQ) between detection, alerting, and notification services.

---

## 17. Future Enhancements

- **Full multimodal fusion**
  - Persist gas and temperature readings per camera,
  - Fuse them with video confidence for more robust detection.

- **Advanced analytics**
  - Heatmaps of most-affected areas,
  - Time-of-day risk patterns,
  - Organization-level SLAs and MTTR (Mean Time To Resolve).

- **Mobile app**
  - Operator mobile client for push alerts and quick actions.

- **Automated actuation**
  - Integration with building control systems (e.g. sprinklers, access control).

- **Complete DevOps pipeline**
  - CI/CD, automated tests, canary deployments, monitoring (Prometheus/Grafana).

---

## 18. License

You may use a permissive license such as **MIT** or **Apache 2.0**. For example:

```text
MIT License

Copyright (c) 2026 <Your Name>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

Update this section with your actual license choice and personal / institutional details as needed.

# AI-Based Smart Fire Detection and Emergency Monitoring System

A production-ready MERN stack web application for intelligent fire detection and emergency monitoring.

## 🚀 Features

- **Authentication System**: Email/password + Google OAuth with JWT tokens
- **Role-Based Access Control**: Super Admin, Organization Admin, Operator
- **Real-Time Monitoring**: Socket.io for live alerts and camera status
- **Camera Management**: Add, edit, and monitor cameras
- **Alert System**: Real-time fire detection alerts with confidence scores
- **Dashboard Analytics**: Role-specific dashboards with charts and metrics
- **Email Notifications**: Automated email alerts using Nodemailer
- **Secure & Scalable**: Production-ready security and architecture

## 📋 Prerequisites

- Node.js (v18 or higher)
- MongoDB (v6 or higher)
- npm or yarn

## 🛠️ Installation

1. Clone the repository
```bash
git clone <repository-url>
cd Starter
```

2. Install dependencies
```bash
npm run install-all
```

3. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start development servers
```bash
npm run dev
```

Backend runs on: `http://localhost:5000`
Frontend runs on: `http://localhost:5173`

## 📁 Project Structure

```
Starter/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── sockets/
│   ├── utils/
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── context/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── routes/
│   │   └── assets/
│   └── package.json
└── README.md
```

## 🔐 User Roles

- **Super Admin**: System-wide access, manage organizations, view all alerts
- **Organization Admin**: Manage organization cameras, operators, view reports
- **Operator**: View live cameras and alerts, limited access

## 🚢 Deployment

See `DEPLOYMENT.md` for detailed deployment instructions.

## 📝 License

ISC

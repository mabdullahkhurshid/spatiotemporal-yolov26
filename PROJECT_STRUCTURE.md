# Project Structure Documentation

## 📁 Complete Project Structure

```
Starter/
├── backend/
│   ├── config/
│   │   └── database.js              # MongoDB connection
│   ├── controllers/
│   │   ├── authController.js        # Authentication logic
│   │   ├── userController.js        # User CRUD operations
│   │   ├── organizationController.js # Organization management
│   │   ├── cameraController.js      # Camera management
│   │   └── alertController.js       # Alert management
│   ├── middleware/
│   │   ├── auth.js                  # JWT authentication & authorization
│   │   ├── errorHandler.js          # Global error handler
│   │   └── validation.js           # Request validation
│   ├── models/
│   │   ├── User.js                  # User schema
│   │   ├── Organization.js         # Organization schema
│   │   ├── Camera.js               # Camera schema
│   │   ├── Alert.js                 # Alert schema
│   │   ├── Subscription.js         # Subscription schema
│   │   ├── Order.js                 # Order schema
│   │   ├── Notification.js          # Notification schema
│   │   └── AuditLog.js              # Audit log schema
│   ├── routes/
│   │   ├── auth.js                  # Auth routes
│   │   ├── users.js                 # User routes
│   │   ├── organizations.js         # Organization routes
│   │   ├── cameras.js               # Camera routes
│   │   ├── alerts.js                # Alert routes
│   │   └── notifications.js         # Notification routes
│   ├── services/
│   │   ├── emailService.js          # Nodemailer email service
│   │   └── oauthService.js          # Google OAuth configuration
│   ├── sockets/
│   │   └── socketHandlers.js        # Socket.io event handlers
│   ├── utils/
│   │   ├── generateToken.js         # JWT token generation
│   │   └── generateOTP.js           # OTP generation
│   └── server.js                    # Express server entry point
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx          # Navigation sidebar
│   │   │   └── Header.jsx           # Top header with notifications
│   │   ├── layouts/
│   │   │   ├── SuperAdminLayout.jsx # Super admin layout
│   │   │   ├── OrgAdminLayout.jsx   # Org admin layout
│   │   │   └── OperatorLayout.jsx   # Operator layout
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── Login.jsx        # Login page
│   │   │   │   ├── Register.jsx     # Registration page
│   │   │   │   ├── ForgotPassword.jsx
│   │   │   │   ├── ResetPassword.jsx
│   │   │   │   └── OAuthCallback.jsx
│   │   │   ├── superadmin/
│   │   │   │   ├── Dashboard.jsx
│   │   │   │   ├── Organizations.jsx
│   │   │   │   ├── Orders.jsx
│   │   │   │   └── Alerts.jsx
│   │   │   ├── orgadmin/
│   │   │   │   ├── Dashboard.jsx
│   │   │   │   ├── Cameras.jsx
│   │   │   │   ├── Alerts.jsx
│   │   │   │   ├── Operators.jsx
│   │   │   │   └── Reports.jsx
│   │   │   └── operator/
│   │   │       ├── Dashboard.jsx
│   │   │       ├── Cameras.jsx
│   │   │       └── Alerts.jsx
│   │   ├── store/
│   │   │   ├── store.js              # Redux store configuration
│   │   │   └── slices/
│   │   │       ├── authSlice.js      # Auth state management
│   │   │       ├── alertSlice.js     # Alert state management
│   │   │       ├── cameraSlice.js    # Camera state management
│   │   │       └── notificationSlice.js
│   │   ├── services/
│   │   │   ├── api.js                # Axios API client
│   │   │   └── socketService.js      # Socket.io client service
│   │   ├── App.jsx                   # Main app component with routing
│   │   ├── main.jsx                  # React entry point
│   │   └── index.css                 # Global styles
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── .env.example                      # Environment variables template
├── .gitignore
├── package.json                      # Root package.json
├── Dockerfile                         # Docker configuration
├── docker-compose.yml                # Docker Compose setup
├── nginx.conf                        # Nginx reverse proxy config
├── README.md                         # Project overview
├── DEPLOYMENT.md                     # Deployment guide
└── PROJECT_STRUCTURE.md             # This file
```

## 🔐 Authentication Flow

1. **Registration**
   - User registers with email/password
   - OTP sent to email
   - User verifies email with OTP
   - Account activated

2. **Login**
   - Email/password authentication
   - JWT access token + refresh token issued
   - Tokens stored in cookies and localStorage
   - User redirected to role-specific dashboard

3. **Google OAuth**
   - User clicks "Sign in with Google"
   - Redirected to Google OAuth
   - Callback receives user data
   - Account created/linked automatically
   - Tokens issued and user logged in

4. **Password Reset**
   - User requests password reset
   - Reset token sent via email
   - User clicks link, enters new password
   - Password updated, user logged in

## 🎭 Role-Based Access Control

### Super Admin
- Full system access
- Manage all organizations
- Approve/reject orders
- View all alerts system-wide
- System analytics

### Organization Admin
- Manage organization cameras
- Add/edit cameras
- View organization alerts
- Mark false alarms
- Manage operators
- View reports

### Operator
- View live cameras
- View alerts
- Cannot edit settings
- Limited access

## 🔄 Real-Time Features (Socket.io)

### Events Emitted:
- `alert:new` - New fire alert detected
- `alert:resolved` - Alert resolved
- `alert:false_alarm` - Alert marked as false alarm
- `camera:status:update` - Camera status changed

### Client Events:
- `join:organization` - Join organization room
- `leave:organization` - Leave organization room
- `camera:status` - Update camera status

## 📊 Database Schema Overview

### User Model
- Authentication fields (email, password, googleId)
- Role (super_admin, org_admin, operator)
- Organization reference
- Email verification status
- Refresh token

### Organization Model
- Organization details
- Subscription plan (basic, pro, enterprise)
- Installation address
- Admin reference
- Subscription status

### Camera Model
- IP address, location, label
- Organization reference
- Status (online, offline, maintenance)
- Last activity timestamp

### Alert Model
- Camera and organization references
- Fire/smoke confidence scores
- Intensity level
- Status (active, resolved, false_alarm)
- Resolution details

## 🚀 Getting Started

1. **Install Dependencies**
```bash
npm run install-all
```

2. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your settings
```

3. **Start MongoDB**
```bash
mongod
```

4. **Start Development**
```bash
npm run dev
```

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login
- `POST /api/auth/verify-email` - Verify email with OTP
- `POST /api/auth/forgotpassword` - Request password reset
- `PUT /api/auth/resetpassword` - Reset password
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `GET /api/auth/google` - Google OAuth
- `GET /api/auth/google/callback` - OAuth callback

### Users
- `GET /api/users` - Get all users (admin)
- `GET /api/users/:id` - Get user
- `POST /api/users` - Create user (admin)
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (admin)

### Organizations
- `GET /api/organizations` - Get all (super admin)
- `GET /api/organizations/:id` - Get organization
- `POST /api/organizations` - Create (super admin)
- `PUT /api/organizations/:id` - Update
- `DELETE /api/organizations/:id` - Delete (super admin)

### Cameras
- `GET /api/cameras` - Get cameras
- `GET /api/cameras/:id` - Get camera
- `POST /api/cameras` - Create camera (admin)
- `PUT /api/cameras/:id` - Update camera (admin)
- `DELETE /api/cameras/:id` - Delete camera (admin)
- `PUT /api/cameras/:id/activity` - Update activity

### Alerts
- `GET /api/alerts` - Get alerts
- `GET /api/alerts/stats` - Get statistics
- `GET /api/alerts/:id` - Get alert
- `POST /api/alerts` - Create alert (AI system)
- `PUT /api/alerts/:id/resolve` - Resolve alert
- `PUT /api/alerts/:id/false-alarm` - Mark false alarm

### Notifications
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read

## 🔒 Security Features

- JWT authentication with refresh tokens
- Password hashing with bcrypt
- Role-based authorization middleware
- CORS configuration
- Helmet security headers
- Rate limiting
- Input validation (express-validator)
- XSS protection
- Secure cookies (httpOnly, secure in production)

## 📧 Email Notifications

- Email verification OTP
- Password reset emails
- Fire alert notifications
- HTML email templates

## 🎨 Frontend Features

- Dark/Light theme toggle
- Responsive design
- Real-time updates via Socket.io
- Toast notifications
- Charts (Recharts)
- Protected routes
- Role-based navigation

## 🐳 Docker Support

- Dockerfile for backend
- docker-compose.yml for full stack
- MongoDB container included

## 📈 Next Steps

1. Implement remaining page components
2. Add camera live feed integration
3. Implement AI model integration for fire detection
4. Add SMS notifications
5. Implement payment integration for subscriptions
6. Add advanced analytics and reporting
7. Set up CI/CD pipeline
8. Add unit and integration tests

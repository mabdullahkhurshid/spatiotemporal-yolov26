# Deployment Guide

## Prerequisites

- Node.js 18+ installed
- MongoDB 6+ installed (or use MongoDB Atlas)
- Git installed
- Server with Ubuntu 20.04+ (for production)

## Local Development Setup

1. **Clone and Install Dependencies**
```bash
git clone <repository-url>
cd Starter
npm run install-all
```

2. **Configure Environment Variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start MongoDB** (if running locally)
```bash
mongod
```

4. **Start Development Servers**
```bash
npm run dev
```

Backend: http://localhost:5000
Frontend: http://localhost:5173

## Production Deployment

### Option 1: DigitalOcean / AWS EC2

1. **Server Setup**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MongoDB (or use MongoDB Atlas)
sudo apt install -y mongodb

# Install Nginx
sudo apt install -y nginx

# Install PM2
sudo npm install -g pm2
```

2. **Clone and Build**
```bash
cd /var/www
sudo git clone <repository-url> fire-detection
cd fire-detection
sudo npm run install-all

# Build frontend
cd frontend
sudo npm run build
```

3. **Configure Backend**
```bash
cd /var/www/fire-detection
sudo cp .env.example .env
sudo nano .env
# Configure all environment variables
```

4. **Start Backend with PM2**
```bash
cd /var/www/fire-detection
sudo pm2 start backend/server.js --name fire-detection-api
sudo pm2 save
sudo pm2 startup
```

5. **Configure Nginx**
```bash
sudo cp nginx.conf /etc/nginx/sites-available/fire-detection
sudo ln -s /etc/nginx/sites-available/fire-detection /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

6. **Setup SSL (Let's Encrypt)**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Option 2: Docker Deployment

1. **Set the required secrets** in `.env` next to `docker-compose.yml`. Compose stops with a clear
   message if one is missing, and the backend refuses to start with placeholder or short values:
   `JWT_SECRET`, `JWT_REFRESH_SECRET`, `INFERENCE_SERVICE_API_KEY`, `MEDIAMTX_INTERNAL_PASS`
   (each 32+ random characters, the two JWT secrets different). Generate one with:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

2. **Build and Run**
```bash
docker-compose up -d
```
   MongoDB is published on `127.0.0.1:27017` only (this machine). The backend has a healthcheck on `/health`.

2. **View Logs**
```bash
docker-compose logs -f
```

### Option 3: MongoDB Atlas (Cloud Database)

1. Create account at https://www.mongodb.com/cloud/atlas
2. Create a cluster
3. Get connection string
4. Update `MONGODB_URI` in `.env`

## Environment Variables Checklist

Ensure these are set in production:

- `NODE_ENV=production`
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Strong random secret
- `JWT_REFRESH_SECRET` - Strong random secret
- `EMAIL_HOST` - SMTP server
- `EMAIL_USER` - SMTP username
- `EMAIL_PASS` - SMTP password
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth secret
- `FRONTEND_URL` - Production frontend URL
- `SOCKET_CORS_ORIGIN` - Production frontend URL
- `INFERENCE_SERVICE_API_KEY` - Strong random secret shared with the inference and explainer services
- `MEDIAMTX_INTERNAL_PASS` - Strong random secret (when demo cameras are enabled)
- `TRUST_PROXY=1` - Only when nginx (or one load balancer) is in front. Without it every user shares
  nginx's IP and a few failed logins anywhere lock everyone out; set it without a proxy and clients
  can spoof their IP.
- `CAMERA_CREDENTIALS_KEY` - Optional but recommended: set it before you ever change `JWT_SECRET`, so
  stored ONVIF camera passwords stay readable. Never change it once set.

### Rotating a placeholder JWT_SECRET

If a server has been running on the example `JWT_SECRET`, the backend now refuses to start in production.
Before replacing it:
1. Set `CAMERA_CREDENTIALS_KEY` to a new random value and restart once. Passwords saved earlier are still
   read with the old key; new and edited cameras use the new key.
2. Re-enter the password of each ONVIF camera (camera settings) so it is stored with the new key.
   Saving with a blank password keeps the old encrypted value.
3. Change `JWT_SECRET` and `JWT_REFRESH_SECRET`. Everyone is signed out and signs in again.

## Network exposure

- `/api/internal/*` is for the inference, explainer and MediaMTX services only. `nginx.conf` answers it
  with 404; those services call the backend directly on the private network.
- Alert snapshots and heatmaps under `/uploads` require sign-in (same access rules as the alert).

## Enabling MongoDB authentication (recommended)

`MONGO_INITDB_ROOT_USERNAME`/`PASSWORD` only take effect on an **empty** data volume, so an existing
deployment must create its user by hand:
```bash
docker compose exec mongodb mongosh fire-detection-system --eval \
  'db.createUser({user: "fireapp", pwd: "<strong password>", roles: [{role: "readWrite", db: "fire-detection-system"}]})'
```
Then set, in `.env`:
```
MONGODB_URI_DOCKER=mongodb://fireapp:<strong password>@mongodb:27017/fire-detection-system?authSource=fire-detection-system
```
and add `command: ["--auth"]` to the `mongodb` service. Restart with `docker compose up -d`.

## Security Checklist

- [ ] Change all default secrets
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall (UFW)
- [ ] Set up regular backups
- [ ] Enable MongoDB authentication
- [ ] Use environment variables (never commit .env)
- [ ] Set up monitoring (PM2 monitoring or similar)
- [ ] Configure rate limiting
- [ ] Enable Helmet security headers

## Monitoring

### PM2 Monitoring
```bash
pm2 monit
pm2 logs
```

### MongoDB Monitoring
```bash
mongostat
```

## Backup Strategy

1. **Database Backup**
```bash
mongodump --uri="mongodb://localhost:27017/fire-detection-system" --out=/backup/$(date +%Y%m%d)
```

2. **Automated Backup Script**
Create a cron job:
```bash
0 2 * * * /path/to/backup-script.sh
```

## Troubleshooting

### Backend won't start
- Check MongoDB connection
- Verify environment variables
- Check port 5000 availability
- Review logs: `pm2 logs fire-detection-api`

### Frontend build fails
- Check Node.js version (18+)
- Clear node_modules and reinstall
- Check for syntax errors

### Socket.io connection issues
- Verify CORS settings
- Check firewall rules
- Verify Socket.io URL in frontend

## Scaling

For high traffic:
1. Use load balancer (Nginx or AWS ALB)
2. Run multiple backend instances
3. Use Redis for session storage
4. Implement database replication
5. Use CDN for frontend assets

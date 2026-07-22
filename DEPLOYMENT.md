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

1. **Build and Run**
```bash
docker-compose up -d
```

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

# Implementation Plan - Deploy to Oracle Free Tier + Search by Company Name

## Task 1: Add Search by Company Name (not just ticker)

### Problem
Currently when a user types a company name (e.g., "Tesla") and submits, the app treats it as a ticker symbol and sends `POST /companies/TESLA/refresh` to SEC, which fails. The SEC `company_tickers.json` file contains both tickers AND company names, but the backend only searches by ticker.

### Solution: Add a `/api/companies/search` endpoint

**Backend changes:**

1. **`backend/src/services/sec-api.js`** - Add new function `searchCompaniesByName(query)`:
   - Fetch `https://www.sec.gov/files/company_tickers.json` (same file already used)
   - Cache it in memory (NodeCache, already a dependency) - it's ~5MB and rarely changes
   - Search both `ticker` and `title` fields (case-insensitive, partial match)
   - Return top 10 matching results: `[{ ticker, name, cik }]`

2. **`backend/src/routes/companies.js`** - Add new route:
   - `GET /api/companies/search?q=tesla` → returns matching companies from SEC
   - Must be placed BEFORE `/:symbol` route to avoid conflict
   - Returns results from both local DB and SEC tickers list

3. **`backend/src/services/mock-database.js`** - Add `searchCompanies(query)`:
   - SQL: `WHERE symbol LIKE ? OR name LIKE ?` for local DB search

**Frontend changes:**

4. **`frontend/src/services/api.js`** - Add API method:
   - `companiesAPI.search(query)` → `GET /companies/search?q={query}`

5. **`frontend/src/pages/HomePage.jsx`** - Add autocomplete/dropdown:
   - As user types (debounced 300ms, min 2 chars), call search API
   - Show dropdown with matching results (ticker + name)
   - Clicking a result either navigates (if in DB) or triggers refresh (if from SEC)
   - Keep existing form submit as fallback

### Files to modify:
- `backend/src/services/sec-api.js` (add searchCompanies + caching)
- `backend/src/routes/companies.js` (add search route)
- `backend/src/services/mock-database.js` (add local search)
- `frontend/src/services/api.js` (add search method)
- `frontend/src/pages/HomePage.jsx` (add autocomplete dropdown UI)

---

## Task 2: Deploy to Oracle Cloud Free Tier (Oracle Linux)

### Prerequisites (user does manually):
- Oracle Cloud account (free tier)
- Create an "Always Free" VM: VM.Standard.E2.1.Micro (1 OCPU, 1 GB RAM) or ARM Ampere A1 (up to 4 OCPU, 24 GB RAM - better!)
- Oracle Linux 8 or 9
- Open ports 80, 443 in OCI Security List (VCN subnet ingress rules)
- SSH access configured

### Step-by-step deployment plan:

#### A. Server Setup (SSH into Oracle Linux VM)

1. **Update system & install essentials:**
   ```bash
   sudo dnf update -y
   sudo dnf install -y git nginx
   ```

2. **Install Node.js 20 (via NodeSource):**
   ```bash
   curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
   sudo dnf install -y nodejs
   ```

3. **Install PM2 (process manager):**
   ```bash
   sudo npm install -g pm2
   ```

4. **Open firewall ports (Oracle Linux uses firewalld):**
   ```bash
   sudo firewall-cmd --permanent --add-service=http
   sudo firewall-cmd --permanent --add-service=https
   sudo firewall-cmd --reload
   ```

#### B. Deploy Application Code

5. **Clone repo to server:**
   ```bash
   sudo mkdir -p /var/www
   cd /var/www
   sudo git clone <your-repo-url> financial-analyzer
   sudo chown -R $USER:$USER /var/www/financial-analyzer
   ```

6. **Install backend dependencies:**
   ```bash
   cd /var/www/financial-analyzer/backend
   npm install --production
   ```

7. **Create `.env` file:**
   ```bash
   cp .env.example .env
   # Edit with actual API keys
   nano .env
   ```
   Set `NODE_ENV=production` and `PORT=3000`

8. **Build frontend for production:**
   ```bash
   cd /var/www/financial-analyzer/frontend
   npm install
   ```
   Update `VITE_API_URL` in `.env` or in `vite.config.js` to point to production API URL.
   ```bash
   npm run build
   # This creates a /dist folder with static files
   ```

#### C. Configure Nginx (reverse proxy + serve frontend)

9. **Create Nginx config:**
   ```nginx
   # /etc/nginx/conf.d/financial-analyzer.conf

   server {
       listen 80;
       server_name your-vm-public-ip;  # or your domain

       # Serve frontend (React static files)
       root /var/www/financial-analyzer/frontend/dist;
       index index.html;

       # Frontend SPA routing - all non-API routes serve index.html
       location / {
           try_files $uri $uri/ /index.html;
       }

       # Proxy API requests to Node.js backend
       location /api/ {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

10. **Enable and start Nginx:**
    ```bash
    sudo nginx -t                    # Test config
    sudo systemctl enable nginx
    sudo systemctl start nginx
    ```

#### D. Run Backend with PM2

11. **Start backend with PM2:**
    ```bash
    cd /var/www/financial-analyzer/backend
    pm2 start src/server.js --name financial-analyzer
    pm2 save
    pm2 startup  # Follow instructions to auto-start on reboot
    ```

#### E. Optional: SSL with Let's Encrypt (if you have a domain)

12. **Install Certbot:**
    ```bash
    sudo dnf install -y certbot python3-certbot-nginx
    sudo certbot --nginx -d yourdomain.com
    ```

### Code changes needed for production:

13. **`backend/src/server.js`** - Update CORS for production:
    - Set specific origin instead of open `cors()`
    - Add trust proxy if behind Nginx

14. **`frontend/src/services/api.js`** - API base URL:
    - Use relative URL `/api` in production (Nginx proxies it)
    - The `VITE_API_URL` env var or default should work: just set it to `/api`

15. **`frontend/vite.config.js`** - Ensure build output is correct

### Deployment file structure on server:
```
/var/www/financial-analyzer/
├── backend/
│   ├── src/server.js          (PM2 runs this)
│   ├── .env                   (production config)
│   └── database.db            (SQLite file, auto-created)
├── frontend/
│   └── dist/                  (Nginx serves this)
│       ├── index.html
│       └── assets/
/etc/nginx/conf.d/
│   └── financial-analyzer.conf
```

---

## Bug Fix: Duplicate Route

While reviewing the code I noticed `companies.js` has **two** `router.post('/:symbol/refresh', ...)` handlers (lines 120-248 and 254-371). The second one will never execute. Also, the comment says "Compare multiple companies" but the route is a duplicate refresh. This should be cleaned up - remove the duplicate and add the actual compare route if needed.

---

## Implementation Order

1. Fix the duplicate route bug in `companies.js`
2. Implement search by name (backend → frontend)
3. Test locally
4. Prepare production configs (CORS, env vars, build)
5. Deploy to Oracle VM (user provides VM access)

---

## Summary of All Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/services/sec-api.js` | Modify | Add `searchCompaniesByName()` + cache tickers JSON |
| `backend/src/routes/companies.js` | Modify | Add `GET /search`, fix duplicate route |
| `backend/src/services/mock-database.js` | Modify | Add `searchCompanies()` local DB search |
| `backend/src/server.js` | Modify | Production CORS config, serve static files option |
| `frontend/src/services/api.js` | Modify | Add `search()` API method |
| `frontend/src/pages/HomePage.jsx` | Modify | Add autocomplete dropdown for name search |
| `/etc/nginx/conf.d/financial-analyzer.conf` | Create | Nginx reverse proxy config (on server) |
| `ecosystem.config.js` | Create | PM2 config file (optional, for deployment) |

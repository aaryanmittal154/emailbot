# EmailBot Deployment Guide

This document provides step-by-step instructions for deploying the EmailBot application to production.

## Prerequisites

- GitHub account
- Render.com or Railway.app account (for backend)
- Vercel account (for frontend)
- Pinecone account (for vector database)
- Google Cloud Console project with OAuth credentials

## Backend Deployment (on Render.com)

1. **Create a PostgreSQL Database on Render**
   - Sign in to your Render account
   - Click "New +" and select "PostgreSQL"
   - Configure your database:
     - Name: `emailbot-db` (or your preferred name)
     - Database: `emailbot`
     - User: Leave as default
     - PostgreSQL Version: 15 (or latest)
     - Region: Select the region closest to your users
     - Plan: Free plan to start with
   - Click "Create Database"
   - **Save the Internal Database URL** - you'll need it in the next step

2. **Create a new Web Service on Render**
   - Sign in to your Render account
   - Click "New +" and select "Web Service"
   - Connect your GitHub repository
   - Select the repository containing EmailBot

3. **Configure the Web Service**
   - **Name**: `emailbot-backend` (or your preferred name)
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free (to start)

4. **Set Environment Variables**
   - Click on "Environment" tab
   - Add the following environment variables:
     ```
     DATABASE_URL=postgres://user:password@host/database  # Internal Database URL from step 1
     PINECONE_API_KEY=your_pinecone_api_key
     PINECONE_ENVIRONMENT=your_pinecone_environment       # Example: us-west1-gcp
     OPENAI_API_KEY=your_openai_api_key
     GOOGLE_CLIENT_ID=your_google_client_id
     GOOGLE_CLIENT_SECRET=your_google_client_secret
     OAUTH_REDIRECT_URI=https://your-frontend-domain.vercel.app/auth/callback
     SECRET_KEY=generate_a_secure_random_string_here      # For JWT token encryption
     ```

5. **Deploy the Service**
   - Click "Create Web Service"
   - Wait for the deployment to complete

## Frontend Deployment (on Vercel)

1. **Create a new Project on Vercel**
   - Sign in to your Vercel account
   - Click "New Project"
   - Import your GitHub repository
   - Select the repository containing EmailBot

2. **Configure the Project**
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend` (important - specify this!)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

3. **Set Environment Variables**
   - Click on "Environment Variables" section
   - Add the following:
     ```
     NEXT_PUBLIC_API_URL=https://your-backend-service.onrender.com
     ```

4. **Deploy the Project**
   - Click "Deploy"
   - Wait for the deployment to complete

## Post-Deployment Tasks

### 1. Update OAuth Configuration

1. Go to the Google Cloud Console
2. Navigate to your project > APIs & Services > Credentials
3. Edit your OAuth 2.0 Client ID
4. Update the Authorized redirect URIs to include:
   - `https://your-frontend-domain.vercel.app/auth/callback`

### 2. Test End-to-End Flow

1. Visit your deployed frontend
2. Sign in with Google
3. Verify that emails load correctly
4. Test search functionality
5. Verify vector search works properly

### 3. Production Database Management

For optimal performance:
1. Set up regular backups of your PostgreSQL database
2. Create a cleanup job to remove old vector embeddings
3. Monitor database size and performance

## Scaling Considerations

As your user base grows:
1. Upgrade from free tiers to paid plans
2. Consider implementing caching for frequently accessed data
3. Set up proper monitoring with alerts for errors
4. Create a staging environment for testing changes

## Nginx Deployment (Alternative)

If deploying to your own server with Nginx:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass https://localhost:3000;  # Next.js frontend
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass https://emailbot-k8s7.onrender.com;  # FastAPI backend
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure your backend has CORS configured correctly for your production frontend domain.
2. **OAuth Errors**: Verify your Google OAuth redirect URIs are correctly set for production.
3. **Database Connection Issues**: Check your DATABASE_URL environment variable and ensure your IP is allowed.
4. **Vector Search Not Working**: Verify your Pinecone API key and environment.

For more help, refer to the project documentation or create an issue on the GitHub repository.

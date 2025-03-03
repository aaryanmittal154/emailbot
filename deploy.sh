#!/bin/bash

# EmailBot Deployment Script
# This script helps prepare the project for deployment

echo "=== EmailBot Deployment Preparation ==="
echo "This script will help prepare your project for deployment."

# 1. Check if git is installed
if ! command -v git &> /dev/null; then
    echo "Git is not installed. Please install git first."
    exit 1
fi

# 2. Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo "⚠️ You have uncommitted changes. Please commit them before deploying."
    git status
    read -p "Do you want to commit these changes now? (y/n): " answer
    if [[ "$answer" == "y" ]]; then
        read -p "Enter commit message: " message
        git add .
        git commit -m "$message"
        echo "Changes committed!"
    else
        echo "Please commit your changes manually before deploying."
        exit 1
    fi
fi

# 3. Create necessary deployment files
echo "Creating deployment configuration files..."

# Ensure the docs directory exists
mkdir -p docs

# 4. Ask for deployment variables
echo ""
echo "=== Deployment Configuration ==="
read -p "Enter your backend deployment URL (e.g., https://emailbot-backend.onrender.com): " BACKEND_URL
read -p "Enter your frontend deployment URL (e.g., https://emailbot.vercel.app): " FRONTEND_URL

# 5. Update environment files
echo ""
echo "Updating environment files..."

# Update frontend production environment
cat > frontend/.env.production << EOL
# Production environment variables
NEXT_PUBLIC_API_URL=${BACKEND_URL}
EOL
echo "✅ Created frontend/.env.production"

# 6. Push to GitHub if requested
echo ""
read -p "Do you want to push your changes to GitHub now? (y/n): " push_answer
if [[ "$push_answer" == "y" ]]; then
    read -p "Enter branch name (default: main): " branch_name
    branch_name=${branch_name:-main}

    git push origin $branch_name
    echo "✅ Changes pushed to GitHub!"
fi

# 7. Display next steps
echo ""
echo "=== Deployment Next Steps ==="
echo "1. Deploy your backend on Render.com:"
echo "   - Create a new Web Service pointing to your GitHub repository"
echo "   - Set environment variables as listed in docs/deployment.md"
echo "   - Set the build command: pip install -r backend/requirements.txt"
echo "   - Set the start command: cd backend && uvicorn main:app --host 0.0.0.0 --port \$PORT"
echo ""
echo "2. Deploy your frontend on Vercel:"
echo "   - Create a new project pointing to your GitHub repository"
echo "   - Set the root directory to 'frontend'"
echo "   - Set the NEXT_PUBLIC_API_URL environment variable to: $BACKEND_URL"
echo ""
echo "3. Update Google OAuth redirect URIs in Google Cloud Console:"
echo "   - Add: $FRONTEND_URL/auth/callback"
echo ""
echo "Deployment preparation complete! Follow the steps above to deploy your application."

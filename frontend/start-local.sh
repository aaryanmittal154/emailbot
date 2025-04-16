#!/bin/bash

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo "Creating .env.local file..."
    cat > .env.local << EOL
# Local development environment variables
NEXT_PUBLIC_API_URL=https://emailbot-k8s7.onrender.com
NEXT_PUBLIC_OAUTH_CLIENT_ID=218482025360-jjhoqa2na16bji7058eokg1lfbp3tu1j.apps.googleusercontent.com
EOL
    echo ".env.local created successfully!"
fi

# Start the development server
echo "Starting Next.js development server..."
npm run dev

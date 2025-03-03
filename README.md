# EmailBot

An intelligent email management system that uses AI to help you organize, search, and analyze your emails.

## Features

- **Smart Email Organization**: Automatically categorizes and labels emails
- **Semantic Search**: Find emails by meaning, not just keywords
- **Email Analytics**: Gain insights about your email communication patterns
- **Natural Language Search**: Ask questions in plain English to find relevant emails
- **Gmail Integration**: Works with your existing Gmail account

## Tech Stack

- **Frontend**: Next.js, Chakra UI, TypeScript
- **Backend**: FastAPI, SQLAlchemy, Python
- **AI/ML**: OpenAI, Pinecone (Vector Database)
- **Authentication**: Google OAuth

## Getting Started

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/your-username/emailbot.git
cd emailbot
```

2. **Set up the backend**
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

3. **Set up the frontend**
```bash
cd frontend
npm install
npm run dev
```

4. **Configure environment variables**
   - Create `.env` files in both frontend and backend directories
   - See `.env.example` files for required variables

### Deployment

For detailed deployment instructions, see [Deployment Guide](docs/deployment.md).

## Project Structure

- `/backend`: FastAPI application with API routes and services
  - `/app`: Main application code
    - `/api`: API routes
    - `/models`: Database models
    - `/services`: Business logic and services
- `/frontend`: Next.js application with React components
  - `/src`: Source code
    - `/app`: Next.js app directory with pages
    - `/components`: Reusable React components
    - `/lib`: Utilities and API client

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

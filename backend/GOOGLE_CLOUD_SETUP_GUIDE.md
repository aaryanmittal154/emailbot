# Google Cloud Setup for Gmail Push Notifications

This guide will walk you through the necessary steps to set up Google Cloud for receiving Gmail push notifications in your EmailBot application.

## Prerequisites

1. A Google Cloud Platform account
2. A Gmail account for testing
3. Your EmailBot application running

## Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Create Project" at the top of the page
3. Enter a project name (e.g., "EmailBot")
4. Click "Create"

## Step 2: Enable Required APIs

1. In your new project, go to "APIs & Services" > "Library"
2. Search for and enable the following APIs:
   - Gmail API
   - Cloud Pub/Sub API

## Step 3: Create Service Account and Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Enter a name for your service account and click "Create"
4. Grant the service account the following roles:
   - Pub/Sub Editor
   - Gmail API Admin
5. Click "Continue" > "Done"
6. On the Credentials page, find your new service account
7. Click on it and then click "Add Key" > "Create new key"
8. Choose JSON format and click "Create"
9. Save the downloaded JSON file securely - this is your service account key

## Step 4: Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Select "External" and click "Create"
3. Fill in the required fields (App name, User support email, Developer contact email)
4. Click "Save and Continue"
5. Under "Scopes", click "Add or Remove Scopes"
6. Add the following scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.settings.basic`
7. Click "Save and Continue"
8. Add test users (your Gmail accounts for testing)
9. Click "Save and Continue" then "Back to Dashboard"

## Step 5: Create OAuth Client ID

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Web application" as the application type
4. Enter a name (e.g., "EmailBot Web Client")
5. Under "Authorized redirect URIs", add:
   - `https://your-app-domain.com/api/auth/google/callback`
   - `http://localhost:8000/api/auth/google/callback` (for local testing)
6. Click "Create"
7. Save the Client ID and Client Secret

## Step 6: Create a Pub/Sub Topic

1. Go to "Pub/Sub" > "Topics"
2. Click "Create Topic"
3. Enter a name following this format: `gmail-notifications-user-{userId}`
   - For example: `gmail-notifications-user-1` for the first user
4. Click "Create"

## Step 7: Create a Push Subscription

1. On your topic page, click "Create Subscription"
2. Enter a name (e.g., `gmail-notifications-sub-1`)
3. Set "Delivery Type" to "Push"
4. Enter your webhook URL: `https://your-app-domain.com/api/auto-reply/gmail-webhook`
5. Under "Authentication", select "Enable authentication"
6. Create a service account with the Pub/Sub Publisher role or use an existing one
7. Click "Create"

## Step 8: Update Environment Variables

Add these environment variables to your `.env` file:

```env
GOOGLE_CLIENT_ID=your_oauth_client_id
GOOGLE_CLIENT_SECRET=your_oauth_client_secret
GOOGLE_CLOUD_PROJECT=your_project_id
GMAIL_WEBHOOK_SECRET=a_random_secure_string
```

Note: Generate a secure random string for `GMAIL_WEBHOOK_SECRET` and use it to validate webhook requests.

## Step 9: Test the Configuration

1. Start your EmailBot application
2. Log in with a Gmail account
3. Call the `/api/auto-reply/enable-instant-auto-reply` endpoint
4. Send a test email to your Gmail account
5. Check the application logs to see if the webhook is triggered

## Troubleshooting

### Common Issues

1. **Webhook not receiving notifications**:
   - Check if your application is publicly accessible
   - Verify the webhook URL in the Pub/Sub subscription
   - Ensure the webhook secret matches

2. **Authorization errors**:
   - Check if all required API permissions are granted
   - Verify OAuth scopes are correct
   - Ensure the service account has the right permissions

3. **Rate limiting**:
   - Gmail has limits on notifications and API calls
   - Implement proper backoff and retry strategies

4. **Webhook validation failing**:
   - Ensure `GMAIL_WEBHOOK_SECRET` is properly set
   - Check that the secret is being validated correctly in your code

## Resources

- [Gmail API Documentation](https://developers.google.com/gmail/api/guides)
- [Pub/Sub Documentation](https://cloud.google.com/pubsub/docs)
- [Gmail Push Notifications Guide](https://developers.google.com/gmail/api/guides/push)

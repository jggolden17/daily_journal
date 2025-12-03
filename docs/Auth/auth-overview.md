# Authentication Overview

Auth is essential for this project, both as a learning exercise, and because in order to actually use the journal I need to have confidence the data is secure.

## Architecture Overview

Auth strategy: client-side oauth pattern w jwt tokens:

```
User → Google Login → Frontend (ID Token) → Backend (Verify & Exchange) → JWT Token → API Requests
```

Might in future extend with:
- [ ] encrypting the markdown stored in DB
- [ ] setting up self-hosted OpenVPN and then restricting access to come within the VPN with 2-factor auth

## Authentication Flow

_To do_: make diagram

### Step 1: User Initiates Login

1. User visits the application and clicks "Sign in with Google"
2. The frontend uses the `@react-oauth/google` library to render Google's OAuth button
3. The Google OAuth SDK handles the authentication popup/modal

### Step 2: Google Returns ID Token

1. After successful Google authentication, Google returns an **ID token** (JWT) to the frontend
2. This ID token contains user information (email, name, picture) and is signed by Google
3. The frontend receives this token via the `onSuccess` callback

### Step 3: Frontend Sends ID Token to Backend

The frontend sends the Google ID token to the backend for verification and exchange:

### Step 4: Backend Verifies Google ID Token & gets user

The backend performs several verification steps:

1. **Verify Token Signature**: Uses Google's public keys to verify the token is authentic
2. **Verify Issuer**: Ensures the token was issued by `accounts.google.com`
3. **Verify Client ID**: Confirms the token was issued for our application's Client ID
4. **Extract User Info**: Extracts email, name, picture, and Google user ID (sub)
5. **Find/Create/Update User** queries DB for user using `sub`; creates if not found, updates if found and any details changed

### Step 5: Backend Generates JWT Access Token

After verifying the Google token and ensuring the user exists, the backend:

1. Generates a **JWT access token** using the user's UUID
2. Signs it with a secret key (`JWT_SECRET_KEY`)
3. Sets expiration time
4. Returns both the token and user information

### Step 6: Frontend Stores Token

The frontend stores the JWT access token in **localStorage** for subsequent API requests:

### Step 7: Making Authenticated API Requests

After login, all subsequent API requests include the JWT token in the Authorization header. For protected endpoints, the backend verifies the token.
# Password Reset Implementation

## Overview
Password reset functionality has been implemented using Appwrite's built-in password recovery features.

## Components

### 1. Appwrite Functions (`lib/appwrite.ts`)
- `requestPasswordReset(email, resetUrl)` - Sends password reset email
- `completePasswordReset(userId, secret, newPassword)` - Completes password reset

### 2. Screens
- **[app/forgot-password.tsx](app/forgot-password.tsx)** - Request password reset
- **[app/reset-password.tsx](app/reset-password.tsx)** - Complete password reset with token
- **[app/login.tsx](app/login.tsx)** - Updated with "Forgot?" link

## User Flow

1. User clicks "Forgot?" on login screen
2. User enters email on forgot-password screen
3. Appwrite sends email with reset link
4. User clicks link in email (deep link: `budgetapp://reset-password?userId=...&secret=...`)
5. App opens reset-password screen with userId and secret params
6. User enters new password
7. Password is reset, user redirected to login

## Appwrite Configuration

### Important: No Console Configuration Needed!
Appwrite handles password recovery URLs programmatically - the URL is passed when you call `requestPasswordReset()` in your code. You don't need to configure anything in the Appwrite Console under Auth > Settings.

### Current Implementation
The app currently sends the reset URL programmatically. Appwrite will send an email with a reset link containing these query parameters:
- `userId` - The user's ID  
- `secret` - The reset token
- `expire` - Token expiration timestamp

### Three Options for Password Reset

**Option 1: In-App Reset (Simplest - Recommended)**
User manually opens the app after clicking email link and enters reset code:
- User receives email with a 6-digit code
- User opens app, goes to reset screen
- User enters code + new password
- No deep linking needed

**Option 2: Mobile Deep Link**
Update [app/forgot-password.tsx](app/forgot-password.tsx) line 21 to:
```typescript
const resetUrl = "budgetapp://reset-password";
```
Pros: Seamless UX - clicking email opens app directly
Cons: Requires proper deep linking setup (see Deep Linking section below)

**Option 3: Web-based Reset**
Point to a web URL:
```typescript
const resetUrl = "https://yourwebsite.com/reset-password";
```
Pros: Works anywhere, no app required
Cons: User completes reset on web, not in app

### Recommended: Email Templates
In the Appwrite Console under **Auth** → **Templates**, you can customize:
- Password recovery email subject
- Email body with {{url}} placeholder for reset link
- Sender name and email

## Deep Linking

The app uses the scheme `budgetapp://` (configured in [app.json](app.json)):
```json
{
  "expo": {
    "scheme": "budgetapp"
  }
}
```

### Testing Deep Links

**iOS Simulator:**
```bash
xcrun simctl openurl booted "budgetapp://reset-password?userId=test&secret=test123"
```

**Android Emulator:**
```bash
adb shell am start -W -a android.intent.action.VIEW -d "budgetapp://reset-password?userId=test&secret=test123"
```

**Physical Device:**
Send the deep link URL via email/message and click it on the device.

## Security Notes

- Password reset tokens (secret) are single-use and expire
- Minimum password length: 8 characters
- Password confirmation required
- Both userId and secret must be valid
- Invalid tokens show error message prompting user to request new reset

## Usage Example

From login screen:
```tsx
<Pressable onPress={() => router.push("/forgot-password")}>
  <Text>Forgot?</Text>
</Pressable>
```

The reset link format from Appwrite:
```
budgetapp://reset-password?userId=6789abc&secret=def123&expire=2024-01-01
```

## Troubleshooting

**Issue:** Email not received
- Check spam/junk folder
- Verify email address is correct
- Check Appwrite email configuration (SMTP settings)

**Issue:** Deep link doesn't open app
- Verify `scheme` in app.json matches reset URL
- On iOS, uninstall and reinstall app to register scheme
- Test with manual deep link command first

**Issue:** "Invalid reset link" error
- Token may have expired (check Appwrite token expiry settings)
- Token may have been used already
- Request a new password reset

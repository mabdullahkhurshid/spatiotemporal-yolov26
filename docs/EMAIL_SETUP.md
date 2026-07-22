# Why Verification Code Is Not Received in Email

The app sends verification emails (OTP) when users register. If you don't receive them, check the following.

## 1. Email is not configured in `.env`

The server needs real SMTP credentials. In your project root `.env`:

- **EMAIL_HOST** – e.g. `smtp.gmail.com`
- **EMAIL_PORT** – e.g. `587` (or `465` for SSL)
- **EMAIL_USER** – your full email (e.g. `you@gmail.com`)
- **EMAIL_PASS** – **App Password** (see below), not your normal Gmail password
- **EMAIL_FROM** – sender address; use the same as `EMAIL_USER` for Gmail to avoid issues

Replace placeholders like `your-email@gmail.com` and `your-app-password` with real values.

## 2. Gmail: use an App Password

Gmail often blocks "less secure apps" and normal passwords. Use an **App Password**:

1. Turn on **2-Step Verification** for your Google account:  
   [Google Account → Security → 2-Step Verification](https://myaccount.google.com/security)
2. Create an **App Password**:  
   [Google Account → Security → App passwords](https://myaccount.google.com/apppasswords)  
   - Select "Mail" and your device, then generate.
3. Put the **16-character password** (no spaces) in `.env` as `EMAIL_PASS`.

If you see **"Invalid login"** or **"535 Username and Password not accepted"** in the server logs, the credentials are wrong or you are still using the normal account password instead of an App Password.

## 3. Server logs

On startup the server will log either:

- `Email service is ready` – SMTP check passed; emails should send.
- `Email service not available: ...` – SMTP check failed; fix `.env` and restart.

When someone registers, a failed send is logged as `Email send error: ...`. Registration still succeeds; only the email is skipped.

## 4. Spam folder

Check the recipient’s **Spam/Junk** folder. First emails from a new sender often land there.

## 5. Quick checklist

- [ ] `.env` has real `EMAIL_USER` and `EMAIL_PASS` (Gmail App Password).
- [ ] `EMAIL_FROM` is set (same as `EMAIL_USER` for Gmail is safest).
- [ ] Server was restarted after changing `.env`.
- [ ] Startup log says "Email service is ready".
- [ ] Checked Spam folder.

After fixing `.env` and restarting the server, try registering again; the verification email should be sent (and may still need to be allowed from Spam the first time).

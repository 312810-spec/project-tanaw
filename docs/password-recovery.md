# Password recovery implementation

The app uses the installed Supabase SSR PKCE flow. `/forgot-password` requests a recovery link; `/auth/callback` exchanges the code and sends the user to a fixed `/reset-password` destination. Password changes require a fresh `getUser()` check. No school role or membership is created, enabled or changed during recovery.

Set `TANAW_APP_ORIGIN` to the exact trusted application origin. The callback does not use caller-supplied destination parameters or an internal Next.js hostname. Configure the exact `/auth/callback` URL in the authentication service redirect allowlist. The repository change configures the isolated local origin only; hosted settings are untouched.

Production email delivery requires a configured authentication SMTP provider. A local Mailpit test captures synthetic mail and follows its recovery link without contacting real recipients. Browser acceptance covers the full PKCE callback, new-password sign-in, anonymous change denial and preservation of disabled membership. Do not claim real email delivery or a TNHS pilot based on synthetic checks.

Primary API references consulted on 2026-10-08:
- https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/server-side/advanced-guide
- https://mailpit.axllent.org/docs/api-v1/

Account provisioning and attributable unfinished-work handover remain separate pending features. Privileged credentials must follow the existing repository operating rules; do not place them in client code or local repository files.

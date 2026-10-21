# Explicit quick-start account discard

Anonymous users can now leave deliberately, rather than being forced to link an
email before logout. Email-registered accounts still use normal non-deleting logout.

## User flow

* Existing-email link errors offer the switch dialog with an irreversible deletion
  warning and password field. No public email-existence lookup endpoint is added.
* A separate nonpersistent Supabase client authenticates the target password.
  Failed authentication, cancellation or a rejected delete leaves the guest intact.
* The current guest is deleted with its own original JWT and an explicit confirmation.
  Only after a successful response does the primary client adopt the target session.
* No Gold/items/skins/nickname are merged into or saved over the existing account.
  Local guest progress is reset; a durable target marker suppresses legacy import.
* Anonymous logout shows the same irreversible warning, deletes, then clears the
  local auth session. Ordinary email logout never invokes the deletion endpoint.
* If deletion succeeded but session adoption fails, report that honestly, clear
  the invalid guest session and ask the user to log in to the existing email again.

## Server

Migration `20261021123758_guest_exit_switch.sql` wraps the existing API without
changing gameplay actions. It verifies `auth.uid()`, the stored `auth.users`
anonymous flag, a live matching `auth.sessions` row, non-admin role, explicit
confirmation and the expected current ID. Arbitrary target/user ID parameters
are rejected. Stored user metadata never authorizes deletion.

An auth-row lock prevents concurrent email conversion from being deleted. The
game-state lock serializes gameplay writes. Auth identities/sessions and gameplay
rows are removed transactionally. Any constraint failure rolls back the entire
operation. Safe retries after lost success responses never recreate an account.
All other game APIs reject a deleted user's still-unexpired JWT.

Financial orders and audit records remain as history. Their player reference is
detached on deletion; the original UUID is retained in `deleted_user_id` or audit
details. Entitlements, cosmetic equipment and starter-grant progress are removed.
No mass cleanup, scheduled purge or existing-account deletion runs on deployment.
The public API wrapper remains the only granted entry point; the renamed internal
wrapper is not executable by anonymous/authenticated clients.

## Validation

Run all `tools/*.test.mjs`, including SQL, actual production-auth adapter tests and
controller tests. `tools/guest-exit-browser.py` exercises actual UI cancellation,
wrong password, server failure, switching without legacy import, refresh, regular
logout and confirmed guest deletion on desktop and touch 320/390 portrait and
844 landscape emulation. No physical phone claim. Screenshots are ignored artifacts.

After applying the migration, run `tools/guest-exit-production-check.sql`: only
synthetic users are modified and every test write rolls back. Verify actual Pages
HTML/JS/CSS after pushing main; a Git push alone is not database deployment proof.

# Project instructions

## Commit and push completed patches

The user has authorized automatically committing and pushing future completed changes in this project to GitHub.

- After completing a requested edit or patch, run the checks appropriate to the change, then commit the task's changes and push to the configured GitHub remote without asking for permission again.
- Commit at the end of a completed patch, not after each individual file edit.
- Inspect the working tree before staging. Do not include unrelated, pre-existing, or concurrent changes from other tasks.
- Never commit secrets, credentials, or temporary test artifacts.
- Do not force-push or overwrite remote history. If authentication, remote changes, or checks block the push, report the blocker and whether the commit or push succeeded.
- In the final response, report the validation performed and the commit and push outcome. Pushing application files does not by itself confirm deployment of database migrations or other server changes.

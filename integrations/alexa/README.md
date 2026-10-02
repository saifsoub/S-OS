# Alexa ↔ GitHub bridge

Voice control surface for S-OS.

## Initial intents
- CreateIssueIntent
- CheckRepoIntent
- RunWorkflowIntent
- LatestBuildIntent

## Architecture
Alexa Custom Skill → Alexa-hosted backend → GitHub REST API → approved repositories/actions.

## Security
Use a fine-grained GitHub token stored as a secret/environment variable. Never commit tokens.
Start with the minimum repository permissions required. Expand only when an intent requires it.

## Alexa setup
Create a Custom Skill and use the interaction model in `interaction-model.json`.
Deploy `lambda/index.js` as the Alexa-hosted Node.js handler.
Set `GITHUB_TOKEN`, `GITHUB_OWNER`, and optionally `GITHUB_DEFAULT_REPO` in the skill environment.

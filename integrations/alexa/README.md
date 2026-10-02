# Alexa ↔ GitHub integration

S-OS voice bridge for GitHub.

Initial commands:
- create issue
- check repository status
- run workflow
- read latest workflow result

Security:
- GitHub credential is supplied at runtime only.
- Never commit tokens.
- Restrict the credential to this repository and only the permissions required by enabled commands.

Target flow:
Alexa Custom Skill → skill backend → GitHub API → S-OS

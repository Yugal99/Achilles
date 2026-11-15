# CLAUDE.md

@AGENTS.md

## Writing

Use the `no-ai-slop` skill ([.claude/skills/no-ai-slop/SKILL.md](.claude/skills/no-ai-slop/SKILL.md), from https://github.com/petergyang/no-ai-slop) for prose a person will read:

- README and `docs/` text, PR descriptions and commit messages
- UI copy in `frontend/`
- Finding descriptions and fix tips, including the built-in rule table in `backend-a/app/tips.py` and the prompts that ask the AI providers to write tips

Write new prose to the skill's rules from the start: no banned words, no binary contrasts, colon reveals, importance puffery or summary-recap endings, and no em-dash clusters. When editing existing text, make the minimum effective edit and keep the writer's voice. When asked whether text reads as AI, run the skill in detect mode and report the named patterns without rewriting.

The skill doesn't apply to code, config, tool output or the `Finding` schema.

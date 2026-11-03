# Project agents

Subagents for this repo, one responsibility each: `planner`, `backend-dev`, `mobile-dev`, `web-dev`, `qa`, `code-reviewer`, `security-reviewer`, `docs-writer`. Each one starts by reading `CLAUDE.md`, `docs/engineering-rules.md`, `docs/glossary.md` and the issue it works on.

## Optional skills

Some agents mention skills to invoke with the `Skill` tool. They come from personal plugins installed on the maintainers' machines and are **not part of this repo**:

| Plugin | Skills used |
| --- | --- |
| `ecc` | `api-design`, `django-patterns`, `django-tdd`, `django-security`, `security-review`, `react-patterns`, `react-native-patterns`, `react-testing`, `frontend-a11y`, `python-testing`, `coding-standards`, `architecture-decision-records` |
| `superpowers` | `writing-plans`, `verification-before-completion` |
| `anthropic-skills` | `django-safe-migration` |
| personal skill | `django-expert` |

**Agents must work without them.** If a skill is missing, skip it and follow `docs/engineering-rules.md`; the rules there are the source of truth, the skills are only helpers.

---
description: "Generate a reusable workspace .prompt.md file for a defined development task."
name: "Create prompt file"
argument-hint: "Describe the repeatable task or goal for the prompt"
agent: "agent"
---
Create a workspace prompt file that captures a single focused developer task. Use the task description below and write a complete `.prompt.md` file:
- Keep the prompt narrowly scoped to one task.
- Include frontmatter with `description`, optional `name`, optional `argument-hint`, and `agent`.
- Do not include unrelated tasks or multi-step workflows.
- If the task requires specific tools, declare only the tools actually needed.
- Provide the full prompt file contents as Markdown.

Task description:
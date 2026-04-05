# Agent: Explore

Fast agent for exploring the codebase — finding files by pattern, searching for keywords, and answering questions about structure.

## When to use

- Tracing where a CSS class or component is used across the project
- Open-ended questions like "which components handle form state?"
- When a simple Grep/Glob search isn't sufficient across multiple locations

## Note

For simple, targeted searches (specific file, class, function) use Grep or Glob directly — it's faster than spawning the Explore agent.

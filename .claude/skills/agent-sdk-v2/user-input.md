# User Input & Approvals

Claude requests user input in two situations:
1. **Tool permission** - Needs approval for a tool
2. **Clarifying questions** - Asks via `AskUserQuestion` tool

Both trigger your `canUseTool` callback.

## Handling Tool Approvals

```typescript
async function canUseTool(toolName: string, input: any) {
  console.log(`Tool: ${toolName}`);

  if (toolName === "Bash") {
    console.log(`Command: ${input.command}`);
    if (input.description) console.log(`Description: ${input.description}`);
  } else {
    console.log(`Input: ${JSON.stringify(input, null, 2)}`);
  }

  const response = await prompt("Allow this action? (y/n): ");

  if (response.toLowerCase() === "y") {
    return { behavior: "allow", updatedInput: input };
  } else {
    return { behavior: "deny", message: "User denied this action" };
  }
}
```

### Tool Input Fields

| Tool | Input Fields |
|------|--------------|
| `Bash` | `command`, `description`, `timeout` |
| `Write` | `file_path`, `content` |
| `Edit` | `file_path`, `old_string`, `new_string` |
| `Read` | `file_path`, `offset`, `limit` |

## Handling AskUserQuestion

When Claude has clarifying questions, it calls `AskUserQuestion`:

```typescript
canUseTool: async (toolName, input) => {
  if (toolName === "AskUserQuestion") {
    return handleClarifyingQuestions(input);
  }
  // Handle other tools...
  return promptForApproval(toolName, input);
}
```

### Question Format

```json
{
  "questions": [
    {
      "question": "How should I format the output?",
      "header": "Format",
      "options": [
        { "label": "Summary", "description": "Brief overview" },
        { "label": "Detailed", "description": "Full explanation" }
      ],
      "multiSelect": false
    }
  ]
}
```

### Collecting Answers

```typescript
async function handleAskUserQuestion(input: any) {
  const answers: Record<string, string> = {};

  for (const q of input.questions) {
    console.log(`\n${q.header}: ${q.question}`);

    q.options.forEach((opt: any, i: number) => {
      console.log(`  ${i + 1}. ${opt.label} - ${opt.description}`);
    });

    if (q.multiSelect) {
      console.log("  (Enter numbers separated by commas, or type your own)");
    } else {
      console.log("  (Enter a number, or type your own answer)");
    }

    const response = await prompt("Your choice: ");
    answers[q.question] = parseResponse(response, q.options);
  }

  return {
    behavior: "allow",
    updatedInput: { questions: input.questions, answers }
  };
}

function parseResponse(response: string, options: any[]): string {
  const indices = response.split(",").map(s => parseInt(s.trim()) - 1);
  const labels = indices
    .filter(i => !isNaN(i) && i >= 0 && i < options.length)
    .map(i => options[i].label);
  return labels.length > 0 ? labels.join(", ") : response;
}
```

### Response Format

Return answers mapping question text to selected label(s):

```typescript
{
  behavior: "allow",
  updatedInput: {
    questions: input.questions,  // Required: pass through original
    answers: {
      "How should I format the output?": "Summary",
      "Which sections should I include?": "Introduction, Conclusion"
    }
  }
}
```

For multi-select, join labels with `", "`. For free-text, use the user's custom text directly.

## Free-Text Input

Support custom answers beyond predefined options:

```typescript
const response = await prompt("Your choice: ");

// Check if numeric (option selection) or free text
const num = parseInt(response);
if (!isNaN(num) && num >= 1 && num <= options.length) {
  return options[num - 1].label;
} else {
  return response;  // User's custom text
}
```

## Limitations

- **60-second timeout**: `canUseTool` must return within 60 seconds
- **Subagents**: `AskUserQuestion` not available in Task tool subagents
- **Question limits**: 1-4 questions with 2-4 options each

## Plan Mode Questions

`AskUserQuestion` is especially common in `plan` mode where Claude explores the codebase and asks questions before proposing a plan.

```typescript
for await (const message of query({
  prompt: "Help me refactor authentication",
  options: {
    permissionMode: "plan",
    canUseTool: async (toolName, input) => {
      if (toolName === "AskUserQuestion") {
        // Present questions to user
        return handleClarifyingQuestions(input);
      }
      return { behavior: "allow", updatedInput: input };
    }
  }
})) {
  // Claude will ask clarifying questions before presenting plan
}
```

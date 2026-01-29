# Structured Outputs

Get validated JSON matching your schema from agent workflows.

## Why Structured Outputs?

Without structured outputs, you get free-form text that needs parsing. With structured outputs, you get typed data you can use directly.

## Quick Start

```typescript
const schema = {
  type: "object",
  properties: {
    company_name: { type: "string" },
    founded_year: { type: "number" },
    headquarters: { type: "string" }
  },
  required: ["company_name"]
};

for await (const message of query({
  prompt: "Research Anthropic and provide key company information",
  options: {
    outputFormat: {
      type: "json_schema",
      schema: schema
    }
  }
})) {
  if (message.type === "result" && message.structured_output) {
    console.log(message.structured_output);
    // { company_name: "Anthropic", founded_year: 2021, headquarters: "San Francisco" }
  }
}
```

## Type-Safe Schemas with Zod

```typescript
import { z } from "zod";

const FeaturePlan = z.object({
  feature_name: z.string(),
  summary: z.string(),
  steps: z.array(z.object({
    step_number: z.number(),
    description: z.string(),
    estimated_complexity: z.enum(["low", "medium", "high"])
  })),
  risks: z.array(z.string())
});

type FeaturePlan = z.infer<typeof FeaturePlan>;

const schema = z.toJSONSchema(FeaturePlan);

for await (const message of query({
  prompt: "Plan how to add dark mode support",
  options: { outputFormat: { type: "json_schema", schema } }
})) {
  if (message.type === "result" && message.structured_output) {
    const parsed = FeaturePlan.safeParse(message.structured_output);
    if (parsed.success) {
      const plan: FeaturePlan = parsed.data;
      console.log(`Feature: ${plan.feature_name}`);
      plan.steps.forEach(step => {
        console.log(`${step.step_number}. [${step.estimated_complexity}] ${step.description}`);
      });
    }
  }
}
```

## Type-Safe Schemas with Pydantic (Python)

```python
from pydantic import BaseModel

class Step(BaseModel):
    step_number: int
    description: str
    estimated_complexity: str  # 'low', 'medium', 'high'

class FeaturePlan(BaseModel):
    feature_name: str
    summary: str
    steps: list[Step]
    risks: list[str]

async for message in query(
    prompt="Plan how to add dark mode support",
    options=ClaudeAgentOptions(
        output_format={
            "type": "json_schema",
            "schema": FeaturePlan.model_json_schema()
        }
    )
):
    if isinstance(message, ResultMessage) and message.structured_output:
        plan = FeaturePlan.model_validate(message.structured_output)
        print(f"Feature: {plan.feature_name}")
```

## Configuration

The `outputFormat` option accepts:

- `type`: Set to `"json_schema"`
- `schema`: A JSON Schema object

Supports standard JSON Schema features: object, array, string, number, boolean, null, enum, const, required, nested objects, $ref definitions.

## Example: TODO Extraction

```typescript
const todoSchema = {
  type: "object",
  properties: {
    todos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          file: { type: "string" },
          line: { type: "number" },
          author: { type: "string" },  // Optional
          date: { type: "string" }     // Optional
        },
        required: ["text", "file", "line"]
      }
    },
    total_count: { type: "number" }
  },
  required: ["todos", "total_count"]
};

// Agent uses Grep to find TODOs, Bash for git blame
for await (const message of query({
  prompt: "Find all TODO comments and identify who added them",
  options: { outputFormat: { type: "json_schema", schema: todoSchema } }
})) {
  if (message.type === "result" && message.structured_output) {
    const data = message.structured_output;
    console.log(`Found ${data.total_count} TODOs`);
    data.todos.forEach(todo => {
      console.log(`${todo.file}:${todo.line} - ${todo.text}`);
      if (todo.author) {
        console.log(`  Added by ${todo.author} on ${todo.date}`);
      }
    });
  }
}
```

## Error Handling

| Subtype | Meaning |
|---------|---------|
| `success` | Output generated and validated |
| `error_max_structured_output_retries` | Agent couldn't produce valid output |

```typescript
for await (const msg of query({ prompt, options })) {
  if (msg.type === "result") {
    if (msg.subtype === "success" && msg.structured_output) {
      console.log(msg.structured_output);
    } else if (msg.subtype === "error_max_structured_output_retries") {
      console.error("Could not produce valid output");
      // Retry with simpler prompt or fall back to unstructured
    }
  }
}
```

## Tips for Avoiding Errors

- **Keep schemas focused**: Deeply nested schemas are harder to satisfy
- **Match schema to task**: Make fields optional if info might not be available
- **Use clear prompts**: Ambiguous prompts make it harder to produce correct output

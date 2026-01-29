import { auth } from "@/auth";
import { query } from "@anthropic-ai/claude-agent-sdk";

const SYSTEM_PROMPT = `You are a helpful AI assistant for Team Chat, a collaborative communication app for AI agent teams. You help users understand the app's features and answer their questions.

## About Team Chat

Team Chat is a dashboard for managing AI agent teams. Key features include:

### Channels
- **Team channel**: Broadcast messages to all team members
- **Research channel**: Focused discussions on research topics
- **Direct messages**: Private 1:1 conversations between agents or users

### Agents
The app supports different types of AI agents:
- **Alice**: A philosopher specializing in epistemology and argumentation
- **Bob**: A computer scientist focused on AI/ML and uncertainty quantification
- **Charlie**: A psychologist specializing in decision theory, HCI, and user trust

### Creating New Agents
When creating a new agent, you need:
1. A unique name and role description
2. A system prompt that defines their personality and expertise
3. Tool permissions (which tools they can use)

### System Prompts
A good system prompt for an agent should include:
- Their role and expertise area
- Their communication style and personality
- How they should interact with other team members
- Any specific knowledge domains they specialize in

### Features
- Real-time messaging with streaming responses
- Session management for conversation context
- Team status updates and standups
- Issue tracking with the Beads system

Be concise and helpful. If asked to help write a system prompt, ask clarifying questions about the agent's intended role and personality.`;

export async function POST(request: Request) {
  // Auth check
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { message, sessionId } = body as {
      message: string;
      sessionId?: string;
    };

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let newSessionId: string | undefined;

          // Build the prompt with conversation context
          const prompt = sessionId
            ? message // If resuming, just send the new message
            : `${SYSTEM_PROMPT}\n\nUser question: ${message}`;

          // Use the Agent SDK query function
          for await (const event of query({
            prompt: sessionId ? message : prompt,
            options: {
              // Resume from existing session if we have one
              ...(sessionId && { resume: sessionId }),
              // No tools needed for a simple Q&A assistant
              allowedTools: [],
              // System prompt only on first message
              ...(!sessionId && { systemPrompt: SYSTEM_PROMPT }),
            },
          })) {
            // Handle different event types based on the SDK's message structure
            const ev = event as Record<string, unknown>;

            if (ev.type === "system" && ev.subtype === "init") {
              // Capture the session ID for future messages
              newSessionId = ev.session_id as string;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ sessionId: newSessionId })}\n\n`,
                ),
              );
            } else if (ev.type === "assistant" && Array.isArray(ev.content)) {
              // Stream text content from assistant messages
              for (const block of ev.content) {
                if (
                  typeof block === "object" &&
                  block !== null &&
                  "type" in block &&
                  block.type === "text" &&
                  "text" in block
                ) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ text: block.text })}\n\n`,
                    ),
                  );
                }
              }
            } else if ("result" in ev && typeof ev.result === "string") {
              // Final result
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ text: ev.result })}\n\n`,
                ),
              );
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("[Assistant API] Error:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: errorMessage })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Assistant API] Request error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

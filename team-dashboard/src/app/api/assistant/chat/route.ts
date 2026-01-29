import { auth } from "@/auth";
import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
  type SDKMessage,
} from "@anthropic-ai/claude-agent-sdk";

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
        // Create or resume session using V2 API
        const session = sessionId
          ? unstable_v2_resumeSession(sessionId, {
              model: "claude-sonnet-4-5-20250929",
              allowedTools: [],
            })
          : unstable_v2_createSession({
              model: "claude-sonnet-4-5-20250929",
              allowedTools: [],
            });

        try {
          // For new sessions, prepend system prompt to first message
          const messageToSend = sessionId
            ? message
            : `${SYSTEM_PROMPT}\n\nUser question: ${message}`;

          // Send message to the session
          await session.send(messageToSend);

          // Stream responses
          let sentSessionId = false;
          for await (const msg of session.stream()) {
            const event = msg as SDKMessage;

            // Send session ID on first message (available on all messages)
            if (!sentSessionId && "session_id" in event) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ sessionId: event.session_id })}\n\n`,
                ),
              );
              sentSessionId = true;
            }

            // Stream text content from assistant messages
            if (event.type === "assistant" && "message" in event) {
              const content = event.message?.content;
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block.type === "text" && "text" in block) {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ text: block.text })}\n\n`,
                      ),
                    );
                  }
                }
              }
            }

            // Handle result messages
            if (event.type === "result" && "result" in event) {
              const result = (event as { result?: string }).result;
              if (typeof result === "string" && result) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ text: result })}\n\n`,
                  ),
                );
              }
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
        } finally {
          // Always close the session
          session.close();
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

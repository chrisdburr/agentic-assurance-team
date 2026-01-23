import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Message } from "@/lib/api";

interface MessagesTabProps {
  messages: Message[];
}

const agentColors: Record<string, string> = {
  alice: "bg-purple-500",
  bob: "bg-blue-500",
  charlie: "bg-green-500",
  team: "bg-gray-500",
};

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return date.toLocaleDateString();
}

export function MessagesTab({ messages }: MessagesTabProps) {
  // Group messages by date
  const groupedMessages = messages.reduce(
    (groups, message) => {
      const date = formatDate(message.timestamp);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
      return groups;
    },
    {} as Record<string, Message[]>
  );

  if (messages.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No messages yet. Team communication will appear here.
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-6">
        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date}>
            <div className="sticky top-0 bg-background py-2 text-sm font-medium text-muted-foreground">
              {date}
            </div>
            <div className="space-y-3">
              {msgs.map((message) => (
                <Card key={message.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback
                          className={`${agentColors[message.from_agent] || "bg-gray-500"} text-white text-xs`}
                        >
                          {message.from_agent.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <CardTitle className="text-sm font-medium capitalize">
                          {message.from_agent}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        {message.to_agent === "team" ? (
                          <Badge variant="secondary">Broadcast</Badge>
                        ) : (
                          <Badge variant="outline">To: {message.to_agent}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

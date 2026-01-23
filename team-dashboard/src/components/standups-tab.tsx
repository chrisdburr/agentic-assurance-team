import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Standup } from "@/lib/api";

interface StandupsTabProps {
  standups: Standup[];
  selectedDate: string;
  onDateChange: (date: string) => void;
}

const agentColors: Record<string, string> = {
  alice: "bg-purple-500",
  bob: "bg-blue-500",
  charlie: "bg-green-500",
};

const agentNames: Record<string, string> = {
  alice: "Alice (Philosopher)",
  bob: "Bob (Computer Scientist)",
  charlie: "Charlie (Psychologist)",
};

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function StandupsTab({
  standups,
  selectedDate,
  onDateChange,
}: StandupsTabProps) {
  // Group standups by session
  const groupedBySession = standups.reduce(
    (groups, standup) => {
      const key = standup.session_id || "individual";
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(standup);
      return groups;
    },
    {} as Record<string, Standup[]>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Date:</label>
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-auto"
        />
      </div>

      {standups.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No standups for {selectedDate}. Standup updates will appear here.
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[550px]">
          <div className="space-y-6">
            {Object.entries(groupedBySession).map(([sessionId, sessionStandups]) => (
              <Card key={sessionId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {sessionId === "individual"
                        ? "Individual Updates"
                        : `Standup Session`}
                    </CardTitle>
                    {sessionId !== "individual" && (
                      <Badge variant="outline" className="font-mono text-xs">
                        {sessionId.slice(0, 8)}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sessionStandups.map((standup, index) => (
                    <div key={standup.id}>
                      {index > 0 && <Separator className="my-4" />}
                      <div className="flex gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback
                            className={`${agentColors[standup.agent_id] || "bg-gray-500"} text-white`}
                          >
                            {standup.agent_id.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {agentNames[standup.agent_id] || standup.agent_id}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(standup.timestamp)}
                            </span>
                          </div>
                          <div className="text-sm whitespace-pre-wrap rounded-lg bg-muted p-3">
                            {standup.content}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

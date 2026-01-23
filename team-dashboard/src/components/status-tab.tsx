import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Status, TeamMember } from "@/lib/api";

interface StatusTabProps {
  statuses: Status[];
  roster: TeamMember[];
}

const agentColors: Record<string, string> = {
  alice: "bg-purple-500",
  bob: "bg-blue-500",
  charlie: "bg-green-500",
};

const statusColors: Record<string, string> = {
  active: "bg-green-500",
  idle: "bg-yellow-500",
  offline: "bg-gray-400",
};

const statusLabels: Record<string, string> = {
  active: "Active",
  idle: "Idle",
  offline: "Offline",
};

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function StatusTab({ statuses, roster }: StatusTabProps) {
  // Create a map of statuses by agent_id
  const statusMap = new Map(statuses.map((s) => [s.agent_id, s]));

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {roster.map((member) => {
        const status = statusMap.get(member.id);
        const currentStatus = status?.status || "offline";

        return (
          <Card key={member.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback
                      className={`${agentColors[member.id] || "bg-gray-500"} text-white text-lg`}
                    >
                      {member.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${statusColors[currentStatus]}`}
                  />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">{member.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{member.role}</p>
                </div>
                <Badge
                  variant={currentStatus === "active" ? "default" : "secondary"}
                  className="capitalize"
                >
                  {statusLabels[currentStatus]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Expertise
                </p>
                <p className="text-sm">{member.expertise}</p>
              </div>

              {status?.working_on && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Working On
                  </p>
                  <p className="text-sm">{status.working_on}</p>
                </div>
              )}

              {status?.beads_id && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Issue
                  </p>
                  <Badge variant="outline" className="font-mono">
                    {status.beads_id}
                  </Badge>
                </div>
              )}

              {status?.updated_at && (
                <p className="text-xs text-muted-foreground">
                  Updated {formatRelativeTime(status.updated_at)}
                </p>
              )}

              {!status && (
                <p className="text-sm text-muted-foreground italic">
                  No activity recorded yet
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

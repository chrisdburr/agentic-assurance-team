import { notFound } from "next/navigation";
import { ChatArea } from "@/components/chat/chat-area";

interface ChannelPageProps {
  params: Promise<{
    channel: string;
  }>;
}

const TEAM_SERVER_URL = process.env.TEAM_SERVER_URL || "http://localhost:3030";

export default async function ChannelPage({ params }: ChannelPageProps) {
  const { channel } = await params;

  // Exclude reserved routes that have their own pages
  const reservedRoutes = ["dm", "monitoring"];
  if (reservedRoutes.includes(channel)) {
    return null;
  }

  // Verify channel exists on the backend
  const res = await fetch(
    `${TEAM_SERVER_URL}/api/channels/${channel}/messages?limit=1`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    notFound();
  }

  // Fetch channel display name from the channels list
  let title = `# ${channel}`;
  try {
    const channelsRes = await fetch(`${TEAM_SERVER_URL}/api/channels`, {
      cache: "no-store",
    });
    if (channelsRes.ok) {
      const { channels } = await channelsRes.json();
      const match = channels.find(
        (ch: { id: string; name: string }) => ch.id === channel
      );
      if (match) {
        title = `# ${match.name}`;
      }
    }
  } catch {
    // Fall back to slug-based title
  }

  return <ChatArea channel={channel} title={title} />;
}

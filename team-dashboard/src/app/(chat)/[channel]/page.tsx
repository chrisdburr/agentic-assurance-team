import { ChatArea } from "@/components/chat/chat-area";

interface ChannelPageProps {
  params: Promise<{
    channel: string;
  }>;
}

export default async function ChannelPage({ params }: ChannelPageProps) {
  const { channel } = await params;

  // Exclude reserved routes that have their own pages
  const reservedRoutes = ["dm", "monitoring"];
  if (reservedRoutes.includes(channel)) {
    return null;
  }

  return <ChatArea channel={channel} title={`# ${channel}`} />;
}

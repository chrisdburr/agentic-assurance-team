import { ChatArea } from "@/components/chat/chat-area";
import { getAgent } from "@/lib/constants";

interface Props {
  params: Promise<{ agent: string }>;
}

export default async function DMPage({ params }: Props) {
  const { agent } = await params;
  const agentInfo = getAgent(agent);

  return <ChatArea agent={agent} title={`@ ${agentInfo.name}`} />;
}

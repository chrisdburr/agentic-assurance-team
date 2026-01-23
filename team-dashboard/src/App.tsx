import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessagesTab } from "@/components/messages-tab";
import { StandupsTab } from "@/components/standups-tab";
import { StatusTab } from "@/components/status-tab";
import {
  fetchMessages,
  fetchStandups,
  fetchStatus,
  fetchRoster,
  createWebSocket,
  type Message,
  type Standup,
  type Status,
  type TeamMember,
} from "@/lib/api";

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [standups, setStandups] = useState<Standup[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [roster, setRoster] = useState<TeamMember[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isConnected, setIsConnected] = useState(false);

  // Load initial data
  useEffect(() => {
    fetchMessages().then(setMessages);
    fetchStatus().then(setStatuses);
    fetchRoster().then(setRoster);
  }, []);

  // Load standups when date changes
  useEffect(() => {
    fetchStandups(selectedDate).then(setStandups);
  }, [selectedDate]);

  // Handle WebSocket events
  const handleWebSocketEvent = useCallback(
    (event: string, _data: unknown) => {
      switch (event) {
        case "message":
          // Refresh messages when a new one arrives
          fetchMessages().then(setMessages);
          break;
        case "standup":
          // Refresh standups if it's for the selected date
          fetchStandups(selectedDate).then(setStandups);
          break;
        case "status":
          // Refresh statuses
          fetchStatus().then(setStatuses);
          break;
      }
    },
    [selectedDate]
  );

  // Connect WebSocket
  useEffect(() => {
    const ws = createWebSocket(
      handleWebSocketEvent,
      () => setIsConnected(true),
      () => setIsConnected(false)
    );

    return () => {
      ws.close();
    };
  }, [handleWebSocketEvent]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Team Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                AI Assurance Research Team
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
              />
              <span className="text-sm text-muted-foreground">
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="messages" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="messages">
              Messages
              {messages.length > 0 && (
                <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {messages.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="standups">Standups</TabsTrigger>
            <TabsTrigger value="status">Status</TabsTrigger>
          </TabsList>

          <TabsContent value="messages" className="space-y-4">
            <MessagesTab messages={messages} />
          </TabsContent>

          <TabsContent value="standups" className="space-y-4">
            <StandupsTab
              standups={standups}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
            />
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <StatusTab statuses={statuses} roster={roster} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;

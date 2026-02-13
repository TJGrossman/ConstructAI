"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "../chat/ChatMessage";
import { ChatInput } from "../chat/ChatInput";
import { Loader2, Check, X } from "lucide-react";

interface CatalogItem {
  name: string;
  description?: string;
  category: string;
  unit: string;
  defaultRate: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  metadata?: {
    catalogItems?: CatalogItem[];
  };
}

interface CatalogChatPanelProps {
  existingItems: Array<{
    id: string;
    name: string;
    category: string;
    unit: string;
    defaultRate: string;
  }>;
  onCatalogUpdate: (items: CatalogItem[]) => void;
}

export function CatalogChatPanel({ existingItems, onCatalogUpdate }: CatalogChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I can help you manage your service catalog. You can tell me about services you offer, update rates, or make changes. What would you like to do?",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingCatalog, setPendingCatalog] = useState<CatalogItem[] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingCatalog]);

  const sendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/catalog-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          existingItems: existingItems.map(item => ({
            name: item.name,
            category: item.category,
            unit: item.unit,
            defaultRate: parseFloat(item.defaultRate)
          })),
        }),
      });

      const data = await res.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.catalogItems) {
        setPendingCatalog(data.catalogItems);
      }
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = () => {
    if (!pendingCatalog) return;
    onCatalogUpdate(pendingCatalog);
    setPendingCatalog(null);

    const confirmMessage: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: "Great! I've updated your service catalog. Anything else you'd like to change?",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, confirmMessage]);
  };

  const handleReject = () => {
    setPendingCatalog(null);
    const rejectMessage: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: "No problem! What would you like to adjust?",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, rejectMessage]);
  };

  return (
    <div className="flex h-[600px] flex-col rounded-lg border bg-card">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-muted-foreground">
            <div>
              <p className="mb-2 text-lg">Start a conversation</p>
              <p className="text-sm">
                Tell me about your services, rates, or changes you&apos;d like to make.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending Catalog Preview */}
      {pendingCatalog && (
        <div className="border-t bg-accent/20 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Updated Catalog Preview</h3>
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
              >
                <X className="h-4 w-4" />
                Adjust
              </button>
              <button
                onClick={handleApprove}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
              >
                <Check className="h-4 w-4" />
                Approve
              </button>
            </div>
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {pendingCatalog.map((item, idx) => (
              <div key={idx} className="rounded-md border bg-card p-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-muted-foreground">
                    ${item.defaultRate.toFixed(2)} / {item.unit}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {item.category.replace(/_/g, " ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        disabled={isLoading}
        placeholder="Tell me about your services..."
      />
    </div>
  );
}

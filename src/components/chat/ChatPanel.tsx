"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { StructuredPreview } from "./StructuredPreview";
import { LineItem } from "@/lib/ai/processor";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  metadata?: {
    structured?: {
      type: "estimate" | "change_order" | "invoice" | "work_entry";
      title?: string;
      lineItems: LineItem[];
      notes?: string;
    };
  };
}

interface ChatPanelProps {
  projectId: string;
  initialMessages?: Message[];
  initialConversationId?: string;
  onDocumentCreated?: () => void;
}

export function ChatPanel({
  projectId,
  initialMessages = [],
  initialConversationId,
  onDocumentCreated,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [conversationId, setConversationId] = useState(
    initialConversationId || ""
  );
  const [isLoading, setIsLoading] = useState(false);
  const [pendingStructured, setPendingStructured] = useState<{
    type: "estimate" | "change_order" | "invoice" | "work_entry" | "project";
    title?: string;
    lineItems?: Array<{
      description: string;
      catalogItemId?: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      total: number;
      category?: string;
      action?: string;
      originalDesc?: string;
    }>;
    workEntries?: Array<{
      estimateLineItemId: string;
      description: string;
      actualTimeHours?: number | null;
      actualTimeRate?: number | null;
      actualTimeCost?: number | null;
      actualMaterialsCost?: number | null;
      actualTotal: number;
      notes?: string;
    }>;
    notes?: string;
    // Project fields
    projectName?: string;
    customerName?: string;
    address?: string;
    description?: string;
    customerEmail?: string;
    customerPhone?: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingStructured]);

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
      const res = await fetch("/api/ai/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          message: content,
          conversationId: conversationId || undefined,
          pendingDraft: pendingStructured || undefined, // Include draft for modifications
        }),
      });

      const data = await res.json();

      if (!conversationId && data.conversationId) {
        setConversationId(data.conversationId);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.structured) {
        setPendingStructured(data.structured);
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

  const handleApprove = async (
    lineItems: LineItem[],
    title: string,
    notes: string
  ) => {
    if (!pendingStructured) return;

    try {
      let endpoint = "";
      let body: Record<string, unknown> = {};

      if (pendingStructured.type === "project") {
        endpoint = "/api/projects";
        // Parse project data from notes parameter
        const projectData = JSON.parse(notes);
        body = {
          name: projectData.projectName,
          customerName: projectData.customerName,
          address: projectData.address || undefined,
          description: projectData.description || undefined,
          customerEmail: projectData.customerEmail || undefined,
          customerPhone: projectData.customerPhone || undefined,
        };
      } else if (pendingStructured.type === "estimate") {
        endpoint = "/api/estimates";
        body = { projectId, title, lineItems, notes };
      } else if (pendingStructured.type === "change_order") {
        endpoint = "/api/change-orders";
        // Use the first estimate's id as the parent
        const projectRes = await fetch(`/api/projects/${projectId}`);
        const projectData = await projectRes.json();
        const estimateId = projectData.estimates?.[0]?.id;
        body = {
          projectId,
          estimateId,
          title,
          description: notes || title,
          lineItems,
        };
      } else if (pendingStructured.type === "invoice") {
        endpoint = "/api/invoices";
        body = { projectId, lineItems, notes };
      } else if (pendingStructured.type === "work_entry") {
        endpoint = "/api/work-entries";
        body = {
          projectId,
          workEntries: (pendingStructured as unknown as { workEntries?: unknown[] }).workEntries || []
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        const confirmMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: pendingStructured.type === "work_entry"
            ? `Work recorded successfully! Added to ${data.status === "draft" ? "draft " : ""}Invoice #${data.number}.`
            : pendingStructured.type === "project"
              ? `Project "${data.name}" has been created successfully! You can now create estimates and track work for this project.`
              : `${pendingStructured.type === "change_order" ? "Change order" : pendingStructured.type.charAt(0).toUpperCase() + pendingStructured.type.slice(1)} "${title}" has been created successfully.`,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, confirmMessage]);
        onDocumentCreated?.();
      }
    } catch {
      // Error handled silently
    }

    setPendingStructured(null);
  };

  const handleReject = () => {
    setPendingStructured(null);
    const msg: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content:
        "No problem, I discarded that draft. Let me know if you want to try again or make changes.",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, msg]);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <p className="text-lg font-medium">Start a conversation</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Describe the work you need to estimate, or tell me about
                completed work to invoice.
              </p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            createdAt={msg.createdAt}
          />
        ))}
        {pendingStructured && (
          <div className="px-4">
            <StructuredPreview
              type={pendingStructured.type}
              title={pendingStructured.title}
              lineItems={pendingStructured.lineItems}
              workEntries={pendingStructured.workEntries}
              notes={pendingStructured.notes}
              projectName={pendingStructured.projectName}
              customerName={pendingStructured.customerName}
              address={pendingStructured.address}
              description={pendingStructured.description}
              customerEmail={pendingStructured.customerEmail}
              customerPhone={pendingStructured.customerPhone}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          </div>
        )}
        {isLoading && (
          <div className="flex gap-3 bg-muted/50 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <span className="text-xs">AI</span>
            </div>
            <div className="flex items-center gap-1 pt-2">
              <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
              <div
                className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
                style={{ animationDelay: "0.1s" }}
              />
              <div
                className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
                style={{ animationDelay: "0.2s" }}
              />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}

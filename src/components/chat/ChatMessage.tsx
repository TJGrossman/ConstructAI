"use client";

import { cn } from "@/lib/utils";
import { HardHat, User } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
}

export function ChatMessage({ role, content, createdAt }: ChatMessageProps) {
  const isAssistant = role === "assistant";

  return (
    <div
      className={cn(
        "flex gap-3 p-4",
        isAssistant ? "bg-muted/50" : "bg-background"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isAssistant
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground"
        )}
      >
        {isAssistant ? (
          <HardHat className="h-4 w-4" />
        ) : (
          <User className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {isAssistant ? "ConstructAI" : "You"}
          </span>
          {createdAt && (
            <span className="text-xs text-muted-foreground">
              {new Date(createdAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      </div>
    </div>
  );
}

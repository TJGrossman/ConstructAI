"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Check, Mic, MicOff } from "lucide-react";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";

interface CatalogItem {
  name: string;
  description: string;
  category: string;
  unit: string;
  defaultRate: number;
}

const CATEGORIES = [
  "demolition", "framing", "electrical", "plumbing", "hvac", "flooring",
  "tile", "painting", "cabinets", "countertops", "roofing", "siding",
  "concrete", "landscaping", "general_labor", "materials", "other",
];

const UNITS = ["hour", "sqft", "linear_ft", "each", "flat"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<"describe" | "review">("describe");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { isRecording, isSupported, toggleRecording } = useVoiceRecording({
    onTranscriptChange: setDescription,
  });

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/ai/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      setItems(data.items || []);
      setStep("review");
    } catch {
      // handled
    } finally {
      setIsGenerating(false);
    }
  };

  const updateItem = (index: number, updates: Partial<CatalogItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...updates } : item)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { name: "", description: "", category: "other", unit: "hour", defaultRate: 0 },
    ]);
  };

  const handleSave = async () => {
    const validItems = items.filter((item) => item.name && item.defaultRate > 0);
    if (validItems.length === 0) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: validItems }),
      });
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      // handled
    } finally {
      setIsSaving(false);
    }
  };

  if (step === "describe") {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <h1 className="text-2xl font-bold">Set Up Your Service Catalog</h1>
        <p className="mt-2 text-muted-foreground">
          Describe the services you offer, including your rates. AI will create a structured
          catalog you can edit.
        </p>
        <div className="relative mt-6">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={8}
            placeholder="Example: I do kitchen and bathroom remodels. I charge $75/hr for demo, $95/hr for tile work, cabinets are usually $150 per linear foot installed, countertops are $85 per square foot for granite..."
            className={`w-full resize-none rounded-md border bg-background px-4 py-3 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm ${
              isRecording
                ? "border-destructive ring-2 ring-destructive/50"
                : "border-input"
            }`}
          />
          {isSupported && (
            <button
              onClick={toggleRecording}
              className={`absolute bottom-3 right-3 inline-flex h-11 w-11 items-center justify-center rounded-md border text-sm transition-colors ${
                isRecording
                  ? "border-destructive bg-destructive text-destructive-foreground"
                  : "border-input bg-background hover:bg-accent"
              }`}
              type="button"
              aria-label={isRecording ? "Stop recording" : "Start recording"}
            >
              {isRecording ? (
                <MicOff className="h-5 w-5 animate-pulse" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
        {isRecording && (
          <p className="mt-2 text-sm text-destructive">
            🎙️ Recording... Speak naturally, and your words will appear above.
          </p>
        )}
        <button
          onClick={handleGenerate}
          disabled={!description.trim() || isGenerating}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating catalog...
            </>
          ) : (
            "Generate My Catalog"
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Review Your Service Catalog</h1>
          <p className="mt-1 text-muted-foreground">
            Edit items, adjust rates, or add new services.
          </p>
        </div>
        <button
          onClick={() => setStep("describe")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Start over
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="rounded-lg border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(idx, { name: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <select
                  value={item.category}
                  onChange={(e) => updateItem(idx, { category: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Unit</label>
                <select
                  value={item.unit}
                  onChange={(e) => updateItem(idx, { unit: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Rate ($)</label>
                <input
                  type="number"
                  value={item.defaultRate}
                  onChange={(e) => updateItem(idx, { defaultRate: parseFloat(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  step="0.01"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => removeItem(idx)}
                  className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addItem}
        className="mt-3 inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
      >
        <Plus className="h-4 w-4" /> Add Item
      </button>

      <div className="mt-8 flex gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving || items.filter((i) => i.name && i.defaultRate > 0).length === 0}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Save Catalog & Continue
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, Plus, Trash2, Mic, MicOff } from "lucide-react";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";

interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  unit: string;
  defaultRate: string;
  isActive: boolean;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState({
    name: "",
    companyName: "",
    phone: "",
    licenseNumber: "",
    defaultMarkup: "0",
    defaultTaxRate: "0",
    paymentTerms: "Net 30",
  });
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingCatalog, setIsSavingCatalog] = useState(false);
  const [tab, setTab] = useState<"profile" | "catalog">("profile");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [voiceEdit, setVoiceEdit] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const { isRecording, isSupported, toggleRecording } = useVoiceRecording({
    onTranscriptChange: setVoiceEdit,
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setProfile({
            name: data.user.name || "",
            companyName: data.user.companyName || "",
            phone: data.user.phone || "",
            licenseNumber: data.user.licenseNumber || "",
            defaultMarkup: data.user.defaultMarkup || "0",
            defaultTaxRate: data.user.defaultTaxRate || "0",
            paymentTerms: data.user.paymentTerms || "Net 30",
          });
        }
      });
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCatalogItems(data);
      });
  }, []);

  const saveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const saveCatalog = async () => {
    setIsSavingCatalog(true);
    try {
      await fetch("/api/catalog/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: catalogItems }),
      });
    } finally {
      setIsSavingCatalog(false);
    }
  };

  const updateCatalogItem = (id: string, updates: Partial<CatalogItem>) => {
    setCatalogItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const handleVoiceEdit = async () => {
    if (!voiceEdit.trim()) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/ai/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: voiceEdit,
          existingItems: catalogItems.map(item => ({
            name: item.name,
            category: item.category,
            unit: item.unit,
            defaultRate: parseFloat(item.defaultRate)
          }))
        }),
      });
      const data = await res.json();
      if (data.items) {
        // Merge AI results with existing IDs
        const updatedItems = data.items.map((aiItem: { name: string; category: string; unit: string; defaultRate: number }, idx: number) => {
          const existingItem = catalogItems[idx];
          return existingItem
            ? { ...existingItem, ...aiItem, defaultRate: aiItem.defaultRate.toString() }
            : { id: `new-${Date.now()}-${idx}`, ...aiItem, defaultRate: aiItem.defaultRate.toString(), description: null, isActive: true };
        });
        setCatalogItems(updatedItems);
      }
      setVoiceEdit("");
    } catch {
      // handled
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      <div className="mb-6 flex gap-1 rounded-lg border bg-muted p-1">
        {(["profile", "catalog"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "profile" ? "Profile & Billing" : "Service Catalog"}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="space-y-6 rounded-lg border bg-card p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Company Name</label>
              <input
                type="text"
                value={profile.companyName}
                onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <input
                type="text"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium">License Number</label>
              <input
                type="text"
                value={profile.licenseNumber}
                onChange={(e) => setProfile({ ...profile, licenseNumber: e.target.value })}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <hr />
          <h3 className="font-semibold">Billing Defaults</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium">Default Markup (%)</label>
              <input
                type="number"
                value={profile.defaultMarkup}
                onChange={(e) => setProfile({ ...profile, defaultMarkup: e.target.value })}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                step="0.01"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Default Tax Rate (%)</label>
              <input
                type="number"
                value={profile.defaultTaxRate}
                onChange={(e) => setProfile({ ...profile, defaultTaxRate: e.target.value })}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                step="0.01"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Payment Terms</label>
              <select
                value={profile.paymentTerms}
                onChange={(e) => setProfile({ ...profile, paymentTerms: e.target.value })}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option>Net 15</option>
                <option>Net 30</option>
                <option>Net 45</option>
                <option>Net 60</option>
                <option>Due on Receipt</option>
              </select>
            </div>
          </div>
          <button
            onClick={saveProfile}
            disabled={isSavingProfile}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Profile
          </button>
        </div>
      )}

      {tab === "catalog" && (
        <div>
          {/* Voice Edit Input */}
          <div className="relative mb-6">
            <div className="flex gap-2">
              <input
                value={voiceEdit}
                onChange={(e) => setVoiceEdit(e.target.value)}
                placeholder="Add or modify services via voice or text (e.g., 'Add drywall repair at $60/hour' or 'Change tile work to $100/hour')"
                className={`flex-1 rounded-md border bg-background px-4 py-3 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm ${
                  isRecording ? "border-destructive ring-2 ring-destructive/50" : "border-input"
                }`}
              />
              {isSupported && (
                <button
                  onClick={toggleRecording}
                  disabled={isGenerating}
                  className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border text-sm transition-colors ${
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
              <button
                onClick={handleVoiceEdit}
                disabled={!voiceEdit.trim() || isGenerating}
                className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </button>
            </div>
            {isRecording && (
              <p className="mt-2 text-sm text-destructive">
                🎙️ Recording... Speak your changes naturally.
              </p>
            )}
          </div>

          {/* Compact Service List */}
          <div className="space-y-2">
            {catalogItems.map((item) => (
              <div key={item.id} className="rounded-lg border bg-card overflow-hidden">
                {/* Compact View */}
                {editingId !== item.id ? (
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => setEditingId(item.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-baseline gap-3">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {item.category?.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        ${parseFloat(item.defaultRate || "0").toFixed(2)} / {item.unit.replace(/_/g, " ")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCatalogItems((prev) => prev.filter((i) => i.id !== item.id));
                        }}
                        className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Expanded Edit View */
                  <div className="p-4 space-y-3 bg-accent/20">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Name</label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateCatalogItem(item.id, { name: e.target.value })}
                          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Category</label>
                        <input
                          type="text"
                          value={item.category || ""}
                          onChange={(e) => updateCatalogItem(item.id, { category: e.target.value })}
                          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Rate ($)</label>
                        <input
                          type="number"
                          value={item.defaultRate}
                          onChange={(e) => updateCatalogItem(item.id, { defaultRate: e.target.value })}
                          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Unit</label>
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => updateCatalogItem(item.id, { unit: e.target.value })}
                          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-sm text-primary hover:underline"
                    >
                      Done editing
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {catalogItems.length === 0 && (
            <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
              <p>No services yet. Use voice or text above to add services.</p>
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button
              onClick={() =>
                setCatalogItems((prev) => [
                  ...prev,
                  { id: `new-${Date.now()}`, name: "", description: null, category: "other", unit: "hour", defaultRate: "0", isActive: true },
                ])
              }
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              <Plus className="h-4 w-4" /> Add Item Manually
            </button>
            <button
              onClick={saveCatalog}
              disabled={isSavingCatalog}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSavingCatalog ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Catalog
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, Plus, Trash2 } from "lucide-react";

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
        <div className="space-y-3">
          {catalogItems.map((item) => (
            <div key={item.id} className="rounded-lg border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-5">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Name</label>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateCatalogItem(item.id, { name: e.target.value })}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Unit</label>
                  <input
                    type="text"
                    value={item.unit}
                    onChange={(e) => updateCatalogItem(item.id, { unit: e.target.value })}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Rate ($)</label>
                  <input
                    type="number"
                    value={item.defaultRate}
                    onChange={(e) => updateCatalogItem(item.id, { defaultRate: e.target.value })}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    step="0.01"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => setCatalogItems((prev) => prev.filter((i) => i.id !== item.id))}
                    className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <div className="flex gap-3">
            <button
              onClick={() =>
                setCatalogItems((prev) => [
                  ...prev,
                  { id: `new-${Date.now()}`, name: "", description: null, category: "other", unit: "hour", defaultRate: "0", isActive: true },
                ])
              }
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              <Plus className="h-4 w-4" /> Add Item
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

"use client";

import { useState, useEffect } from "react";
import { Shield, User, Mail, Calendar } from "lucide-react";

export default function AdminPage() {
  const [user, setUser] = useState<{
    id: string;
    email: string;
    name: string;
    isDemoAccount: boolean;
    createdAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/admin/user");
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleDemoAccount = async () => {
    if (!user) return;

    const confirmMsg = user.isDemoAccount
      ? "Remove demo account status? You will lose access to the Reset Data feature."
      : "Enable demo account status? This will allow you to reset all test data.";

    if (!confirm(confirmMsg)) return;

    setUpdating(true);
    try {
      const res = await fetch("/api/admin/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDemoAccount: !user.isDemoAccount }),
      });

      if (res.ok) {
        await fetchUser();
        alert(`✅ Demo account status ${!user.isDemoAccount ? "enabled" : "disabled"}!`);
      } else {
        const data = await res.json();
        alert(`❌ Error: ${data.error}`);
      }
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">Failed to load user data</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Admin Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account settings and demo features
        </p>
      </div>

      {/* User Info Card */}
      <div className="mb-6 rounded-lg border bg-card">
        <div className="border-b p-4">
          <h2 className="font-semibold">Account Information</h2>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Member Since</p>
              <p className="font-medium">
                {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Account Toggle */}
      <div className="rounded-lg border bg-card">
        <div className="border-b p-4">
          <h2 className="font-semibold">Demo Account Features</h2>
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="font-medium">Demo Account Status</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Demo accounts have access to the &quot;Reset Test Data&quot; feature,
                which allows you to clear all projects, estimates, invoices, and
                messages for testing purposes.
              </p>
              {user.isDemoAccount && (
                <div className="mt-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                  <strong>⚠️ Warning:</strong> With demo account enabled, you can
                  permanently delete all your data. Only use this for testing!
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg border bg-muted/30 p-4">
            <div>
              <p className="font-medium">
                Status:{" "}
                <span
                  className={
                    user.isDemoAccount ? "text-green-600" : "text-muted-foreground"
                  }
                >
                  {user.isDemoAccount ? "✓ Enabled" : "✗ Disabled"}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                {user.isDemoAccount
                  ? "Reset Data button visible on Projects page"
                  : "Reset Data feature hidden"}
              </p>
            </div>
            <button
              onClick={toggleDemoAccount}
              disabled={updating}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                user.isDemoAccount
                  ? "border border-red-600 text-red-600 hover:bg-red-50"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {updating
                ? "Updating..."
                : user.isDemoAccount
                  ? "Disable Demo Mode"
                  : "Enable Demo Mode"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

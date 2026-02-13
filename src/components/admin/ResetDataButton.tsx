"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

export function ResetDataButton({ isDemoAccount }: { isDemoAccount: boolean }) {
  if (!isDemoAccount) return null;
  const [isLoading, setIsLoading] = useState(false);

  const handleReset = async () => {
    if (!confirm("⚠️ This will DELETE ALL test data (projects, estimates, invoices, messages). Your account and service catalog will be preserved. Continue?")) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/reset-data", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        alert("✅ All test data cleared successfully!\n\nPreserved:\n- User account\n- Service catalog\n\nRefresh the page to see the clean slate.");
        window.location.reload();
      } else {
        alert(`❌ Error: ${data.error}\n${data.details || ""}`);
      }
    } catch (error) {
      alert(`❌ Failed to reset data: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleReset}
      disabled={isLoading}
      className="inline-flex items-center gap-2 rounded-md border border-red-600 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
      title="Delete all test data"
    >
      <Trash2 className="h-4 w-4" />
      {isLoading ? "Clearing..." : "Reset Test Data"}
    </button>
  );
}

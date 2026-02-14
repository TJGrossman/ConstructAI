"use client";

import { useState, useEffect } from "react";
import { Upload, Mic, MicOff, Camera } from "lucide-react";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";

interface ReceiptUploadProps {
  projectId: string;
  onUploadComplete: (receiptId: string, description: string) => void;
  onCancel: () => void;
}

export function ReceiptUpload({
  projectId,
  onUploadComplete,
  onCancel,
}: ReceiptUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect mobile device
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const {
    isRecording,
    transcript,
    startRecording,
    stopRecording,
    isSupported,
  } = useVoiceRecording({
    onTranscriptChange: (text) => setDescription(text),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type (images and PDFs)
      const validTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
      if (!validTypes.includes(selectedFile.type)) {
        setError("Please upload an image (JPG, PNG) or PDF file");
        return;
      }

      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }

      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);
      if (description) {
        formData.append("description", description);
      }

      const response = await fetch("/api/receipts", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload receipt");
      }

      const data = await response.json();
      onUploadComplete(data.receipt.id, description);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleVoiceToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Upload Receipt</h3>
        <p className="text-sm text-muted-foreground">
          Upload a receipt and describe the work performed
        </p>
      </div>

      {/* File Upload */}
      <div className="mb-4">
        <label
          htmlFor="receipt-file"
          className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50"
        >
          {file ? (
            <div className="text-center">
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          ) : (
            <>
              {isMobile ? (
                <>
                  <Camera className="mb-2 h-10 w-10 text-primary" />
                  <p className="text-base font-medium">Tap to capture receipt</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Camera will open automatically
                  </p>
                </>
              ) : (
                <>
                  <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Click to upload</p>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, or PDF (max 10MB)
                  </p>
                </>
              )}
            </>
          )}
        </label>
        <input
          id="receipt-file"
          type="file"
          accept="image/jpeg,image/png,image/jpg,application/pdf"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        {file && (
          <button
            onClick={() => setFile(null)}
            className="mt-2 text-sm text-muted-foreground hover:text-destructive"
          >
            Remove file
          </button>
        )}
      </div>

      {/* Voice/Text Description */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">
            Description
            {isRecording && (
              <span className="ml-2 text-xs text-primary">(Recording...)</span>
            )}
          </label>
          {isSupported && (
            <button
              onClick={handleVoiceToggle}
              className={`rounded-md p-2 ${
                isRecording
                  ? "bg-red-500 text-white"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {isRecording ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the work performed and materials purchased..."
          rows={3}
          className="w-full resize-none rounded-md border px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {transcript && (
          <p className="mt-1 text-xs text-muted-foreground">
            Voice transcript: {transcript}
          </p>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleUpload}
          disabled={!file || isUploading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isUploading ? "Uploading..." : "Upload & Continue"}
        </button>
        <button
          onClick={onCancel}
          disabled={isUploading}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

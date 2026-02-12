"use client";

import { useState, useRef, useEffect } from "react";

interface UseVoiceRecordingOptions {
  onTranscriptChange?: (transcript: string) => void;
  continuous?: boolean;
  interimResults?: boolean;
}

interface UseVoiceRecordingReturn {
  isRecording: boolean;
  transcript: string;
  error: string | null;
  isSupported: boolean;
  toggleRecording: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  clearTranscript: () => void;
}

export function useVoiceRecording({
  onTranscriptChange,
  continuous = true,
  interimResults = true,
}: UseVoiceRecordingOptions = {}): UseVoiceRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    // Check if Speech Recognition API is supported
    const hasSpeechAPI =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    setIsSupported(!!hasSpeechAPI);
  }, []);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startRecording = () => {
    if (isRecording) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser");
      return;
    }

    setError(null);
    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let currentTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);
      onTranscriptChange?.(currentTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      setError(`Recognition error: ${event.error}`);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
    } catch (err) {
      setError("Failed to start recording");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const clearTranscript = () => {
    setTranscript("");
    setError(null);
  };

  return {
    isRecording,
    transcript,
    error,
    isSupported,
    toggleRecording,
    startRecording,
    stopRecording,
    clearTranscript,
  };
}

import { useState, useEffect, useRef, useCallback } from "react";
import api, { getAccessToken } from "../lib/api.js";

export function useRealtimePipeline({ projectId, active = true, onUpdate, onComplete, onError }) {
  const [pipelineState, setPipelineState] = useState({
    status: "idle",
    progress: 0,
    stage: "idle",
    message: "",
    logs: [],
    candidates: [],
    activeOperations: [],
    operationHistory: [],
    connectedViaSSE: false,
  });

  const eventSourceRef = useRef(null);
  const pollingTimerRef = useRef(null);
  const isPollingFallbackRef = useRef(false);

  // Reconcile operations array
  const upsertOperation = useCallback((op) => {
    if (!op || !op.operationId) return;
    setPipelineState((prev) => {
      const activeOps = [...(prev.activeOperations || [])];
      const history = [...(prev.operationHistory || [])];

      const idx = activeOps.findIndex((o) => o.operationId === op.operationId);
      if (op.status === "RUNNING" || op.status === "QUEUED") {
        if (idx >= 0) {
          activeOps[idx] = op;
        } else {
          activeOps.push(op);
        }
      } else {
        // Completed/Failed/Cancelled -> remove from active and add to history
        if (idx >= 0) {
          activeOps.splice(idx, 1);
        }
        const histIdx = history.findIndex((o) => o.operationId === op.operationId);
        if (histIdx >= 0) {
          history[histIdx] = op;
        } else {
          history.unshift(op);
        }
      }

      return {
        ...prev,
        activeOperations: activeOps,
        operationHistory: history.slice(0, 20),
        progress: op.progress !== undefined ? op.progress : prev.progress,
        message: op.message || prev.message,
      };
    });
  }, []);

  // Fetch operations from backend for reconciliation / page refresh
  const fetchOperations = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await api.get(`/api/projects/${projectId}/operations`);
      const data = res.data?.data;
      if (data) {
        setPipelineState((prev) => ({
          ...prev,
          activeOperations: data.activeOperations || [],
          operationHistory: data.operationHistory || [],
        }));
      }
    } catch (err) {
      console.warn("Failed to fetch operations:", err);
    }
  }, [projectId]);

  const fallbackPoll = useCallback(async () => {
    if (!projectId) return;
    try {
      const [statusRes, opsRes] = await Promise.allSettled([
        api.get(`/api/projects/${projectId}/pipeline-status`),
        api.get(`/api/projects/${projectId}/operations`),
      ]);

      const data = statusRes.status === "fulfilled" ? statusRes.value?.data?.data : null;
      const opsData = opsRes.status === "fulfilled" ? opsRes.value?.data?.data : null;

      if (data || opsData) {
        setPipelineState((prev) => ({
          ...prev,
          status: data?.status || prev.status,
          progress: data?.progress !== undefined ? data.progress : prev.progress,
          stage: data?.stage || prev.stage,
          message: data?.message || prev.message,
          logs: data?.logs || prev.logs,
          candidates: data?.candidates || prev.candidates,
          activeOperations: opsData?.activeOperations || prev.activeOperations,
          operationHistory: opsData?.operationHistory || prev.operationHistory,
          connectedViaSSE: false,
        }));

        if (data) onUpdate?.(data);

        if (data && (data.status === "ready" || data.status === "failed")) {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          if (data.status === "ready") onComplete?.(data);
          else onError?.(data.message || "Pipeline failed");
        }
      }
    } catch (err) {
      console.warn("Polling status error", err);
    }
  }, [projectId, onUpdate, onComplete, onError]);

  const startPolling = useCallback(() => {
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    isPollingFallbackRef.current = true;
    fallbackPoll();
    pollingTimerRef.current = setInterval(fallbackPoll, 2000);
  }, [fallbackPoll]);

  // Cancel an active operation
  const cancelOperation = useCallback(
    async (operationId) => {
      if (!projectId || !operationId) return;
      try {
        await api.post(`/api/projects/${projectId}/operations/${operationId}/cancel`);
        setPipelineState((prev) => ({
          ...prev,
          activeOperations: prev.activeOperations.filter((o) => o.operationId !== operationId),
        }));
      } catch (err) {
        console.error("Failed to cancel operation:", err);
      }
    },
    [projectId]
  );

  // Helper to query active operation by type
  const getOperation = useCallback(
    (type) => {
      return (pipelineState.activeOperations || []).find((o) => o.type === type);
    },
    [pipelineState.activeOperations]
  );

  useEffect(() => {
    if (!projectId || !active) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      return;
    }

    // Initial operations recovery
    fetchOperations();

    // Try connecting to SSE endpoint
    const token = getAccessToken();
    const sseUrl = `/api/projects/${projectId}/pipeline-stream${token ? `?token=${encodeURIComponent(token)}` : ""}`;

    try {
      const es = new EventSource(sseUrl, { withCredentials: true });
      eventSourceRef.current = es;

      es.addEventListener("pipeline.init", (e) => {
        try {
          const data = JSON.parse(e.data);
          setPipelineState((prev) => ({
            ...prev,
            status: data.status,
            progress: data.progress || 0,
            stage: data.stage || data.status,
            message: data.message || "",
            candidates: data.candidates || [],
            activeOperations: data.activeOperations || prev.activeOperations,
            operationHistory: data.operationHistory || prev.operationHistory,
            connectedViaSSE: true,
          }));
          onUpdate?.(data);
        } catch (err) {}
      });

      es.addEventListener("pipeline.update", (e) => {
        try {
          const data = JSON.parse(e.data);
          setPipelineState((prev) => ({
            ...prev,
            status: data.status,
            progress: data.progress || 0,
            stage: data.stage || data.status,
            message: data.message || "",
            logs: data.logs || [],
            candidates: data.candidates || [],
            activeOperations: data.activeOperations || prev.activeOperations,
            connectedViaSSE: true,
          }));
          onUpdate?.(data);
        } catch (err) {}
      });

      es.addEventListener("pipeline.completed", (e) => {
        try {
          const data = JSON.parse(e.data);
          setPipelineState((prev) => ({ ...prev, status: "ready", progress: 100 }));
          onComplete?.(data);
        } catch (err) {}
      });

      es.addEventListener("pipeline.failed", (e) => {
        try {
          const data = JSON.parse(e.data);
          setPipelineState((prev) => ({ ...prev, status: "failed" }));
          onError?.(data.message || "Pipeline failed");
        } catch (err) {}
      });

      // Individual operation real-time events
      const opEvents = [
        "operation.created",
        "operation.started",
        "operation.step_started",
        "operation.step_completed",
        "operation.progress",
        "operation.completed",
        "operation.failed",
        "operation.cancelled",
      ];

      opEvents.forEach((eventName) => {
        es.addEventListener(eventName, (e) => {
          try {
            const op = JSON.parse(e.data);
            upsertOperation(op);
          } catch (err) {}
        });
      });

      es.onerror = () => {
        console.info("SSE pipeline stream disconnected, activating polling fallback");
        es.close();
        eventSourceRef.current = null;
        startPolling();
      };
    } catch (e) {
      console.warn("Failed to initialize SSE, falling back to polling", e);
      startPolling();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [projectId, active, onUpdate, onComplete, onError, startPolling, fetchOperations, upsertOperation]);

  return {
    ...pipelineState,
    refreshStatus: fallbackPoll,
    fetchOperations,
    cancelOperation,
    getOperation,
    hasActiveOperations: (pipelineState.activeOperations || []).length > 0,
  };
}

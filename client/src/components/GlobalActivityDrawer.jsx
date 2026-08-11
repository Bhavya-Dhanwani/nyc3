import React, { useState, useEffect } from "react";
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  ChevronRight,
  RefreshCw,
  StopCircle,
  Sliders,
  Sparkles,
  Video,
  FileText,
  Scissors,
  Share2,
  HardDrive,
  Download,
} from "lucide-react";

// Map operation types to user-friendly icons
const OPERATION_ICONS = {
  VIDEO_ANALYSIS: Video,
  TRANSCRIPTION: FileText,
  CLIP_GENERATION: Scissors,
  CAPTION_GENERATION: FileText,
  AI_EDIT_ASSISTANT: Sparkles,
  BRAND_KIT_GENERATION: Sliders,
  CONTENT_PACKAGE_GENERATION: Share2,
  THUMBNAIL_GENERATION: Sparkles,
  EXPORT: Download,
  DRIVE_SAVE: HardDrive,
  DRIVE_RESTORE: HardDrive,
};

export function GlobalActivityPill({
  activeOperations = [],
  operationHistory = [],
  isOpen,
  onToggle,
  saveStatus = "saved", // "saving" | "saved" | "error"
}) {
  const activeCount = activeOperations.length;
  const primaryOp = activeOperations[0];

  return (
    <div className="relative flex items-center gap-2">
      {/* Google Drive Save Status Indicator */}
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
          saveStatus === "saving"
            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
            : saveStatus === "error"
            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
            : "bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20"
        }`}
        title={
          saveStatus === "saving"
            ? "Saving changes to Google Drive..."
            : saveStatus === "error"
            ? "Save failed - Click to retry"
            : "All changes saved to Google Drive"
        }
      >
        <HardDrive className="w-3 h-3" />
        <span className="hidden sm:inline">
          {saveStatus === "saving" ? "Saving..." : saveStatus === "error" ? "Save failed" : "Drive Synced"}
        </span>
      </div>

      {/* Global Activity Pill Indicator */}
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-all shadow-sm ${
          activeCount > 0
            ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/30 hover:border-indigo-400 shadow-indigo-950/40"
            : "bg-slate-800/60 text-slate-400 border border-slate-700/60 hover:bg-slate-800 hover:text-slate-200"
        }`}
      >
        {activeCount > 0 ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span className="font-medium">
              {primaryOp ? `${primaryOp.title} (${primaryOp.progress}%)` : `${activeCount} Active Tasks`}
            </span>
            {activeCount > 1 && (
              <span className="bg-indigo-500/30 text-indigo-200 px-1.5 py-0.2 rounded-full text-[10px]">
                +{activeCount - 1}
              </span>
            )}
          </>
        ) : (
          <>
            <Activity className="w-3 h-3 text-slate-400" />
            <span className="hidden sm:inline">Activity</span>
            {operationHistory.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            )}
          </>
        )}
      </button>
    </div>
  );
}

export function GlobalActivityDrawer({
  isOpen,
  onClose,
  activeOperations = [],
  operationHistory = [],
  onCancelOperation,
  onRetryOperation,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl flex flex-col transition-transform animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide">Activity & Live Tasks</h3>
            <p className="text-[11px] text-slate-400">
              {activeOperations.length > 0
                ? `${activeOperations.length} running background operation${activeOperations.length > 1 ? "s" : ""}`
                : "All operations completed"}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {/* Active Operations Section */}
        {activeOperations.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-400 uppercase tracking-wider px-1">
              <span>Active Operations ({activeOperations.length})</span>
            </div>

            {activeOperations.map((op) => {
              const OpIcon = OPERATION_ICONS[op.type] || Activity;
              return (
                <div
                  key={op.operationId}
                  className="bg-slate-950/60 border border-indigo-500/30 rounded-xl p-4 shadow-lg space-y-3 relative overflow-hidden"
                >
                  {/* Glowing subtle edge */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-pulse" />

                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
                        <OpIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{op.title}</h4>
                        <p className="text-[11px] text-indigo-300/90 font-medium line-clamp-1">{op.message}</p>
                      </div>
                    </div>

                    {op.cancellable && onCancelOperation && (
                      <button
                        onClick={() => onCancelOperation(op.operationId)}
                        className="text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20 transition-colors flex items-center gap-1"
                        title="Cancel operation"
                      >
                        <StopCircle className="w-3 h-3" />
                        Cancel
                      </button>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-medium text-slate-400">
                      <span>Progress</span>
                      <span className="text-indigo-400 font-bold">{op.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 rounded-full"
                        style={{ width: `${Math.max(4, op.progress)}%` }}
                      />
                    </div>
                  </div>

                  {/* Live Multi-Step Checklist */}
                  {op.steps && op.steps.length > 0 && (
                    <div className="bg-slate-900/80 rounded-lg p-2.5 border border-slate-800/80 space-y-2 mt-2">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Execution Pipeline ({op.stepIndex + 1}/{op.totalSteps})
                      </div>
                      <div className="space-y-1.5">
                        {op.steps.map((step, sIdx) => {
                          const isDone = step.status === "completed";
                          const isRunning = step.status === "running";
                          const isFailed = step.status === "failed";

                          return (
                            <div
                              key={step.id || sIdx}
                              className={`flex items-center justify-between text-xs py-1 px-2 rounded ${
                                isRunning
                                  ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-200"
                                  : isDone
                                  ? "text-slate-300"
                                  : isFailed
                                  ? "bg-rose-500/10 text-rose-300"
                                  : "text-slate-500"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {isDone ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                ) : isRunning ? (
                                  <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
                                ) : isFailed ? (
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                ) : (
                                  <span className="w-3.5 h-3.5 rounded-full border border-slate-700 flex items-center justify-center text-[9px] text-slate-500 shrink-0">
                                    {sIdx + 1}
                                  </span>
                                )}
                                <span className="font-medium text-[11px]">{step.label}</span>
                              </div>
                              {step.message && (
                                <span className="text-[10px] text-slate-400 max-w-[120px] truncate">
                                  {step.message}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 px-4 bg-slate-950/40 border border-slate-800/60 rounded-xl space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400/80 mx-auto" />
            <h4 className="text-xs font-semibold text-slate-200">No Active Operations</h4>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
              All video generation, analysis, transcription, and export pipelines are currently idle.
            </p>
          </div>
        )}

        {/* Recent History Section */}
        {operationHistory.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
              <span>Recent Activity History</span>
            </div>

            <div className="space-y-2">
              {operationHistory.slice(0, 10).map((hist) => {
                const isSuccess = hist.status === "COMPLETED";
                const isFailed = hist.status === "FAILED";
                const HistIcon = OPERATION_ICONS[hist.type] || Activity;

                return (
                  <div
                    key={hist.operationId}
                    className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-800/80 rounded-lg text-xs hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isSuccess ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : isFailed ? (
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-slate-200 truncate">{hist.title}</div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {hist.error || hist.message || (isSuccess ? "Completed" : "Ended")}
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 shrink-0 pl-2">
                      {hist.completedAt
                        ? new Date(hist.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "Recent"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

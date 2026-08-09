import React, { useState } from "react";
import {
  Calendar as CalendarIcon,
  X,
  Plus,
  CheckCircle2,
  Clock,
  Send,
  Sparkles,
  Share2
} from "lucide-react";
import { getContentTypeConfig } from "../lib/contentTypes.js";

export function ContentCalendarModal({ open, onClose, candidates = [], project }) {
  const [scheduledItems, setScheduledItems] = useState(() => {
    try {
      const saved = localStorage.getItem(`katetor_calendar_${project?._id || project?.id || "global"}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    // Seed initial scheduled items from approved candidates
    return candidates.slice(0, 3).map((c, idx) => ({
      id: c._id || c.id || idx,
      title: c.title || `Viral Short #${idx + 1}`,
      platform: c.recommendedPlatforms?.[0] || "TikTok",
      date: new Date(Date.now() + (idx + 1) * 86400000).toISOString().split("T")[0],
      status: idx === 0 ? "Scheduled" : "Draft",
      contentType: c.contentType || "Viral",
      notes: "Post with trending audio"
    }));
  });

  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDate, setNewItemDate] = useState(new Date().toISOString().split("T")[0]);
  const [newItemPlatform, setNewItemPlatform] = useState("TikTok");

  if (!open) return null;

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;
    const item = {
      id: String(Date.now()),
      title: newItemTitle.trim(),
      platform: newItemPlatform,
      date: newItemDate,
      status: "Scheduled",
      contentType: "Viral",
      notes: ""
    };
    const next = [...scheduledItems, item];
    setScheduledItems(next);
    try {
      localStorage.setItem(`katetor_calendar_${project?._id || project?.id || "global"}`, JSON.stringify(next));
    } catch (e) {}
    setNewItemTitle("");
  };

  const handleToggleStatus = (id) => {
    const next = scheduledItems.map((item) => {
      if (item.id === id) {
        const nextStatus = item.status === "Published" ? "Draft" : item.status === "Scheduled" ? "Published" : "Scheduled";
        return { ...item, status: nextStatus };
      }
      return item;
    });
    setScheduledItems(next);
    try {
      localStorage.setItem(`katetor_calendar_${project?._id || project?.id || "global"}`, JSON.stringify(next));
    } catch (e) {}
  };

  return (
    <div className="language-intro" style={{ zIndex: 1100 }}>
      <div className="language-intro-card" style={{ maxWidth: "680px", padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #a855f7, #ec4899)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <CalendarIcon size={18} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#ffffff" }}>Content Publishing Calendar</h3>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>Plan and track your AI Shorts across platforms</span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        {/* Add Entry Form */}
        <form onSubmit={handleAddItem} style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Content title or hook..."
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            style={{ flex: 2, minWidth: "180px", padding: "8px 10px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#fff", fontSize: "11px" }}
          />
          <input
            type="date"
            value={newItemDate}
            onChange={(e) => setNewItemDate(e.target.value)}
            style={{ flex: 1, minWidth: "120px", padding: "8px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#fff", fontSize: "11px" }}
          />
          <select
            value={newItemPlatform}
            onChange={(e) => setNewItemPlatform(e.target.value)}
            style={{ flex: 1, minWidth: "110px", padding: "8px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#fff", fontSize: "11px" }}
          >
            <option value="TikTok">TikTok</option>
            <option value="Instagram Reels">Instagram</option>
            <option value="YouTube Shorts">YouTube</option>
            <option value="LinkedIn">LinkedIn</option>
            <option value="X">X (Twitter)</option>
          </select>
          <button
            type="submit"
            className="btn-primary-gradient"
            style={{ padding: "8px 14px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}
          >
            <Plus size={14} />
            <span>Schedule</span>
          </button>
        </form>

        {/* Scheduled List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto" }}>
          {scheduledItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px", color: "#64748b", fontSize: "12px" }}>
              No scheduled shorts yet. Add an entry above.
            </div>
          ) : (
            scheduledItems.map((item) => {
              const cfg = getContentTypeConfig(item.contentType);
              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    background: "rgba(0,0,0,0.3)",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.06)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "13px" }}>{cfg.icon}</span>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "#ffffff" }}>{item.title}</div>
                      <div style={{ fontSize: "10px", color: "#94a3b8", display: "flex", gap: "8px", marginTop: "2px" }}>
                        <span>📅 {item.date}</span>
                        <span>📱 {item.platform}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleStatus(item.id)}
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: "999px",
                      border: "1px solid",
                      cursor: "pointer",
                      background: item.status === "Published" ? "rgba(16,185,129,0.15)" : item.status === "Scheduled" ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.06)",
                      borderColor: item.status === "Published" ? "#10b981" : item.status === "Scheduled" ? "#6366f1" : "rgba(255,255,255,0.15)",
                      color: item.status === "Published" ? "#34d399" : item.status === "Scheduled" ? "#a5b4fc" : "#94a3b8"
                    }}
                  >
                    {item.status}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "14px" }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: "8px 18px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

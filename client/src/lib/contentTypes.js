// Controlled Content Types and configurations

export const CONTENT_TYPES = [
  { id: "Viral", label: "Viral", icon: "🔥", color: "#f97316", bg: "rgba(249, 115, 22, 0.15)", border: "rgba(249, 115, 22, 0.35)" },
  { id: "Educational", label: "Educational", icon: "💡", color: "#eab308", bg: "rgba(234, 179, 8, 0.15)", border: "rgba(234, 179, 8, 0.35)" },
  { id: "Funny", label: "Funny", icon: "😂", color: "#ec4899", bg: "rgba(236, 72, 153, 0.15)", border: "rgba(236, 72, 153, 0.35)" },
  { id: "Emotional", label: "Emotional", icon: "❤️", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)", border: "rgba(239, 68, 68, 0.35)" },
  { id: "Story", label: "Story", icon: "📖", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.15)", border: "rgba(139, 92, 246, 0.35)" },
  { id: "Opinion", label: "Opinion", icon: "💭", color: "#06b6d4", bg: "rgba(6, 182, 212, 0.15)", border: "rgba(6, 182, 212, 0.35)" },
  { id: "Tutorial", label: "Tutorial", icon: "🎓", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.35)" },
  { id: "Business", label: "Business", icon: "💼", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)", border: "rgba(59, 130, 246, 0.35)" },
  { id: "Inspirational", label: "Inspirational", icon: "✨", color: "#a855f7", bg: "rgba(168, 85, 247, 0.15)", border: "rgba(168, 85, 247, 0.35)" },
  { id: "Controversial", label: "Controversial", icon: "⚡", color: "#f43f5e", bg: "rgba(244, 63, 94, 0.15)", border: "rgba(244, 63, 94, 0.35)" },
  { id: "How-To", label: "How-To", icon: "🛠️", color: "#14b8a6", bg: "rgba(20, 184, 166, 0.15)", border: "rgba(20, 184, 166, 0.35)" },
  { id: "News", label: "News", icon: "📰", color: "#64748b", bg: "rgba(100, 116, 139, 0.15)", border: "rgba(100, 116, 139, 0.35)" },
];

export const HOOK_TYPES = [
  { id: "Curiosity", label: "Curiosity", desc: "Creates an irresistible information gap" },
  { id: "Question", label: "Question", desc: "Directly asks a thought-provoking question" },
  { id: "Contrarian", label: "Contrarian", desc: "Challenges widely held beliefs" },
  { id: "Shock", label: "Shock", desc: "Surprising, counter-intuitive statement" },
  { id: "Result", label: "Result", desc: "Showcases the end outcome first" },
  { id: "Story", label: "Story", desc: "Opens with a personal narrative moment" },
  { id: "Confession", label: "Confession", desc: "Vulnerable personal admission" },
  { id: "Tutorial", label: "Tutorial", desc: "Step-by-step practical instruction" },
  { id: "Statement", label: "Statement", desc: "Bold, confident assertion" },
];

export const REVIEW_STATUSES = [
  { id: "all", label: "All Opportunities" },
  { id: "ai_found", label: "AI Found", badgeColor: "#6366f1" },
  { id: "reviewing", label: "Reviewing", badgeColor: "#f59e0b" },
  { id: "approved", label: "Approved", badgeColor: "#10b981" },
  { id: "rejected", label: "Rejected", badgeColor: "#ef4444" },
  { id: "generated", label: "Generated", badgeColor: "#8b5cf6" },
];

export function getContentTypeConfig(typeId) {
  return CONTENT_TYPES.find((t) => t.id?.toLowerCase() === (typeId || "").toLowerCase()) || CONTENT_TYPES[0];
}

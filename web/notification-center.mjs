/* Shared, accessible and dismissible notifications. Never claims transaction finality. */
let region;
const kinds = new Set(["success", "error", "warning", "info"]);
const titles = { success: "Success", error: "Action needs attention", warning: "Check before continuing", info: "PACT Atlas" };
function container() {
  if (region?.isConnected) return region;
  region = document.createElement("div");
  region.id = "pact-notifications";
  region.className = "pact-notifications";
  region.setAttribute("aria-label", "PACT notifications");
  document.body.append(region);
  return region;
}
export function notifyUser(kind, message, { title, duration } = {}) {
  if (typeof document === "undefined") return;
  const level = kinds.has(kind) ? kind : "info";
  const copy = String(message || "").trim().slice(0, 400);
  if (!copy) return;
  const list = container();
  const existing = [...list.children].find(el => el.dataset.kind === level && el.dataset.message === copy);
  if (existing) { existing.focus?.(); return; }
  while (list.children.length >= 3) list.firstElementChild?.remove();
  const item = document.createElement("section");
  item.className = "pact-notification";
  item.dataset.kind = level;
  item.dataset.message = copy;
  item.setAttribute("role", level === "error" ? "alert" : "status");
  const mark = document.createElement("span");
  mark.className = "pact-notification-mark";
  mark.textContent = {success:"✓",error:"!",warning:"!",info:"i"}[level];
  mark.setAttribute("aria-hidden", "true");
  const body = document.createElement("div");
  body.className = "pact-notification-body";
  const heading = document.createElement("strong");
  heading.textContent = String(title || titles[level]).slice(0, 70);
  const text = document.createElement("p");
  text.textContent = copy;
  body.append(heading, text);
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "pact-notification-close";
  dismiss.setAttribute("aria-label", "Dismiss notification");
  dismiss.textContent = "×";
  dismiss.addEventListener("click", () => item.remove());
  item.append(mark, body, dismiss);
  list.append(item);
  const delay = Number.isFinite(duration) ? Math.max(0, Math.min(30000, duration)) : (level === "error" ? 12000 : 7000);
  if (delay) setTimeout(() => item.remove(), delay);
  return item;
}
if (typeof window !== "undefined") {
  window.addEventListener("pact:notify", event => {
    const info = event.detail || {};
    notifyUser(info.kind, info.message, info);
  });
}

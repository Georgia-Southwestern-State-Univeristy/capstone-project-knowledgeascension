function getCoopServerBase() {
  // Manual: if you ever want to hardcode a LAN IP, change it here.
  const host = window.location.hostname;
  return import.meta.env.VITE_SERVER_URL || "https://capstone-project-knowledgeascension-iba4vpbje.vercel.app";
}

export async function uploadStudyFileToServer({ code, file }) {
  if (!code) throw new Error("Missing room code.");
  if (!file) throw new Error("Missing file.");

  const apiBase = getCoopServerBase();

  const form = new FormData();
  form.append("code", code);
  form.append("file", file);

  const res = await fetch(`${apiBase}/api/coop/upload`, {
    method: "POST",
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "Upload failed.");
  }

  return data?.questions || [];
}
// Open WhatsApp via the deep-link scheme with a wa.me fallback.
// On mobile, `whatsapp://send` opens the installed app directly.
// If WhatsApp isn't installed / the scheme isn't handled, we fall back
// to wa.me which handles both mobile (app hand-off) and desktop web.
export function openWhatsApp(rawPhone: string, message: string) {
  const digits = rawPhone.replace(/[^\d]/g, "");
  if (!digits) return false;
  // South African local numbers starting with 0 -> +27
  const phone = digits.startsWith("0") ? "27" + digits.slice(1) : digits;
  const text = encodeURIComponent(message);
  const deep = `whatsapp://send?phone=${phone}&text=${text}`;
  const web = `https://wa.me/${phone}?text=${text}`;

  if (typeof window === "undefined") return false;

  let launched = false;
  const onHide = () => { launched = true; };
  document.addEventListener("visibilitychange", onHide, { once: true });

  // Try the deep link first.
  window.location.href = deep;

  // If the app didn't take over within 900ms, fall back to wa.me in a new tab.
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    if (!launched && document.visibilityState === "visible") {
      window.open(web, "_blank", "noopener,noreferrer");
    }
  }, 900);
  return true;
}

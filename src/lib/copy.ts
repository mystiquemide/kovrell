/**
 * Copies text and returns immediately. Uses the async clipboard API when it is available and
 * falls back to a hidden textarea, since some browsers leave the async call pending.
 */
export function copyText(text: string): void {
  const fallback = () => {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand("copy");
    } finally {
      el.remove();
    }
  };
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(fallback);
  } else {
    fallback();
  }
}

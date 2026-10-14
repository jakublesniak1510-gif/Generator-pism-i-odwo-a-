/**
 * Wysyłka e-maili przez Resend (HTTP API). Bez RESEND_API_KEY funkcja jest wyłączona.
 * Zasada: e-mailem wysyłamy WYŁĄCZNIE link do pisma albo kod – nigdy treść pisma.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendEmailResult =
  | { sent: true; id: string | null }
  | { sent: false; reason: "not-configured" | "error"; message?: string };

const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "PismoGotowe <onboarding@resend.dev>";
const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]{2,}$/;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Prosta walidacja adresu (bez znaków, które mogłyby zmienić nagłówki). */
export function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && email.length <= 254 && EMAIL_RE.test(email);
}

export async function sendEmail(message: EmailMessage): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "not-configured" };
  if (!isValidEmail(message.to)) return { sent: false, reason: "error", message: "Nieprawidłowy adres odbiorcy." };

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || DEFAULT_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      // nie logujemy treści wiadomości ani adresu odbiorcy
      const detail = await res.text().catch(() => "");
      console.error(`[email] Resend odrzucił wiadomość (${res.status})`, detail.slice(0, 300));
      return { sent: false, reason: "error", message: `HTTP ${res.status}` };
    }
    const data = (await res.json().catch(() => null)) as { id?: string } | null;
    return { sent: true, id: data?.id ?? null };
  } catch (err) {
    console.error("[email] błąd połączenia z Resend:", err instanceof Error ? err.message : err);
    return { sent: false, reason: "error", message: "Błąd połączenia." };
  }
}

/* ---------------------------- szablony ---------------------------- */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="pl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:24px;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917;line-height:1.5;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px;">
    <p style="margin:0 0 16px;font-weight:bold;font-size:18px;">PismoGotowe</p>
    ${bodyHtml}
    <p style="margin:24px 0 0;font-size:12px;color:#78716c;">Ta wiadomość została wysłana automatycznie na prośbę osoby korzystającej z serwisu PismoGotowe. Jeśli to nie Ty, zignoruj ją.</p>
  </div>
</body>
</html>`;
}

function button(url: string, label: string): string {
  return `<p style="margin:20px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold;">${escapeHtml(label)}</a></p>`;
}

/** „Twój link do pisma” – wyłącznie link, bez treści pisma. */
export function documentLinkEmail(input: { to: string; templateName: string; url: string }): EmailMessage {
  const subject = `Twój link do pisma: ${input.templateName}`;
  const html = layout(
    subject,
    `<p>Dzień dobry,</p>
    <p>oto link do Twojego pisma <strong>${escapeHtml(input.templateName)}</strong> przygotowanego w serwisie PismoGotowe:</p>
    ${button(input.url, "Otwórz pismo")}
    <p style="font-size:13px;word-break:break-all;color:#57534e;">${escapeHtml(input.url)}</p>
    <p><strong>Ważne:</strong> link daje dostęp do pisma i zawartych w nim danych osobowych – nie przekazuj go osobom postronnym.</p>
    <p><strong>Co dalej?</strong></p>
    <ol>
      <li>Otwórz link i sprawdź treść pisma oraz swoje dane.</li>
      <li>Pobierz pismo w formacie PDF lub DOCX, wydrukuj je i podpisz własnoręcznie.</li>
      <li>Wyślij pismo zgodnie z instrukcją widoczną na stronie pisma (najlepiej listem poleconym za potwierdzeniem odbioru) i zachowaj dowód nadania.</li>
    </ol>
    <p>Pisma przechowujemy przez ograniczony czas – zapisz pobrany plik u siebie.</p>`,
  );
  const text = [
    "Dzień dobry,",
    "",
    `oto link do Twojego pisma „${input.templateName}” przygotowanego w serwisie PismoGotowe:`,
    input.url,
    "",
    "Ważne: link daje dostęp do pisma i zawartych w nim danych osobowych – nie przekazuj go osobom postronnym.",
    "",
    "Co dalej?",
    "1. Otwórz link i sprawdź treść pisma oraz swoje dane.",
    "2. Pobierz pismo w formacie PDF lub DOCX, wydrukuj je i podpisz własnoręcznie.",
    "3. Wyślij pismo zgodnie z instrukcją na stronie pisma (najlepiej listem poleconym za potwierdzeniem odbioru) i zachowaj dowód nadania.",
    "",
    "Pisma przechowujemy przez ograniczony czas – zapisz pobrany plik u siebie.",
  ].join("\n");
  return { to: input.to, subject, html, text };
}

/** „Twój kod pakietu 5 pism”. */
export function packageCodeEmail(input: { to: string; code: string; uses: number; siteUrl: string }): EmailMessage {
  const subject = "Twój kod pakietu 5 pism – PismoGotowe";
  const html = layout(
    subject,
    `<p>Dzień dobry,</p>
    <p>dziękujemy za zakup pakietu. Oto Twój kod:</p>
    <p style="font-size:24px;font-weight:bold;letter-spacing:2px;font-family:'Courier New',monospace;margin:16px 0;">${escapeHtml(input.code)}</p>
    <p>Kod odblokowuje <strong>${input.uses}</strong> ${input.uses === 1 ? "pismo" : "pism"}.</p>
    <p><strong>Jak użyć kodu?</strong></p>
    <ol>
      <li>Wybierz rodzaj pisma i wypełnij formularz.</li>
      <li>Na stronie podglądu pisma wybierz odblokowanie kodem i wpisz powyższy kod.</li>
      <li>Pełne pismo zostanie odblokowane, a z kodu ubędzie jedno użycie.</li>
    </ol>
    ${button(input.siteUrl, "Przejdź do serwisu")}
    <p>Zachowaj tę wiadomość – kod działa do wyczerpania liczby użyć.</p>`,
  );
  const text = [
    "Dzień dobry,",
    "",
    "dziękujemy za zakup pakietu. Oto Twój kod:",
    input.code,
    "",
    `Kod odblokowuje ${input.uses} ${input.uses === 1 ? "pismo" : "pism"}.`,
    "",
    "Jak użyć kodu?",
    "1. Wybierz rodzaj pisma i wypełnij formularz.",
    "2. Na stronie podglądu pisma wybierz odblokowanie kodem i wpisz powyższy kod.",
    "3. Pełne pismo zostanie odblokowane, a z kodu ubędzie jedno użycie.",
    "",
    input.siteUrl,
    "",
    "Zachowaj tę wiadomość – kod działa do wyczerpania liczby użyć.",
  ].join("\n");
  return { to: input.to, subject, html, text };
}

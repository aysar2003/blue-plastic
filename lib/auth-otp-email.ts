import { PRODUCT_NAME } from '@/lib/product-brand'

/** OTP email lifetime shown to the user (matches LOGIN_OTP TTL). */
export const AUTH_OTP_EXPIRY_MINUTES = 10

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Space a 6-digit code as "863 641" for reading aloud / notification previews. */
export function formatOtpDisplay(code: string): string {
  const digits = code.replace(/\D/g, '')
  if (digits.length === 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
  if (digits.length === 8) return `${digits.slice(0, 4)} ${digits.slice(4)}`
  return code.trim()
}

export function authOtpEmailSubject(code: string, productName = PRODUCT_NAME): string {
  return `${formatOtpDisplay(code)} is your ${productName} sign-in code`
}

export function authOtpEmailText(
  code: string,
  productName = PRODUCT_NAME,
  expiryMinutes = AUTH_OTP_EXPIRY_MINUTES,
): string {
  return [
    `Your ${productName} verification code is ${code}.`,
    `It expires in ${expiryMinutes} minutes.`,
    '',
    'Never share this code. We will never ask for it by phone, chat, or email.',
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n')
}

/**
 * Luxury transactional OTP — VIP ink shell, champagne accent, digit boxes.
 * Table + inline CSS for Gmail / Outlook / Apple Mail. No remote images.
 */
export function authOtpEmailHtml(
  code: string,
  productName = PRODUCT_NAME,
  expiryMinutes = AUTH_OTP_EXPIRY_MINUTES,
): string {
  const name = escapeHtml(productName)
  const digits = code.replace(/\D/g, '') || code.trim()
  const safeDigits = escapeHtml(digits)
  const spaced = escapeHtml(formatOtpDisplay(digits))
  const mid = Math.ceil(digits.length / 2)

  const digitCells = [...digits]
    .map((digit, index) => {
      const gap = index === mid ? 'padding-left:10px;' : ''
      return `<td style="padding:0 3px;${gap}">
        <div style="width:40px;height:52px;line-height:52px;text-align:center;font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:26px;font-weight:700;letter-spacing:0;color:#f5efe6;background:#15131a;border:1px solid rgb(196 165 116 / 0.18);border-radius:8px;">${escapeHtml(digit)}</div>
      </td>`
    })
    .join('')

  const preheader = `Use ${spaced} to finish signing in. Expires in ${expiryMinutes} minutes. Never share it.`

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light dark"/>
<meta name="supported-color-schemes" content="light dark"/>
<title>${name} sign-in code</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  :root { color-scheme: light dark; }
  @media (prefers-color-scheme: dark) {
    .otp-shell { background:#07060a !important; }
    .otp-card { background:#100e14 !important; border-color:rgb(196 165 116 / 0.18) !important; }
    .otp-muted { color:#c4b8a8 !important; }
  }
  @media only screen and (max-width: 480px) {
    .otp-digit div { width:34px !important; height:46px !important; line-height:46px !important; font-size:22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#07060a;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" class="otp-shell" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#07060a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" class="otp-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#100e14;border:1px solid rgb(196 165 116 / 0.18);border-radius:16px;">
          <tr>
            <td style="padding:0;height:3px;background:linear-gradient(90deg,#c4a574 0%,#e8d5a8 50%,#c4a574 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:36px 36px 12px;text-align:center;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:13px;font-weight:400;letter-spacing:0.28em;text-transform:uppercase;color:#c4a574;">
                ${name}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 36px 0;text-align:center;">
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:#c4b8a8;">
                Sign-in verification
              </p>
              <h1 style="margin:14px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;line-height:1.25;color:#f5efe6;">
                Your sign-in code
              </h1>
              <p class="otp-muted" style="margin:14px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#c4b8a8;">
                Enter this code to finish signing in to ${name}. It expires in ${expiryMinutes} minutes.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 24px 8px;">
              <table role="presentation" class="otp-digit" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                <tr>${digitCells}</tr>
              </table>
              <!--
                Email clients block JavaScript clipboard APIs.
                One click/tap selects the whole code (user-select:all) so Copy is one shortcut away.
              -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px auto 0;max-width:280px;">
                <tr>
                  <td align="center" style="background:#15131a;border:1px solid rgb(196 165 116 / 0.35);border-radius:12px;padding:14px 22px;">
                    <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#c4a574;">
                      Copy code
                    </p>
                    <p style="margin:0;font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:26px;font-weight:700;letter-spacing:0.28em;color:#f5efe6;-webkit-user-select:all;user-select:all;-moz-user-select:all;ms-user-select:all;">
                      ${safeDigits}
                    </p>
                  </td>
                </tr>
              </table>
              <p class="otp-muted" style="margin:12px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.45;color:#c4b8a8;">
                Click or tap the code once to select it, then copy (Ctrl+C / ⌘C).
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 36px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#15131a;border:1px solid rgb(196 165 116 / 0.18);border-radius:10px;">
                <tr>
                  <td style="padding:14px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#c4b8a8;">
                    <strong style="color:#e4d0a8;">Security:</strong>
                    ${name} will never ask for this code by phone, chat, or email. Do not share it with anyone.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 36px 36px;text-align:center;">
              <p class="otp-muted" style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#c4b8a8;">
                If you did not request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8a7d6e;">
          ${name} · Secure access
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

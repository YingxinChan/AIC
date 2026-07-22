from datetime import date
from html import escape

FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"


def _format_day(day_date: str) -> str:
    try:
        return date.fromisoformat(day_date).strftime("%a, %d %b")
    except ValueError:
        return day_date


def _wrap(heading: str, body_html: str) -> str:
    return f"""<!doctype html>
<html>
  <body style="margin:0; padding:0; background-color:#f3f4f6; font-family:{FONT_STACK};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e5e7eb;">
            <tr>
              <td style="background-color:#4f46e5; background-image:linear-gradient(135deg,#4f46e5,#7c3aed); padding:24px 32px;">
                <span style="color:#ffffff; font-size:18px; font-weight:700; font-family:{FONT_STACK};">SmartTrip AI</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px; font-size:20px; color:#111827; font-family:{FONT_STACK};">{heading}</h1>
                {body_html}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px; background-color:#f9fafb; border-top:1px solid #e5e7eb;">
                <p style="margin:0; font-size:12px; color:#9ca3af; font-family:{FONT_STACK};">You're receiving this because you have an active trip on SmartTrip AI.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def test_email() -> tuple[str, str]:
    text = "This is a test email from SmartTrip AI — if you're reading this, notifications are working!"
    html = _wrap(
        "Test email",
        f'<p style="margin:0; font-size:14px; color:#374151; line-height:1.6; font-family:{FONT_STACK};">{text}</p>',
    )
    return html, text


def _swap_row_html(s: dict) -> str:
    day = _format_day(s["day_date"])
    trip_name = escape(s["trip_name"], quote=False)
    original_name = escape(s["original_name"], quote=False)
    original_location = escape(s["original_location"], quote=False)
    alternate_name = escape(s["alternate_name"], quote=False)
    alternate_location = escape(s["alternate_location"], quote=False)
    reason = escape(s["reason"], quote=False)
    return f'''<tr>
      <td style="padding:16px 0; border-bottom:1px solid #f3f4f6;">
        <p style="margin:0 0 8px; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.03em; font-family:{FONT_STACK};">{trip_name} &middot; {day}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="vertical-align:top; width:45%;">
              <p style="margin:0; font-size:13px; color:#9ca3af; text-decoration:line-through; font-family:{FONT_STACK};">{original_name}</p>
              <p style="margin:2px 0 0; font-size:12px; color:#9ca3af; text-decoration:line-through; font-family:{FONT_STACK};">{original_location}</p>
            </td>
            <td style="vertical-align:middle; width:10%; text-align:center; color:#9ca3af; font-size:14px; font-family:{FONT_STACK};">&rarr;</td>
            <td style="vertical-align:top; width:45%;">
              <p style="margin:0; font-size:14px; font-weight:600; color:#111827; font-family:{FONT_STACK};">{alternate_name}</p>
              <p style="margin:2px 0 0; font-size:12px; color:#6b7280; font-family:{FONT_STACK};">{alternate_location}</p>
            </td>
          </tr>
        </table>
        <p style="margin:8px 0 0; font-size:12px; color:#b45309; font-family:{FONT_STACK};">☔ {reason}</p>
      </td>
    </tr>'''


def _swap_row_text(s: dict) -> str:
    day = _format_day(s["day_date"])
    return (
        f"- {s['trip_name']} ({day}): {s['original_name']} at {s['original_location']} "
        f"-> {s['alternate_name']} at {s['alternate_location']} — {s['reason']}"
    )


def swap_digest_email(swaps: list[dict]) -> tuple[str, str]:
    rows = "".join(_swap_row_html(s) for s in swaps)
    body_html = f"""
      <p style="margin:0 0 16px; font-size:14px; color:#374151; line-height:1.6; font-family:{FONT_STACK};">
        Rain is in the forecast, so we've swapped the affected outdoor plans for indoor alternatives:
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows}</table>
    """
    text = "Your itinerary was automatically updated due to weather:\n\n" + "\n".join(
        _swap_row_text(s) for s in swaps
    )
    return _wrap("Your itinerary was updated for weather", body_html), text

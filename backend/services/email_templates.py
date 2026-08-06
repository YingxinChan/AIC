from datetime import date
from html import escape

from core.config import settings

FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"


def _cta_html(text: str) -> str:
    # Always the site root, not a deep link to a specific trip/page — every
    # route is login-gated anyway (see frontend's ProtectedRoute), so a deep
    # link buys nothing but the extra work of picking one when a digest can
    # span several trips.
    return f'''<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
      <tr>
        <td style="border-radius:8px; background-color:#4f46e5;">
          <a href="{settings.frontend_url}" style="display:inline-block; padding:10px 20px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; font-family:{FONT_STACK};">{escape(text, quote=False)} &rarr;</a>
        </td>
      </tr>
    </table>'''


def _cta_text(text: str) -> str:
    return f"{text}: {settings.frontend_url}"

# Matches services.weather_rules.ACTIVE_RULES' rule ids, and (via
# _METRIC_TO_RULE_ID) the swap-scoring engine's metric names too — both
# produce the same id strings on purpose so this one mapping covers both.
# Falls back to the rain icon for anything unmapped (e.g. a swap/tip dict
# from before rule_id existed, or a future rule not yet added here).
RULE_ICONS = {
    "rain": "☔",
    "fog": "🌫️",
    "wind": "💨",
    "extreme_heat": "🔥",
    "extreme_cold": "❄️",
    "extreme_uv": "☀️",
    "beach_safety": "🏖️",
}


def _rule_icon(rule_id: str | None) -> str:
    return RULE_ICONS.get(rule_id, "☔")


# Icon keys for daily_summary_email's point-form highlights — Claude is
# constrained to these keys via daily_summary_service.SUMMARY_SCHEMA's enum
# (imports this dict rather than duplicating the key list), same reasoning
# as RULE_ICONS above: a model-produced key is validated by the JSON schema,
# a model-produced emoji character isn't.
SUMMARY_ICONS = {
    "temperature": "🌡️",
    "rain": "☔",
    "wind": "💨",
    "uv": "☀️",
    "clothing": "👕",
    "activity": "🥾",
    "beach": "🏖️",
    "tip": "💡",
}


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
                <span style="color:#ffffff; font-size:18px; font-weight:700; font-family:{FONT_STACK};">ClimaGo</span>
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
                <p style="margin:0; font-size:12px; color:#9ca3af; font-family:{FONT_STACK};">You're receiving this because you have an active trip on ClimaGo.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def test_email() -> tuple[str, str]:
    text = "This is a test email from ClimaGo — if you're reading this, notifications are working!"
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
    icon = _rule_icon(s.get("rule_id"))
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
        <p style="margin:8px 0 0; font-size:12px; color:#b45309; font-family:{FONT_STACK};">{icon} {reason}</p>
      </td>
    </tr>'''


def _swap_row_text(s: dict) -> str:
    day = _format_day(s["day_date"])
    return (
        f"- {s['trip_name']} ({day}): {s['original_name']} at {s['original_location']} "
        f"-> {s['alternate_name']} at {s['alternate_location']} — {s['reason']}"
    )


def _tip_row_html(t: dict) -> str:
    day = _format_day(t["day_date"])
    trip_name = escape(t["trip_name"], quote=False)
    name = escape(t["name"], quote=False)
    location = escape(t["location"], quote=False)
    reason = escape(t["reason"], quote=False)
    tip = escape(t["tip"], quote=False)
    icon = _rule_icon(t.get("rule_id"))
    return f'''<tr>
      <td style="padding:16px 0; border-bottom:1px solid #f3f4f6;">
        <p style="margin:0 0 8px; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.03em; font-family:{FONT_STACK};">{trip_name} &middot; {day}</p>
        <p style="margin:0; font-size:14px; font-weight:600; color:#111827; font-family:{FONT_STACK};">{name}</p>
        <p style="margin:2px 0 0; font-size:12px; color:#6b7280; font-family:{FONT_STACK};">{location}</p>
        <p style="margin:8px 0 0; font-size:12px; color:#b45309; font-family:{FONT_STACK};">{icon} {reason}</p>
        <p style="margin:4px 0 0; font-size:13px; color:#374151; font-family:{FONT_STACK};">💡 {tip}</p>
      </td>
    </tr>'''


def _tip_row_text(t: dict) -> str:
    day = _format_day(t["day_date"])
    return f"- {t['trip_name']} ({day}): {t['name']} at {t['location']} — {t['reason']} — Tip: {t['tip']}"


def _reverted_row_html(r: dict) -> str:
    day = _format_day(r["day_date"])
    trip_name = escape(r["trip_name"], quote=False)
    restored_name = escape(r["restored_name"], quote=False)
    restored_location = escape(r["restored_location"], quote=False)
    return f'''<tr>
      <td style="padding:16px 0; border-bottom:1px solid #f3f4f6;">
        <p style="margin:0 0 8px; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.03em; font-family:{FONT_STACK};">{trip_name} &middot; {day}</p>
        <p style="margin:0; font-size:14px; font-weight:600; color:#111827; font-family:{FONT_STACK};">{restored_name}</p>
        <p style="margin:2px 0 0; font-size:12px; color:#6b7280; font-family:{FONT_STACK};">{restored_location}</p>
        <p style="margin:8px 0 0; font-size:12px; color:#15803d; font-family:{FONT_STACK};">&#9989; Forecast improved — we've switched back to your original plan.</p>
      </td>
    </tr>'''


def _reverted_row_text(r: dict) -> str:
    day = _format_day(r["day_date"])
    return f"- {r['trip_name']} ({day}): back to {r['restored_name']} at {r['restored_location']} — forecast improved"


def _summary_point_html(point: dict) -> str:
    icon = SUMMARY_ICONS.get(point.get("icon"), "💡")
    text = escape(point["text"], quote=False)
    return f'''<tr>
      <td style="padding:10px 0; border-bottom:1px solid #f3f4f6;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:top; width:28px; font-size:16px; font-family:{FONT_STACK};">{icon}</td>
            <td style="vertical-align:top; font-size:14px; color:#374151; line-height:1.5; font-family:{FONT_STACK};">{text}</td>
          </tr>
        </table>
      </td>
    </tr>'''


def _summary_point_text(point: dict) -> str:
    icon = SUMMARY_ICONS.get(point.get("icon"), "💡")
    return f"{icon} {point['text']}"


def daily_summary_email(trip, weather_day: dict, summary_points: list[dict]) -> tuple[str, str]:
    """One email per ongoing trip, sent daily (see daily_summary_service.py)
    — the day's headline condition/temperature, then Claude's point-form
    highlights (summary_points, each {"icon", "text"} — see
    daily_summary_service.SUMMARY_SCHEMA) each on their own icon + text row,
    rather than one paragraph of prose."""
    destination = escape(trip.destination, quote=False)
    day = _format_day(weather_day["date"])
    condition = escape(str(weather_day.get("condition", "")), quote=False)
    temp_min = weather_day.get("temp_min")
    temp_max = weather_day.get("temp_max")
    rows = "".join(_summary_point_html(p) for p in summary_points)

    body_html = f"""
      <p style="margin:0 0 4px; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.03em; font-family:{FONT_STACK};">{destination} &middot; {day}</p>
      <p style="margin:0 0 16px; font-size:16px; font-weight:600; color:#111827; font-family:{FONT_STACK};">{condition}, {temp_min}&deg;&ndash;{temp_max}&deg;C</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows}</table>
      {_cta_html("View your itinerary")}
    """
    text = (
        f"{destination} ({day}): {condition}, {temp_min}-{temp_max}°C\n\n"
        + "\n".join(_summary_point_text(p) for p in summary_points)
        + f"\n\n{_cta_text('View your itinerary')}"
    )

    return _wrap(f"Today's weather in {trip.destination}", body_html), text


def swap_digest_email(
    swaps: list[dict], tips: list[dict] | None = None, reverted: list[dict] | None = None
) -> tuple[str, str]:
    """Combines this run's swaps, fixed-activity tips, and reverts back to
    the original plan into one digest email per user — never more than one
    email for the same run. `tips`/`reverted` are optional (default to none)
    so existing callers passing just `swaps` still work."""
    tips = tips or []
    reverted = reverted or []

    sections_html = []
    sections_text = []

    if swaps:
        rows = "".join(_swap_row_html(s) for s in swaps)
        sections_html.append(f"""
          <p style="margin:0 0 16px; font-size:14px; color:#374151; line-height:1.6; font-family:{FONT_STACK};">
            The forecast means we've swapped these plans for better-suited alternatives:
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows}</table>
        """)
        sections_text.append(
            "Your itinerary was automatically updated due to weather:\n\n"
            + "\n".join(_swap_row_text(s) for s in swaps)
        )

    if tips:
        rows = "".join(_tip_row_html(t) for t in tips)
        sections_html.append(f"""
          <p style="margin:24px 0 16px; font-size:14px; color:#374151; line-height:1.6; font-family:{FONT_STACK};">
            Weather's worth a heads-up here, even though we haven't changed these plans:
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows}</table>
        """)
        sections_text.append(
            "Weather tips for your trip:\n\n" + "\n".join(_tip_row_text(t) for t in tips)
        )

    if reverted:
        rows = "".join(_reverted_row_html(r) for r in reverted)
        sections_html.append(f"""
          <p style="margin:24px 0 16px; font-size:14px; color:#374151; line-height:1.6; font-family:{FONT_STACK};">
            Good news — the forecast improved, so these plans are back to normal:
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows}</table>
        """)
        sections_text.append(
            "Good news — the forecast improved for these plans:\n\n"
            + "\n".join(_reverted_row_text(r) for r in reverted)
        )

    if swaps or reverted:
        heading = "Your itinerary was updated for weather"
    else:
        heading = "Weather tips for your upcoming trip"

    body_html = "".join(sections_html) + _cta_html("View your trips")
    text = "\n\n".join(sections_text) + f"\n\n{_cta_text('View your trips')}"
    return _wrap(heading, body_html), text

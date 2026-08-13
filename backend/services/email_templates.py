from datetime import date
from html import escape

from core.config import settings

FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
# Reserved for ticket-data fields only (trip/day labels, destination code) —
# the same mono-for-data/sans-for-prose split the frontend's font-mono
# convention uses (see tailwind.config.js). Email-safe web fonts only, no
# @font-face — 'Courier New' is the nearest universally-installed monospace.
MONO_STACK = "'Courier New', Courier, monospace"

# Brand navy, matching frontend/tailwind.config.js's brandNavy scale exactly
# — this template used to run its own unrelated indigo/purple palette,
# visibly disconnected from the app itself the moment a real user compared
# the two. accent (amber) stays reserved for an actual swap ("REBOOKED"),
# same rule as the frontend.
NAVY_900 = "#0F1729"
NAVY_100 = "#DCE3F0"
INK = "#1A2233"
INK_MUTED = "#5B6478"
# Gmail's Android/iOS apps run their own auto-dark-mode pass that no
# meta tag or CSS override can fully opt out of (confirmed by testing —
# color-scheme/prefers-color-scheme are both ignored). Its transform
# preserves hue and flips lightness, so a *warm* near-white (the frontend's
# actual cream, #F7F2E7) inverts into a muddy dark olive-brown — the exact
# "ugly" reported. Two colors from brandNavy itself (brand-50/brand-100,
# already cool blue-tinted near-whites, no warm hue for Gmail to invert
# into mud) invert into a clean dark navy-gray instead, and still read as
# clearly part of this app's palette in light mode — just the cool side of
# it rather than the cream side, which is the deliberate trade for a
# surface that has to survive a transform it can't opt out of.
SURFACE = "#EEF1F7"  # brandNavy 50
SURFACE_SUNKEN = "#E2E7F2"  # between brandNavy 50 and 100
ACCENT_500 = "#F59E0B"
# Off-white, not pure #ffffff — the header text is the other thing Gmail's
# pass visibly touched (turned "Navia" nearly invisible against its own
# navy background in testing), and every report of this behavior traces it
# to literal #ffffff/#000000 specifically being flagged for "readability"
# adjustment regardless of what they're actually sitting on. One step off
# pure white is enough to stop being a target without being a visible
# change to anyone reading it normally.
OFF_WHITE = "#F7F8FA"


# This design is light-only (the frontend has no dark theme either) — it
# isn't repainted for dark mode, it's defended against it. Apple Mail and
# Outlook both honor the color-scheme/supported-color-schemes meta+CSS
# below and leave a light-only design alone entirely; Gmail's apps don't
# honor either one and dark-mode-process regardless, which is what the
# SURFACE/OFF_WHITE choices above are actually defending against.
DARK_MODE_CSS = f"""
    :root {{ color-scheme: light; supported-color-schemes: light; }}
    @media (prefers-color-scheme: dark) {{
      .nv-shell {{ background-color: {SURFACE_SUNKEN} !important; }}
      .nv-card {{ background-color: {SURFACE} !important; }}
      .nv-header {{ background-color: {NAVY_900} !important; }}
      .nv-footer {{ background-color: {SURFACE} !important; }}
      .nv-border {{ border-color: {NAVY_100} !important; }}
      .nv-white {{ color: {OFF_WHITE} !important; }}
      .nv-ink {{ color: {INK} !important; }}
      .nv-ink-muted {{ color: {INK_MUTED} !important; }}
      .nv-strike {{ color: {INK_MUTED} !important; }}
      .nv-warn {{ color: #b45309 !important; }}
      .nv-good {{ color: #15803d !important; }}
      .nv-cta {{ background-color: {NAVY_900} !important; }}
      .nv-rebooked {{ background-color: {ACCENT_500} !important; color: {NAVY_900} !important; }}
    }}
"""


def _cta_html(text: str) -> str:
    # Always the site root, not a deep link to a specific trip/page — every
    # route is login-gated anyway (see frontend's ProtectedRoute), so a deep
    # link buys nothing but the extra work of picking one when a digest can
    # span several trips.
    return f'''<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
      <tr>
        <td class="nv-cta" style="border-radius:999px; background-color:{NAVY_900};">
          <a href="{settings.frontend_url}" class="nv-white" style="display:inline-block; padding:10px 22px; font-size:14px; font-weight:600; color:{OFF_WHITE}; text-decoration:none; font-family:{FONT_STACK};">{escape(text, quote=False)} &rarr;</a>
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


def _wrap(heading: str, body_html: str, tag: str = "NAVIA") -> str:
    # A light boarding-pass flavor, not a full replica — no side barcode or
    # punched notches (email clients render CSS far too inconsistently for
    # those), just what carries across reliably: the navy the app actually
    # uses, a small corner tag mirroring the app's "BOARDING PASS" stub
    # label, a dashed perforation under the header, and a pill CTA.
    return f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <style>{DARK_MODE_CSS}</style>
  </head>
  <body class="nv-shell" style="margin:0; padding:0; background-color:{SURFACE_SUNKEN}; font-family:{FONT_STACK};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="nv-shell" bgcolor="{SURFACE_SUNKEN}" style="background-color:{SURFACE_SUNKEN}; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" class="nv-card nv-border" bgcolor="{SURFACE}" style="max-width:480px; width:100%; background-color:{SURFACE}; border-radius:12px; overflow:hidden; border:1px solid {NAVY_100};">
            <tr>
              <td class="nv-header" bgcolor="{NAVY_900}" style="background-color:{NAVY_900}; padding:24px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td class="nv-white" style="color:{OFF_WHITE}; font-size:18px; font-weight:700; font-family:{FONT_STACK};">Navia</td>
                    <td align="right">
                      <span style="display:inline-block; padding:4px 10px; border:1px solid rgba(255,255,255,0.35); border-radius:999px; color:#B9C7E0; font-size:10px; font-weight:700; letter-spacing:0.12em; font-family:{MONO_STACK};">{escape(tag, quote=False)}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="nv-border" style="padding:0; border-top:2px dashed {NAVY_100};"></td>
            </tr>
            <tr>
              <td class="nv-card" bgcolor="{SURFACE}" style="padding:32px; background-color:{SURFACE};">
                <h1 class="nv-ink" style="margin:0 0 16px; font-size:20px; color:{INK}; font-family:{FONT_STACK};">{heading}</h1>
                {body_html}
              </td>
            </tr>
            <tr>
              <td class="nv-footer nv-border" bgcolor="{SURFACE}" style="padding:20px 32px; background-color:{SURFACE}; border-top:1px solid {NAVY_100};">
                <p class="nv-ink-muted" style="margin:0; font-size:12px; color:{INK_MUTED}; font-family:{FONT_STACK};">You're receiving this because you have an active trip on Navia.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def test_email() -> tuple[str, str]:
    text = "This is a test email from Navia — if you're reading this, notifications are working!"
    html = _wrap(
        "Test email",
        f'<p class="nv-ink" style="margin:0; font-size:14px; color:{INK}; line-height:1.6; font-family:{FONT_STACK};">{text}</p>',
        tag="TEST",
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
    # REBOOKED pill matches the frontend's shadow-stamp treatment exactly
    # (amber, dark-navy text) — amber is reserved there for the same one
    # moment (an actual weather swap), so reusing it here for the identical
    # event is the rule, not an exception to it.
    return f'''<tr>
      <td class="nv-border" style="padding:16px 0; border-bottom:1px solid {NAVY_100};">
        <p class="nv-ink-muted" style="margin:0 0 8px; font-size:12px; font-weight:600; color:{INK_MUTED}; text-transform:uppercase; letter-spacing:0.03em; font-family:{MONO_STACK};">{trip_name} &middot; {day}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="vertical-align:top; width:45%;">
              <p class="nv-strike" style="margin:0; font-size:13px; color:{INK_MUTED}; text-decoration:line-through; font-family:{FONT_STACK};">{original_name}</p>
              <p class="nv-strike" style="margin:2px 0 0; font-size:12px; color:{INK_MUTED}; text-decoration:line-through; font-family:{FONT_STACK};">{original_location}</p>
            </td>
            <td class="nv-ink-muted" style="vertical-align:middle; width:10%; text-align:center; color:{INK_MUTED}; font-size:14px; font-family:{FONT_STACK};">&rarr;</td>
            <td style="vertical-align:top; width:45%;">
              <p class="nv-ink" style="margin:0; font-size:14px; font-weight:600; color:{INK}; font-family:{FONT_STACK};">{alternate_name}</p>
              <p class="nv-ink-muted" style="margin:2px 0 0; font-size:12px; color:{INK_MUTED}; font-family:{FONT_STACK};">{alternate_location}</p>
              <span class="nv-rebooked" style="display:inline-block; margin-top:4px; padding:2px 8px; border-radius:999px; background-color:{ACCENT_500}; color:{NAVY_900}; font-size:10px; font-weight:700; letter-spacing:0.04em; font-family:{FONT_STACK};">REBOOKED</span>
            </td>
          </tr>
        </table>
        <p class="nv-warn" style="margin:8px 0 0; font-size:12px; color:#b45309; font-family:{FONT_STACK};">{icon} {reason}</p>
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
      <td class="nv-border" style="padding:16px 0; border-bottom:1px solid {NAVY_100};">
        <p class="nv-ink-muted" style="margin:0 0 8px; font-size:12px; font-weight:600; color:{INK_MUTED}; text-transform:uppercase; letter-spacing:0.03em; font-family:{MONO_STACK};">{trip_name} &middot; {day}</p>
        <p class="nv-ink" style="margin:0; font-size:14px; font-weight:600; color:{INK}; font-family:{FONT_STACK};">{name}</p>
        <p class="nv-ink-muted" style="margin:2px 0 0; font-size:12px; color:{INK_MUTED}; font-family:{FONT_STACK};">{location}</p>
        <p class="nv-warn" style="margin:8px 0 0; font-size:12px; color:#b45309; font-family:{FONT_STACK};">{icon} {reason}</p>
        <p class="nv-ink" style="margin:4px 0 0; font-size:13px; color:{INK}; font-family:{FONT_STACK};">💡 {tip}</p>
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
      <td class="nv-border" style="padding:16px 0; border-bottom:1px solid {NAVY_100};">
        <p class="nv-ink-muted" style="margin:0 0 8px; font-size:12px; font-weight:600; color:{INK_MUTED}; text-transform:uppercase; letter-spacing:0.03em; font-family:{MONO_STACK};">{trip_name} &middot; {day}</p>
        <p class="nv-ink" style="margin:0; font-size:14px; font-weight:600; color:{INK}; font-family:{FONT_STACK};">{restored_name}</p>
        <p class="nv-ink-muted" style="margin:2px 0 0; font-size:12px; color:{INK_MUTED}; font-family:{FONT_STACK};">{restored_location}</p>
        <p class="nv-good" style="margin:8px 0 0; font-size:12px; color:#15803d; font-family:{FONT_STACK};">&#9989; Forecast improved — we've switched back to your original plan.</p>
      </td>
    </tr>'''


def _reverted_row_text(r: dict) -> str:
    day = _format_day(r["day_date"])
    return f"- {r['trip_name']} ({day}): back to {r['restored_name']} at {r['restored_location']} — forecast improved"


def _summary_point_html(point: dict) -> str:
    icon = SUMMARY_ICONS.get(point.get("icon"), "💡")
    text = escape(point["text"], quote=False)
    return f'''<tr>
      <td class="nv-border" style="padding:10px 0; border-bottom:1px solid {NAVY_100};">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:top; width:28px; font-size:16px; font-family:{FONT_STACK};">{icon}</td>
            <td class="nv-ink" style="vertical-align:top; font-size:14px; color:{INK}; line-height:1.5; font-family:{FONT_STACK};">{text}</td>
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
      <p class="nv-ink-muted" style="margin:0 0 4px; font-size:12px; font-weight:600; color:{INK_MUTED}; text-transform:uppercase; letter-spacing:0.03em; font-family:{MONO_STACK};">{destination} &middot; {day}</p>
      <p class="nv-ink" style="margin:0 0 16px; font-size:16px; font-weight:600; color:{INK}; font-family:{FONT_STACK};">{condition}, {temp_min}&deg;&ndash;{temp_max}&deg;C</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows}</table>
      {_cta_html("View your itinerary")}
    """
    text = (
        f"{destination} ({day}): {condition}, {temp_min}-{temp_max}°C\n\n"
        + "\n".join(_summary_point_text(p) for p in summary_points)
        + f"\n\n{_cta_text('View your itinerary')}"
    )

    return _wrap(f"Today's weather in {trip.destination}", body_html, tag="DAILY FORECAST"), text


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
          <p class="nv-ink" style="margin:0 0 16px; font-size:14px; color:{INK}; line-height:1.6; font-family:{FONT_STACK};">
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
          <p class="nv-ink" style="margin:24px 0 16px; font-size:14px; color:{INK}; line-height:1.6; font-family:{FONT_STACK};">
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
          <p class="nv-ink" style="margin:24px 0 16px; font-size:14px; color:{INK}; line-height:1.6; font-family:{FONT_STACK};">
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
    tag = "ITINERARY UPDATE" if (swaps or reverted) else "WEATHER TIP"
    return _wrap(heading, body_html, tag=tag), text

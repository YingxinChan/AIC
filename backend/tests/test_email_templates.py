from services import email_templates


def test_test_email_returns_html_and_text():
    html, text = email_templates.test_email()
    assert "SmartTrip AI" in html
    assert "<html>" in html.lower()
    assert "notifications are working" in text
    assert "<" not in text  # plain-text part has no markup


def _swap(**overrides):
    defaults = dict(
        trip_name="Paris Trip", reason="Heavy rain expected (80.0% chance)",
        day_date="2026-08-01", original_name="Louvre Courtyard Walk", original_location="Louvre, Paris",
        alternate_name="Musée d'Orsay", alternate_location="1 Rue de la Légion d'Honneur, Paris",
    )
    defaults.update(overrides)
    return defaults


def test_swap_digest_email_lists_each_swap():
    swaps = [
        _swap(trip_name="Paris Trip", reason="Heavy rain expected (80.0% chance)"),
        _swap(trip_name="London Trip", reason="Heavy rain expected (65.0% chance)"),
    ]
    html, text = email_templates.swap_digest_email(swaps)

    assert html.count("Paris Trip") == 1
    assert html.count("London Trip") == 1
    assert "80.0%" in html and "65.0%" in html
    assert "Paris Trip" in text and "London Trip" in text


def test_swap_digest_email_escapes_html_special_characters():
    swaps = [_swap(trip_name="Mom & Dad's <Trip>", original_name="Tate & Modern")]
    html, text = email_templates.swap_digest_email(swaps)

    assert "<Trip>" not in html
    assert "Mom &amp; Dad's &lt;Trip&gt;" in html
    assert "Tate &amp; Modern" in html
    # plain-text part is never HTML-escaped
    assert "Mom & Dad's <Trip>" in text


def test_swap_digest_email_shows_day_and_before_after():
    html, text = email_templates.swap_digest_email([_swap()])

    assert "Sat, 01 Aug" in html
    for body in (html, text):
        assert "Louvre Courtyard Walk" in body
        assert "Louvre, Paris" in body
        assert "Musée d'Orsay" in body
        assert "1 Rue de la Légion d'Honneur, Paris" in body

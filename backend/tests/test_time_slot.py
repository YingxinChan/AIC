# Run: python -m pytest tests/test_time_slot.py
from services.time_slot import parse_time_slot, hourly_window_is_rainy


def test_parse_time_slot_standard_format():
    assert parse_time_slot("09:00 - 11:00") == (9, 11)


def test_parse_time_slot_no_spaces():
    assert parse_time_slot("9:00-11:00") == (9, 11)


def test_parse_time_slot_alternate_separator_word():
    assert parse_time_slot("09:00 to 11:00") == (9, 11)


def test_parse_time_slot_tolerates_surrounding_text():
    assert parse_time_slot("Afternoon (14:00 - 17:00)") == (14, 17)


def test_parse_time_slot_single_time_is_one_hour_window():
    assert parse_time_slot("14:00") == (14, 14)


def test_parse_time_slot_end_before_start_is_unparseable():
    assert parse_time_slot("22:00 - 01:00") is None


def test_parse_time_slot_out_of_range_hour_is_unparseable():
    assert parse_time_slot("25:00 - 27:00") is None


def test_parse_time_slot_no_digits_is_unparseable():
    assert parse_time_slot("Flexible") is None
    assert parse_time_slot("All day") is None
    assert parse_time_slot("") is None
    assert parse_time_slot(None) is None


def test_hourly_window_is_rainy_true_when_hour_inside_window_meets_threshold():
    hourly = [
        {"time": "2026-08-01T08:00", "rain_probability": 20},
        {"time": "2026-08-01T09:00", "rain_probability": 75},
        {"time": "2026-08-01T10:00", "rain_probability": 10},
    ]
    assert hourly_window_is_rainy(hourly, (9, 11), 60) is True


def test_hourly_window_is_rainy_false_when_rainy_hour_outside_window():
    hourly = [
        {"time": "2026-08-01T09:00", "rain_probability": 90},
        {"time": "2026-08-01T14:00", "rain_probability": 10},
    ]
    assert hourly_window_is_rainy(hourly, (14, 16), 60) is False


def test_hourly_window_is_rainy_false_for_empty_hourly_data():
    assert hourly_window_is_rainy([], (9, 11), 60) is False


def test_hourly_window_is_rainy_handles_missing_rain_probability():
    hourly = [{"time": "2026-08-01T09:00"}]  # no rain_probability key at all
    assert hourly_window_is_rainy(hourly, (9, 11), 60) is False

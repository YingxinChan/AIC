def test_all_model_tables_registered_in_metadata():
    from models import Base
    table_names = set(Base.metadata.tables.keys())
    assert "users" in table_names
    assert "trips" in table_names
    assert "activities" in table_names

import pytest
from services.cook_service import classify_by_rules, intro_text, step_text

RECIPE = {"name": "Pad Kra Pao", "steps": ["Chop garlic.", "Stir fry."], "ingredients": ["Garlic - 10 g", "Basil"]}


@pytest.mark.parametrize("msg,expected", [
    ("Next", ("next", None)),
    ("next!", ("next", None)),
    ("ok", ("next", None)),
    ("Back", ("back", None)),
    ("Repeat", ("repeat", None)),
    ("Ingredients", ("ingredients", None)),
    ("Start cooking", ("start", None)),
    ("exit", ("exit", None)),
    ("!help", ("help", None)),
    ("step 2", ("goto", 2)),
    ("go to step 3", ("goto", 3)),
])
def test_rules_read_navigation(msg, expected):
    assert classify_by_rules(msg) == expected


@pytest.mark.parametrize("msg", [
    "can I use lime instead of fish sauce?",
    "how long should I fry the garlic",
    "next time I want it spicier",   # not a bare "next": left to the classifier
])
def test_rules_leave_questions_alone(msg):
    assert classify_by_rules(msg) is None


def test_texts():
    assert "Pad Kra Pao" in intro_text(RECIPE) and "Garlic - 10 g" in intro_text(RECIPE)
    assert step_text(RECIPE, 2) == "Step 2/2\nStir fry."

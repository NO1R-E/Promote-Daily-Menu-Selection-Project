import pytest
from services.cook_service import classify_by_rules, intro_text, navigate, step_text

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


@pytest.mark.parametrize("action,n,step,expected_step,ended,starts_with", [
    ("start", None, 0, 0, False, "Let's cook"),
    ("start", None, 2, 1, False, "Step 1/2"),
    ("next", None, 0, 1, False, "Step 1/2"),
    ("next", None, 1, 2, False, "Step 2/2"),
    ("next", None, 2, 0, True, "That was the last step"),
    ("back", None, 0, 0, False, "Let's cook"),
    ("back", None, 1, 1, False, "This is the first step."),
    ("back", None, 2, 1, False, "Step 1/2"),
    ("repeat", None, 0, 0, False, "Let's cook"),
    ("repeat", None, 2, 2, False, "Step 2/2"),
    ("goto", 2, 1, 2, False, "Step 2/2"),
    ("goto", 9, 1, 1, False, "This recipe has steps 1 to 2"),
    ("goto", None, 1, 1, False, "This recipe has steps 1 to 2"),
    ("ingredients", None, 1, 1, False, "Ingredients for Pad Kra Pao"),
    ("help", None, 1, 1, False, "You're in cooking mode"),
    ("exit", None, 1, 0, True, "Cooking mode is off"),
])
def test_navigate(action, n, step, expected_step, ended, starts_with):
    text, new_step, is_ended = navigate(action, n, RECIPE, step)
    assert text.startswith(starts_with)
    assert (new_step, is_ended) == (expected_step, ended)


def test_navigate_leaves_questions_to_the_llm():
    assert navigate("question", None, RECIPE, 1) is None


def test_texts():
    assert "Pad Kra Pao" in intro_text(RECIPE) and "Garlic - 10 g" in intro_text(RECIPE)
    assert step_text(RECIPE, 2) == "Step 2/2\nStir fry."

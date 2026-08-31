import pytest
from services.dss_service import calculate_meal_recommendations, MEAL_CACHE
from schemas import CachedRecipes

@pytest.fixture(autouse=True)
def setup_mock_cache():
    """Populates the in-memory MEAL_CACHE with dummy data before tests run."""
    MEAL_CACHE.clear()
    MEAL_CACHE.extend([
        CachedRecipes(id="1", name="Low Salt Chicken", calories=300, protein=30, fat=5, carbs=10, tags=["low salt"]),
        CachedRecipes(id="2", name="Sweet Pork", calories=500, protein=20, fat=20, carbs=40, tags=["sweet"]),
    ])

@pytest.mark.asyncio
async def test_calculate_meal_recommendations_filters_correctly():
    # Execute function with low-salt constraint
    results = await calculate_meal_recommendations(user_id=123 ,preferences=["low salt"])
    
    assert len(results) > 0
    assert results[0].id == "1"
    assert "low salt" in results[0].reason
import pytest
from unittest.mock import AsyncMock, patch
from schemas import ClassificationResult, IntentEnum
from services.groq_service import classify_intent

@pytest.mark.asyncio
async def test_classify_intent_mocked():
    fake_json_response = '{"intent": "meal_recommendation", "preferences": ["low salt"]}'
    
    # Mock the execute_groq_with_fallback function
    with patch("services.groq_service.execute_groq_with_fallback", new_callable=AsyncMock) as mock_groq:
        mock_groq.return_value = fake_json_response
        
        result = await classify_intent("Recommend a low salt dinner")
        
        assert isinstance(result, ClassificationResult)
        assert result.intent == IntentEnum.MEAL_RECOMMENDATION
        assert "low salt" in result.preferences
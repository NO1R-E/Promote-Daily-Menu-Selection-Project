from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_chat_endpoint_empty_message_returns_400():
    response = client.post("/api/chat", json={"user_id": "u1", "room_id": "r1", "message": "   "})
    assert response.status_code == 400
    assert response.json()["detail"] == "Message cannot be empty"
import requests
import pytest

def test_canvas_get_courses():
    token = "test_canvas_token"
    url = "https://canvas.test.edu/api/v1/courses"
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(url, headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

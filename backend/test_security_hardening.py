import sys
import os
from fastapi.testclient import TestClient

# Add backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app

client = TestClient(app)


def test_security_headers_presence():
    print("\n1. Testing security headers in API response...")
    response = client.get("/health")
    assert response.status_code == 200
    
    headers = response.headers
    
    # Assert security headers are present
    assert "content-security-policy" in headers
    assert "x-content-type-options" in headers
    assert headers["x-content-type-options"] == "nosniff"
    assert "x-frame-options" in headers
    assert headers["x-frame-options"] == "DENY"
    assert "strict-transport-security" in headers
    assert "referrer-policy" in headers
    
    print("Success: CSP, HSTS, X-Frame-Options, Referrer-Policy, and X-Content-Type-Options verified.")


def test_rate_limiting_enforcement():
    print("\n2. Testing rate limiter on sensitive endpoints...")
    
    # Send rapid requests (threshold is 5 requests per 10 seconds)
    limit_triggered = False
    retry_after_header = None
    
    for i in range(10):
        # Request forgot-password endpoint
        res = client.post("/api/v1/auth/forgot-password", json={"email": f"test{i}@example.com"})
        
        if res.status_code == 429:
            limit_triggered = True
            retry_after_header = res.headers.get("retry-after")
            print(f"Rate limit triggered successfully at request {i+1}! Retry-After: {retry_after_header}")
            break
            
    assert limit_triggered, "Rate limiter did not block excessive requests."
    assert retry_after_header is not None, "429 Response missing Retry-After header."
    assert int(retry_after_header) > 0, "Retry-After is not a positive timeout."
    print("Success: Rate limiter blocked connections and returned Retry-After headers.")


if __name__ == "__main__":
    test_security_headers_presence()
    test_rate_limiting_enforcement()
    print("\nSecurity Hardening checks successfully completed!")

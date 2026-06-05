import requests


BASE_URL = "http://127.0.0.1:8000"


def test_endpoint(name, url, expected_status=200):
    try:
        response = requests.get(url, timeout=90)

        if response.status_code == expected_status:
            print(f"PASS: {name} returned {response.status_code}")
            return True

        print(f"FAIL: {name} returned {response.status_code}, expected {expected_status}")
        print(response.text)
        return False

    except Exception as e:
        print(f"FAIL: {name} crashed with error: {e}")
        return False


def main():
    tests = [
        ("Root", f"{BASE_URL}/", 200),
        ("Health", f"{BASE_URL}/health", 200),
        ("API Health", f"{BASE_URL}/api/health", 200),
        ("Analyze AAPL", f"{BASE_URL}/analyze/AAPL", 200),
        ("Recommend AAPL", f"{BASE_URL}/recommend/AAPL", 200),
        ("Strategies AAPL", f"{BASE_URL}/strategies/AAPL", 200),
        ("Compare Stocks", f"{BASE_URL}/compare?tickers=AAPL,NVDA,TSLA", 200),
        ("Portfolio Summary", f"{BASE_URL}/portfolio?tickers=AAPL,NVDA,TSLA,MSFT,AMD", 200),
        ("Trending", f"{BASE_URL}/api/trending", 200),
        ("Invalid Ticker", f"{BASE_URL}/analyze/@@@", 400),
    ]

    passed = 0

    for name, url, expected_status in tests:
        if test_endpoint(name, url, expected_status):
            passed += 1

    total = len(tests)

    print("=" * 50)
    print(f"API TESTS COMPLETE: {passed}/{total} passed")

    if passed == total:
        print("ALL API TESTS PASSED")
    else:
        print("Some API tests failed")


if __name__ == "__main__":
    main()
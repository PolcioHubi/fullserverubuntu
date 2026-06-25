import logging


def test_404_logged_as_warning_without_traceback(client, caplog):
    with caplog.at_level(logging.WARNING):
        resp = client.get("/definitely-not-a-real-route-xyz123")
    assert resp.status_code == 404
    recs = [r for r in caplog.records if "HTTP Error 404" in r.getMessage()]
    assert recs, "404 should still be logged"
    for r in recs:
        assert r.levelno == logging.WARNING   # not ERROR
        assert r.exc_info is None             # no stack trace

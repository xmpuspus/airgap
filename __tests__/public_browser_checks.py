"""Authored browser regressions using actual site bytes and an actual missing file.

Called by public:qa. No route interception, provider doubles, or clock changes.
Screenshots are embedded in the already-declared qa.json output.
"""

import base64
import functools
import hashlib
import http.server
import json
import pathlib
import shutil
import tempfile
import threading
from datetime import datetime, timezone

from playwright.sync_api import expect

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE_FILES = ("lab.html", "lab.js", "lab.css", "styles.css", "public-core.js")


def screenshot(page, label):
    png = page.screenshot(full_page=True)
    return {
        "label": label,
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "mimeType": "image/png",
        "sha256": hashlib.sha256(png).hexdigest(),
        "base64": base64.b64encode(png).decode("ascii"),
    }


def check_loading_recovery(browser, width, height, pack):
    parent = ROOT / "tmp/public-showcase"
    parent.mkdir(parents=True, exist_ok=True)
    pack_bytes = (ROOT / "web/data/public-service.json").read_bytes()
    with tempfile.TemporaryDirectory(prefix="missing-pack-", dir=parent) as directory:
        staged = pathlib.Path(directory)
        for file in SITE_FILES:
            shutil.copyfile(ROOT / "web" / file, staged / file)
        (staged / "data").mkdir()
        handler = functools.partial(
            http.server.SimpleHTTPRequestHandler, directory=str(staged)
        )
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        context = None
        try:
            context = browser.new_context(viewport={"width": width, "height": height})
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            base = f"http://127.0.0.1:{server.server_port}"

            def source_response(response):
                return response.url == base + "/data/public-service.json"

            with page.expect_response(source_response) as missing:
                page.goto(base + "/lab.html", wait_until="networkidle")
            assert missing.value.status == 404
            expect(page.locator("#load-status")).to_contain_text("Source pack HTTP 404")
            expect(page.locator("#workspace")).to_be_hidden()
            expect(page.locator("#retry")).to_be_visible()
            failure = screenshot(page, "Actual missing pack: HTTP 404")
            error_text = page.locator("#load-status").inner_text()

            # Retry once while the file is still absent. The server still returns
            # a real 404, and the workspace must remain unavailable.
            page.locator("#retry").focus()
            with page.expect_response(source_response) as still_missing:
                page.keyboard.press("Enter")
            assert still_missing.value.status == 404
            expect(page.locator("#retry")).to_be_visible()
            expect(page.locator("#workspace")).to_be_hidden()

            # Restore an exact copy of the real pack, never a made-up response.
            (staged / "data/public-service.json").write_bytes(pack_bytes)
            page.locator("#retry").focus()
            with page.expect_response(source_response) as restored:
                page.keyboard.press("Enter")
            assert restored.value.status == 200
            served_hash = hashlib.sha256(restored.value.body()).hexdigest()
            assert served_hash == hashlib.sha256(pack_bytes).hexdigest()
            expect(page.locator("#workspace")).to_be_visible()
            expect(page.locator("#retry")).to_be_hidden()
            expect(page.locator("#case option")).to_have_count(len(pack["cases"]) + 1)
            page.locator("#question").fill("Magkano ang passport?")
            page.locator("#ask-form button[type=submit]").focus()
            page.keyboard.press("Enter")
            expect(page.locator("#route")).to_have_text(
                "Route: record · Model called: no"
            )
            passport = next(
                record for record in pack["records"] if record["id"] == "fee-011"
            )
            expect(page.locator("#answer")).to_contain_text(passport["content"])
            recovered = screenshot(
                page, "Exact pack restored: live deterministic answer"
            )
            assert not errors, errors
            assert (
                page.evaluate("document.documentElement.scrollWidth - innerWidth") <= 1
            )
            return {
                "origin": (
                    "Authored filesystem fault: real pack omitted, "
                    "then exact bytes restored"
                ),
                "httpStatuses": [
                    missing.value.status,
                    still_missing.value.status,
                    restored.value.status,
                ],
                "errorText": error_text,
                "recoveredPackSha256": served_hash,
                "answer": page.locator("#answer").inner_text(),
                "routeLabel": page.locator("#route").inner_text(),
                "pageErrors": errors,
                "screenshots": [failure, recovered],
            }
        finally:
            if context is not None:
                context.close()
            server.shutdown()
            server.server_close()
            thread.join()


def check_historical_dates(page):
    original, amendment = page.locator("#revision-comparison > div").all()
    expect(original).to_contain_text("Source document dated 2024-01-02")
    expect(original).to_contain_text("Proclamation signed 2023-10-11")
    expect(amendment).to_contain_text("Source document dated 2024-08-16")
    expect(amendment).to_contain_text("Proclamation issued 2024-08-15")
    expect(page.locator("#revision-comparison")).not_to_contain_text("Published")


def check_landing(page, base, width, pack):
    response = page.goto(base + "/index.html", wait_until="networkidle")
    assert response.status == 200
    manifest = page.request.get(base + "/data/manifest.json")
    assert manifest.ok
    count = len(manifest.json()["verticals"])
    site_images = {"assets/gifs/airgap-demo.gif"}
    for vertical in manifest.json()["verticals"]:
        data = page.request.get(base + f"/data/{vertical['vertical']}.json")
        assert data.ok
        site_images.add(data.json()["gif"])
    assert len(site_images) == count + 1
    served_site_images = []
    for href in sorted(site_images):
        source_bytes = (ROOT / "demo" / pathlib.Path(href).name).read_bytes()
        image_response = page.request.get(f"{base}/{href}")
        assert image_response.status == 200, href
        source_hash = hashlib.sha256(source_bytes).hexdigest()
        assert hashlib.sha256(image_response.body()).hexdigest() == source_hash
        served_site_images.append({"href": href, "sha256": source_hash})
    for image_element in page.locator("img").all():
        assert image_element.evaluate(
            "image => image.complete && image.naturalWidth > 0"
        ), image_element.get_attribute("src")
    expect(
        page.locator(".trust-grid p")
        .filter(has_text="industry templates")
        .locator("strong")
    ).to_have_text(str(count))
    cards = page.locator("#public-service article[data-feature]")
    expect(cards).to_have_count(5)
    features = {card.get_attribute("data-feature") for card in cards.all()}
    assert features == {
        "replay-pack",
        "evidence-lab",
        "source-workbench",
        "model-controls",
        "demo-kit",
    }
    media_manifest = json.loads(
        (ROOT / "demo/public-service/recordings.json").read_text()
    )
    recordings = {
        recording["feature"]: recording for recording in media_manifest["recordings"]
    }
    assert set(recordings) == features
    served_media = []
    for card in cards.all():
        feature = card.get_attribute("data-feature")
        recording = recordings[feature]
        expect(card.locator("h3")).to_be_visible()
        assert len(card.locator("p").inner_text()) > 40
        for suffix, path_field, hash_field in (
            (".gif", "output", "sha256"),
            (".mp4", "shareMp4", "shareMp4Sha256"),
        ):
            link = card.locator(f'a[href$="{suffix}"]')
            expect(link).to_have_count(1)
            source_path = recording[path_field]
            source_bytes = (ROOT / source_path).read_bytes()
            declared_hash = recording[hash_field]
            assert hashlib.sha256(source_bytes).hexdigest() == declared_hash
            href = link.get_attribute("href")
            assert href == f"assets/gifs/public-service/{feature}{suffix}"
            media_response = page.request.get(f"{base}/{href}")
            assert media_response.status == 200
            served_hash = hashlib.sha256(media_response.body()).hexdigest()
            assert served_hash == declared_hash
            served_media.append(
                {"feature": feature, "href": href, "sha256": served_hash}
            )
    expect(page.locator("#public-service")).to_contain_text(
        "node scripts/public-service.mjs replay --json"
    )
    expect(page.locator("#public-service")).to_contain_text(
        "npm run public:demo -- --model"
    )
    assert page.evaluate("document.documentElement.scrollWidth - innerWidth") <= 1, (
        width
    )
    image = screenshot(page, "Public-service landing page")
    link = page.locator('#public-service a[href="lab.html"]').first
    link.focus()
    page.keyboard.press("Enter")
    expect(page.locator("#workspace")).to_be_visible()
    expect(page.locator("#case option")).to_have_count(len(pack["cases"]) + 1)
    return {
        "templateCount": count,
        "featureCount": 5,
        "servedMedia": served_media,
        "servedSiteImages": served_site_images,
        "screenshot": image,
    }

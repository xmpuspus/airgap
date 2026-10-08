#!/usr/bin/env python3
"""Build the minimum support bot architecture diagram.

Writes minimum-support-bot.drawio next to this file, then exports a PNG with
the draw.io desktop CLI (`drawio` on PATH). The README embeds the PNG.

    python3 docs/diagrams/build_minimum_support_bot.py
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path
from xml.sax.saxutils import quoteattr

PAYLOAD, META, CONTROL = "#B83227", "#1F6FB2", "#7F8C8D"
INK, MUTED = "#232F3E", "#5A6B7B"
EDGE = {"payload": (PAYLOAD, 0), "meta": (META, 1), "control": (CONTROL, 1)}
CODE, MODEL, DATA = "#3C4A5A", "#C77700", "#1F6FB2"
HERE = Path(__file__).resolve().parent
NAME = "minimum-support-bot"


class Page:
    def __init__(self, name: str, width: int, height: int) -> None:
        self.name, self.width, self.height = name, width, height
        self.back: list[str] = []
        self.edges: list[str] = []
        self.cells: list[str] = []
        self.n = 2
        self.geo: dict[str, tuple[float, float, float, float]] = {}

    def _id(self) -> str:
        self.n += 1
        return f"c{self.n}"

    def vertex(self, value, x, y, w, h, style, layer="cells") -> str:
        i = self._id()
        geo = f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/>'
        xml = f'<mxCell id="{i}" value={quoteattr(value)} style="{style}" vertex="1" parent="1">{geo}</mxCell>'
        getattr(self, layer).append(xml)
        self.geo[i] = (x, y, w, h)
        return i

    def text(self, value, x, y, w, h, size=12, bold=False, color=INK, italic=False) -> str:
        style = (
            f"text;html=1;whiteSpace=wrap;fontSize={size};fontStyle={(1 if bold else 0) + (2 if italic else 0)};"
            f"fontColor={color};align=left;verticalAlign=top;"
        )
        return self.vertex(value, x, y, w, h, style)

    def header(self, title: str, subtitle: str) -> None:
        self.text(title, 40, 18, self.width - 120, 36, size=24, bold=True)
        self.text(subtitle, 40, 58, self.width - 120, 24, size=13, color=MUTED)

    def panel(self, value, x, y, w, h, stroke=INK, fill="none", dashed=0) -> str:
        style = (
            f"rounded=1;arcSize=2;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};dashed={dashed};"
            f"verticalAlign=top;align=left;spacingLeft=10;spacingTop=4;fontSize=13;fontStyle=1;fontColor={stroke};"
        )
        return self.vertex(value, x, y, w, h, style, layer="back")

    def card(self, title, lines, x, y, w, h, color) -> str:
        """A titled box: colour bar with the title, bullet lines below."""
        style = (
            f"swimlane;html=1;startSize=30;rounded=1;arcSize=6;fontStyle=1;fontSize=13;fontColor=#FFFFFF;"
            f"fillColor={color};strokeColor={color};swimlaneFillColor=#FFFFFF;align=center;"
        )
        i = self.vertex(title, x, y, w, h, style)
        body = "<br>".join(f"· {line}" for line in lines)
        self.text(body, x + 8, y + 36, w - 16, h - 40, size=12)
        return i

    def box(self, label, x, y, w, h, stroke=INK, fill="#FFFFFF", width=1) -> str:
        style = (
            f"rounded=1;arcSize=10;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};strokeWidth={width};"
            f"fontSize=12;fontColor={INK};align=center;verticalAlign=middle;spacingLeft=6;spacingRight=6;"
        )
        return self.vertex(label, x, y, w, h, style)

    def note(self, value, x, y, w, h=40) -> str:
        return self.text(value, x, y, w, h, size=11, color=MUTED, italic=True)

    def arrow(self, src, dst, cls, label="", points=None, exit_=None, entry=None) -> None:
        color, dashed = EDGE[cls]
        extra = ""
        if exit_:
            extra += f"exitX={exit_[0]};exitY={exit_[1]};exitDx=0;exitDy=0;"
        if entry:
            extra += f"entryX={entry[0]};entryY={entry[1]};entryDx=0;entryDy=0;"
        pts = "".join(f'<mxPoint x="{px}" y="{py}"/>' for px, py in points or [])
        geo = f'<Array as="points">{pts}</Array>' if pts else ""
        style = (
            f"edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;endFill=1;strokeColor={color};strokeWidth=2;"
            f"dashed={dashed};fontSize=11;fontStyle=1;fontColor={color};labelBackgroundColor=#FFFFFF;{extra}"
        )
        self.edges.append(
            f'<mxCell id="{self._id()}" value={quoteattr(label)} style="{style}" edge="1" parent="1" '
            f'source="{src}" target="{dst}"><mxGeometry relative="1" as="geometry">{geo}</mxGeometry></mxCell>'
        )

    def side(self, src, dst, cls, label="") -> None:
        self.arrow(src, dst, cls, label, None, (1, 0.5), (0, 0.5))

    def down(self, src, dst, cls, label="") -> None:
        self.arrow(src, dst, cls, label, None, (0.5, 1), (0.5, 0))

    def up(self, src, dst, cls, label="") -> None:
        self.arrow(src, dst, cls, label, None, (0.5, 0), (0.5, 1))

    def lane(self, src, dst, cls, label, lane_y) -> None:
        sx, sy, sw, sh = self.geo[src]
        tx, ty, tw, th = self.geo[dst]
        pts = [(sx + sw / 2, lane_y), (tx + tw / 2, lane_y)]
        self.arrow(src, dst, cls, label, pts, (0.5, 1), (0.5, 1))

    def gutter(self, src, dst, cls, label, gutter_y) -> None:
        sx, sy, sw, sh = self.geo[src]
        tx, ty, tw, th = self.geo[dst]
        pts = [(sx + sw / 2, gutter_y), (tx + tw / 2, gutter_y)]
        self.arrow(src, dst, cls, label, pts, (0.5, 0), (0.5, 0))

    def xml(self) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", self.name.lower())
        return (
            f'<diagram id="{slug}" name={quoteattr(self.name)}><mxGraphModel dx="{self.width}" dy="{self.height}" grid="1" '
            f'gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" '
            f'pageWidth="{self.width}" pageHeight="{self.height}" math="0" shadow="0" background="#FFFFFF"><root>'
            f'<mxCell id="0"/><mxCell id="1" parent="0"/>{"".join(self.back + self.edges + self.cells)}</root></mxGraphModel></diagram>'
        )


def hug(page: Page, ids: list, pad_x=24, pad_top=36, pad_bottom=24):
    boxes = [page.geo[i] for i in ids]
    x0 = min(b[0] for b in boxes) - pad_x
    y0 = min(b[1] for b in boxes) - pad_top
    x1 = max(b[0] + b[2] for b in boxes) + pad_x
    y1 = max(b[1] + b[3] for b in boxes) + pad_bottom
    return (x0, y0, x1 - x0, y1 - y0)


def build() -> Page:
    p = Page("Minimum support bot", 2040, 900)
    p.header(
        "Airgap · Minimum public-facing support bot · Request path",
        "one user message, left to right · grey boxes are code · the model is the one orange box · github.com/xmpuspus/airgap",
    )

    # Inputs.
    config = p.card(
        "Config (JSON)",
        ["brand, bot name", "scope and identity records", "provider policy and order", "blocklist, refusal templates"],
        300,
        130,
        300,
        118,
        DATA,
    )
    knowledge = p.card(
        "Knowledge store",
        ["dated records: as_of, content, keywords, source_url", "signed, versioned bundles", "local only, no network"],
        640,
        130,
        360,
        118,
        DATA,
    )
    p.panel("Inputs", *hug(p, [config, knowledge]), stroke=DATA)

    # Pipeline.
    user = p.box("<b>User</b><br>mobile app", 60, 410, 120, 70, stroke=INK, width=2)
    stages_spec = [
        ("1 Guardrails", ["blocklist rules", "prompt-probe rules", "fixed refusal", "no inference"], CODE),
        ("2 Deterministic intents", ["greeting", "doubt check: replay last answer", "date and time: system clock", "action phrase: keyword router"], CODE),
        ("3 Retrieval", ["local BM25 (MiniSearch)", "top-k dated records", "no network call"], CODE),
        ("4 Verbatim records", ["identity and scope", "rendered as written", "model skipped"], CODE),
        ("5 Provider chain", ["policy picks one:", "on-device Gemma 4 E2B, 3-bit, 2.4 GB", "demo formatter", "cloud (optional)", "prompt = rules + records + question"], MODEL),
        ("6 Output validation", ["amounts, dates, names", "must exist in the records", "streamed tokens gated", "miss: show the record and why"], CODE),
        ("7 Provenance", ["provider", "model file", "knowledge version", "sources"], CODE),
    ]
    stages = []
    for k, (title, lines, color) in enumerate(stages_spec):
        stages.append(p.card(title, lines, 240 + k * 250, 370, 230, 150, color))
    pipeline = p.panel("Request pipeline", *hug(p, stages, pad_bottom=64), stroke=INK)
    # Notes under their stages, inside the pipeline box.
    p.note("The only model call. It phrases the retrieved records, nothing else.", 1245, 526, 222, 44)
    p.note("Code checks the model text before it renders.", 1495, 526, 222, 44)
    p.note("Every answer shows who answered.", 40, 500, 150, 44)

    # Actions and evidence.
    router = p.card("Keyword router", ["code, no model", "picks the action"], 490, 690, 210, 76, CODE)
    rest = p.card("REST backend connector", ["token auth, HTTPS", "one call per action"], 740, 690, 230, 76, CODE)
    outbox = p.card("Offline outbox", ["idempotency keys", "receipts, retry"], 1010, 690, 210, 76, CODE)
    p.panel("Actions · the model never decides", *hug(p, [router, rest, outbox]), stroke=INK)
    tests = p.card("Prompt sets in CI", ["golden and adversarial", "one set per template"], 1300, 690, 230, 76, CODE)
    recordings = p.card("Pinned recordings", ["source commit per take", "manifest checked in CI"], 1570, 690, 230, 76, CODE)
    p.panel("Evidence · on every change", *hug(p, [tests, recordings]), stroke=INK)

    # Flows.
    p.side(user, stages[0], "payload", "message")
    for k in range(6):
        p.side(stages[k], stages[k + 1], "payload")
    p.gutter(stages[6], user, "payload", "answer with provider, model, sources", 104)
    p.lane(stages[0], stages[6], "payload", "", 598)
    p.lane(stages[1], stages[6], "payload", "fixed replies skip the model", 606)
    p.lane(stages[3], stages[6], "payload", "", 614)
    p.down(config, stages[0], "control", "rules")
    p.down(config, stages[4], "control", "policy")
    p.down(knowledge, stages[2], "meta", "records")
    p.down(stages[1], router, "meta", "action")
    p.side(router, rest, "meta", "online")
    p.lane(router, outbox, "meta", "offline", 800)
    # CI replays the prompt sets through the whole pipeline, so the arrow
    # enters the pipeline box itself, straight up from the tests card.
    tx, ty, tw, th = p.geo[tests]
    px, py, pw, ph = p.geo[pipeline]
    p.arrow(tests, pipeline, "control", "replay", None, (0.5, 0), ((tx + tw / 2 - px) / pw, 1))
    p.down(stages[6], recordings, "meta", "takes")
    return p


def write(page: Page, out: Path) -> None:
    out.write_text('<mxfile host="drawio" version="24.7.17">' + page.xml() + "</mxfile>\n")


def export(drawio_file: Path) -> None:
    target = drawio_file.with_suffix(".png")
    subprocess.run(
        ["drawio", "-x", "-f", "png", "-s", "1", "-o", str(target), str(drawio_file)],
        check=True,
        capture_output=True,
        timeout=180,
    )
    print(target)


if __name__ == "__main__":
    out = HERE / f"{NAME}.drawio"
    write(build(), out)
    print(out)
    export(out)

from __future__ import annotations

import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "CitySync_Whitepaper.md"
OUTPUT = ROOT / "CitySync_Whitepaper.docx"
ASSETS = ROOT / "assets"
BRAND = Path("/Users/nathansuits/dev/Progress/public/brand")

NAVY = "15151E"
BLUE = "245D75"
BLUE_DARK = "183C4C"
BLUE_LIGHT = "E8F1F4"
GOLD = "DD9E33"
GOLD_LIGHT = "F8EEDC"
TEXT = "222731"
MUTED = "64717A"
PALE = "F4F6F7"
WHITE = "FFFFFF"
RULE = "D8E0E3"


def font(size: int, bold: bool = False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Calibri Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Calibri.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    return ImageFont.load_default()


def rounded_box(draw, xy, fill, outline=None, radius=24, width=2):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def arrow(draw, start, end, fill, width=8):
    draw.line([start, end], fill=fill, width=width)
    x, y = end
    draw.polygon([(x, y), (x - 20, y - 13), (x - 20, y + 13)], fill=fill)


def create_architecture_diagram(path: Path):
    w, h = 1800, 1120
    im = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(im)
    f_title = font(50, True)
    f_head = font(31, True)
    f_body = font(23)
    f_small = font(20)

    d.text((90, 65), "City/Sync: local operations, shared proof", font=f_title, fill="#15151E")
    d.text((90, 130), "Private data stays close to the institution; verifiable commitments travel.", font=f_body, fill="#64717A")

    columns = [
        (90, 245, 470, 825, "ORGANIZATION", "#E8F1F4", [
            ("Volunteer application", "Discovery · consent · scheduling"),
            ("SQLite-compatible node", "Projections · private evidence"),
            ("Append-only journal", "Authority · policy · corrections"),
        ]),
        (710, 245, 1090, 825, "CITY DOMAIN", "#F8EEDC", [
            ("City policy profile", "Local rules · trust registry"),
            ("Independent city ledger", "Ordered events · reconciliation"),
            ("Civic Credit journal", "Optional · capped · city-scoped"),
        ]),
        (1330, 245, 1710, 825, "PUBLIC PROOF", "#F4F6F7", [
            ("Merkle proof bundle", "Hashes · versions · inclusion"),
            ("Anchor adapter", "Chain-agnostic submission"),
            ("Public commitment", "Root · range · receipt"),
        ]),
    ]
    for x1, y1, x2, y2, head, fill, items in columns:
        rounded_box(d, (x1, y1, x2, y2), fill, "#D8E0E3", 24, 3)
        d.text((x1 + 30, y1 + 26), head, font=f_head, fill="#245D75")
        y = y1 + 95
        for title, desc in items:
            rounded_box(d, (x1 + 28, y, x2 - 28, y + 120), "#FFFFFF", "#D8E0E3", 16, 2)
            d.text((x1 + 48, y + 22), title, font=f_head, fill="#15151E")
            d.text((x1 + 48, y + 68), desc, font=f_small, fill="#64717A")
            y += 148

    arrow(d, (490, 530), (690, 530), "#245D75", 8)
    d.text((515, 470), "signed events", font=f_small, fill="#245D75")
    d.text((505, 558), "ordered · idempotent", font=f_small, fill="#64717A")
    arrow(d, (1110, 530), (1310, 530), "#DD9E33", 8)
    d.text((1143, 470), "Merkle roots", font=f_small, fill="#A96C0A")
    d.text((1135, 558), "no raw PII", font=f_small, fill="#64717A")

    rounded_box(d, (90, 900, 1710, 1025), "#15151E", None, 20, 0)
    d.text((135, 928), "FEDERATION LAYER", font=f_head, fill="#DD9E33")
    d.text((570, 930), "schemas · credentials · trust registries · conformance tests · governance", font=f_body, fill="#FFFFFF")
    im.save(path, quality=95, dpi=(180, 180))


def create_theory_diagram(path: Path):
    w, h = 1800, 910
    im = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(im)
    f_title = font(50, True)
    f_head = font(27, True)
    f_body = font(21)
    d.text((90, 60), "The City/Sync theory of change", font=f_title, fill="#15151E")
    d.text((90, 125), "A sequence of testable links—not an automatic effect of technology.", font=f_body, fill="#64717A")

    labels = [
        ("Institutional continuity", "Rule · authority · evidence · correction"),
        ("Lower uncertainty", "Less learning, compliance, and protective effort"),
        ("Confident participation", "Follow-through · disclosure · cooperation"),
        ("Better institutional learning", "Stronger information · clearer accountability"),
        ("Greater civic capacity", "More reliable coordination for public goods"),
    ]
    colors = ["#E8F1F4", "#EDF4F6", "#F8EEDC", "#F4F6F7", "#E8F1F4"]
    x = 70
    y1, y2 = 285, 600
    bw, gap = 292, 52
    for idx, ((title, desc), fill) in enumerate(zip(labels, colors)):
        x1 = x + idx * (bw + gap)
        x2 = x1 + bw
        rounded_box(d, (x1, y1, x2, y2), fill, "#D8E0E3", 24, 3)
        lines = title.split(" ")
        if len(lines) > 2:
            d.text((x1 + 24, y1 + 40), " ".join(lines[:2]), font=f_head, fill="#245D75")
            d.text((x1 + 24, y1 + 76), " ".join(lines[2:]), font=f_head, fill="#245D75")
            desc_y = y1 + 145
        else:
            d.text((x1 + 24, y1 + 52), title, font=f_head, fill="#245D75")
            desc_y = y1 + 130
        words, lines_out, line = desc.split(), [], ""
        for word in words:
            test = (line + " " + word).strip()
            if d.textbbox((0, 0), test, font=f_body)[2] > bw - 48:
                lines_out.append(line)
                line = word
            else:
                line = test
        if line:
            lines_out.append(line)
        for li, txt in enumerate(lines_out):
            d.text((x1 + 24, desc_y + li * 31), txt, font=f_body, fill="#4D5962")
        if idx < len(labels) - 1:
            arrow(d, (x2 + 7, 444), (x2 + gap - 7, 444), "#DD9E33", 7)

    rounded_box(d, (305, 700, 1495, 820), "#15151E", None, 18, 0)
    d.text((350, 727), "Feedback loop", font=f_head, fill="#DD9E33")
    d.text((565, 728), "Participation improves the information and relationships available to the institution.", font=f_body, fill="#FFFFFF")
    im.save(path, quality=95, dpi=(180, 180))


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=80, start=120, bottom=80, end=120):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for m, v in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{m}"))
        if node is None:
            node = OxmlElement(f"w:{m}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(v))
        node.set(qn("w:type"), "dxa")


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def set_keep_with_next(paragraph, keep=True):
    p_pr = paragraph._p.get_or_add_pPr()
    node = p_pr.find(qn("w:keepNext"))
    if node is None:
        node = OxmlElement("w:keepNext")
        p_pr.append(node)
    node.set(qn("w:val"), "1" if keep else "0")


def set_cant_split(row):
    tr_pr = row._tr.get_or_add_trPr()
    node = OxmlElement("w:cantSplit")
    tr_pr.append(node)


def add_page_number(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = paragraph.add_run("CITY/SYNC  ·  ")
    run.font.name = "Calibri"
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor.from_string(MUTED)
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), "PAGE")
    paragraph._p.append(fld)


def add_hyperlink(paragraph, text, url, color=BLUE, underline=False):
    part = paragraph.part
    rid = part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), rid)
    new_run = OxmlElement("w:r")
    rpr = OxmlElement("w:rPr")
    c = OxmlElement("w:color")
    c.set(qn("w:val"), color)
    rpr.append(c)
    if underline:
        u = OxmlElement("w:u")
        u.set(qn("w:val"), "single")
        rpr.append(u)
    new_run.append(rpr)
    t = OxmlElement("w:t")
    t.text = text
    new_run.append(t)
    hyperlink.append(new_run)
    paragraph._p.append(hyperlink)


def add_internal_hyperlink(paragraph, text, anchor, *, color=TEXT, bold=False, size=8.5):
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("w:anchor"), anchor)
    hyperlink.set(qn("w:history"), "1")
    new_run = OxmlElement("w:r")
    rpr = OxmlElement("w:rPr")
    fonts = OxmlElement("w:rFonts")
    fonts.set(qn("w:ascii"), "Calibri")
    fonts.set(qn("w:hAnsi"), "Calibri")
    rpr.append(fonts)
    c = OxmlElement("w:color")
    c.set(qn("w:val"), color)
    rpr.append(c)
    sz = OxmlElement("w:sz")
    sz.set(qn("w:val"), str(round(size * 2)))
    rpr.append(sz)
    if bold:
        rpr.append(OxmlElement("w:b"))
    new_run.append(rpr)
    t = OxmlElement("w:t")
    t.text = text
    new_run.append(t)
    hyperlink.append(new_run)
    paragraph._p.append(hyperlink)


def add_bookmark(paragraph, name, bookmark_id):
    start = OxmlElement("w:bookmarkStart")
    start.set(qn("w:id"), str(bookmark_id))
    start.set(qn("w:name"), name)
    end = OxmlElement("w:bookmarkEnd")
    end.set(qn("w:id"), str(bookmark_id))
    insert_at = 1 if paragraph._p.pPr is not None else 0
    paragraph._p.insert(insert_at, start)
    paragraph._p.append(end)


def add_inline(paragraph, text, base_bold=False, base_italic=False, color=None):
    # Markdown links are retained as clickable text.
    pattern = re.compile(r"(\*\*.*?\*\*|\*.*?\*|`.*?`|\[[^\]]+\]\([^)]+\)|https?://\S+)")
    for token in filter(None, pattern.split(text)):
        link = re.fullmatch(r"\[([^\]]+)\]\(([^)]+)\)", token)
        if link:
            add_hyperlink(paragraph, link.group(1), link.group(2), underline=False)
            continue
        if token.startswith("http://") or token.startswith("https://"):
            clean = token.rstrip(".,;)")
            suffix = token[len(clean):]
            add_hyperlink(paragraph, clean, clean, underline=False)
            if suffix:
                paragraph.add_run(suffix)
            continue
        is_bold = token.startswith("**") and token.endswith("**")
        is_italic = token.startswith("*") and token.endswith("*") and not is_bold
        is_code = token.startswith("`") and token.endswith("`")
        content = token[2:-2] if is_bold else token[1:-1] if (is_italic or is_code) else token
        run = paragraph.add_run(content)
        run.bold = base_bold or is_bold
        run.italic = base_italic or is_italic
        if is_code:
            run.font.name = "Menlo"
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor.from_string(BLUE_DARK)
        elif color:
            run.font.color.rgb = RGBColor.from_string(color)


def configure_styles(doc):
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor.from_string(TEXT)
    normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    normal.paragraph_format.space_after = Pt(7)
    normal.paragraph_format.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    normal.paragraph_format.line_spacing = 1.18
    normal.paragraph_format.widow_control = True

    for name, size, color, before, after in [
        ("Title", 30, NAVY, 0, 14),
        ("Subtitle", 16, BLUE, 0, 14),
        ("Heading 1", 18, BLUE, 18, 10),
        ("Heading 2", 14, BLUE_DARK, 14, 7),
        ("Heading 3", 11.5, BLUE, 9, 4),
    ]:
        style = styles[name]
        style.font.name = "Calibri"
        style.font.size = Pt(size)
        style.font.color.rgb = RGBColor.from_string(color)
        style.font.bold = True
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True
        style.paragraph_format.widow_control = True

    styles["Heading 1"].paragraph_format.page_break_before = False
    styles["Heading 2"].paragraph_format.page_break_before = False

    if "Figure Caption" not in styles:
        cap = styles.add_style("Figure Caption", WD_STYLE_TYPE.PARAGRAPH)
    else:
        cap = styles["Figure Caption"]
    cap.font.name = "Calibri"
    cap.font.size = Pt(8.5)
    cap.font.italic = True
    cap.font.color.rgb = RGBColor.from_string(MUTED)
    cap.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_before = Pt(3)
    cap.paragraph_format.space_after = Pt(10)
    cap.paragraph_format.keep_with_next = False

    if "Callout" not in styles:
        callout = styles.add_style("Callout", WD_STYLE_TYPE.PARAGRAPH)
    else:
        callout = styles["Callout"]
    callout.font.name = "Calibri"
    callout.font.size = Pt(11)
    callout.font.color.rgb = RGBColor.from_string(BLUE_DARK)
    callout.font.italic = True
    callout.paragraph_format.left_indent = Inches(0.35)
    callout.paragraph_format.right_indent = Inches(0.25)
    callout.paragraph_format.space_before = Pt(8)
    callout.paragraph_format.space_after = Pt(12)
    callout.paragraph_format.line_spacing = 1.15

    if "Reference" not in styles:
        ref = styles.add_style("Reference", WD_STYLE_TYPE.PARAGRAPH)
    else:
        ref = styles["Reference"]
    ref.font.name = "Calibri"
    ref.font.size = Pt(8.5)
    ref.font.color.rgb = RGBColor.from_string(TEXT)
    ref.paragraph_format.left_indent = Inches(0.18)
    ref.paragraph_format.first_line_indent = Inches(-0.18)
    ref.paragraph_format.space_after = Pt(5)
    ref.paragraph_format.line_spacing = 1.0


def configure_section(section, body=True):
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.82 if body else 0.65)
    section.bottom_margin = Inches(0.72 if body else 0.65)
    section.left_margin = Inches(0.88)
    section.right_margin = Inches(0.88)
    section.header_distance = Inches(0.34)
    section.footer_distance = Inches(0.34)


def add_header_footer(section):
    section.header.is_linked_to_previous = False
    hp = section.header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = hp.add_run("CITY/SYNC  /  WHITEPAPER")
    run.font.name = "Calibri"
    run.font.size = Pt(8)
    run.font.bold = True
    run.font.color.rgb = RGBColor.from_string(BLUE)
    ppr = hp._p.get_or_add_pPr()
    pbdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "8")
    bottom.set(qn("w:space"), "5")
    bottom.set(qn("w:color"), GOLD)
    pbdr.append(bottom)
    ppr.append(pbdr)
    section.footer.is_linked_to_previous = False
    add_page_number(section.footer.paragraphs[0])


def add_cover(doc):
    section = doc.sections[0]
    configure_section(section, body=False)
    # Brand mark as crisp SVG if supported by python-docx/LibreOffice.
    try:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.add_run().add_picture(str(BRAND / "citysync-wordmark-on-white.svg"), width=Inches(2.8))
    except Exception:
        p = doc.add_paragraph()
        r = p.add_run("CITY/SYNC")
        r.font.name = "Calibri"
        r.font.size = Pt(22)
        r.font.bold = True
        r.font.color.rgb = RGBColor.from_string(NAVY)
    doc.add_paragraph().paragraph_format.space_after = Pt(65)
    p = doc.add_paragraph(style="Title")
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    add_inline(p, "Distributed Institutional Infrastructure")
    p2 = doc.add_paragraph(style="Subtitle")
    p2.alignment = WD_ALIGN_PARAGRAPH.LEFT
    add_inline(p2, "for Civic Capacity, Verifiable Public Administration, and Local Public-Goods Economies")

    rule = doc.add_paragraph()
    ppr = rule._p.get_or_add_pPr()
    pbdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "24")
    bottom.set(qn("w:space"), "8")
    bottom.set(qn("w:color"), GOLD)
    pbdr.append(bottom)
    ppr.append(pbdr)

    doc.add_paragraph().paragraph_format.space_after = Pt(26)
    quote = doc.add_paragraph(style="Callout")
    quote.paragraph_format.left_indent = Inches(0)
    quote.paragraph_format.right_indent = Inches(0.9)
    quote.paragraph_format.space_after = Pt(92)
    add_inline(quote, "Public institutions become easier to trust when people can understand the rules, see who had authority, follow commitments across time, and verify the record without surrendering privacy or due process.")

    meta = doc.add_paragraph()
    meta.paragraph_format.space_before = Pt(24)
    r = meta.add_run("WHITEPAPER v1.0")
    r.bold = True
    r.font.size = Pt(10)
    r.font.color.rgb = RGBColor.from_string(BLUE)
    meta.add_run("\nAugust 2026\nCity/Sync").font.color.rgb = RGBColor.from_string(MUTED)
    doc.add_page_break()


def parse_table(lines, i):
    rows = []
    while i < len(lines) and lines[i].strip().startswith("|"):
        cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
        rows.append(cells)
        i += 1
    if len(rows) > 1 and all(re.fullmatch(r":?-{3,}:?", c.replace(" ", "")) for c in rows[1]):
        rows.pop(1)
    return rows, i


def add_table(doc, rows):
    if not rows:
        return
    table = doc.add_table(rows=len(rows), cols=len(rows[0]))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"
    table.autofit = False
    usable = Inches(6.74)
    widths = [usable / len(rows[0])] * len(rows[0])
    if len(rows[0]) == 2:
        widths = [Inches(2.05), Inches(4.69)]
    elif len(rows[0]) == 3:
        widths = [Inches(1.45), Inches(2.25), Inches(3.04)]
    for ri, row in enumerate(rows):
        set_cant_split(table.rows[ri])
        if ri == 0:
            set_repeat_table_header(table.rows[ri])
        for ci, text in enumerate(row):
            cell = table.cell(ri, ci)
            cell.width = widths[ci]
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            set_cell_margins(cell)
            if ri == 0:
                set_cell_shading(cell, BLUE)
            elif ri % 2 == 0:
                set_cell_shading(cell, PALE)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_after = Pt(1.5)
            p.paragraph_format.line_spacing = 1.0
            add_inline(p, text, base_bold=(ri == 0), color=(WHITE if ri == 0 else None))
            for run in p.runs:
                run.font.size = Pt(8.4 if len(rows[0]) >= 3 else 8.8)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def add_picture(doc, relative_path):
    path = ROOT / relative_path
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.space_before = Pt(5)
    p.paragraph_format.space_after = Pt(2)
    shape = p.add_run().add_picture(str(path), width=Inches(6.65))
    alt_text = {
        "architecture-overview.png": "Architecture diagram showing organization-local operations, a city coordination domain, public proof anchoring, and a shared federation layer.",
        "theory-of-change.png": "Theory-of-change diagram linking institutional continuity to lower uncertainty, confident participation, institutional learning, and greater civic capacity.",
    }.get(path.name, f"City/Sync whitepaper figure: {path.stem.replace('-', ' ')}")
    shape._inline.docPr.set("title", path.stem.replace("-", " ").title())
    shape._inline.docPr.set("descr", alt_text)


def build():
    ASSETS.mkdir(exist_ok=True)
    create_architecture_diagram(ASSETS / "architecture-overview.png")
    create_theory_diagram(ASSETS / "theory-of-change.png")

    text = SOURCE.read_text(encoding="utf-8")
    lines = text.splitlines()
    # Remove source cover content; the DOCX gets an editorial cover.
    start = lines.index("## Abstract")
    lines = lines[start:]

    toc_entries = []
    heading_anchors = {}
    for raw in lines:
        match = re.match(r"^(#{1,2})\s+(.*)$", raw.strip())
        if not match:
            continue
        level = len(match.group(1))
        heading = match.group(2)
        anchor = f"citysync_heading_{len(toc_entries) + 1:03d}"
        toc_entries.append((level, heading, anchor))
        heading_anchors[heading] = anchor

    doc = Document()
    configure_styles(doc)
    add_cover(doc)

    body_section = doc.add_section(WD_SECTION.NEW_PAGE)
    configure_section(body_section, body=True)
    add_header_footer(body_section)

    # Static, clickable navigation page. This renders consistently across Word,
    # LibreOffice, and browser previews without requiring a field update.
    p = doc.add_paragraph("Contents", style="Heading 1")
    p.paragraph_format.page_break_before = False
    note = doc.add_paragraph()
    note.alignment = WD_ALIGN_PARAGRAPH.LEFT
    note.paragraph_format.space_after = Pt(6)
    add_inline(note, "A navigable outline of the argument, system design, and implementation path. Select an entry to move directly to that section.", base_italic=True, color=MUTED)
    for level, heading, anchor in toc_entries:
        entry = doc.add_paragraph()
        entry.alignment = WD_ALIGN_PARAGRAPH.LEFT
        entry.paragraph_format.left_indent = Inches(0 if level == 1 else 0.22)
        entry.paragraph_format.space_before = Pt(2.5 if level == 1 else 0)
        entry.paragraph_format.space_after = Pt(0.5)
        entry.paragraph_format.line_spacing = 1.0
        add_internal_hyperlink(
            entry,
            heading,
            anchor,
            color=BLUE if level == 1 else TEXT,
            bold=(level == 1),
            size=8.3 if level == 1 else 8.0,
        )
    doc.add_page_break()

    i = 0
    in_refs = False
    skip_rule = False
    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()
        stripped = line.strip()
        if not stripped or stripped == "---":
            i += 1
            continue
        if stripped.startswith("!["):
            m = re.match(r"!\[[^\]]*\]\(([^)]+)\)", stripped)
            if m:
                add_picture(doc, m.group(1))
            i += 1
            continue
        if stripped.startswith("|"):
            rows, i = parse_table(lines, i)
            add_table(doc, rows)
            continue
        if stripped.startswith(">"):
            parts = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                parts.append(lines[i].strip().lstrip(">").strip())
                i += 1
            p = doc.add_paragraph(style="Callout")
            add_inline(p, " ".join(parts))
            continue

        hm = re.match(r"^(#{1,3})\s+(.*)$", stripped)
        if hm:
            level = len(hm.group(1))
            heading = hm.group(2)
            if heading == "References":
                in_refs = True
            style = {1: "Heading 1", 2: "Heading 2", 3: "Heading 3"}[level]
            p = doc.add_paragraph(style=style)
            # Parts and appendices are the top hierarchy; ordinary source H2s are H1 in Word.
            if level == 1:
                p.style = doc.styles["Heading 1"]
            elif level == 2 and not heading.startswith("Distributed"):
                p.style = doc.styles["Heading 2"]
            p.paragraph_format.page_break_before = heading in {
                "Part I — The Institutional Case",
                "Part III — Technical Architecture",
                "Appendix A — City/Sync Institutional Decision Test",
                "References",
            }
            if heading in {"Abstract", "Executive Summary", "Reading This Whitepaper"}:
                p.paragraph_format.page_break_before = False
            add_inline(p, heading)
            if heading in heading_anchors:
                add_bookmark(p, heading_anchors[heading], len(heading_anchors) + i + 1)
            i += 1
            continue

        lm = re.match(r"^([-*]|\d+\.)\s+(.*)$", stripped)
        if lm:
            marker, body = lm.groups()
            is_bullet = marker in {"-", "*"}
            p = doc.add_paragraph(style="List Bullet" if is_bullet else "Normal")
            p.paragraph_format.left_indent = Inches(0.36)
            p.paragraph_format.first_line_indent = Inches(-0.18)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.08
            add_inline(p, body if is_bullet else f"{marker} {body}")
            i += 1
            continue

        # Paragraphs may span source lines until a blank/structural line.
        parts = [stripped]
        i += 1
        while i < len(lines):
            nxt = lines[i].strip()
            if not nxt or nxt == "---" or nxt.startswith(("#", "|", ">", "![")) or re.match(r"^([-*]|\d+\.)\s+", nxt):
                break
            parts.append(nxt)
            i += 1
        body = " ".join(parts)
        is_caption = body.startswith("**Figure ")
        style = "Figure Caption" if is_caption else "Reference" if in_refs and re.match(r"^\[\d+\]", body) else "Normal"
        p = doc.add_paragraph(style=style)
        if body.startswith("`") and body.endswith("`"):
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.left_indent = Inches(0.25)
            p.paragraph_format.right_indent = Inches(0.25)
        add_inline(p, body)

    # Document properties and update fields on open.
    props = doc.core_properties
    props.title = "City/Sync — Distributed Institutional Infrastructure"
    props.subject = "Whitepaper on civic capacity, verifiable public administration, and local public-goods economies"
    props.author = "City/Sync"
    props.keywords = "City/Sync, public administration, volunteer management, distributed ledger, civic capacity"
    settings = doc.settings._element
    update_fields = OxmlElement("w:updateFields")
    update_fields.set(qn("w:val"), "true")
    settings.append(update_fields)

    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build()

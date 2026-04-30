# officecli Reference

This file is a reference for the `officecli` CLI tool available at `bin/officecli`. The agent should read this file instead of running `./bin/officecli --help` repeatedly.

## General Usage

```
officecli [command] [options] [--json] [--help]
```

**Global options:**
- `--json` — Output as JSON (AI-friendly)
- `-?, -h, --help` — Show help and usage information
- `--version` — Show version information

## Top-Level Commands

| Command | Description |
|---------|-------------|
| `open <file>` | Start a resident process to keep the document in memory for faster subsequent commands |
| `close <file>` | Stop the resident process for the document |
| `watch <file>` | Start a live preview server that refreshes when officecli modifies the document |
| `unwatch <file>` | Stop the watch preview server for the document |
| `view <file> <mode>` | View document in different modes |
| `get <file> <path>` | Get a document node by path [default: /] |
| `query <file> <selector>` | Query document elements with CSS-like selectors |
| `set <file> <path>` | Modify a document node's properties |
| `add <file> <parent>` | Add a new element to the document |
| `remove <file> <path>` | Remove an element from the document |
| `move <file> <path>` | Move an element to a new position or parent |
| `swap <file> <path1> <path2>` | Swap two elements in the document |
| `raw <file> <part>` | View raw XML of a document part [default: /document] |
| `raw-set <file> <part>` | Modify raw XML in a document part (universal fallback) |
| `add-part <file> <parent>` | Create a new document part and return its relationship ID |
| `validate <file>` | Validate document against OpenXML schema |
| `batch <file>` | Execute multiple commands from a JSON array (one open/save cycle) |
| `import <file> <parent-path> <source-file>` | Import CSV/TSV data into an Excel sheet |
| `create, new <file>` | Create a blank Office document |
| `merge <template> <output>` | Merge template with JSON data, replacing {{key}} placeholders |

---

## xlsx Elements Reference

The following are all elements available for the xlsx format, grouped by the operations they support.

### workbook
- **Path:** `/`
- **Operations:** `set`, `get`, `query`
- **Properties (get):** `defaultFont`, `defaultFontSize`, `author`, `title`, `subject`
- **Children:** `sheet` (1..n) — `/SheetName`
- **Note:** Root container. Get returns sheet list and workbook-level metadata.

### sheet
- **Paths:** `/SheetName`
- **Operations:** `add`, `set`, `get`, `query`, `remove`
- **Properties:**
  - `name` (string) — Sheet tab name. `[add/set/get]`
  - `autoFilter` (string) — Range to apply AutoFilter on (e.g. A1:D10). `[add/set/get]`
  - `tabColor` (color) — Sheet tab color. `[add/set/get]`
  - `hidden` (bool) — Hide the sheet. `[add/set/get]`
  - `freeze` (string) — Freeze panes anchor (cell ref). `[set/get]`
  - `rightToLeft` (bool) — RTL sheet layout. `[set/get]`
- **Children:** `cell` (0..n), `chart` (0..n)

### cell
- **Parent:** sheet
- **Paths:** `/SheetName/A1` (single cell), `/SheetName/B2:C3` (range)
- **Operations:** `add`, `set`, `get`, `query`, `remove`
- **Properties:**
  - `value` (string) — Literal cell value (string, number, date). `[add/set/get]`
  - `formula` (string) — Cell formula, without leading `=`. `[add/set/get]`
  - `numberformat` (string) — Excel number format string. `[add/set/get]`
  - `font.bold`, `bold` (bool) — Bold text. `[add/set/get]`
  - `font.italic`, `italic` (bool) — Italic text. `[add/set/get]`
  - `font.name`, `font`, `fontname` (string) — Font name. `[add/set/get]`
  - `font.size`, `size`, `fontsize` (font-size) — Font size. `[add/set/get]`
  - `font.color`, `color` (color) — Font color. `[add/set/get]`
  - `fill` (color) — Cell background fill color. `[add/set/get]`
  - `strike`, `strikethrough`, `font.strike` (bool) — Strikethrough. `[add/set/get]`
  - `underline`, `font.underline` (enum) — Underline style. Values: single, double, singleAccounting, doubleAccounting, none. `[add/set/get]`
  - `locked` (bool) — Cell protection lock. `[add/set/get]`
  - `alignment.horizontal`, `halign` (enum) — Values: left, center, right, justify, fill, distributed. `[add/set/get]`
  - `alignment.vertical`, `valign` (enum) — Values: top, center, bottom. `[add/set/get]`
  - `alignment.wrapText`, `wrap`, `wrapText` (bool) — Wrap text. `[add/set/get]`
  - `alignment.readingOrder`, `direction`, `dir` (enum) — Values: context, ltr, rtl. `[add/set/get]`
  - `merge` (string) — Merge range (e.g. A1:C3) or `false` to unmerge. `[add/set]`
  - `ref`, `address` (string) — Target A1 cell reference (for `add`). `[add]`
  - `link` (string) — Hyperlink target (URL or internal anchor). `[add/set/get]`
  - `tooltip`, `screenTip`, `screentip` (string) — ScreenTip text for hyperlink hover. `[add/set]`
  - `type` (enum) — Force cell type. Values: string, number, boolean, date, richtext, shared, inline. `[add/set/get]`
  - `runs` (string) — Rich-text runs as JSON array. `[add]`
  - `clear` (bool) — Clear cell value/formula before applying new content. `[add/set]`
  - `arrayformula` (string) — Dynamic-array formula spilled into ref range. `[add/set]`

### range
- **Parent:** sheet
- **Paths:** `/SheetName/A1:C10`
- **Operations:** `set`, `get`, `query` (read-only container, never created/removed)
- **Properties (get):** `merge` (bool)
- **Properties (set, broadcast to all cells in range):**
  - `font.bold` (bool) — Broadcast bold to every cell.
  - `fill` (color) — Broadcast fill color.
  - `numberformat` (string) — Broadcast number format code.
  - `alignment.horizontal`, `halign` (enum) — Values: left, center, right, justify, general, fill, centerContinuous.
  - `merge` (bool/string) — `true` to merge, `false` to unmerge (must match exact range), `sweep` to bulk-clear.
- **Children:** `cell` (1..n)

### row
- **Parent:** sheet
- **Paths:** `/SheetName/row[N]` (N is 1-based)
- **Operations:** `add`, `set`, `get`, `query`, `remove`
- **Properties:**
  - `cols` (int) — Number of empty cells to seed in the new row. `[add]`
  - `height` (length) — Row height in points. `[add/set/get]`
  - `hidden` (bool) — Hide row. `[add/set/get]`
  - `outline`, `outlinelevel`, `group` (int) — Outline/group level 0-7. `[set]`
  - `collapsed` (bool) — Collapse row group. `[set]`

### column
- **Parent:** sheet
- **Paths:** `/SheetName/col[X]` (X = column letter or 1-based index)
- **Operations:** `add`, `set`, `get`, `query`, `remove`
- **Properties:**
  - `name` (string) — Column letter to insert at (e.g. 'C'). `[add]`
  - `width` (length) — Column width in Excel character units. `[add/set/get]`
  - `hidden` (bool) — Hide column. `[add/set/get]`
  - `outline`, `outlinelevel`, `group` (int) — Outline/group level 0-7. `[set]`
  - `collapsed` (bool) — Collapse column group. `[set]`
  - `autofit` (bool) — Auto-fit width to cell content. `[set]`

### table
- **Parent:** sheet
- **Paths:** `/SheetName/table[N]`
- **Operations:** `add`, `set`, `get`, `query`, `remove`
- **Properties:**
  - `ref`, `range` (string) — Cell range reference (e.g. A1:C10). Required. `[add/set/get]`
  - `name` (string) — Table identifier (sanitized). Defaults to 'TableN'. `[add/set/get]`
  - `displayName` (string) — Excel UI display name. `[add/set/get]`
  - `style` (string) — Table style name. Defaults to TableStyleMedium2. `[add/set/get]`
  - `headerRow`, `showHeader` (bool) — Show header row. `[add/set/get]`
  - `totalRow`, `showTotals` (bool) — Show total row. `[add/set/get]`
  - `autoExpand` (bool) — Auto-expand range downward at Add time. `[add]`
  - `showFirstColumn`, `firstColumn` (bool) — Highlight first column. `[add/set/get]`
  - `showLastColumn`, `lastColumn` (bool) — Highlight last column. `[add/set/get]`
  - `showRowStripes`, `showBandedRows`, `bandedRows`, `bandRows` (bool) — Alternate-row banding. `[add/set/get]`
  - `showColumnStripes`, `showBandedColumns`, `bandedColumns`, `bandedCols`, `showColStripes`, `bandCols` (bool) — Alternate-column banding. `[add/set/get]`
  - `columns` (string) — Comma-separated column header names. `[add]`
  - `totalsRowFunction` (string) — Comma-separated per-column totals functions (none|sum|average|count|countNums|max|min|stdDev|var|custom). `[add]`

### namedrange (definedname)
- **Parent:** workbook, sheet
- **Paths:** `/namedrange[@name=NAME]`
- **Operations:** `add`, `set`, `get`, `query`, `remove`
- **Properties:**
  - `name` (string) — Defined-name identifier. Required. `[add/set/get]`
  - `ref`, `refersTo`, `formula` (string) — RefersTo expression (without leading `=`). `[add/set/get]`
  - `scope` (string) — Sheet name for local scope, or 'workbook' (default). `[add/get]`
  - `comment` (string) — Free-text description. `[add/set/get]`
  - `volatile` (boolean) — Force recalculation on every workbook change. `[add/set/get]`

### Other xlsx elements (available for add/set/get/query/remove):
- `autofilter` — AutoFilter on a sheet
- `chart` — Charts in a sheet
- `chart-axis` — Chart axes
- `chart-series` — Chart data series
- `colbreak` — Column page breaks
- `comment` — Cell comments
- `conditionalformatting` — Conditional formatting rules
- `hyperlink` — Hyperlinks within cells
- `ole` — OLE objects
- `pagebreak` — Page breaks (row/column)
- `picture` — Images
- `pivottable` — Pivot tables
- `run` — Rich text runs within a cell
- `rowbreak` — Row page breaks
- `shape` — Shapes
- `slicer` — Slicers
- `sparkline` — Sparklines
- `sort` — Sort on a range
- `validation` — Data validation rules

---

## Format: docx (Word)

Elements: `body`, `paragraph`, `run`, `text`, `table`, `tablerow`, `tablecell`, `image`, `shape`, `smartart`, `chart`, `ole`, `header`, `footer`, `footnote`, `endnote`, `comment`, `bookmark`, `hyperlink`, `list`, `section`

## Format: pptx (PowerPoint)

Elements: `slide`, `shape`, `text`, `image`, `table`, `chart`, `smartart`, `ole`, `hyperlink`, `comment`, `slideLayout`, `slideMaster`, `notesSlide`

---

## Common Examples

### Creating a budget spreadsheet
```
# Create new file
./bin/officecli new budget.xlsx

# Rename default sheet
./bin/officecli set budget.xlsx /Sheet1 --prop name=Budget

# Add headers
./bin/officecli add budget.xlsx /Budget --type cell --prop ref=A1 --prop value=Category --prop bold=true
./bin/officecli add budget.xlsx /Budget --type cell --prop ref=B1 --prop value=Budgeted --prop bold=true
./bin/officecli add budget.xlsx /Budget --type cell --prop ref=C1 --prop value=Actual --prop bold=true
./bin/officecli add budget.xlsx /Budget --type cell --prop ref=D1 --prop value=Difference --prop bold=true

# Add data and formula
./bin/officecli set budget.xlsx /Budget/A2 --prop value=Food
./bin/officecli set budget.xlsx /Budget/B2 --prop value=500
./bin/officecli set budget.xlsx /Budget/C2 --prop value=475
./bin/officecli set budget.xlsx /Budget/D2 --prop formula="C2-B2"

# Format as currency
./bin/officecli set budget.xlsx /Budget/B2:D2 --prop numberformat='$#,##0.00'
```

### Reading data from a spreadsheet
```
# Get everything
./bin/officecli get data.xlsx / --json

# Get just sheet names
./bin/officecli get data.xlsx /

# Get a specific sheet
./bin/officecli get data.xlsx /Sheet1

# Search all cells in a sheet
./bin/officecli query data.xlsx cell

# Read a specific range
./bin/officecli get data.xlsx /Sheet1/A1:D20
```

### Batch operations (faster for multiple changes)
```
./bin/officecli batch file.xlsx <<'EOF'
[
  {"command": "set", "path": "/Sheet1/A1", "props": {"value": "Header"}},
  {"command": "set", "path": "/Sheet1/A1", "props": {"bold": true}},
  {"command": "add", "path": "/Sheet1", "props": {"type": "row", "cols": 3}}
]
EOF
```

### Import CSV data
```
./bin/officecli import file.xlsx /Sheet1/A1 data.csv
./bin/officecli import file.xlsx /Sheet1/A1 data.tsv
```

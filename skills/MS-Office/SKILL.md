# MS-Office Skill

You have access to `officecli`, a CLI tool for working with Microsoft Office documents (.docx, .xlsx, .pptx). The binary is located at `bin/officecli` in the project root.

## Quick Reference

For the full officecli command reference, see the `HELP.md` file in this same `skills/MS-Office/` directory.

## Common Workflows for .xlsx Files

### Reading cell contents

```bash
# Get the entire workbook structure (sheets and cells)
./bin/officecli get file.xlsx /

# Get a specific sheet's contents
./bin/officecli get file.xlsx /Sheet1

# Get a specific cell value
./bin/officecli get file.xlsx /Sheet1/A1

# Get a range of cells
./bin/officecli get file.xlsx /Sheet1/A1:C10

# Query all cells (flat list) — useful for finding data in large files
./bin/officecli query file.xlsx cell
```

### Modifying cells

```bash
# Set a cell value
./bin/officecli set file.xlsx /Sheet1/A1 --prop value="New Value"

# Set a number value
./bin/officecli set file.xlsx /Sheet1/B2 --prop value=42

# Add a new cell with a value (appends to the sheet or at specific cell)
./bin/officecli add file.xlsx /Sheet1 --type cell --prop value="Hello" --prop ref=A5

# Add a formula
./bin/officecli set file.xlsx /Sheet1/C3 --prop value="=SUM(A1:A10)"

# Add a formula via --prop (without leading =)
./bin/officecli set file.xlsx /Sheet1/C3 --prop formula="SUM(A1:A10)"

# Format a cell — bold, color, fill, font
./bin/officecli set file.xlsx /Sheet1/A1 --prop bold=true --prop fill=FFFF00
./bin/officecli set file.xlsx /Sheet1/A1 --prop color=FF0000 --prop italic=true

# Set number format
./bin/officecli set file.xlsx /Sheet1/B2 --prop numberformat="#,##0.00"
```

### Working with sheets

```bash
# List all sheets (get the root)
./bin/officecli get file.xlsx /

# Rename a sheet
./bin/officecli set file.xlsx /Sheet1 --prop name=Summary

# Add a new sheet
./bin/officecli add file.xlsx / --type sheet --prop name=NewSheet

# Remove a sheet
./bin/officecli remove file.xlsx /Sheet2
```

### Working with rows and columns

```bash
# Add a row with 5 empty cells
./bin/officecli add file.xlsx /Sheet1 --type row --prop cols=5

# Set row height
./bin/officecli set file.xlsx /Sheet1/row[2] --prop height=30

# Add a column
./bin/officecli add file.xlsx /Sheet1 --type column --prop width=25
```

### Batch operations

For multiple operations on the same file, use `batch` to avoid repeated open/save cycles:

```bash
echo '[
  {"command": "set", "path": "/Sheet1/A1", "props": {"value": "Name"}},
  {"command": "set", "path": "/Sheet1/B1", "props": {"value": "Qty"}},
  {"command": "set", "path": "/Sheet1/A2", "props": {"value": "Widget"}},
  {"command": "set", "path": "/Sheet1/B2", "props": {"value": 100}}
]' | ./bin/officecli batch file.xlsx /dev/stdin
```

### Data import from CSV/TSV

```bash
# Import CSV data into a sheet starting at a given cell
echo -e "Name,Qty,Price\nWidget,100,9.99\nGadget,50,24.99" > /tmp/data.csv
./bin/officecli import file.xlsx /Sheet1/A1 /tmp/data.csv
```

### Creating new documents

```bash
# Create a new blank xlsx file
./bin/officecli new file.xlsx
```

### Opening and closing documents (resident mode)

For faster operations when doing multiple sequential commands, open the file in resident mode:

```bash
./bin/officecli open file.xlsx
# ... perform multiple commands ...
./bin/officecli close file.xlsx
```

## Important Notes

- Always use `./bin/officecli` from the project root for a known context.
- Paths use forward-slashes: `/Sheet1/A1` not `Sheet1!A1`.
- Sheet names are case-sensitive.
- Cell references use A1 notation.
- For `--prop` values with spaces, use quotes: `--prop value="Hello World"`.
- Boolean props use `true`/`false` (lowercase).
- Use `--json` flag for machine-readable output (e.g., `./bin/officecli get file.xlsx / --json`).
- When in doubt about which properties exist for a given element, check the HELP.md reference file.

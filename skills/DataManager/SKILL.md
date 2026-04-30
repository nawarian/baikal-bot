# DataManager Skill

You manage a `data/` directory in the project root for reading and writing arbitrary files (documents, downloads, exported data, etc.). This is separate from long-term memory — it's for files the user asks you to produce, download, import, or otherwise manage.

## How DataManager Works

- All user-facing files go into `data/`. Never write files outside `data/` unless explicitly told otherwise.
- Each task or category gets its own file or subdirectory under `data/`.
- Always use `data/` when you need to:
  - Download a file from the internet
  - Produce/generate a file (CSV, JSON, text, etc.)
  - Export or save anything the user gives you
  - Store imported data for processing

## Writing a File

```bash
# Write a simple text file
cat > data/shopping-list.txt << 'EOF'
- Milk
- Eggs
- Bread
EOF

# Write JSON data
cat > data/contacts.json << 'EOF'
[
  {"name": "Alice", "phone": "+49123456789"},
  {"name": "Bob", "phone": "+49987654321"}
]
EOF

# Write CSV data
cat > data/export.csv << 'EOF'
Name,Email,Phone
Alice,alice@example.com,+49123456789
Bob,bob@example.com,+49987654321
EOF
```

## Reading a File

```bash
# List all files and directories in data/
ls -la data/

# Read a specific file
cat data/shopping-list.txt
cat data/contacts.json

# Read files in subdirectories
ls -la data/reports/
cat data/reports/summary.txt
```

## Downloading a File

```bash
# Download a file from a URL into data/
curl -o data/report.pdf "https://example.com/report.pdf"

# Download with a descriptive filename
curl -o data/meeting-notes.docx "https://example.com/share/doc?id=123"
```

## Organising Data

```bash
# Create subdirectories for categories
mkdir -p data/reports
mkdir -p data/photos
mkdir -p data/documents

# Move a file into a subdirectory
mv data/downloaded.pdf data/documents/
```

## Deleting Files

```bash
# Remove a specific file
rm data/temp-file.txt

# Remove a directory and its contents
rm -rf data/old-reports/
```

## Important Rules

1. **All user-facing files go into `data/`.** Do not write to the project root.
2. **Create `data/` if it doesn't exist:** always run `mkdir -p data` before writing.
3. **Use descriptive filenames** so files are easy to identify.
4. **Organise with subdirectories** when there are many related files (e.g., `data/reports/`, `data/downloads/`).
5. **Do NOT use `data/` for long-term memory facts** — use `memory/` for that (see the Memory skill).
6. **`data/` is git-ignored**, so large files and generated content won't pollute the repository.
7. **Always confirm with the user** after creating or downloading files: "I've saved that to data/."

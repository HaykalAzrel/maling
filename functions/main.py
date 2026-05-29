import os
import json
from pathlib import Path
from datetime import datetime

# =========================
# CONFIG
# =========================

PROJECT_ROOT = r"./"  # ganti dengan path project

IGNORE_FOLDERS = {
    ".git",
    "node_modules",
    "__pycache__",
    "venv",
    "env",
    ".next",
    "dist",
    "build"
}

OUTPUT_JSON = "project_scan.json"
OUTPUT_TXT = "project_structure.txt"

# =========================
# GLOBAL STATS
# =========================

stats = {
    "total_files": 0,
    "total_folders": 0,
    "total_size_mb": 0
}

# =========================
# GET FILE SIZE
# =========================

def get_file_size(path):
    try:
        return round(os.path.getsize(path) / (1024 * 1024), 4)
    except:
        return 0

# =========================
# SCAN PROJECT
# =========================

def scan_directory(path):
    result = {
        "name": os.path.basename(path),
        "type": "folder",
        "children": []
    }

    stats["total_folders"] += 1

    try:
        entries = os.listdir(path)

        for entry in sorted(entries):

            full_path = os.path.join(path, entry)

            # Skip ignored folders
            if entry in IGNORE_FOLDERS:
                continue

            # Folder
            if os.path.isdir(full_path):

                child = scan_directory(full_path)
                result["children"].append(child)

            # File
            else:
                file_size = get_file_size(full_path)

                stats["total_files"] += 1
                stats["total_size_mb"] += file_size

                file_data = {
                    "name": entry,
                    "type": "file",
                    "extension": Path(entry).suffix,
                    "size_mb": file_size,
                    "path": full_path
                }

                result["children"].append(file_data)

    except PermissionError:
        pass

    return result

# =========================
# GENERATE TREE TEXT
# =========================

def write_tree(node, file, indent=""):

    if node["type"] == "folder":
        file.write(f"{indent}📁 {node['name']}/\n")

        for child in node["children"]:
            write_tree(child, file, indent + "    ")

    else:
        file.write(
            f"{indent}📄 {node['name']} "
            f"({node['size_mb']} MB)\n"
        )

# =========================
# MAIN
# =========================

def main():

    print("=" * 60)
    print("PROJECT STRUCTURE SCANNER")
    print("=" * 60)

    project_data = scan_directory(PROJECT_ROOT)

    # Save JSON
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(project_data, f, indent=4)

    # Save TXT Tree
    with open(OUTPUT_TXT, "w", encoding="utf-8") as f:
        write_tree(project_data, f)

    print("\nSCAN COMPLETED")
    print("-" * 60)
    print(f"Total Files   : {stats['total_files']}")
    print(f"Total Folders : {stats['total_folders']}")
    print(f"Project Size  : {round(stats['total_size_mb'], 2)} MB")

    print("\nOUTPUT FILES")
    print("-" * 60)
    print(f"JSON : {OUTPUT_JSON}")
    print(f"TXT  : {OUTPUT_TXT}")

    print("\nDONE")

# =========================

if __name__ == "__main__":
    main()
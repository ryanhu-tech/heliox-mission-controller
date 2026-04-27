import pypdf
import json
import re
import os

# New file path
pdf_path = "/home/user/workspace/RyanWiki/raw/研究主堡/7_專案開發追蹤/進階潛水物理網頁化/US DIVING MANUAL_REV7-645-654.pdf"

deco_table = {}
current_depth = None

def parse_pdf():
    global current_depth
    reader = pypdf.PdfReader(pdf_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
        
    lines = text.split("\n")
    
    for line in lines:
        line = line.strip()
        
        if not line or "Decompression" in line or "Depth" in line or "BOTTOM MIX" in line:
            continue
            
        # Check if line is just a depth (e.g., "60" or "380" on a line by itself)
        if re.match(r'^\d+$', line) and int(line) % 10 == 0 and 60 <= int(line) <= 400:
            current_depth = int(line)
            if current_depth not in deco_table:
                deco_table[current_depth] = {}
            continue
            
        # Match: Time TTFS Stop1 Stop2 ...
        # E.g., "10 2:00 0 0" or "60 0:40 10 11 16 1"
        match = re.match(r'^(\d+)\s+(\d+:\d+)\s+([\d\s]+)$', line)
        if match and current_depth is not None:
            bottom_time = int(match.group(1))
            ttfs = match.group(2)
            stops = [int(x) for x in match.group(3).split()]
            deco_table[current_depth][bottom_time] = {"ttfs": ttfs, "stops": stops}
            continue
            
    out_path = "/home/user/workspace/heliox-calculator/src/data/deco_table.json"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(deco_table, f, indent=2)
    
    print(f"Extraction complete! Found {len(deco_table)} depths.")
    for d in sorted(deco_table.keys()):
        print(f"Depth {d}: {len(deco_table[d])} profiles.")

parse_pdf()

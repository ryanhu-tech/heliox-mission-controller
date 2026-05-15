import pypdf
import json
import re
import os

pdf_path = '/home/user/workspace/RyanWiki/raw/研究主堡/9._Diving/US DIVING MANUAL_REV7-494-516.pdf'
reader = pypdf.PdfReader(pdf_path)

with open('air_deco_text.txt', 'w', encoding='utf-8') as f:
    for i, page in enumerate(reader.pages):
        f.write(f"--- Page {i} ---\n")
        f.write(page.extract_text() + "\n")

print("Text extracted to air_deco_text.txt")

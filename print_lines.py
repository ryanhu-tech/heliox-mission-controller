import pdfplumber

pdf_path = "/home/user/workspace/RyanWiki/raw/研究主堡/7_專案開發追蹤/進階潛水物理網頁化/US DIVING MANUAL_REV7-645-651.pdf"

with pdfplumber.open(pdf_path) as pdf:
    text = pdf.pages[0].extract_text()
    for i, line in enumerate(text.split("\n")[:30]):
        print(repr(line))

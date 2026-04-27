import pdfplumber

pdf_path = "/home/user/workspace/RyanWiki/raw/研究主堡/7_專案開發追蹤/進階潛水物理網頁化/US DIVING MANUAL_REV7-645-651.pdf"

with pdfplumber.open(pdf_path) as pdf:
    first_page = pdf.pages[0]
    tables = first_page.extract_tables()
    for i, table in enumerate(tables):
        print(f"--- Table {i} ---")
        for row in table:
            cleaned_row = [str(cell)[::-1].replace('\n', ' ').strip() if cell else '' for cell in row]
            print(cleaned_row)

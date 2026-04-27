import pypdf

pdf_path = "/home/user/workspace/RyanWiki/raw/研究主堡/7_專案開發追蹤/進階潛水物理網頁化/US DIVING MANUAL_REV7-645-651.pdf"

reader = pypdf.PdfReader(pdf_path)
page = reader.pages[0]
print(page.extract_text()[:500])

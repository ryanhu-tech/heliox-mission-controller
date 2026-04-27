import pypdf
import json

pdf_path = "/home/user/workspace/RyanWiki/raw/研究主堡/7_專案開發追蹤/進階潛水物理網頁化/US DIVING MANUAL_REV7-615-644.pdf"

def extract_surd_info(path):
    reader = pypdf.PdfReader(path)
    content = ""
    # 讀取全文以尋找關鍵字
    for i in range(len(reader.pages)):
        content += reader.pages[i].extract_text() + "\n"
    
    # 尋找 SurD O2 關鍵詞
    keywords = ["Surface Decompression", "SurD O2", "40 fsw", "50 fsw", "surface interval", "recompression"]
    findings = []
    
    lines = content.split('\n')
    for idx, line in enumerate(lines):
        if any(key.lower() in line.lower() for key in keywords):
            # 抓取上下幾行
            context = "\n".join(lines[max(0, idx-2):min(len(lines), idx+5)])
            findings.append(context)
            
    return findings

findings = extract_surd_info(pdf_path)
with open("/home/user/workspace/heliox-calculator/surd_research.txt", "w") as f:
    for item in findings:
        f.write(item + "\n" + "-"*20 + "\n")

print(f"Extracted {len(findings)} relevant snippets.")

import json
import re
import os

text_file = "air_deco_text.txt"
out_file = "/home/user/workspace/heliox-calculator/src/data/air_deco_table.json"

deco_table = {}
current_depth = None

with open(text_file, "r", encoding="utf-8") as f:
    lines = f.read().splitlines()

depth_re = re.compile(r"^(\d+)\s+FSW$")
air_re = re.compile(r"^(\d+)\s+(\d+:\d+)\s+AIR\s+(.*?)$")
airo2_re = re.compile(r"^AIR/O2\s+(.*?)$")

pending_profile = None

def finalize_profile():
    global pending_profile
    if pending_profile and current_depth is not None:
        if current_depth not in deco_table:
            deco_table[current_depth] = {}
            
        deco_table[current_depth][pending_profile['bt']] = {
            "ttfs": pending_profile['ttfs'],
            "airStops": pending_profile.get('air_stops', [0]),
            "airo2Stops": pending_profile.get('airo2_stops', pending_profile.get('air_stops', [0])),
            "chamberO2": pending_profile.get('o2_periods', 0),
            "repetitiveGroup": pending_profile.get('repet', None)
        }
    pending_profile = None

for line in lines:
    line = line.strip()
    if not line: continue
    
    m_depth = depth_re.match(line)
    if m_depth:
        finalize_profile()
        current_depth = int(m_depth.group(1))
        continue
        
    m_air = air_re.match(line)
    if m_air:
        finalize_profile()
        bt = int(m_air.group(1))
        ttfs = m_air.group(2)
        rest = m_air.group(3).split()
        
        repet = None
        if rest[-1].isalpha():
            repet = rest[-1]
            rest = rest[:-1]
            
        o2_periods = 0
        if len(rest) >= 2:
            try:
                # If the last element is like "0.5" or "1", it's o2 periods
                if re.match(r'^\d+(\.\d+)?$', rest[-1]):
                    o2_periods = float(rest[-1])
                    rest = rest[:-1]
            except ValueError:
                pass
                
        # Total ascent is the last element now
        total_ascent = rest[-1]
        stops = [int(x) for x in rest[:-1]]
        
        pending_profile = {
            'bt': bt,
            'ttfs': ttfs,
            'repet': repet,
            'o2_periods': o2_periods,
            'air_stops': stops
        }
        continue
        
    m_airo2 = airo2_re.match(line)
    if m_airo2 and pending_profile is not None:
        rest = m_airo2.group(1).split()
        # Last element is total ascent for AIR/O2
        total_ascent = rest[-1]
        stops = [int(x) for x in rest[:-1]]
        pending_profile['airo2_stops'] = stops
        finalize_profile()
        continue

finalize_profile()

os.makedirs(os.path.dirname(out_file), exist_ok=True)
with open(out_file, "w", encoding="utf-8") as f:
    json.dump(deco_table, f, indent=2)

print(f"Extraction complete! Found {len(deco_table)} depths.")

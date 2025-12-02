import pandas as pd
import json
import requests
import os

# Get the absolute path of the directory where the script is located
script_dir = os.path.dirname(os.path.abspath(__file__))

# Construct absolute paths for the data files
star_data_path = os.path.join(script_dir, "star_data.csv")
star_name_data_path = os.path.join(script_dir, "star_name_data.json")
hd_cross_reference_path = os.path.join(script_dir, "star_name_cross_reference.csv")

## read our two files
stars_df = pd.read_csv(star_data_path)
star_names_df = pd.read_json(star_name_data_path)
hd_cross_reference_df = pd.read_csv(hd_cross_reference_path)

####################################################################
############# FEATURE ENGINEER DISPLAY NAME COL ####################
####################################################################
## look at HD number for each star in stars_df
## 1) see if hd number exists in star_names_df
##     - if it does display name = name in star_names_df
## 2) see if hd number exists in hd_cross_reference_df
##     - Get 'bayer' and 'Cst'
##     - Reformat all 'bayer' values to their full name
##     - Reformat all 'Cst' values to their full name
##     - Display Name = reformatted('bayer') + reformated('Cst')
## 3) Check if hd_cross_reference_df has a 'Fl'
##     - If it does, display name = Fl + reformatted('Cst')
## 4) Check if last value of DM designation is a Letter
##     - If it is, add it to the end
## 5) just use HD number
## 6) say star does not exist

# Mapping for Bayer designations to full names
bayer_mapping = {
    "alf": "α", "bet": "β", "gam": "γ", "del": "δ", "eps": "ε", "zet": "ζ", "eta": "η", "the": "θ",
    "iot": "ι", "kap": "κ", "lam": "λ", "mu.": "μ", "nu.": "ν", "ksi": "ξ", "omi": "ο", "pi.": "π",
    "rho": "ρ", "sig": "σ", "tau": "τ", "ups": "υ", "phi": "φ", "chi": "χ", "psi": "ψ", "ome": "ω",
    "A02": "A", "B02": "B", "C02": "C", "D02": "D", "E02": "E", "F02": "F", "G02": "G", "H02": "H",
    "I02": "I", "J02": "J", "K02": "K", "L02": "L", "M02": "M", "N02": "N", "O02": "O", "P02": "P",
    "Q02": "Q", "R02": "R", "S02": "S", "T02": "T", "U02": "U", "V02": "V", "W02": "W", "X02": "X",
    "Y02": "Y", "Z02": "Z",
    "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "t": "t", "f": "f", "g": "g", "s": "s", 
    "e": "e", "rho01": "ρ¹", "ksi02": "ξ²"
}

# Constellation abbreviation to full name mapping
constellation_mapping = {
    "Eri": "Eridanus", "Cet": "Cetus", "Tau": "Taurus", "Per": "Perseus", "Aur": "Auriga",
    "Cam": "Camelopardalis", "And": "Andromeda", "Tri": "Triangulum", "Ari": "Aries", "Psc": "Piscis",
    "UMa": "Ursa Major", "UMi": "Ursa Minor", "Dra": "Draco", "Cep": "Cepheus", "Cas": "Cassiopeia",
    "Lyn": "Lynx", "Gem": "Gemini", "Cnc": "Cancer", "Leo": "Leo", "UMa": "Ursa Major", "CVn": "Canes Venatici",
    "Com": "Coma Berenices", "Boo": "Boötes", "Cen": "Centaurus", "Lup": "Lupus", "Vir": "Virgo",
    "Lib": "Libra", "Sco": "Scorpius", "Oph": "Ophiuchus", "Sgr": "Sagittarius", "Sct": "Scutum",
    "Aql": "Aquila", "Lyr": "Lyra", "Cyg": "Cygnus", "Peg": "Pegasus", "Cap": "Capella", "Aur": "Auriga"
}

def get_display_name(hd):
    """
    Feature engineer the display_name for a star based on its HD number.
    Follows the priority order specified in the comments above.
    """
    # Convert HD to string for comparison
    hd_str = str(int(hd)) if pd.notna(hd) else None
    
    if hd_str is None:
        return "Star does not exist"
    
    # 1) Check if HD exists in star_names_df
    matching_name = star_names_df[star_names_df['HD'] == hd_str]
    if not matching_name.empty:
        name = matching_name.iloc[0].get('Name/ASCII', '')
        if pd.notna(name) and name.strip():
            return name
    
    # 2) Check if HD exists in hd_cross_reference_df
    matching_hd = hd_cross_reference_df[hd_cross_reference_df['HD'] == int(hd_str)]
    if not matching_hd.empty:
        row = matching_hd.iloc[0]
        bayer = row['Bayer'] if 'Bayer' in row.index else ''
        cst = row['Cst'] if 'Cst' in row.index else ''
        fl = row['Fl'] if 'Fl' in row.index else ''
        dm = row['DM'] if 'DM' in row.index else ''
        
        # 2) Try Bayer + Constellation
        if pd.notna(bayer) and str(bayer).strip() and pd.notna(cst) and str(cst).strip():
            bayer_reform = bayer_mapping.get(str(bayer).strip().lower(), str(bayer).strip())
            cst_reform = constellation_mapping.get(str(cst).strip(), str(cst).strip())
            return f"{bayer_reform} {cst_reform}"
        
        # 3) Try Fl + Constellation
        if pd.notna(fl) and str(fl).strip() and fl != '':
            cst_reform = constellation_mapping.get(str(cst).strip(), str(cst).strip()) if pd.notna(cst) else ''
            return f"{fl} {cst_reform}".strip()
        
        # 4) Check if DM designation ends with a letter
        if pd.notna(dm) and str(dm).strip():
            dm_str = str(dm).strip()
            if dm_str and dm_str[-1].isalpha():
                cst_reform = constellation_mapping.get(str(cst).strip(), str(cst).strip()) if pd.notna(cst) else ''
                return f"{cst_reform} {dm_str[-1]}".strip()
    
    # 5) Just use HD number
    return f"HD {hd_str}"

# Apply the display_name feature engineering
stars_df['display_name'] = stars_df['HD'].apply(get_display_name)

# Save the updated DataFrame back to the CSV file
stars_df.to_csv(star_data_path, index=False)


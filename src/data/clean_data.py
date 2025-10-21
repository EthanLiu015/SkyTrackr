import pandas as pd
import json
import os

# Get the absolute path of the directory where the script is located
script_dir = os.path.dirname(os.path.abspath(__file__))

# Construct absolute paths for the data files
star_data_path = os.path.join(script_dir, "star_data.csv")
star_name_data_path = os.path.join(script_dir, "star_name_data.json")
hd_cross_reference = os.path.join(script_dir, "star_name_cross_reference.csv")

## read our two files
stars_df = pd.read_csv(star_data_path)
star_names_df = pd.read_json(star_name_data_path)
hd_cross_reference_df = pd.read_csv(hd_cross_reference)
print(star_names_df)

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
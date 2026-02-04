import csv
import logging
import os
from contextlib import asynccontextmanager
from typing import List, Dict, Union

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api")

# Global storage for stars
stars_db = []

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager to handle startup and shutdown events.
    Loads CSV data into memory when the app starts.
    """
    global stars_db
    
    # Locate the CSV file in the 'src/data' folder
    current_dir = os.path.dirname(os.path.abspath(__file__))
    csv_file = os.path.join(current_dir, "..", "src", "data", "star_data.csv")
    
    if os.path.exists(csv_file):
        try:
            with open(csv_file, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                # Clean headers just in case
                reader.fieldnames = [name.strip() for name in reader.fieldnames]
                
                def safe_float(v):
                    try:
                        return float(v)
                    except (ValueError, TypeError):
                        return None

                def safe_int(v):
                    try:
                        return int(v)
                    except (ValueError, TypeError):
                        return None

                for row in reader:
                    try:
                        star = {
                            "HR": safe_int(row.get("HR")),
                            "Name": row.get("Name", "").strip(),
                            "HD": safe_int(row.get("HD")),
                            "ADS": row.get("ADS", "").strip(),
                            "VarID": row.get("VarID", "").strip(),
                            "RAJ2000": safe_float(row.get("RAJ2000")),
                            "DEJ2000": safe_float(row.get("DEJ2000")),
                            "Vmag": safe_float(row.get("Vmag")),
                            "B-V": safe_float(row.get("B-V")),
                            "SpType": row.get("SpType", "").strip(),
                            "NoteFlag": row.get("NoteFlag", "").strip(),
                            "Parallax": safe_float(row.get("Parallax")),
                            "n_Parallax": row.get("n_Parallax", "").strip(),
                            "display_name": row.get("display_name", "").strip()
                        }
                        
                        # Ensure essential coordinates exist
                        if star["RAJ2000"] is not None and star["DEJ2000"] is not None and star["Vmag"] is not None:
                            stars_db.append(star)
                    except Exception:
                        continue
                        
            logger.info(f"Successfully loaded {len(stars_db)} stars into memory from {csv_file}.")
        except Exception as e:
            logger.error(f"Error loading CSV data: {e}")
    else:
        logger.warning(f"CSV file not found at: {csv_file}")
    
    yield
    stars_db.clear()

app = FastAPI(title="SkyTrackr API", lifespan=lifespan)

# Enable CORS to allow requests from your React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/stars")
async def get_stars():
    """Returns the list of loaded stars."""
    return stars_db

if __name__ == "__main__":
    # Run the app with uvicorn when executed directly
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
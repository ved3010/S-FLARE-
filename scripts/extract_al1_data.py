"""
extract_al1_data.py — Extract and organize downloaded Aditya-L1 PRADAN zip files.

Run:  python scripts/extract_al1_data.py
After download, run this once to unpack all zipped data into data/raw/.
"""

import os
import zipfile
import gzip
import shutil
import glob
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"
SOLEXS_OUT = RAW_DIR / "solexs"
HELIOS_OUT = RAW_DIR / "helios"


def extract_solexs():
    """Extract SoLEXS daily zip files — flatten into organized per-day directories."""
    print("=== Extracting SoLEXS Data ===")
    os.makedirs(SOLEXS_OUT, exist_ok=True)

    # Outer zip files (what the user downloaded from PRADAN)
    outer_zips = sorted(glob.glob(str(RAW_DIR / "solexs" / "solexs_*.zip")))

    if not outer_zips:
        print("No SoLEXS outer zip files found. Skipping.")
        return

    for outer_zip in outer_zips:
        print(f"  Processing: {os.path.basename(outer_zip)}")
        try:
            with zipfile.ZipFile(outer_zip, 'r') as oz:
                # Each outer zip contains daily zip files like AL1_SLX_L1_YYYYMMDD_v1.0.zip
                for inner_name in oz.namelist():
                    if not inner_name.endswith('.zip'):
                        continue
                    # Extract date from filename: AL1_SLX_L1_YYYYMMDD_v1.0.zip
                    parts = inner_name.split('_')
                    if len(parts) >= 5:
                        date_str = parts[3]  # YYYYMMDD
                    else:
                        continue

                    date_dir = SOLEXS_OUT / date_str
                    if date_dir.exists():
                        continue  # Already extracted

                    os.makedirs(date_dir, exist_ok=True)

                    # Extract inner zip to temp
                    data = oz.read(inner_name)
                    temp_zip = date_dir / inner_name
                    with open(temp_zip, 'wb') as f:
                        f.write(data)

                    # Extract inner zip
                    with zipfile.ZipFile(temp_zip, 'r') as iz:
                        iz.extractall(date_dir)

                    # Remove temp zip
                    os.remove(temp_zip)
                    print(f"    Extracted: {date_str} -> {date_dir}")

                    # Decompress gzipped FITS files for easier reading
                    for gz_file in glob.glob(str(date_dir / "**" / "*.gz"), recursive=True):
                        fits_file = gz_file[:-3]  # Remove .gz
                        if os.path.exists(fits_file):
                            continue
                        try:
                            with gzip.open(gz_file, 'rb') as fin:
                                with open(fits_file, 'wb') as fout:
                                    shutil.copyfileobj(fin, fout)
                            os.remove(gz_file)
                            print(f"      Decompressed: {os.path.basename(gz_file)}")
                        except Exception as e:
                            print(f"      Decompress error {gz_file}: {e}")

        except Exception as e:
            print(f"    Error processing {outer_zip}: {e}")

    print(f"  Done. SoLEXS data in: {SOLEXS_OUT}")


def extract_helios():
    """Extract HEL1OS zip files — flatten into organized per-day directories."""
    print("\n=== Extracting HEL1OS Data ===")
    os.makedirs(HELIOS_OUT, exist_ok=True)

    outer_zips = sorted(glob.glob(str(RAW_DIR / "helios" / "hel1os_*.zip")))

    if not outer_zips:
        print("No HEL1OS outer zip files found. Skipping.")
        return

    for outer_zip in outer_zips:
        print(f"  Processing: {os.path.basename(outer_zip)}")
        try:
            with zipfile.ZipFile(outer_zip, 'r') as oz:
                for inner_name in oz.namelist():
                    if not inner_name.endswith('.zip') or not inner_name.startswith('HLS_'):
                        continue

                    # Extract date from: HLS_YYYYMMDD_HHMMSS_XXXXXsec_lev1_V111.zip
                    parts = inner_name.split('_')
                    if len(parts) >= 2:
                        date_str = parts[1]  # YYYYMMDD
                    else:
                        continue

                    date_dir = HELIOS_OUT / date_str
                    if date_dir.exists():
                        continue

                    os.makedirs(date_dir, exist_ok=True)

                    # Extract inner zip
                    data = oz.read(inner_name)
                    temp_zip = date_dir / inner_name
                    with open(temp_zip, 'wb') as f:
                        f.write(data)

                    with zipfile.ZipFile(temp_zip, 'r') as iz:
                        # Extract only science files, flatten into date dir
                        for member in iz.namelist():
                            # Simplify: extract everything
                            iz.extract(member, date_dir)

                    os.remove(temp_zip)
                    print(f"    Extracted: {date_str} -> {date_dir}")

        except Exception as e:
            print(f"    Error processing {outer_zip}: {e}")

    print(f"  Done. HEL1OS data in: {HELIOS_OUT}")


def main():
    print("=" * 60)
    print("Aditya-L1 PRADAN Data Extraction")
    print("=" * 60)

    extract_solexs()
    extract_helios()

    print("\n" + "=" * 60)
    print("Extraction complete!")
    print(f"  SoLEXS: {SOLEXS_OUT}/  (per-day subdirectories)")
    print(f"  HEL1OS: {HELIOS_OUT}/  (per-day subdirectories)")
    print("=" * 60)


if __name__ == "__main__":
    main()

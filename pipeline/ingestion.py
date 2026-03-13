import os
import json
import math
import gzip
import glob
import struct
from datetime import datetime


# ==========================================
# Pure-Python FITS Reader (No Astropy Needed)
# ==========================================

def read_fits_header_data(f):
    """
    Read a FITS binary table header and return (header_dict, data_bytes).
    Works with opened file objects (including gzip'd ones).
    """
    header = {}
    hdu_start = f.tell()  # Save starting position for multi-HDU files
    data_start = 0
    hdu_datasize = 0

    for block_num in range(100):
        data = f.read(2880)
        if len(data) < 2880:
            break
        for i in range(0, 2880, 80):
            card = data[i:i+80]
            try:
                s = card.decode('ascii', errors='replace').rstrip()
            except UnicodeDecodeError:
                s = ''
            if not s.strip():
                continue

            if '=' in s[:10]:
                eq = s.index('=')
                k = s[:eq].strip()
                v = s[eq+1:].strip()
                if v.startswith("'"):
                    end = v.find("'", 1)
                    if end > 0:
                        v = v[1:end]
                elif '/' in v:
                    v = v[:v.index('/')].strip()
                header[k] = v

            if s.startswith('END'):
                data_start = hdu_start + (block_num + 1) * 2880
                break
        if data_start:
            break

    # Compute data size from header
    naxis1 = int(header.get('NAXIS1', 0))
    naxis2 = int(header.get('NAXIS2', 0))
    if naxis1 > 0 and naxis2 > 0:
        hdu_datasize = naxis1 * naxis2
        # Round up to 2880 boundary
        hdu_datasize = ((hdu_datasize + 2879) // 2880) * 2880
    elif naxis1 > 0:
        hdu_datasize = ((naxis1 + 2879) // 2880) * 2880

    # Seek to data
    f.seek(data_start)
    if hdu_datasize > 0:
        raw = f.read(hdu_datasize)
    else:
        raw = b''

    return header, raw


def parse_fits_table(header, raw_bytes):
    """
    Parse a FITS binary table and return list of dicts.
    Handles 'D' (double), 'J' (int32), 'E' (float), 'A' (string) types.
    """
    fields = int(header.get('TFIELDS', 0))
    if fields == 0:
        return []

    # Get column definitions
    ttype = {}
    tform = {}
    tunit = {}
    for i in range(1, fields + 1):
        ttype[i] = header.get(f'TTYPE{i}', f'COL{i}').strip()
        form = header.get(f'TFORM{i}', 'D')
        tform[i] = form
        tunit[i] = header.get(f'TUNIT{i}', '')

    # Parse TFORM to get byte size
    def parse_form(f):
        f = f.strip()
        if f.startswith('D'):
            return 8, 'double'
        elif f.startswith('E'):
            return 4, 'float'
        elif f.startswith('J') or f.startswith('K'):
            return 4, 'int32'
        elif f.startswith('I'):
            return 2, 'int16'
        elif f.startswith('B'):
            return 1, 'byte'
        elif f.startswith('A'):
            # String: e.g. "30A" -> 30 bytes
            rest = f[:-1] if f[-1] == 'A' else f
            try:
                size = int(rest)
            except (ValueError, TypeError):
                size = 1
            return size, 'string'
        elif 'A' in f:
            rest = f.split('A')[0]
            try:
                size = int(rest)
            except (ValueError, TypeError):
                size = 1
            return size, 'string'
        else:
            # Try to parse as number prefix
            try:
                n = int(f)
                return n, 'double'
            except (ValueError, TypeError):
                return 8, 'double'

    # Handle variable-length arrays (e.g. "341J" -> 341 * 4 bytes)
    def parse_var_form(f):
        f = f.strip()
        if f.endswith('J'):
            rest = f[:-1]
            try:
                cnt = int(rest)
                return cnt * 4, 'int32_arr', cnt
            except (ValueError, TypeError):
                return 4, 'int32', 1
        elif f.endswith('D'):
            rest = f[:-1]
            try:
                cnt = int(rest)
                return cnt * 8, 'double_arr', cnt
            except (ValueError, TypeError):
                return 8, 'double', 1
        elif f.endswith('E'):
            rest = f[:-1]
            try:
                cnt = int(rest)
                return cnt * 4, 'float_arr', cnt
            except (ValueError, TypeError):
                return 4, 'float', 1
        elif f.endswith('K'):
            return 4, 'int32', 1
        elif f.endswith('I'):
            return 2, 'int16', 1
        elif f.endswith('B'):
            return 1, 'byte', 1
        elif 'A' in f:
            rest = f.split('A')[0]
            try:
                size = int(rest)
            except (ValueError, TypeError):
                size = 1
            return size, 'string', 1
        else:
            return parse_form(f)[0], parse_form(f)[1], 1

    # Build row structure
    col_info = []
    for i in range(1, fields + 1):
        field_size, field_type, count = parse_var_form(tform[i])
        col_info.append({
            'name': ttype[i],
            'size': field_size,
            'type': field_type,
            'count': count,
            'unit': tunit[i]
        })

    naxis1 = int(header.get('NAXIS1', 0))
    row_size = naxis1 if naxis1 > 0 else sum(c['size'] for c in col_info)
    naxis2 = int(header.get('NAXIS2', 1))

    if naxis1 == 0:
        naxis1 = row_size

    records = []
    for row_idx in range(naxis2):
        offset = row_idx * naxis1
        if offset + naxis1 > len(raw_bytes):
            break
        row_data = raw_bytes[offset:offset + naxis1]
        record = {}
        col_offset = 0
        for col in col_info:
            name = col['name']
            size = col['size']
            ctype = col['type']
            raw_val = row_data[col_offset:col_offset + size]
            col_offset += size

            if ctype == 'double':
                val = struct.unpack('>d', raw_val[:8])[0]
            elif ctype == 'float':
                val = struct.unpack('>f', raw_val[:4])[0]
            elif ctype == 'int32':
                if len(raw_val) >= 4:
                    val = struct.unpack('>i', raw_val[:4])[0]
                else:
                    val = 0
            elif ctype == 'int16':
                if len(raw_val) >= 2:
                    val = struct.unpack('>h', raw_val[:2])[0]
                else:
                    val = 0
            elif ctype == 'byte':
                val = raw_val[0] if raw_val else 0
            elif ctype == 'string':
                val = raw_val.decode('ascii', errors='replace').strip()
            elif ctype == 'int32_arr':
                count = col['count']
                vals = []
                for j in range(count):
                    if j * 4 + 4 <= len(raw_val):
                        vals.append(struct.unpack('>i', raw_val[j*4:j*4+4])[0])
                val = vals
            elif ctype == 'double_arr':
                count = col['count']
                vals = []
                for j in range(count):
                    if j * 8 + 8 <= len(raw_val):
                        vals.append(struct.unpack('>d', raw_val[j*8:j*8+8])[0])
                val = vals
            else:
                val = 0

            record[name] = val
        records.append(record)

    return records


# ==========================================
# Aditya-L1 SoLEXS Ingestion
# ==========================================

def find_solexs_files(date_str=None):
    """Find extracted SoLEXS FITS files for a given date (YYYYMMDD) or latest.
    Returns (date_str, sdd1_path, sdd2_path) where individual paths may be None.
    """
    base = os.path.join('data', 'raw', 'solexs')

    if date_str:
        date_dir = os.path.join(base, date_str)
        if not os.path.exists(date_dir):
            return None, None, None
    else:
        dates = sorted([d for d in os.listdir(base) if d.isdigit() and os.path.isdir(os.path.join(base, d))])
        if not dates:
            return None, None, None
        date_str = dates[-1]
        date_dir = os.path.join(base, date_str)

    # Find SLX session directory inside date_dir
    session_dir = None
    for d in os.listdir(date_dir):
        full = os.path.join(date_dir, d)
        if os.path.isdir(full) and 'SLX' in d:
            session_dir = full
            break

    if not session_dir:
        return None, None, None

    # Try finding SDD1 and SDD2 light curves independently (either may be missing)
    sdd1_path = None
    sdd2_path = None
    for ext in ['', '.fits']:
        s1 = os.path.join(session_dir, 'SDD1', f'AL1_SOLEXS_{date_str}_SDD1_L1.lc{ext}')
        s2 = os.path.join(session_dir, 'SDD2', f'AL1_SOLEXS_{date_str}_SDD2_L1.lc{ext}')
        if not sdd1_path and os.path.exists(s1):
            sdd1_path = s1
        if not sdd2_path and os.path.exists(s2):
            sdd2_path = s2

    if sdd1_path or sdd2_path:
        return date_str, sdd1_path, sdd2_path

    return None, None, None


def load_solexs_lc(filepath):
    """Load SoLEXS light curve FITS and return list of {time, counts}."""
    if filepath.endswith('.gz'):
        f = gzip.open(filepath, 'rb')
    else:
        f = open(filepath, 'rb')

    try:
        # Skip primary HDU (HDU 0)
        h0, _ = read_fits_header_data(f)
        # Read table HDU (HDU 1)
        h1, raw = read_fits_header_data(f)
        records = parse_fits_table(h1, raw)
    finally:
        f.close()

    # Real SoLEXS LC has columns: TIME (MJD or s), COUNTS (cts)
    # Map to our schema
    # Debug: show actual column names present
    if records:
        col_names = list(records[0].keys())
        print(f"    SoLEXS LC columns: {col_names}")
        if records[0]:
            print(f"    First rec: {[(k, v) for k, v in list(records[0].items())[:2]]}")

    result = []
    for r in records:
        # TIME could be MJD or seconds; try common column names
        time_val = r.get('TIME', r.get('MJD', r.get('TSTART', r.get('time', 0))))
        counts = r.get('COUNTS', r.get('CTR', r.get('RATE', 0)))

        # Skip rows with NaN or unreasonable values
        if isinstance(time_val, (int, float)) and (time_val != time_val or abs(time_val) > 1e12):
            continue
        if isinstance(counts, float) and (counts != counts or counts < 0):
            counts = 0.0
        if isinstance(counts, int):
            counts = float(counts)

        # Convert MJD to Unix timestamp if needed
        if time_val > 50000 and time_val < 200000:  # Likely MJD (not seconds)
            # MJD -> Unix: (MJD - 40587) * 86400
            # 40587 = 2440587.5 - 2400000.5 (offset between MJD and Unix)
            unix_time = (time_val - 40587.0) * 86400.0
        elif time_val > 1000000000 and time_val < 2000000000:
            # Already in Unix seconds
            unix_time = time_val
        elif time_val > 50000:
            # Could still be MJD
            unix_time = (time_val - 40587.0) * 86400.0
        else:
            unix_time = time_val

        # Sanity check: reasonable unix timestamps for 2024-2026
        if unix_time < 1.7e9 or unix_time > 1.8e9:
            continue

        result.append({
            'time': int(unix_time),
            'counts': float(counts)
        })

    return result


def process_solexs_to_flux(records_sdd1, records_sdd2):
    """Combine SDD1 and SDD2 SoLEXS light curves into unified flux."""
    from collections import defaultdict

    combined = defaultdict(float)
    for r in records_sdd1 + records_sdd2:
        combined[r['time']] += r['counts']

    # Convert counts to physical flux (soft X-ray)
    # SoLEXS counts -> flux using calibration factor
    # ~1 count/sec ≈ 1.5e-8 W/m² (calibration from SoLEXS specs)
    flux_list = []
    for t in sorted(combined.keys()):
        counts = combined[t]
        flux_list.append({
            'time': t,
            'soft_flux': counts * 1.5e-8,
            'counts': counts
        })

    return flux_list


# ==========================================
# Aditya-L1 HEL1OS Ingestion
# ==========================================

def find_helios_files(date_str=None):
    """Find extracted HEL1OS FITS files."""
    base = os.path.join('data', 'raw', 'helios')

    if date_str:
        date_dir = os.path.join(base, date_str)
        if not os.path.exists(date_dir):
            return None, None
    else:
        dates = sorted([d for d in os.listdir(base) if d.isdigit() and os.path.isdir(os.path.join(base, d))])
        if not dates:
            return None, None
        date_str = dates[-1]
        date_dir = os.path.join(base, date_str)

    # Find the HEL1OS session directory (nested: YYYY/MM/DD/HLS_...)
    for root, dirs, files in os.walk(date_dir):
        for d in dirs:
            if d.startswith('HLS_'):
                return date_str, os.path.join(root, d)
        # Limit depth for performance
        if root.count(os.sep) - date_dir.count(os.sep) > 4:
            break

    return None, None


def load_helios_lightcurve(filepath):
    """Load HEL1OS light curve FITS (CZT or CdTe) and return list of records."""
    if not os.path.exists(filepath):
        return []

    f = open(filepath, 'rb')
    try:
        h0, _ = read_fits_header_data(f)
        h1, raw = read_fits_header_data(f)
        records = parse_fits_table(h1, raw)
    finally:
        f.close()

    if records:
        print(f"    HEL1OS LC columns: {list(records[0].keys())}")

    result = []
    for r in records:
        # HEL1OS LC columns: MJD (D), ISOT (30A), CTR (cts/sec), STAT_ERR (D)
        mjd = r.get('MJD', r.get('TIME', r.get('TSTART', 0)))
        ctr = r.get('CTR', r.get('COUNTS', r.get('RATE', 0)))
        stat_err = r.get('STAT_ERR', 0)

        # Skip bad rows
        if isinstance(mjd, (int, float)) and (mjd != mjd or abs(mjd) > 1e12):
            continue
        if isinstance(ctr, float) and (ctr != ctr or ctr < 0):
            ctr = 0.0

        if mjd > 50000 and mjd < 200000:
            unix_time = (mjd - 40587.0) * 86400.0
        elif mjd > 1000000000 and mjd < 2000000000:
            unix_time = mjd
        elif mjd > 50000:
            unix_time = (mjd - 40587.0) * 86400.0
        else:
            unix_time = mjd

        if unix_time < 1.7e9 or unix_time > 1.85e9:
            continue

        result.append({
            'time': int(unix_time),
            'ctr': float(ctr),
            'stat_err': float(stat_err)
        })

    return result


def process_helios(session_dir):
    """Load HEL1OS data from all 4 detectors and merge into unified hard X-ray channels."""
    detectors = {
        'cdte1': os.path.join(session_dir, 'cdte', 'lightcurve_cdte1.fits'),
        'cdte2': os.path.join(session_dir, 'cdte', 'lightcurve_cdte2.fits'),
        'czt1':  os.path.join(session_dir, 'czt',  'lightcurve_czt1.fits'),
        'czt2':  os.path.join(session_dir, 'czt',  'lightcurve_czt2.fits'),
    }

    # Load all detector light curves
    lc_data = {}
    for name, path in detectors.items():
        lc_data[name] = load_helios_lightcurve(path)

    # Merge by timestamp, summing CTR for CdTe (lower energy) and CZT (higher energy)
    from collections import defaultdict
    merged = defaultdict(lambda: {'cdte_ctr': 0.0, 'czt_ctr': 0.0})

    for name, records in lc_data.items():
        for r in records:
            t = r['time']
            if 'cdte' in name:
                merged[t]['cdte_ctr'] += r['ctr']
            else:
                merged[t]['czt_ctr'] += r['ctr']

    # Map to pipeline schema:
    # CdTe (~5-30 keV) -> proxy for 15-25 keV
    # CZT (~20-150 keV) -> proxy for 25-50 and 50-100 keV
    # TODO: calibrate these scaling factors using HEL1OS response matrices
    # from the PRADAN data release for accurate energy-band mapping
    result = []
    for t in sorted(merged.keys()):
        cdte = max(0.1, merged[t]['cdte_ctr'])
        czt = max(0.1, merged[t]['czt_ctr'])

        # CdTe count rate scales to hardness proxy
        # CZT count rate splits into two hard channels
        hard_main = czt * 0.15 + cdte * 0.02  # Rough scaling to match NOAA-like units

        result.append({
            'time': t,
            'hard_15_25': cdte * 0.8,      # CdTe proxy for lower hard band
            'hard_25_50': hard_main,         # Combined mid band
            'hard_50_100': czt * 0.03,       # CZT proxy for upper hard band
        })

    return result


# ==========================================
# Main Data Loading Functions
# ==========================================

def load_aditya_data(date_str=None, sample_every=1):
    """Main entry point: load real Aditya-L1 data for a given date or latest.
    
    Args:
        date_str: YYYYMMDD date or None for latest
        sample_every: Load every Nth record (higher = faster for API init)
    """
    print(f"Loading real Aditya-L1 data (date: {date_str or 'latest'}, sample_every={sample_every})...")

    # 1. Load SoLEXS
    found_date, sdd1_path, sdd2_path = find_solexs_files(date_str)
    if not found_date:
        print("  No SoLEXS data found.")
        return None

    print(f"  Found SoLEXS data: {found_date}")
    sdd1 = load_solexs_lc(sdd1_path) if sdd1_path and os.path.exists(sdd1_path) else []
    sdd2 = load_solexs_lc(sdd2_path) if sdd2_path and os.path.exists(sdd2_path) else []

    if not sdd1 and not sdd2:
        print("  SoLEXS data is empty.")
        return None

    soft_flux_data = process_solexs_to_flux(sdd1, sdd2)
    
    # Apply sampling if requested
    if sample_every > 1 and soft_flux_data:
        soft_flux_data = soft_flux_data[::sample_every]
        
    print(f"  SoLEXS: {len(soft_flux_data)} points (SDD1: {len(sdd1)}, SDD2: {len(sdd2)})")

    # 2. Load HEL1OS (same date)
    helios_date, session_dir = find_helios_files(found_date)
    if not helios_date:
        print("  No HEL1OS data found for this date. SoLEXS-only mode.")
        hard_data = []
    else:
        hard_data = process_helios(session_dir)
        # Also sample HEL1OS to match
        if sample_every > 1 and hard_data:
            hard_data = hard_data[::sample_every]
        print(f"  HEL1OS: {len(hard_data)} points")

    # 3. Align and merge (or return SoLEXS-only if no HEL1OS)
    if hard_data:
        return align_al1_data(soft_flux_data, hard_data)
    else:
        # Return SoLEXS-only data
        return [{'time': p['time'], 'soft_flux': p['soft_flux'],
                 'hard_15_25': 0, 'hard_25_50': 0, 'hard_50_100': 0,
                 'data_gap': True}
                for p in soft_flux_data]


def align_al1_data(soft_data, hard_data):
    """Align SoLEXS and HEL1OS data by timestamp, filling gaps."""
    if not soft_data or not hard_data:
        return []

    soft_map = {r['time']: r for r in soft_data}
    hard_map = {r['time']: r for r in hard_data}

    t_min = min(min(soft_map.keys()), min(hard_map.keys()))
    t_max = max(max(soft_map.keys()), max(hard_map.keys()))

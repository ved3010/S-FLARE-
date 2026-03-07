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

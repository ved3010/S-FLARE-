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

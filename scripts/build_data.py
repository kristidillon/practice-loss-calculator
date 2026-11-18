#!/usr/bin/env python3
"""Rebuild js/data.js and js/zips.js from the BLS API and a GeoNames US.txt.

The committed files are what the page loads. Re-run only when refreshing sources.

  python3 scripts/build_data.py --geonames /path/to/US.txt
  python3 scripts/build_data.py --wages-json /tmp/wages.json --geonames /path/to/US.txt

Wages are BLS OEWS May 2025, public API:
  state hourly mean  OEUS + SS00000 + 000000 + SOC + 03
  state hourly median OEUS + SS00000 + 000000 + SOC + 08
  national uses OEUN and area 0000000
SOC 31-9091 dental assistants, SOC 29-1292 dental hygienists.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# FIPS (OEWS area SS00000) -> postal
FIPS = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
    "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
    "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
    "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
    "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
    "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
    "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
    "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
    "54": "WV", "55": "WI", "56": "WY", "72": "PR",
}

NAMES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "DC": "District of Columbia", "FL": "Florida", "GA": "Georgia", "HI": "Hawaii",
    "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming", "PR": "Puerto Rico",
    "US": "United States", "MIL": "U.S. military mail",
}

# ADA HPI, 2026 Survey of Dental Practice (2025 results). See README.
ADA_BILLINGS = 965660  # Table 5, owner GPs, all owners, average gross billings per dentist
ADA_EXPENSES = 556450  # Table 13, owner GPs, all owners, average expenses excl. shareholder salaries
ADA_HOUR_MEAN = 621.146145  # Table 9, solo GPs, average gross billings per practice hour
ADA_HOUR_MEDIAN = 529.152  # Table 9, solo GPs, median
ADA_OFFICE_HOURS = 1726  # Table 19, owner GPs, all owners, 2025


def cents(value):
    if value is None:
        return None
    return round(float(value) + 1e-9, 2)


def fetch_wages():
    import time
    import urllib.request

    occs = {"319091": "assistant", "291292": "hygienist"}
    series = []
    meta = {}
    for fips, st in FIPS.items():
        for occ, name in occs.items():
            for dt, label in (("03", "mean"), ("08", "median")):
                sid = f"OEUS{fips}00000" + "000000" + occ + dt
                assert len(sid) == 25, sid
                series.append(sid)
                meta[sid] = (st, name, label)
    for occ, name in occs.items():
        for dt, label in (("03", "mean"), ("08", "median")):
            sid = "OEUN0000000" + "000000" + occ + dt
            assert len(sid) == 25, sid
            series.append(sid)
            meta[sid] = ("US", name, label)
    out = {}
    for i in range(0, len(series), 25):
        chunk = series[i:i + 25]
        body = json.dumps({"seriesid": chunk, "startyear": "2025", "endyear": "2025"}).encode()
        req = urllib.request.Request(
            "https://api.bls.gov/publicAPI/v2/timeseries/data/",
            data=body,
            headers={"Content-Type": "application/json", "User-Agent": "practice-loss-calculator"},
        )
        with urllib.request.urlopen(req, timeout=90) as res:
            payload = json.load(res)
        if payload.get("status") != "REQUEST_SUCCEEDED":
            raise SystemExit(payload)
        for item in payload["Results"]["series"]:
            rows = item.get("data") or []
            raw = rows[0]["value"] if rows else None
            st, name, label = meta[item["seriesID"]]
            out.setdefault(st, {}).setdefault(name, {})[label] = None if raw in (None, "-") else cents(raw)
        time.sleep(0.35)
    return out


def wage_block(raw):
    states = {}
    for code, name in NAMES.items():
        if code in ("US", "MIL"):
            continue
        rec = raw.get(code, {})
        assistant = rec.get("assistant") or {}
        hygienist = rec.get("hygienist") or {}
        unpublished = assistant.get("mean") is None or hygienist.get("mean") is None
        states[code] = {
            "name": name,
            "assistant": None if unpublished else {"mean": assistant.get("mean"), "median": assistant.get("median")},
            "hygienist": None if unpublished else {"mean": hygienist.get("mean"), "median": hygienist.get("median")},
            "unpublished": unpublished,
        }
    us = raw["US"]
    return {
        "vintage": "May 2025",
        "retrieved": "2026-11-18",
        "assistantSoc": "31-9091",
        "hygienistSoc": "29-1292",
        "national": {
            "assistant": {"mean": us["assistant"]["mean"], "median": us["assistant"]["median"]},
            "hygienist": {"mean": us["hygienist"]["mean"], "median": us["hygienist"]["median"]},
        },
        "states": states,
    }


def write_zips(geonames: Path):
    exact = {}
    by_prefix = defaultdict(Counter)
    with geonames.open(encoding="utf-8") as handle:
        for line in handle:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 5:
                continue
            postal, admin = parts[1], parts[4]
            if not postal.isdigit() or len(postal) != 5:
                continue
            if admin in NAMES and admin not in ("US", "MIL"):
                code = admin
            elif not admin:
                code = "MIL"  # APO / FPO rows in this file have a blank state
            else:
                code = "US"  # present in the file, no wage table (for example MH)
            exact[postal] = code
            by_prefix[postal[:3]][code] += 1
    # Fallback only when every ZIP in the prefix maps to one code.
    unanimous = {prefix: counts.most_common(1)[0][0] for prefix, counts in by_prefix.items() if len(counts) == 1}
    for zip_code, code in {"10001": "NY", "94105": "CA", "02139": "MA", "55401": "MN", "67202": "KS", "30303": "GA"}.items():
        if exact.get(zip_code) != code:
            raise SystemExit(f"Unexpected ZIP mapping for {zip_code}: {exact.get(zip_code)}")
    payload = {
        "attribution": "GeoNames postal codes (CC BY 4.0), US.txt dated 2026-11-18 in the download used here.",
        "url": "https://download.geonames.org/export/zip/",
        "exact": exact,
        "prefixUnanimous": unanimous,
    }
    # Compact so the static file stays a single script the page can load from disk.
    text = (
        "/* Generated by scripts/build_data.py. GeoNames postal codes, CC BY 4.0. https://www.geonames.org/ */\n"
        "window.ZIP_DATA = "
        + json.dumps(payload, separators=(",", ":"), ensure_ascii=True)
        + ";\n"
    )
    path = ROOT / "js" / "zips.js"
    path.write_text(text, encoding="utf-8")
    print(f"wrote {path} ({path.stat().st_size} bytes, {len(exact)} ZIPs, {len(unanimous)} prefixes)")


def write_data(wages):
    ratio = ADA_EXPENSES / ADA_BILLINGS
    data = {
        "wages": wage_block(wages),
        "production": {
            "perHourMean": ADA_HOUR_MEAN,
            "perHourMeanRounded": cents(ADA_HOUR_MEAN),
            "perHourMedian": ADA_HOUR_MEDIAN,
            "perHourMedianRounded": cents(ADA_HOUR_MEDIAN),
            "respondents": 246,
            "officeHoursYear": ADA_OFFICE_HOURS,
            "oneCaseStart": 500,
        },
        "overhead": {
            "expensesPerDentist": ADA_EXPENSES,
            "billingsPerDentist": ADA_BILLINGS,
            "expenseRespondents": 367,
            "billingRespondents": 423,
            "percentExact": ratio * 100,
            "percentRounded": cents(ratio * 100),
            "perHourAtMeanBillings": cents(ADA_HOUR_MEAN * ratio),
        },
        "studies": {
            "remakePct": 3.8,
            "crownsPerMonth": 18,
        },
        "defaults": {
            "units": 25,
            "remakePct": 8,
            "adjustMin": 15,
            "productionPerHour": 500,
            "staffHrs": 4,
            "staffWage": 28,
            "targetRemakePct": 2,
            "targetAdjustMin": 5,
            "remakeHours": 1.5,
            "targetStaffHrs": 0.5,
            "prepMin": 60,
            "seatMin": 30,
            "daWage": wages["US"]["assistant"]["mean"],
            "hygWage": wages["US"]["hygienist"]["mean"],
            "assistantPerChairHour": 1,
            "hygHoursPerRemake": 0,
            "hygHoursPerSeat": 0,
            "hygHoursPerExtraVisit": 0,
            "overheadPct": cents(ratio * 100),
            "labFee": 0,
            "turnaroundDays": 14,
            "tempCost": 0,
            "extraVisits": 1,
            "extraVisitAfterDays": 7,
            "extraVisitMin": 20,
            "carryRatePct": 0,
            "hoursPerDay": 8,
            "officeHoursYear": ADA_OFFICE_HOURS,
            "scenarioRemake": 2,
            "scenarioAdjust": 5,
            "scenarioTurnaround": 7,
        },
    }
    # Lock this vintage so a bad API parse fails the build.
    us = data["wages"]["national"]
    assert us["assistant"]["mean"] == 24.13
    assert us["assistant"]["median"] == 23.11
    assert us["hygienist"]["median"] == 47.16
    assert data["wages"]["states"]["NY"]["assistant"]["mean"] == 23.95
    assert data["wages"]["states"]["AL"]["assistant"]["median"] == 18.79
    assert data["wages"]["states"]["MN"]["assistant"]["median"] == 31.38
    assert data["wages"]["states"]["KS"]["unpublished"] is True
    text = (
        "/* Generated by scripts/build_data.py. Figures are cited in README and on the page. */\n"
        "window.PRACTICE_DATA = "
        + json.dumps(data, indent=2)
        + ";\n"
    )
    path = ROOT / "js" / "data.js"
    path.write_text(text, encoding="utf-8")
    print(f"wrote {path} ({path.stat().st_size} bytes)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--wages-json", type=Path)
    parser.add_argument("--geonames", type=Path, required=True)
    args = parser.parse_args()
    if args.wages_json:
        raw = json.loads(args.wages_json.read_text())
        role_names = {"da": "assistant", "hyg": "hygienist", "assistant": "assistant", "hygienist": "hygienist"}
        wages = {}
        for code, rec in raw.items():
            wages[code] = {
                role_names.get(role, role): {stat: cents(val) for stat, val in (stats or {}).items()}
                for role, stats in rec.items()
            }
    else:
        wages = fetch_wages()
    write_data(wages)
    write_zips(args.geonames)


if __name__ == "__main__":
    main()

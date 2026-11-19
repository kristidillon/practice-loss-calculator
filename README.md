# Dental Practice Production/Revenue Loss Calculator

A static estimate of what adjustments, remakes, staff time, overhead, and lab turnaround cost a dental practice. It runs entirely in the browser. Open `index.html` directly, or host the repository root on GitHub Pages.

The page is a general information tool. It has no email link, no meeting link, and no lead form. The header is the Dandy wordmark.

## Use it

1. Open `index.html` in a browser, or the GitHub Pages URL after the steps below.
2. Enter a 5-digit U.S. ZIP on the opening page and continue. That opens `calculator.html?zip=` in the same tab. State wages fill in from BLS May 2024. You can edit every figure.
3. Enter office size, monthly fixed and removable cases, turnaround, adjustment minutes, and remakes. The annual estimate updates as you type. Case counts replace the old 25-units-per-chair starting point. Remakes are a count, not a percent.
4. Open **Fine-tune** to edit production, wages, the separate removable adjustment minutes and remake chair time, overhead, lab fee, and the comparison.
5. The “With fewer remakes” bar uses the comparison remake count, adjustment minutes, and turnaround inside Fine-tune.
6. The one-case comparison lower on the page uses the original gap formula (chair time and chasing hours only).

`calculator.html?zip=10001` opens that ZIP. A missing or unknown ZIP returns to `index.html`.

There is no build step and no server. Scripts are plain files so the page works from `file://` as well as from GitHub Pages. Do not rename the `js/` or `css/` folders without updating the paths in `index.html`.

## Enable GitHub Pages

1. Push this branch to `main` (or merge the pull request).
2. On GitHub, open the repository **Settings**.
3. Open **Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
5. Set the branch to **main** and the folder to **/ (root)**.
6. Save. The site will be at `https://kristidillon.github.io/practice-loss-calculator/`.

A `.nojekyll` file is included so GitHub Pages serves the files as-is.

## What the annual figure adds

For the current pace, not as a gap against a target:

- **Lost production** — chair hours from the cases you enter. Fixed and removable cases use their own adjustment minutes and remake chair time. Remake hours are the remake count times those chair times, split between the two types in proportion to the cases. Extra-visit hours are added when turnaround is longer than the day threshold.
- **Staff wages** — those chair hours times assistant hours per chair hour times the dental-assistant wage, plus any hygienist hours you enter times the hygienist wage.
- **Overhead** — shown beside lost production as the share of those billings that is overhead. It is not added to the annual total, because gross billings per hour already include it.
- **Lab fees** — remakes times the lab fee you enter (starts at $0).
- **Turnaround** — per case: temp cost, plus extra visits when turnaround is longer than the day threshold (those visits are priced with production, wages, and overhead), plus a carrying cost if you set a rate.

Billings sitting in the queue (units per month × turnaround days / 30 × production per hour × chair hours per remake) are shown and are **not** added unless you set a carrying rate.

The annual total is lost production plus staff wages for that time. Overhead stays visible and is not added again. Lab fees, temps, and carrying cost are added only when those fields are set.

A lower block prices only the gap in remake rate, adjustment minutes, and chasing hours:

```
units × 12 × (remake% − target remake%) / 100 × chair hours per remake
+ units × 12 × (adjustment minutes − target minutes) / 60
```

priced at production per hour, plus `(chasing hours − target chasing hours) × 52 × chasing wage`. Gaps below zero are treated as zero. The page keeps 52 weeks, matching that calculator.

## Data sources

Figures are not invented. Where no public number exists, the field is labeled **assumption — enter your own** and starts at a round default you can replace.

### Wages

U.S. Bureau of Labor Statistics, Occupational Employment and Wage Statistics, **May 2024**. The numbers are in `data/may2024-wages.json`.

- Dental hygienists, SOC **29-1292**, and dental assistants, SOC **31-9091**: official mean hourly wages, cross-industry (`state_M2024_dl.xlsx` and `national_M2024_dl.xlsx`).
- Receptionists, SOC **43-4171**: state means for Offices of Dentists, NAICS **621200**, from the May 2024 OEWS research estimates (`oes_research_2024_sec_62.xlsx`). The national receptionist mean, **$21.39**, is the official national industry figure in `nat4d_M2024_dl.xlsx`.
- Team/hr is one hygienist, one assistant, and one receptionist. Wages only.

Minnesota, Montana, and Vermont have no published dental-office receptionist wage. Team/hr is n/a for those states. The estimate fills the U.S. receptionist mean and says so.

Tables: [bls.gov/oes/tables.htm](https://www.bls.gov/oes/tables.htm). Research estimates: [oes_research_2024.htm](https://www.bls.gov/oes/oes_research_2024.htm).

Checked on November 18, 2026 against those files (Wayback copies of the May 2024 release). Hygienist and assistant means matched all 50 states and D.C. Receptionist means matched every published state. National receptionist $21.39 matched. No wage in the sheet was changed. Two Hawaii ZIP codes that also have a blank military-mail row, 96860 and 96863, now map to Hawaii. ADA Tables 5, 9, 13, and 19 were re-read from the 2026 Survey of Dental Practice workbook; the production, hours, and overhead figures were already the published ones.

### Production, hours, and overhead

ADA Health Policy Institute, **2026 Survey of Dental Practice**, results for **2025**. [Dental practice research](https://www.ada.org/resources/research/health-policy-institute/dental-practice-research). Workbook: [Income, Gross Billings, Expenses, and Characteristics (XLSX)](https://www.ada.org/-/media/project/ada-organization/ada/ada-org/files/resources/research/hpi/hpidata_sdpi_2025.xlsx).

| Figure | Value | Table |
| --- | --- | --- |
| Average gross billings per practice hour, solo general practitioners | $621.15 (published 621.146145; median $529.15; n=246) | Table 9 |
| Average hours per year in the dental office, owner general practitioners | 1,726 | Table 19, 2025 |
| Average gross billings per owner general practitioner | $965,660 (n=423) | Table 5 |
| Average practice expenses per owner general practitioner, excluding shareholder salaries | $556,450 (n=367) | Table 13 |

ADA publishes these nationally, not by state. The hourly figure is practice billings per practice hour, not a dentist-only wage. The page says that next to the field.

**Overhead percent is derived, not an ADA-published rate.** $556,450 / $965,660 = 57.62% after rounding to the cent. Gross billings are not collections. The two averages come from different respondents. Owner shareholder pay is excluded. Per practice hour applies that percent to whatever production per hour is on the form. At the ADA hourly average, that is about $358.

The production field starts at **$500**, the one-case calculator’s starting value, and switches to the ADA average when you enter a ZIP unless you have already typed your own.

### Studies you can apply

These are not the starting values. Buttons on the page apply them.

- McCracken et al., *Journal of Prosthodontics* 28(2):122–130, published online November 22, 2018. Of 3,731 single-unit crowns that reached try-in, 141 (**3.8%**) were rejected. 205 dentists in the National Dental Practice-Based Research Network. [doi:10.1111/jopr.12995](https://doi.org/10.1111/jopr.12995).
- McCracken et al., *Journal of the American Dental Association* 2017;148(11):788–796.e4. Self-reported mean of **18 crowns a month**. Most respondents (59%) reported a remake rate under 2%, and 17% reported a rate over 4%. That is a questionnaire, separate from the 3.8% try-in study. [PMC5793929](https://pmc.ncbi.nlm.nih.gov/articles/PMC5793929/).

The remake field starts at **8%** and units at **25** because those are the one-case calculator’s starting values. The one-case page’s line about a 5–10% industry average is not repeated here; this page did not find a public source for that range.

### ZIP codes

[GeoNames](https://www.geonames.org/) postal codes, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), U.S. file from [download.geonames.org/export/zip/](https://download.geonames.org/export/zip/). A ZIP maps to a state, then to that state’s OEWS wages. It is not a ZIP-level or metro wage. If a prefix is entirely one state, an unrecognized ZIP in that prefix still resolves. Military mail entries have no state, so the page uses U.S. means. Puerto Rico wages are in the BLS file and in the state list; Puerto Rico ZIPs are not in the GeoNames U.S. extract used here.

### One-case calculator

The comparison formula and slider ranges follow the earlier calculator. The type is the system font stack. The accent is `#0A7C86`. The header wordmark is the word Dandy.

## Assumptions

All of these are editable and labeled on the page:

| Field | Starts at |
| --- | --- |
| Adjustment minutes | 15 (one-case starting value) |
| Prep / seat minutes | 60 / 30, which is 1.5 chair hours per remake |
| Assistant hours per chair hour | 1 |
| Hygienist hours | 0 |
| Lab fee and temp cost | $0 |
| Extra visits | 1, only when turnaround is longer than 7 days |
| Minutes per extra visit | 20 |
| Carrying rate | 0% |
| Hours per day | 8 |
| Turnaround | 14 days |
| Scenario | 2% remake, 5 minutes adjusting, 7 days |

2% and 5 minutes are the one-case calculator’s comparison starting points, not a forecast. 14 days is a starting point in the same neighborhood as the two-week path described on that page, not a measured U.S. average.

## Refresh the wage and ZIP files

`js/data.js` and `js/zips.js` are generated. To rebuild them:

```bash
python3 scripts/build_data.py --geonames /path/to/US.txt
```

That calls the BLS API. Pass `--wages-json` to reuse a file already shaped like the API result (`assistant`/`hygienist` or `da`/`hyg`, with `mean` and `median`). The script checks a few published medians before it writes. Commit the regenerated `js/data.js` and `js/zips.js`.

`node tests/model.test.js` checks the one-case formula at its starting values ($43,596 a year) and the loss components.

## Page shape

The layout is minimal: near-black type on white, soft gray bands, one accent, hairline inputs, and a thin stacked bar. The annual figure is the only display-size number. The ZIP is the first step, three practice inputs are the second, and the annual estimate is the third. There is no countdown, scarcity, or testimonial.

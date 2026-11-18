# Dental Practice Production/Revenue Loss Calculator

A static estimate of what adjustments, remakes, staff time, overhead, and lab turnaround cost a dental practice. It runs entirely in the browser. Open `index.html` directly, or host the repository root on GitHub Pages.

The report form opens an email draft. It does not submit anywhere, and the page does not show the recipient’s name.

## Use it

1. Open `index.html` in a browser, or the GitHub Pages URL after the steps below.
2. Enter a 5-digit U.S. ZIP, or choose a state. State wages fill in from BLS. You can edit every figure.
3. Set monthly crown and bridge units, remake rate, and minutes adjusting at the seat. The annual estimate, the monthly and office-day equivalents, and the breakdown update as you type.
4. Open **Your area** to edit production, wages, chair time, overhead, lab fee, and turnaround.
5. Set a comparison remake rate, adjustment time, and turnaround under **With fewer adjustments and remakes**.
6. The one-case comparison lower on the page uses the original gap formula (chair time and chasing hours only).

`index.html?zip=10001` opens with that ZIP already applied.

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

- **Lost production** — chair hours in adjustments and remakes, times gross billings per practice hour.
- **Staff wages** — those chair hours times assistant hours per chair hour times the dental-assistant wage, plus any hygienist hours you enter times the hygienist wage.
- **Overhead** — the same chair hours times production per hour times the overhead percent.
- **Lab fees** — remakes times the lab fee you enter (starts at $0).
- **Turnaround** — per case: temp cost, plus extra visits when turnaround is longer than the day threshold (those visits are priced with production, wages, and overhead), plus a carrying cost if you set a rate.

Billings sitting in the queue (units per month × turnaround days / 30 × production per hour × chair hours per remake) are shown and are **not** added unless you set a carrying rate.

Staff wages also sit inside the expense total used for the overhead percent, so the headline counts payroll on these hours twice. The page shows the total with staff left inside overhead as well.

The one-case block is a separate formula, ported from [the one-case calculator](https://kristidillon.github.io/one-case/#cost):

```
units × 12 × (remake% − target remake%) / 100 × chair hours per remake
+ units × 12 × (adjustment minutes − target minutes) / 60
```

priced at production per hour, plus `(chasing hours − target chasing hours) × 52 × chasing wage`. Gaps below zero are treated as zero. The page keeps 52 weeks, matching that calculator.

## Data sources

Figures are not invented. Where no public number exists, the field is labeled **assumption — enter your own** and starts at a round default you can replace.

### Wages

U.S. Bureau of Labor Statistics, Occupational Employment and Wage Statistics, **May 2025**.

- Dental assistants: SOC **31-9091**. OEWS does not publish this occupation as 29-9093.
- Dental hygienists: SOC **29-1292**.

State and national **mean** (datatype 03) and **median** (datatype 08) hourly wages, all industries, from the [BLS Public Data API](https://www.bls.gov/developers/), retrieved November 18, 2026. State series use `OEUS` plus the state area code (`SS00000`). The U.S. series uses `OEUN` and area `0000000`. These are straight-time wages, not loaded wages, and they do not include benefits.

Kansas has no published May 2025 state series for either occupation in that API. The page fills the U.S. mean and says so.

Tables: [bls.gov/oes/tables.htm](https://www.bls.gov/oes/tables.htm).

Checked against the published medians for Alabama ($18.79), Minnesota ($31.38), and the U.S. ($23.11 assistant, $47.16 hygienist).

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

Inputs, the comparison formula, and slider ranges are ported from [the one-case page](https://kristidillon.github.io/one-case/#cost) ([source](https://github.com/kristidillon/one-case)). The type is the system font stack. The accent is `#0A7C86`.

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

## Report form

The form’s `action` is `#`. Submit opens a `mailto:` draft. It does not post to a form service, and this repository does not send test entries anywhere.

**TODO:** if these reports should be stored, replace the mailto handoff in `js/app.js` (`reportForm` submit handler) with an endpoint you control. Until that exists, leave the handler as a mailto draft.

## Page shape

The layout is minimal: near-black type on white, soft gray bands, one accent, hairline inputs, and a thin stacked bar. The annual figure is the only display-size number. The ZIP is the first step, three practice inputs are the second, and the annual estimate is the third. There is no countdown, scarcity, or testimonial.

(function () {
  var DATA = window.PRACTICE_DATA;
  var ZIPS = window.ZIP_DATA;
  var Model = window.LossModel;
  if (!DATA || !ZIPS || !Model) return;

  var $ = function (id) { return document.getElementById(id); };
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var state = Object.assign({ remakeLinked: true, touched: {} }, DATA.defaults);
  var region = { code: "US", zip: "", via: "default" };
  var shownAnnual = 0;

  function num(value) {
    var n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  function money(value) {
    var v = Math.round(num(value));
    var sign = v < 0 ? "-" : "";
    return sign + "$" + Math.abs(v).toLocaleString("en-US");
  }
  function fmt(value, digits) {
    return num(value).toLocaleString("en-US", { maximumFractionDigits: digits == null ? 0 : digits });
  }
  function wageText(value) {
    return "$" + num(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function paintRange(el) {
    var min = num(el.min), max = num(el.max), v = num(el.value);
    var span = max - min || 1;
    el.style.setProperty("--pct", ((v - min) / span * 100) + "%");
  }

  function sync(name, source) {
    var value = state[name];
    document.querySelectorAll('[data-field="' + name + '"]').forEach(function (el) {
      if (el === source && el.type !== "range") return;
      if (el.type === "range") {
        var min = num(el.min), max = num(el.max);
        var clamped = Math.min(max, Math.max(min, num(value)));
        el.value = String(clamped);
        paintRange(el);
        return;
      }
      var next = String(value);
      if (el.value !== next) el.value = next;
    });
  }

  function syncAll() {
    Object.keys(DATA.defaults).forEach(function (name) { sync(name); });
  }

  function wageRecord() {
    var wages = DATA.wages;
    if (region.code === "US" || region.code === "MIL") {
      return { pack: wages.national, unpublished: false, national: true, name: region.code === "MIL" ? "U.S. military mail" : "the U.S." };
    }
    var st = wages.states[region.code];
    if (!st || st.unpublished) {
      return { pack: wages.national, unpublished: true, national: true, name: st ? st.name : "this area" };
    }
    return { pack: { assistant: st.assistant, hygienist: st.hygienist }, unpublished: false, national: false, name: st.name };
  }

  function applyWages() {
    var rec = wageRecord();
    state.daWage = rec.pack.assistant.mean;
    state.hygWage = rec.pack.hygienist.mean;
    sync("daWage");
    sync("hygWage");
  }

  function setProduction(value, mark) {
    state.productionPerHour = value;
    if (mark) state.touched.productionPerHour = true;
    sync("productionPerHour");
  }

  function applyRegion(code, zip) {
    region.code = code || "US";
    region.zip = zip || "";
    applyWages();
    if (!state.touched.productionPerHour) setProduction(DATA.production.perHourMeanRounded, false);
    var select = $("statePick");
    if (select && DATA.wages.states[region.code]) select.value = region.code;
    else if (select && region.code === "US") select.value = "US";
    paint();
  }

  function lookupZip(raw) {
    var digits = String(raw || "").replace(/\D/g, "").slice(0, 5);
    if (digits.length !== 5) return { error: "Enter a 5-digit U.S. ZIP code." };
    var code = ZIPS.exact[digits];
    var via = "ZIP";
    if (!code && ZIPS.prefixUnanimous[digits.slice(0, 3)]) {
      code = ZIPS.prefixUnanimous[digits.slice(0, 3)];
      via = "ZIP prefix";
    }
    if (!code) return { unmatched: true, zip: digits, error: "That ZIP is not in the local list. Choose a state instead." };
    return { zip: digits, code: code, via: via };
  }

  function regionSentence() {
    var rec = wageRecord();
    var place = rec.name;
    if (region.zip) place = place + " · " + region.zip;
    var prod = state.touched.productionPerHour
      ? "Production per hour is the figure you entered."
      : (state.productionPerHour === DATA.production.oneCaseStart
        ? "Production is still the $500 starting value."
        : "Production and overhead are U.S. figures. ADA does not publish them by state.");
    if (rec.unpublished && region.code !== "US" && region.code !== "MIL") {
      return place + ". BLS does not publish a May 2025 state estimate for these two occupations here, so the U.S. mean is filled in. " + prod;
    }
    if (region.code === "MIL") {
      return "Military mail ZIP. No state wage is assigned, so the U.S. mean is filled in. " + prod;
    }
    return place + " wages, BLS OEWS May 2025. " + prod;
  }

  function lossNow() { return Model.annualLoss(state); }
  function lossScenario() { return Model.annualLoss(Model.scenarioInput(state)); }

  function bar(loss) {
    var parts = [
      [loss.lostProduction, "#0A7C86"],
      [loss.staffCost, "#1D1D1F"],
      [loss.overheadBurn, "#6E6E73"],
      [loss.labCost, "#C7C7CC"],
      [loss.turnaroundCost, "#3A3A3F"]
    ];
    var total = parts.reduce(function (sum, part) { return sum + part[0]; }, 0);
    var weights = parts.map(function (part) {
      var pct = total > 0 ? part[0] / total * 100 : 0;
      return part[0] > 0 && pct < 0.9 ? 0.9 : pct;
    });
    var scale = weights.reduce(function (sum, pct) { return sum + pct; }, 0) || 1;
    var row = document.createElement("div");
    var label = document.createElement("div");
    label.className = "bar-label";
    var name = document.createElement("span");
    name.textContent = loss === lossNow() ? "Now" : "Scenario";
    var amount = document.createElement("span");
    amount.textContent = money(loss.total);
    label.appendChild(name);
    label.appendChild(amount);
    var track = document.createElement("div");
    track.className = "stackbar";
    parts.forEach(function (part) {
      var slice = document.createElement("i");
      slice.style.width = (weights[parts.indexOf(part)] / scale * 100) + "%";
      slice.style.background = part[1];
      track.appendChild(slice);
    });
    row.appendChild(label);
    row.appendChild(track);
    return row;
  }

  function addRow(parent, color, title, detail, annual, monthly) {
    var row = document.createElement("div");
    row.className = "break-row";
    var swatch = document.createElement("i");
    swatch.className = "swatch";
    swatch.style.background = color;
    var name = document.createElement("div");
    name.className = "name";
    name.textContent = title;
    if (detail) {
      var small = document.createElement("small");
      small.textContent = detail;
      name.appendChild(small);
    }
    var nums = document.createElement("div");
    nums.className = "nums";
    var year = document.createElement("b");
    year.textContent = money(annual) + " / yr";
    var month = document.createElement("span");
    month.textContent = money(monthly) + " / mo";
    nums.appendChild(year);
    nums.appendChild(month);
    row.appendChild(swatch);
    row.appendChild(name);
    row.appendChild(nums);
    parent.appendChild(row);
  }

  function animateAnnual(target) {
    var el = $("outAnnual");
    if (reduced) { el.textContent = money(target); shownAnnual = target; return; }
    var start = shownAnnual, t0 = performance.now(), dur = 520;
    cancelAnimationFrame(el._raf);
    var tick = function (t) {
      var p = Math.min(1, (t - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = money(start + (target - start) * eased);
      if (p < 1) el._raf = requestAnimationFrame(tick);
      else shownAnnual = target;
    };
    el._raf = requestAnimationFrame(tick);
  }

  function paint() {
    var now = lossNow();
    var scenario = lossScenario();
    var eq = Model.equivalents(now, state);
    var original = Model.originalComparison(state);
    var rec = wageRecord();

    animateAnnual(now.total);
    $("outDayLine").textContent = "About " + money(now.monthly) + " a month, and about " + money(eq.perOfficeDay) + " an office day.";
    $("outCrowns").textContent = "The chair time in adjustments and remakes is about " + fmt(eq.crownsOfChairTime, 0) + " crowns, at " + fmt(state.remakeHours, 2) + " hours each.";
    $("outRegion").textContent = regionSentence();
    $("outMonthLine").innerHTML = "Every month at this pace, the estimate is about <b>" + money(now.monthly) + "</b>.";
    $("stickyValue").textContent = money(now.total);

    if (now.visits > 0) {
      var visitDollars = now.visitProduction + now.visitStaff + now.visitOverhead;
      $("outVisitNote").textContent = "Includes " + fmt(now.visits, 2) + " assumed extra visit" + (now.visits === 1 ? "" : "s") + " per case, because turnaround is longer than " + fmt(state.extraVisitAfterDays, 0) + " days. That visit count is an assumption. It is " + money(visitDollars) + " of the annual estimate.";
    } else {
      $("outVisitNote").textContent = "Extra visits are not in the dollar total. Set them under Your area if a case comes back while you wait on the lab.";
    }

    if (document.activeElement !== $("productionPerDay")) {
      $("productionPerDay").value = String(Math.round(state.productionPerHour * state.hoursPerDay));
    }
    if (document.activeElement !== $("overheadPerHour")) {
      $("overheadPerHour").value = (state.productionPerHour * state.overheadPct / 100).toFixed(2);
    }
    $("remakeHoursEcho").value = String(state.remakeHours);

    var prodNote = "Starts at $500, the one-case calculator’s starting value, until a ZIP is entered. ADA Table 9, solo general practitioners, 2025: average gross billings per practice hour " + wageText(DATA.production.perHourMeanRounded) + " (median " + wageText(DATA.production.perHourMedianRounded) + ", 246 responses). National only.";
    if (state.productionPerHour === DATA.production.perHourMeanRounded) {
      prodNote = "ADA Table 9 average for solo general practitioners, 2025. Practice billings per practice hour, not a dentist-only wage. The same national figure is used in every state.";
    } else if (state.productionPerHour === DATA.production.perHourMedianRounded) {
      prodNote = "ADA Table 9 median for solo general practitioners, 2025. National only.";
    }
    $("prodMeta").textContent = prodNote;

    var daMedian = rec.pack.assistant.median;
    var hygMedian = rec.pack.hygienist.median;
    var place = rec.unpublished && region.code !== "US" && region.code !== "MIL"
      ? rec.name + " is not published. U.S. mean filled in."
      : (rec.national ? "U.S. mean." : rec.name + " mean.");
    $("daMeta").textContent = place + " Median " + (daMedian == null ? "not published" : wageText(daMedian)) + ". SOC 31-9091. Not a loaded wage.";
    $("hygMeta").textContent = place + " Median " + (hygMedian == null ? "not published" : wageText(hygMedian)) + ". SOC 29-1292. Hours below start at 0. Assumption — enter your own.";

    $("overheadMeta").textContent = "Derived from ADA Tables 5 and 13: $" + DATA.overhead.expensesPerDentist.toLocaleString("en-US") + " expenses (excluding shareholder salaries) / $" + DATA.overhead.billingsPerDentist.toLocaleString("en-US") + " gross billings = " + DATA.overhead.percentRounded + "%. Not an ADA-published overhead rate, and not by state. At the ADA hourly average this is about " + money(DATA.overhead.perHourAtMeanBillings) + " per practice hour.";

    var sumHours = (num(state.prepMin) + num(state.seatMin)) / 60;
    $("remakeHoursHint").textContent = state.remakeLinked
      ? "Prep plus seat is " + fmt(sumHours, 2) + " hours. Assumption — enter your own. No public U.S. average is loaded."
      : "Set directly to " + fmt(state.remakeHours, 2) + " hours. Prep plus seat would be " + fmt(sumHours, 2) + ".";

    $("areaTitle").textContent = region.code === "US"
      ? "U.S. averages, ready to edit."
      : rec.name + " wages, ready to edit.";
    $("areaEyebrow").textContent = region.zip ? "Your area · " + region.zip : "Your area";

    var bars = $("bars");
    bars.textContent = "";
    var nowLabel = bar(now);
    nowLabel.querySelector(".bar-label span").textContent = "Now";
    var scLabel = bar(scenario);
    scLabel.querySelector(".bar-label span").textContent = "Fewer adjustments and remakes";
    bars.appendChild(nowLabel);
    bars.appendChild(scLabel);

    var rows = $("rows");
    rows.textContent = "";
    addRow(rows, "#0A7C86", "Lost production", "Adjustment and remake chair time, priced at production per hour.", now.lostProduction, now.lostProduction / 12);
    addRow(rows, "#1D1D1F", "Staff wages", "Assistant time on that chair time, plus any hygienist hours you enter.", now.staffCost, now.staffCost / 12);
    addRow(rows, "#6E6E73", "Overhead", "The overhead percent applied to those same chair hours.", now.overheadBurn, now.overheadBurn / 12);
    addRow(rows, "#C7C7CC", "Lab remake fees", state.labFee > 0 ? "Your lab fee times remakes." : "Lab fee is $0 until you enter one. Assumption — enter your own.", now.labCost, now.labCost / 12);
    addRow(rows, "#3A3A3F", "Turnaround", "Temps, extra visits, and a carrying cost if you set a rate.", now.turnaroundCost, now.turnaroundCost / 12);
    addRow(rows, "transparent", "Total", "Staff wages are also inside the overhead line. See the note.", now.total, now.monthly);

    $("overlapNote").textContent = "If staff wages are left inside overhead and not added again, the annual estimate is " + money(now.withoutStaffOnTop) + ". The headline adds them on their own line, so payroll on these hours is counted twice. Queue of billings while cases are out: " + money(now.queueBillings) + ". That queue is not in the total" + (state.carryRatePct > 0 ? " except through the carrying rate (" + money(now.carryCost) + " a year)." : ".");

    $("buildFormula").textContent = fmt(now.unitsYear, 0) + " units a year. Adjustments " + fmt(now.adjustmentHours, 1) + " hours. Remakes " + fmt(now.remakesYear, 1) + " × " + fmt(state.remakeHours, 2) + " hours. Production " + money(state.productionPerHour) + "/hour. Overhead " + fmt(state.overheadPct, 2) + "%. Extra visits counted: " + fmt(now.visits, 2) + ".";

    $("nowTotal").textContent = money(now.total);
    $("scTotal").textContent = money(scenario.total);
    $("nowQueue").textContent = "Billings in the queue: " + money(now.queueBillings) + ". Not added to the loss. Extra visits counted: " + fmt(now.visits, 2) + ".";
    $("scQueue").textContent = "Billings in the queue: " + money(scenario.queueBillings) + ". Not added to the loss. Extra visits counted: " + fmt(scenario.visits, 2) + ".";
    var diff = now.total - scenario.total;
    $("outDiff").textContent = Math.round(diff) === 0
      ? "These two estimates match at the current inputs."
      : (diff > 0
        ? "About " + money(diff) + " less per year in this scenario."
        : "About " + money(-diff) + " more per year in this scenario.");

    $("deltaDollars").textContent = money(original.dollars);
    $("deltaHours").textContent = fmt(original.chairHours, 0);
    $("deltaRemakes").textContent = fmt(original.remakesAvoided, 0);
    $("deltaStaffHours").textContent = fmt(original.staffHoursYear, 0);
    $("deltaStaffCost").textContent = money(original.staffDollars);
    $("deltaMonth").textContent = "Every month, that gap is about " + money(original.monthly) + ".";
    $("deltaCtaText").textContent = original.dollars >= 1
      ? "Get back " + money(original.dollars) + "/yr — book a 30-min demo"
      : "Book a 30-min demo";
    $("deltaFormula").textContent = fmt(original.yearly, 0) + " units a year × (" + fmt(state.remakePct, 1) + "% − " + fmt(state.targetRemakePct, 1) + "% remakes) = " + fmt(original.remakesAvoided, 0) + " remakes × " + fmt(state.remakeHours, 2) + " chair hours, plus " + fmt(state.adjustMin, 0) + " − " + fmt(state.targetAdjustMin, 0) + " minutes per unit at " + money(state.productionPerHour) + "/hour, plus " + fmt(state.staffHrs, 2) + " − " + fmt(state.targetStaffHrs, 2) + " chasing hours a week at " + money(state.staffWage) + "/hour.";

    var mail = mailto(reportLines());
    ["navMail", "resultMail", "deltaMail"].forEach(function (id) {
      var node = $(id);
      if (node) node.href = mail;
    });
  }

  function reportLines(extra) {
    var now = lossNow();
    var scenario = lossScenario();
    var original = Model.originalComparison(state);
    var lines = [
      "Dental Practice Production/Revenue Loss Calculator",
      "",
      "ZIP: " + (region.zip || "(none)"),
      "Area: " + wageRecord().name,
      "",
      "Estimated annual loss: " + money(now.total),
      "Per month: " + money(now.monthly),
      "Lost production: " + money(now.lostProduction),
      "Staff wages: " + money(now.staffCost),
      "Overhead: " + money(now.overheadBurn),
      "Lab fees: " + money(now.labCost),
      "Turnaround: " + money(now.turnaroundCost),
      "If staff is left inside overhead: " + money(now.withoutStaffOnTop),
      "",
      "Scenario annual loss: " + money(scenario.total),
      "Scenario remake %: " + state.scenarioRemake,
      "Scenario adjustment min: " + state.scenarioAdjust,
      "Scenario turnaround days: " + state.scenarioTurnaround,
      "",
      "One-case comparison, chair + staff gap per year: " + money(original.dollars),
      "",
      "Units / month: " + state.units,
      "Remake %: " + state.remakePct,
      "Adjustment min: " + state.adjustMin,
      "Production per hour: " + state.productionPerHour,
      "Assistant wage: " + state.daWage,
      "Hygienist wage: " + state.hygWage,
      "Overhead %: " + state.overheadPct,
      "This is an estimate from the page’s sources and the numbers entered. It is not a quote."
    ];
    if (extra) lines.push("", extra);
    return lines.join("\r\n");
  }

  function mailto(body) {
    return "mailto:kristi.dillon@meetdandy.com?subject=" + encodeURIComponent("Dental Practice Production/Revenue Loss Calculator") + "&body=" + encodeURIComponent(body);
  }

  function onField(el) {
    var name = el.dataset.field;
    if (el.value === "" || el.value === "-" || el.value === "." || el.value === "-.") return;
    var n = num(el.value);
    if (!Number.isFinite(parseFloat(el.value))) return;
    if (name === "productionPerDay") {
      if (state.productionPerHour > 0) {
        state.hoursPerDay = n / state.productionPerHour;
        state.touched.hoursPerDay = true;
        sync("hoursPerDay");
      }
      paint();
      return;
    }
    if (name === "overheadPerHour") {
      if (state.productionPerHour > 0) {
        state.overheadPct = Math.round(n / state.productionPerHour * 10000) / 100;
        state.touched.overheadPct = true;
        sync("overheadPct");
      }
      paint();
      return;
    }
    state[name] = n;
    state.touched[name] = true;
    if ((name === "prepMin" || name === "seatMin") && state.remakeLinked) {
      state.remakeHours = Math.round((num(state.prepMin) + num(state.seatMin)) / 60 * 100) / 100;
      sync("remakeHours");
    }
    if (name === "remakeHours") state.remakeLinked = false;
    sync(name, el);
    paint();
  }

  function clamp(el) {
    var name = el.dataset.field;
    if (!name || el.type === "range" || name === "productionPerDay" || name === "overheadPerHour") return;
    if (el.value === "") {
      var fallback = el.min !== "" ? num(el.min) : 0;
      state[name] = fallback;
    } else {
      var n = num(el.value);
      if (el.min !== "" && n < num(el.min)) n = num(el.min);
      if (el.max !== "" && n > num(el.max)) n = num(el.max);
      state[name] = n;
    }
    sync(name);
    paint();
  }

  function fillStates() {
    var select = $("statePick");
    var us = document.createElement("option");
    us.value = "US";
    us.textContent = "U.S. average";
    select.appendChild(us);
    Object.keys(DATA.wages.states).sort(function (a, b) {
      return DATA.wages.states[a].name.localeCompare(DATA.wages.states[b].name);
    }).forEach(function (code) {
      var opt = document.createElement("option");
      opt.value = code;
      opt.textContent = DATA.wages.states[code].name;
      select.appendChild(opt);
    });
  }

  function status(message, bad) {
    var node = $("zipStatus");
    node.textContent = message;
    node.classList.toggle("bad", !!bad);
  }

  function goToResult() {
    $("result").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  }

  $("zip").addEventListener("input", function () {
    $("zip").value = $("zip").value.replace(/\D/g, "").slice(0, 5);
  });
  $("zipForm").addEventListener("submit", function (event) {
    event.preventDefault();
    var found = lookupZip($("zip").value);
    if (found.error) {
      status(found.error, true);
      if (found.unmatched) $("statePick").focus();
      return;
    }
    applyRegion(found.code, found.zip);
    var rec = wageRecord();
    status(found.via + " " + found.zip + " → " + rec.name + ". Wages are filled in. You can edit every figure.");
    goToResult();
  });
  $("statePick").addEventListener("change", function () {
    if (!$("statePick").value) return;
    applyRegion($("statePick").value, "");
    status(wageRecord().name + " wages are filled in. Production and overhead stay national.");
  });

  document.body.addEventListener("input", function (event) {
    if (event.target && event.target.dataset && event.target.dataset.field) onField(event.target);
  });
  document.body.addEventListener("focusout", function (event) {
    if (event.target && event.target.dataset && event.target.dataset.field) clamp(event.target);
  });

  $("useStudyRemake").addEventListener("click", function () {
    state.remakePct = DATA.studies.remakePct;
    state.touched.remakePct = true;
    sync("remakePct");
    paint();
  });
  $("useCrowns18").addEventListener("click", function () {
    state.units = DATA.studies.crownsPerMonth;
    state.touched.units = true;
    sync("units");
    paint();
  });
  $("useAdaMean").addEventListener("click", function () { setProduction(DATA.production.perHourMeanRounded, true); paint(); });
  $("useAdaMedian").addEventListener("click", function () { setProduction(DATA.production.perHourMedianRounded, true); paint(); });
  $("useFiveHundred").addEventListener("click", function () { setProduction(DATA.production.oneCaseStart, true); paint(); });
  $("usePrepSeat").addEventListener("click", function () {
    state.remakeLinked = true;
    state.remakeHours = Math.round((num(state.prepMin) + num(state.seatMin)) / 60 * 100) / 100;
    sync("remakeHours");
    paint();
  });

  $("reportForm").addEventListener("submit", function (event) {
    event.preventDefault();
    var extra = [
      "Name: " + $("reportName").value.trim(),
      "Email: " + $("reportEmail").value.trim(),
      "Practice: " + $("reportPractice").value.trim()
    ].join("\r\n");
    var draft = mailto(reportLines(extra));
    if (typeof window.__openMail === "function") window.__openMail(draft);
    else window.location.href = draft;
    $("reportStatus").textContent = "Your email draft should open now. Nothing was sent to a server.";
  });

  window.addEventListener("scroll", function () {
    var on = window.scrollY > 520 && window.innerWidth <= 720;
    $("sticky").classList.toggle("on", on);
    document.body.classList.toggle("has-sticky", on);
  }, { passive: true });

  fillStates();
  applyWages();
  syncAll();
  paint();

  var params = new URLSearchParams(window.location.search);
  if (params.get("zip")) {
    $("zip").value = params.get("zip").replace(/\D/g, "").slice(0, 5);
    $("zipForm").dispatchEvent(new Event("submit", { cancelable: true }));
  }
})();

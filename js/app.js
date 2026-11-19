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
    var national = wages.national;
    if (region.code === "US" || region.code === "MIL" || !wages.states[region.code]) {
      return {
        hygienist: national.hygienist,
        assistant: national.assistant,
        receptionist: national.receptionist,
        receptionistFromNational: region.code !== "US",
        teamHour: national.teamHour,
        teamPublished: true,
        national: true,
        name: region.code === "MIL" ? "U.S. military mail" : "the U.S."
      };
    }
    var st = wages.states[region.code];
    var fromNational = st.receptionist == null;
    var receptionist = fromNational ? national.receptionist : st.receptionist;
    return {
      hygienist: st.hygienist,
      assistant: st.assistant,
      receptionist: receptionist,
      receptionistFromNational: fromNational,
      teamHour: st.teamHour,
      teamPublished: st.teamHour != null,
      teamUsed: Math.round((st.hygienist + st.assistant + receptionist) * 100) / 100,
      national: false,
      name: st.name
    };
  }

  function applyWages() {
    var rec = wageRecord();
    state.daWage = rec.assistant;
    state.hygWage = rec.hygienist;
    state.receptionistWage = rec.receptionist;
    sync("daWage");
    sync("hygWage");
    sync("receptionistWage");
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
    if (digits.length !== 5) return { error: "Enter a 5-digit ZIP code." };
    var code = ZIPS.exact[digits];
    var via = "ZIP";
    if (!code && ZIPS.prefixUnanimous[digits.slice(0, 3)]) {
      code = ZIPS.prefixUnanimous[digits.slice(0, 3)];
      via = "ZIP prefix";
    }
    if (!code || code === "MIL" || !DATA.wages.states[code]) return { unmatched: true, zip: digits, error: "That ZIP code isn't in our state wage table. Check the number and try again." };
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
    if (region.code === "MIL" || (rec.national && region.code !== "US")) {
      return place + ". No state wage row is used, so the U.S. May 2024 means are filled in. " + prod;
    }
    if (rec.receptionistFromNational && !rec.national) {
      return place + " wages, BLS OEWS May 2024. Receptionist is n/a here; the U.S. dental-office mean is used. " + prod;
    }
    return place + " wages, BLS OEWS May 2024. " + prod;
  }

  function derivedUnits() {
    return Math.max(0, num(state.fixedCases)) + Math.max(0, num(state.removableCases));
  }
  function estimateNow() { return Model.scaledEstimate(state); }
  function estimateScenario() { return Model.scaledEstimate(Model.scenarioInput(state)); }

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
    name.textContent = "Estimate";
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
    year.textContent = monthly == null ? money(annual) : money(annual) + " / yr";
    nums.appendChild(year);
    if (monthly != null) {
      var month = document.createElement("span");
      month.textContent = money(monthly) + " / mo";
      nums.appendChild(month);
    }
    if (color) {
      var swatch = document.createElement("i");
      swatch.className = "swatch";
      swatch.style.background = color;
      row.appendChild(swatch);
    }
    row.appendChild(name);
    row.appendChild(nums);
    parent.appendChild(row);
  }

  function paintMoney(value) {
    var text = money(value);
    $("outAnnual").textContent = text;
    $("outMonth").textContent = money(value / 12);
    $("stickyAnnual").textContent = text;
  }
  function animateAnnual(target) {
    var el = $("outAnnual");
    var finish = function (value) {
      paintMoney(value);
      shownAnnual = value;
      $("liveTotal").textContent = "Estimated loss per year " + money(value) + ". " + $("outCrowns").textContent + " hours lost.";
    };
    if (reduced) { finish(target); return; }
    var start = shownAnnual, t0 = performance.now(), dur = 520;
    cancelAnimationFrame(el._raf);
    var tick = function (t) {
      var p = Math.min(1, (t - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      paintMoney(start + (target - start) * eased);
      if (p < 1) el._raf = requestAnimationFrame(tick);
      else finish(target);
    };
    el._raf = requestAnimationFrame(tick);
  }

  function paint() {
    if (!state.touched.units && document.activeElement !== $("units")) {
      state.units = derivedUnits();
      sync("units");
    }
    state.unitsTouched = !!state.touched.units;
    var est = estimateNow();
    var estSc = estimateScenario();
    var now = est.loss;
    var scenario = estSc.loss;
    var eq = Model.equivalents(now, state);
    var original = Model.originalComparison(state);
    var rec = wageRecord();

    $("outCrowns").textContent = fmt(est.hours, 1);
    var monthHours = est.hours / 12;
    var fullDays = monthHours / Math.max(1, num(state.hoursPerDay));
    $("outPace").textContent = "That's about " + fmt(monthHours, 1) + " chair hour" + (Math.abs(monthHours - 1) < 0.05 ? "" : "s") + " a month, or " + fmt(fullDays, 1) + " full day" + (Math.abs(fullDays - 1) < 0.05 ? "" : "s") + ".";
    $("wagePlace").textContent = rec.name;
    $("staffRate").textContent = wageText((num(rec.assistant) + num(rec.receptionist)) / 2);
    $("staffNote").textContent = rec.receptionistFromNational && !rec.national
      ? "Assistant wage for this state. Receptionist uses the U.S. mean. Wages only, before benefits."
      : "Assistant and receptionist average. Wages only, BLS May 2024, before benefits.";
    animateAnnual(Math.round(est.chairDollars) + Math.round(est.staffDollars) + Math.round(est.otherDollars));

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

    var place = rec.national ? "U.S. mean." : rec.name + " mean.";
    $("daMeta").textContent = place + " SOC 31-9091, official May 2024 cross-industry mean hourly wage. Benefits are not included.";
    $("hygMeta").textContent = place + " SOC 29-1292, official May 2024 cross-industry mean hourly wage. Benefits are not included.";
    $("recMeta").textContent = rec.receptionistFromNational && !rec.national
      ? "n/a for " + rec.name + " in the May 2024 Offices of Dentists research estimates. The U.S. mean " + wageText(DATA.wages.national.receptionist) + " is used."
      : "SOC 43-4171. " + (rec.national ? "Official national mean for Offices of Dentists, NAICS 621200." : "May 2024 research estimate for Offices of Dentists, NAICS 621200.") + " Benefits are not included.";
    $("teamLine").textContent = rec.teamPublished
      ? "Team/hr, one of each: " + wageText(rec.teamHour) + ". Wages only."
      : "Team/hr is n/a because the receptionist wage was not published. The estimate uses " + wageText(rec.teamUsed) + " (state hygienist + state assistant + U.S. receptionist).";

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
    var nowBar = {
      lostProduction: est.chairDollars,
      staffCost: est.staffDollars,
      overheadBurn: est.overheadDollars,
      labCost: est.loss.labCost,
      turnaroundCost: est.otherDollars - est.loss.labCost,
      total: est.total
    };
    var scBar = {
      lostProduction: estSc.chairDollars,
      staffCost: estSc.staffDollars,
      overheadBurn: estSc.overheadDollars,
      labCost: estSc.loss.labCost,
      turnaroundCost: estSc.otherDollars - estSc.loss.labCost,
      total: estSc.total
    };
    var nowLabel = bar(nowBar);
    nowLabel.querySelector(".bar-label span").textContent = "Now";
    var scLabel = bar(scBar);
    scLabel.querySelector(".bar-label span").textContent = "Fewer adjustments and remakes";
    bars.appendChild(nowLabel);
    bars.appendChild(scLabel);

    var rows = $("rows");
    rows.textContent = "";
    addRow(rows, "", "Chair time", "", est.chairDollars, null);
    addRow(rows, "", "Staff", "", est.staffDollars, null);
    if (est.otherDollars > 0) addRow(rows, "", "Lab, temps, and carrying cost", "", est.otherDollars, null);

    $("overlapNote").textContent = "Overhead is " + money(est.overheadDollars) + " of the lost production and is not added to the total. Queue of billings while cases are out: " + money(now.queueBillings) + ". That queue is not in the total" + (state.carryRatePct > 0 ? " except through the carrying rate (" + money(now.carryCost) + " a year)." : ".");

    $("buildFormula").textContent = fmt(now.unitsYear, 0) + " units a year. Adjustments " + fmt(now.adjustmentHours, 1) + " hours. Remakes " + fmt(now.remakesYear, 1) + " × " + fmt(state.remakeHours, 2) + " hours. Production " + money(state.productionPerHour) + "/hour. Overhead " + fmt(state.overheadPct, 2) + "%. Extra visits counted: " + fmt(now.visits, 2) + ".";

    $("nowTotal").textContent = money(est.total);
    $("scTotal").textContent = money(estSc.total);
    $("nowQueue").textContent = "Billings in the queue: " + money(now.queueBillings) + ". Not added to the loss. Extra visits counted: " + fmt(now.visits, 2) + ".";
    $("scQueue").textContent = "Billings in the queue: " + money(scenario.queueBillings) + ". Not added to the loss. Extra visits counted: " + fmt(scenario.visits, 2) + ".";
    var diff = est.total - estSc.total;
    $("outDiff").textContent = Math.round(diff) === 0
      ? "These two estimates match at the current inputs."
      : (diff > 0
        ? "About " + money(diff) + " less per year in this scenario."
        : "About " + money(-diff) + " more per year in this scenario.");
    $("nowProd").textContent = money(est.chairDollars);
    $("scProd").textContent = money(estSc.chairDollars);
    var barScale = Math.max(est.chairDollars, estSc.chairDollars, 1);
    $("barNow").style.width = (est.chairDollars / barScale * 100) + "%";
    $("barSc").style.width = (estSc.chairDollars / barScale * 100) + "%";

    $("deltaDollars").textContent = money(original.dollars);
    $("deltaHours").textContent = fmt(original.chairHours, 0);
    $("deltaRemakes").textContent = fmt(original.remakesAvoided, 0);
    $("deltaStaffHours").textContent = fmt(original.staffHoursYear, 0);
    $("deltaStaffCost").textContent = money(original.staffDollars);
    $("deltaMonth").textContent = "Every month, that gap is about " + money(original.monthly) + ".";
    $("deltaFormula").textContent = fmt(original.yearly, 0) + " units a year × (" + fmt(state.remakePct, 1) + "% − " + fmt(state.targetRemakePct, 1) + "% remakes) = " + fmt(original.remakesAvoided, 0) + " remakes × " + fmt(state.remakeHours, 2) + " chair hours, plus " + fmt(state.adjustMin, 0) + " − " + fmt(state.targetAdjustMin, 0) + " minutes per unit at " + money(state.productionPerHour) + "/hour, plus " + fmt(state.staffHrs, 2) + " − " + fmt(state.targetStaffHrs, 2) + " chasing hours a week at " + money(state.staffWage) + "/hour.";
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
    if (!select) return;
    var us = document.createElement("option");
    us.value = "US";
    us.textContent = "U.S. average";
    us.selected = true;
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

  function showScreen(which) {
    var gate = $("screen1");
    var app = $("screen2");
    var enter = which === 2 ? app : gate;
    var leave = which === 2 ? gate : app;
    if (reduced) {
      leave.hidden = true;
      enter.hidden = false;
      if (which === 1) $("zip").focus();
      else window.scrollTo(0, 0);
      return;
    }
    leave.classList.add("is-leaving");
    window.setTimeout(function () {
      leave.hidden = true;
      leave.classList.remove("is-leaving");
      enter.hidden = false;
      if (which === 1) $("zip").focus();
      else window.scrollTo(0, 0);
    }, 180);
  }

  function openFromZip(raw) {
    var digits = String(raw || "").replace(/\D/g, "").slice(0, 5);
    $("zip").value = digits;
    if (digits.length !== 5) {
      status("Enter a 5-digit ZIP code.", true);
      return false;
    }
    var found = lookupZip(digits);
    if (found.error) {
      status(found.error, true);
      return false;
    }
    applyRegion(found.code, found.zip);
    status("");
    showScreen(2);
    return true;
  }

  $("zip").addEventListener("input", function () {
    $("zip").value = $("zip").value.replace(/\D/g, "").slice(0, 5);
    status("");
  });
  $("continueZip").addEventListener("click", function () { openFromZip($("zip").value); });
  $("zip").addEventListener("keydown", function (event) {
    if (event.key === "Enter") { event.preventDefault(); openFromZip($("zip").value); }
  });
  $("changeZip").addEventListener("click", function () { showScreen(1); });

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

  document.body.addEventListener("click", function (event) {
    var btn = event.target.closest && event.target.closest(".step");
    if (!btn) return;
    var name = btn.getAttribute("data-step");
    var input = $(name);
    if (!input) return;
    var next = num(state[name]) + num(btn.getAttribute("data-dir"));
    if (input.min !== "" && next < num(input.min)) next = num(input.min);
    if (input.max !== "" && next > num(input.max)) next = num(input.max);
    state[name] = next;
    state.touched[name] = true;
    sync(name);
    paint();
  });

  function resultsPlain() {
    var rows = Array.prototype.map.call(document.querySelectorAll("#rows .break-row"), function (row) {
      return row.innerText.replace(/\s+/g, " ").trim();
    }).join("\n");
    return [
      "Dental Practice Production/Revenue Loss Calculator",
      "Estimated loss per year: " + $("outAnnual").textContent,
      "Per month: " + $("outMonth").textContent,
      "Hours lost: " + $("outCrowns").textContent,
      $("outPace").textContent,
      rows,
      "Production lost now: " + $("nowProd").textContent,
      "With fewer remakes: " + $("scProd").textContent
    ].join("\n");
  }
  function markCopied() { $("copyStatus").textContent = "Copied."; }
  $("copyResults").addEventListener("click", function () {
    var text = resultsPlain();
    var fallback = function () {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("aria-hidden", "true");
      document.body.appendChild(area);
      area.select();
      try { document.execCommand("copy"); markCopied(); }
      catch (err) { $("copyStatus").textContent = "Copy is unavailable in this browser."; }
      area.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(markCopied, fallback);
    else fallback();
  });
  $("printResults").addEventListener("click", function () { window.print(); });

  if ("IntersectionObserver" in window) {
    var stickyWatch = new IntersectionObserver(function (entries) {
      var entry = entries[0];
      var past = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      $("stickyTotal").classList.toggle("is-on", past);
    });
    stickyWatch.observe($("result"));
  }

  fillStates();
  applyWages();
  syncAll();
  paint();

  var params = new URLSearchParams(window.location.search);
  if (params.get("zip")) openFromZip(params.get("zip"));
})();

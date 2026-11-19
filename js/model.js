/* Practice-loss math.
   originalComparison is the one-case calculator, unchanged:
     yearly units × the gap in remake rate × chair hours per remake
     + yearly units × the gap in adjustment minutes / 60
     priced at production per hour
     + the gap in weekly chasing hours × 52 × chasing wage.
   annualLoss prices the current pace (not a gap):
     core chair hours = adjustment hours + remake chair hours
     lost production = core chair hours × production per hour
     staff = those hours × assistants per chair hour × assistant wage
            + remakes × hygienist hours per remake × hygienist wage
            + units × hygienist hours per seat × hygienist wage
     overhead = core chair hours × production per hour × overhead percent
     lab = remakes × lab fee per remake
     turnaround is per case, times yearly units:
       temp cost
       + extra visits, only when turnaround days are longer than the threshold
         (visit hours × production, assistant wage, hygienist wage, and overhead)
       + case billings × days / 365 × carrying rate
     case billings = production per hour × chair hours per remake
   Queue billings (units per month × days / 30 × case billings) are reported
   and are not added to the total. A carrying rate is what turns delay into a dollar cost.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LossModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function num(value) {
    var n = typeof value === "number" ? value : parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }

  function originalComparison(input) {
    var units = num(input.units);
    var rem = num(input.remakePct);
    var adj = num(input.adjustMin);
    var val = num(input.productionPerHour);
    var staffhrs = num(input.staffHrs);
    var staffwage = num(input.staffWage);
    var trem = num(input.targetRemakePct);
    var tadj = num(input.targetAdjustMin);
    var rh = num(input.remakeHours);
    var tstaffhrs = num(input.targetStaffHrs);
    var yearly = units * 12;
    var remakesAvoided = Math.max(0, yearly * (rem - trem) / 100);
    var adjHours = Math.max(0, yearly * (adj - tadj) / 60);
    var chairHours = remakesAvoided * rh + adjHours;
    var chairDollars = chairHours * val;
    var staffHoursYear = Math.max(0, (staffhrs - tstaffhrs) * 52);
    var staffDollars = staffHoursYear * staffwage;
    var dollars = chairDollars + staffDollars;
    return {
      yearly: yearly,
      remakesAvoided: remakesAvoided,
      adjHours: adjHours,
      chairHours: chairHours,
      chairDollars: chairDollars,
      staffHoursYear: staffHoursYear,
      staffDollars: staffDollars,
      dollars: dollars,
      monthly: dollars / 12
    };
  }

  function annualLoss(input) {
    var unitsMonth = Math.max(0, num(input.units));
    var unitsYear = unitsMonth * 12;
    var remakeRate = Math.max(0, num(input.remakePct)) / 100;
    var adjustMin = Math.max(0, num(input.adjustMin));
    var production = Math.max(0, num(input.productionPerHour));
    var daWage = Math.max(0, num(input.daWage));
    var hygWage = Math.max(0, num(input.hygWage));
    var recWage = Math.max(0, num(input.receptionistWage));
    var remakeHours = Math.max(0, num(input.remakeHours));
    var asstRatio = Math.max(0, num(input.assistantPerChairHour));
    var hygPerChair = Math.max(0, num(input.hygPerChairHour));
    var recPerChair = Math.max(0, num(input.receptionistPerChairHour));
    var hygPerRemake = Math.max(0, num(input.hygHoursPerRemake));
    var hygPerSeat = Math.max(0, num(input.hygHoursPerSeat));
    var overheadPct = Math.max(0, num(input.overheadPct)) / 100;
    var labFee = Math.max(0, num(input.labFee));
    var turnaroundDays = Math.max(0, num(input.turnaroundDays));
    var tempCost = Math.max(0, num(input.tempCost));
    var extraVisitsAsked = Math.max(0, num(input.extraVisits));
    var extraAfter = Math.max(0, num(input.extraVisitAfterDays));
    var extraMin = Math.max(0, num(input.extraVisitMin));
    var hygPerExtra = Math.max(0, num(input.hygHoursPerExtraVisit));
    var carryRate = Math.max(0, num(input.carryRatePct)) / 100;

    var remakesYear = unitsYear * remakeRate;
    var adjustmentHours = unitsYear * adjustMin / 60;
    var remakeChairHours = remakesYear * remakeHours;
    var coreChairHours = adjustmentHours + remakeChairHours;
    var overheadPerHour = production * overheadPct;

    var lostProduction = coreChairHours * production;
    var assistantHours = coreChairHours * asstRatio;
    var hygienistHours = coreChairHours * hygPerChair + remakesYear * hygPerRemake + unitsYear * hygPerSeat;
    var receptionistHours = coreChairHours * recPerChair;
    var staffCost = assistantHours * daWage + hygienistHours * hygWage + receptionistHours * recWage;
    var overheadBurn = coreChairHours * overheadPerHour;
    var labCost = remakesYear * labFee;

    var visits = turnaroundDays > extraAfter ? extraVisitsAsked : 0;
    var visitHours = extraMin / 60;
    var visitProductionEach = visits * visitHours * production;
    var visitStaffEach = visits * (visitHours * asstRatio * daWage + visitHours * hygPerChair * hygWage + visitHours * recPerChair * recWage + hygPerExtra * hygWage);
    var visitOverheadEach = visits * visitHours * overheadPerHour;
    var carryEach = production * remakeHours * (turnaroundDays / 365) * carryRate;
    var turnaroundEach = tempCost + visitProductionEach + visitStaffEach + visitOverheadEach + carryEach;
    var turnaroundCost = unitsYear * turnaroundEach;

    var total = lostProduction + staffCost + overheadBurn + labCost + turnaroundCost;
    var queueBillings = unitsMonth * (turnaroundDays / 30) * production * remakeHours;

    return {
      unitsYear: unitsYear,
      remakesYear: remakesYear,
      adjustmentHours: adjustmentHours,
      remakeChairHours: remakeChairHours,
      coreChairHours: coreChairHours,
      overheadPerHour: overheadPerHour,
      lostProduction: lostProduction,
      staffCost: staffCost,
      assistantHours: assistantHours,
      hygienistHours: hygienistHours,
      receptionistHours: receptionistHours,
      overheadBurn: overheadBurn,
      labCost: labCost,
      visits: visits,
      visitHoursEach: visits * visitHours,
      tempCost: unitsYear * tempCost,
      visitProduction: unitsYear * visitProductionEach,
      visitStaff: unitsYear * visitStaffEach,
      visitOverhead: unitsYear * visitOverheadEach,
      carryCost: unitsYear * carryEach,
      turnaroundCost: turnaroundCost,
      queueBillings: queueBillings,
      total: total,
      monthly: total / 12,
      withoutStaffOnTop: total - staffCost
    };
  }

  function equivalents(loss, input) {
    var hoursPerDay = Math.max(0, num(input.hoursPerDay));
    var officeHours = Math.max(0, num(input.officeHoursYear));
    var officeDays = hoursPerDay > 0 ? officeHours / hoursPerDay : 0;
    var remakeHours = Math.max(0, num(input.remakeHours));
    return {
      monthly: loss.total / 12,
      perOfficeDay: officeDays > 0 ? loss.total / officeDays : 0,
      officeDays: officeDays,
      crownsOfChairTime: remakeHours > 0 ? loss.coreChairHours / remakeHours : 0,
      perCase: loss.unitsYear > 0 ? loss.total / loss.unitsYear : 0
    };
  }

  function scaledEstimate(input) {
    var operatories = Math.max(0, num(input.operatories));
    var staffSize = Math.max(0, num(input.staffSize));
    var providers = Math.max(0, num(input.providers));
    var fixedMonth = Math.max(0, num(input.fixedCases));
    var removableMonth = Math.max(0, num(input.removableCases));
    var casesMonth = fixedMonth + removableMonth;
    var remakesMonth = Math.max(0, num(input.remakesPerMonth));
    var fixedAdj = Math.max(0, num(input.fixedAdjustMin != null ? input.fixedAdjustMin : input.adjustMin));
    var removableAdj = Math.max(0, num(input.removableAdjustMin));
    var fixedRh = Math.max(0, num(input.fixedRemakeHours != null ? input.fixedRemakeHours : input.remakeHours));
    var removableRh = Math.max(0, num(input.removableRemakeHours));
    var fixedShare = casesMonth > 0 ? fixedMonth / casesMonth : 1;
    var fixedRemakesYear = remakesMonth * 12 * fixedShare;
    var removableRemakesYear = remakesMonth * 12 * (1 - fixedShare);
    var adjustmentHours = fixedMonth * 12 * fixedAdj / 60 + removableMonth * 12 * removableAdj / 60;
    var remakeChairHours = fixedRemakesYear * fixedRh + removableRemakesYear * removableRh;
    var coreChairHours = adjustmentHours + remakeChairHours;
    var production = Math.max(0, num(input.productionPerHour));
    var turnaroundDays = Math.max(0, num(input.turnaroundDays));
    var extraAfter = Math.max(0, num(input.extraVisitAfterDays));
    var visits = turnaroundDays > extraAfter ? Math.max(0, num(input.extraVisits)) : 0;
    var visitHours = casesMonth * 12 * visits * Math.max(0, num(input.extraVisitMin)) / 60;
    var hours = coreChairHours + visitHours;
    var chairDollars = hours * production;
    var blended = (Math.max(0, num(input.daWage)) + Math.max(0, num(input.receptionistWage))) / 2;
    var ratioSum = Math.max(0, num(input.assistantPerChairHour)) + Math.max(0, num(input.hygPerChairHour)) + Math.max(0, num(input.receptionistPerChairHour));
    var staffFactor = ratioSum / 3;
    var staffHours = operatories > 0 ? hours * (staffSize / operatories) * staffFactor : 0;
    var staffDollars = staffHours * blended;
    var overheadDollars = chairDollars * Math.max(0, num(input.overheadPct)) / 100;
    var casesYear = casesMonth * 12;
    var remakesYear = fixedRemakesYear + removableRemakesYear;
    var labCost = remakesYear * Math.max(0, num(input.labFee));
    var tempCost = casesYear * Math.max(0, num(input.tempCost));
    var blendedRh = casesMonth > 0 ? (fixedMonth * fixedRh + removableMonth * removableRh) / casesMonth : fixedRh;
    var carryCost = casesYear * production * blendedRh * (turnaroundDays / 365) * Math.max(0, num(input.carryRatePct)) / 100;
    var otherDollars = labCost + tempCost + carryCost;
    var total = chairDollars + staffDollars + otherDollars;
    var queueBillings = casesMonth * (turnaroundDays / 30) * production * blendedRh;
    return {
      units: casesMonth,
      chairs: Math.min(providers, operatories),
      hours: hours,
      monthHours: hours / 12,
      chairDollars: chairDollars,
      staffHours: staffHours,
      staffDollars: staffDollars,
      blended: blended,
      overheadDollars: overheadDollars,
      otherDollars: otherDollars,
      total: total,
      monthly: total / 12,
      loss: {
        unitsYear: casesYear,
        remakesYear: remakesYear,
        adjustmentHours: adjustmentHours,
        remakeChairHours: remakeChairHours,
        coreChairHours: coreChairHours,
        visits: visits,
        labCost: labCost,
        tempCost: tempCost,
        carryCost: carryCost,
        queueBillings: queueBillings
      }
    };
  }

  function scenarioInput(input) {
    var fewerRemakes = input.scenarioRemakes != null ? input.scenarioRemakes : input.remakesPerMonth;
    return Object.assign({}, input, {
      remakePct: input.scenarioRemake,
      adjustMin: input.scenarioAdjust,
      fixedAdjustMin: input.scenarioAdjust,
      removableAdjustMin: input.scenarioAdjust,
      remakesPerMonth: fewerRemakes,
      turnaroundDays: input.scenarioTurnaround
    });
  }

  return {
    originalComparison: originalComparison,
    annualLoss: annualLoss,
    equivalents: equivalents,
    scaledEstimate: scaledEstimate,
    scenarioInput: scenarioInput
  };
});

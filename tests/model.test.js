const assert = require("assert");
const { originalComparison, annualLoss, equivalents, scenarioInput } = require("../js/model.js");

const base = {
  units: 25,
  remakePct: 8,
  adjustMin: 15,
  productionPerHour: 500,
  staffHrs: 4,
  staffWage: 28,
  targetRemakePct: 2,
  targetAdjustMin: 5,
  remakeHours: 1.5,
  targetStaffHrs: 0.5,
  daWage: 24.13,
  hygWage: 47.59,
  assistantPerChairHour: 1,
  hygHoursPerRemake: 0,
  hygHoursPerSeat: 0,
  hygHoursPerExtraVisit: 0,
  overheadPct: 57.62,
  labFee: 0,
  turnaroundDays: 14,
  tempCost: 0,
  extraVisits: 1,
  extraVisitAfterDays: 7,
  extraVisitMin: 20,
  carryRatePct: 0,
  hoursPerDay: 8,
  officeHoursYear: 1726,
  scenarioRemake: 2,
  scenarioAdjust: 5,
  scenarioTurnaround: 7
};

const original = originalComparison(base);
assert.strictEqual(original.yearly, 300);
assert.strictEqual(original.remakesAvoided, 18);
assert.strictEqual(original.adjHours, 50);
assert.strictEqual(original.chairHours, 77);
assert.strictEqual(original.chairDollars, 38500);
assert.strictEqual(original.staffHoursYear, 182);
assert.strictEqual(original.staffDollars, 5096);
assert.strictEqual(original.dollars, 43596);
assert.strictEqual(original.monthly, 43596 / 12);

const noGap = originalComparison(Object.assign({}, base, {
  targetRemakePct: 20,
  targetAdjustMin: 40,
  targetStaffHrs: 10
}));
assert.strictEqual(noGap.dollars, 0);

const loss = annualLoss(base);
assert.strictEqual(loss.unitsYear, 300);
assert.strictEqual(loss.remakesYear, 24);
assert.strictEqual(loss.adjustmentHours, 75);
assert.strictEqual(loss.remakeChairHours, 36);
assert.strictEqual(loss.coreChairHours, 111);
assert.strictEqual(loss.lostProduction, 55500);
assert.ok(Math.abs(loss.staffCost - 111 * 24.13) < 1e-9);
assert.ok(Math.abs(loss.overheadPerHour - 500 * 0.5762) < 1e-9);
assert.ok(Math.abs(loss.overheadBurn - 111 * 500 * 0.5762) < 1e-6);
assert.strictEqual(loss.labCost, 0);
assert.strictEqual(loss.visits, 1);
assert.strictEqual(loss.carryCost, 0);
assert.ok(loss.queueBillings > 0);
const visitHours = 20 / 60;
const overheadPerHour = 500 * 0.5762;
const turnaroundExpected = 300 * visitHours * (500 + 24.13 + overheadPerHour);
assert.ok(Math.abs(loss.turnaroundCost - turnaroundExpected) < 1e-6);
assert.ok(Math.abs(loss.total - (loss.lostProduction + loss.staffCost + loss.overheadBurn + loss.labCost + loss.turnaroundCost)) < 1e-6);
assert.ok(Math.abs(loss.withoutStaffOnTop - (loss.total - loss.staffCost)) < 1e-6);

const quiet = annualLoss(Object.assign({}, base, { extraVisits: 0, tempCost: 0, carryRatePct: 0 }));
const quietLonger = annualLoss(Object.assign({}, base, { extraVisits: 0, tempCost: 0, carryRatePct: 0, turnaroundDays: 30 }));
assert.strictEqual(quiet.turnaroundCost, 0);
assert.strictEqual(quietLonger.turnaroundCost, 0);
assert.ok(quietLonger.queueBillings > quiet.queueBillings);

const atThreshold = annualLoss(Object.assign({}, base, { turnaroundDays: 7 }));
assert.strictEqual(atThreshold.visits, 0);
assert.strictEqual(atThreshold.turnaroundCost, 0);

const withFee = annualLoss(Object.assign({}, base, { labFee: 100, extraVisits: 0 }));
assert.strictEqual(withFee.labCost, 24 * 100);

const withHyg = annualLoss(Object.assign({}, base, { hygHoursPerRemake: 0.5, extraVisits: 0 }));
assert.ok(Math.abs(withHyg.staffCost - (111 * 24.13 + 24 * 0.5 * 47.59)) < 1e-6);

const scenario = annualLoss(scenarioInput(base));
assert.ok(scenario.total < loss.total);
assert.strictEqual(scenario.visits, 0);

const eq = equivalents(loss, base);
assert.strictEqual(eq.officeDays, 1726 / 8);
assert.ok(Math.abs(eq.perOfficeDay - loss.total / (1726 / 8)) < 1e-6);
assert.ok(Math.abs(eq.crownsOfChairTime - 111 / 1.5) < 1e-9);

console.log("model tests passed");

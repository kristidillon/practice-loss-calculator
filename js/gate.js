(function () {
  var zip = document.getElementById("zip");
  var status = document.getElementById("zipStatus");
  var form = document.getElementById("zipForm");
  var params = new URLSearchParams(window.location.search);
  var seeded = (params.get("zip") || "").replace(/\D/g, "").slice(0, 5);
  if (seeded) zip.value = seeded;
  if (params.get("invalid") === "1") {
    status.textContent = seeded.length === 5
      ? "That ZIP code isn't in our state wage table. Check the number and try again."
      : "Enter a 5-digit ZIP code.";
  }
  if (window.matchMedia("(min-width: 800px)").matches) zip.focus();

  function digitsOf(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 5);
  }
  function lookup(digits) {
    var data = window.ZIP_DATA;
    var wages = window.PRACTICE_DATA && window.PRACTICE_DATA.wages;
    if (!data || !wages) return null;
    var code = data.exact[digits];
    if (!code && data.prefixUnanimous[digits.slice(0, 3)]) code = data.prefixUnanimous[digits.slice(0, 3)];
    if (!code || code === "MIL" || !wages.states[code]) return null;
    return code;
  }

  zip.addEventListener("input", function () {
    zip.value = digitsOf(zip.value);
    status.textContent = "";
  });
  form.addEventListener("submit", function (event) {
    var digits = digitsOf(zip.value);
    zip.value = digits;
    if (digits.length !== 5) {
      event.preventDefault();
      status.textContent = "Enter a 5-digit ZIP code.";
      zip.focus();
      return;
    }
    if (!lookup(digits)) {
      event.preventDefault();
      status.textContent = "That ZIP code isn't in our state wage table. Check the number and try again.";
      zip.focus();
      return;
    }
    event.preventDefault();
    window.location.href = "calculator.html?zip=" + digits;
  });
})();

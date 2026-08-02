window.loadTestData = function () {
  window.importData({
    nextEmployeeId: 3,
    employeur: "Boulangerie Tremblay Inc.",
    employeurAdresse: "1234 rue Saint-Laurent, Montréal QC H2X 2T1",
    employeurLogo: "https://www.svgrepo.com/show/303106/mcdonald-s-15-logo.svg",
    employeurTel: "514-555-0101",
    employeurEmail: "info@tremblay.ca",
    employeurWeb: "https://tremblay.ca",
    tauxFSS: "1.65",
    tauxCNESST: "1.20",
    revenusTypes: ["Prime de nuit", "Prime de fin de semaine", "Indemnité de transport"],
    retenuesTypes: ["Assurance collective", "REER", "Cotisation syndicale"],
    postesTypes: ["Boulangère", "Boulanger", "Caissier", "Caissière", "Pâtissier", "Livreur"],
    frequence: "bihebdomadaire",
    periodeNum: "14",
    datePaiement: "2026-07-17",
    employees: [
      {
        id: "1", nom: "Marie-Claire Gagnon", poste: "Boulangère", dateNaissance: "1988-03-15",
        adresse: "567 av. du Parc, Montréal QC H2V 4E7", telephone: "514-555-0202", email: "marie@gmail.com",
        nas: "123-456-789", taux: "28.50", pourboire: "non", tauxSup: "1.5",
        periods: {
          "13": { heuresReg: "80", heuresSup: "0", brut: "2280.00", impotCa: "172.15", impotQc: "184.90", rrq: "135.16", ae: "29.64", rqap: "9.80", rrqEmp: "135.16", aeEmp: "41.50", rqapEmp: "13.73", fss: "37.62", cnesst: "27.36", pourboires: "0", revenusExtras: [], retenuesExtras: [{ nom: "Assurance collective", montant: "45.00" }] },
          "14": { heuresReg: "80", heuresSup: "4", brut: "2280.00", impotCa: "172.15", impotQc: "184.90", rrq: "135.16", ae: "29.64", rqap: "9.80", rrqEmp: "135.16", aeEmp: "41.50", rqapEmp: "13.73", fss: "37.62", cnesst: "27.36", pourboires: "0", revenusExtras: [{ nom: "Prime de nuit", montant: "75.00" }], retenuesExtras: [{ nom: "Assurance collective", montant: "45.00" }] }
        }
      },
      {
        id: "2", nom: "Jean-François Lavoie", poste: "Caissier", dateNaissance: "2001-11-22",
        adresse: "890 boul. René-Lévesque, Québec QC G1R 2B5", telephone: "418-555-0303", email: "jf.lavoie@outlook.com",
        nas: "987-654-321", taux: "17.75", pourboire: "oui", tauxSup: "1.5",
        periods: {
          "14": { heuresReg: "70", heuresSup: "0", brut: "1242.50", impotCa: "60.61", impotQc: "51.31", rrq: "69.80", ae: "16.15", rqap: "5.34", rrqEmp: "69.80", aeEmp: "22.61", rqapEmp: "7.48", fss: "20.50", cnesst: "14.91", pourboires: "125.00", revenusExtras: [], retenuesExtras: [] }
        }
      }
    ]
  });
  console.log("Données de test chargées.");
};


// ═══════════════════════════════════════════════════════════════════════════
// Automated tests — run with: runTests() in the browser console
// ═══════════════════════════════════════════════════════════════════════════

window.runTests = function () {
  var passed = 0;
  var failed = 0;
  var errors = [];

  function assert(name, actual, expected) {
    if (Math.abs(actual - expected) < 0.005) {
      passed++;
    } else {
      failed++;
      errors.push(name + ": got " + actual + ", expected " + expected);
    }
  }

  function assertEq(name, actual, expected) {
    if (actual === expected) {
      passed++;
    } else {
      failed++;
      errors.push(name + ": got " + JSON.stringify(actual) + ", expected " + JSON.stringify(expected));
    }
  }

  // ─── RQAP ─────────────────────────────────────────────────────────────────

  (function () {
    var r = QC.calculerRQAP({ salaireBrut: 2280, frequence: "bihebdomadaire", cumulBrutAnnuel: 0 });
    assert("RQAP employee basic", r.employe, 9.80);
    assert("RQAP employer basic", r.employeur, 13.73);
  })();

  (function () {
    var r = QC.calculerRQAP({ salaireBrut: 2000, frequence: "bihebdomadaire", cumulBrutAnnuel: 102000 });
    // Only 1000 remains assurable (103000 - 102000)
    assert("RQAP employee near cap", r.employe, +(1000 * 0.00430).toFixed(2));
    assert("RQAP employer near cap", r.employeur, +(1000 * 0.00602).toFixed(2));
  })();

  (function () {
    var r = QC.calculerRQAP({ salaireBrut: 2000, frequence: "bihebdomadaire", cumulBrutAnnuel: 104000 });
    assert("RQAP employee past cap", r.employe, 0);
    assert("RQAP employer past cap", r.employeur, 0);
  })();

  // ─── AE ────────────────────────────────────────────────────────────────────

  (function () {
    var r = QC.calculerAE({ salaireBrut: 2280, frequence: "bihebdomadaire", cumulBrutAnnuel: 0 });
    assert("AE employee basic", r.employe, +(2280 * 0.013).toFixed(2));
    assert("AE employer basic", r.employeur, +(2280 * 0.0182).toFixed(2));
  })();

  (function () {
    var r = QC.calculerAE({ salaireBrut: 3000, frequence: "bihebdomadaire", cumulBrutAnnuel: 67000 });
    // Only 1900 remains (68900 - 67000)
    assert("AE employee near cap", r.employe, +(1900 * 0.013).toFixed(2));
    assert("AE employer near cap", r.employeur, +(1900 * 0.0182).toFixed(2));
  })();

  (function () {
    var r = QC.calculerAE({ salaireBrut: 1000, frequence: "bihebdomadaire", cumulBrutAnnuel: 70000 });
    assert("AE employee past cap", r.employe, 0);
    assert("AE employer past cap", r.employeur, 0);
  })();

  // ─── RRQ ───────────────────────────────────────────────────────────────────

  (function () {
    // Basic case: biweekly, no cumul
    var r = QC.calculerRRQ({ salaireBrut: 2280, frequence: "bihebdomadaire", cumulBrutAnnuel: 0 });
    var exemption = 3500 / 26;
    var cotisable = 2280 - exemption;
    assert("RRQ employee basic", r.employe, +(cotisable * 0.063).toFixed(2));
    assert("RRQ employer basic", r.employeur, r.employe);
  })();

  (function () {
    // Near MGA: cumul=73000, brut=3000. Total reaches 76000 > MGA(74600)
    var r = QC.calculerRRQ({ salaireBrut: 3000, frequence: "bihebdomadaire", cumulBrutAnnuel: 73000 });
    var exemption = 3500 / 26;
    var brutApresExemption = 3000 - exemption;
    // RRQ1: cumul cotisable = min(73000,74600)-3500 = 69500. Reste = 71100-69500 = 1600
    var resteRRQ1 = 71100 - (73000 - 3500);
    var cotisableRRQ1 = Math.min(brutApresExemption, resteRRQ1);
    var rrq1 = cotisableRRQ1 * 0.063;
    // RRQ2: cumul above MGA = max(0, min(73000,85000)-74600) = 0. brutAuDessusMGA = 3000 - (74600-73000) = 1400
    var brutAuDessusMGA = 3000 - (74600 - 73000);
    var rrq2 = brutAuDessusMGA * 0.04;
    assert("RRQ employee near MGA (RRQ1+RRQ2)", r.employe, +((rrq1 + rrq2).toFixed(2)));
  })();

  (function () {
    // Past MGAP: no cotisation
    var r = QC.calculerRRQ({ salaireBrut: 3000, frequence: "bihebdomadaire", cumulBrutAnnuel: 86000 });
    assert("RRQ employee past MGAP", r.employe, 0);
  })();

  (function () {
    // Weekly frequency
    var r = QC.calculerRRQ({ salaireBrut: 1000, frequence: "hebdomadaire", cumulBrutAnnuel: 0 });
    var exemption = 3500 / 52;
    var cotisable = 1000 - exemption;
    assert("RRQ employee weekly", r.employe, +(cotisable * 0.063).toFixed(2));
  })();

  // ─── FSS ───────────────────────────────────────────────────────────────────

  (function () {
    var r = QC.calculerFSS({ salaireBrut: 2280, tauxFSS: "1.65" });
    assert("FSS employer", r.employeur, +(2280 * 0.0165).toFixed(2));
  })();

  (function () {
    var r = QC.calculerFSS({ salaireBrut: 2280, tauxFSS: "" });
    assert("FSS no rate", r.employeur, 0);
  })();

  // ─── CNESST ────────────────────────────────────────────────────────────────

  (function () {
    var r = QC.calculerCNESST({ salaireBrut: 2280, tauxCNESST: "1.20" });
    assert("CNESST employer", r.employeur, +(2280 * 0.012).toFixed(2));
  })();

  (function () {
    var r = QC.calculerCNESST({ salaireBrut: 2280, tauxCNESST: "0" });
    assert("CNESST zero rate", r.employeur, 0);
  })();

  // ─── Impôt fédéral ─────────────────────────────────────────────────────────

  (function () {
    // Basic case: biweekly 2280, no deductions, default credit
    var r = QC.calculerImpotFederal({ salaireBrut: 2280, frequence: "bihebdomadaire", cotisationRRQ: 0, cotisationAE: 0, cotisationRQAP: 0 });
    // Annualized: 2280*26 = 59280. Taxable = 59280.
    // Bracket 1: 58523 × 14% = 8193.22. Bracket 2: 757 × 20.5% = 155.19. Total brut = 8348.41
    // Credit: 16452 × 14% = 2303.28. After credit: 6045.13
    // Abattement QC: 6045.13 × 16.5% = 997.45. After: 5047.68
    // Per period: 5047.68/26 = 194.14
    assert("Fed tax basic", r.impot, 194.14);
  })();

  (function () {
    // With deductions
    var r = QC.calculerImpotFederal({ salaireBrut: 2280, frequence: "bihebdomadaire", cotisationRRQ: 135, cotisationAE: 29.64, cotisationRQAP: 9.80 });
    // Annualized income: 59280. Deductions annualized: (135+29.64+9.80)*26 = 4535.44
    // Taxable: 59280 - 4535.44 = 54744.56. All in first bracket (< 58523)
    // Brut: 54744.56 × 14% = 7664.24. Credit: 2303.28. After: 5360.96
    // Abattement: 5360.96 × 16.5% = 884.56. After: 4476.40. Per period: 172.17
    assert("Fed tax with deductions", r.impot, 172.17);
  })();

  (function () {
    // Zero salary
    var r = QC.calculerImpotFederal({ salaireBrut: 0, frequence: "bihebdomadaire" });
    assert("Fed tax zero", r.impot, 0);
  })();

  (function () {
    // Custom credit
    var r = QC.calculerImpotFederal({ salaireBrut: 2280, frequence: "bihebdomadaire", creditPersonnel: 20000 });
    // Same as basic but credit = 20000 × 14% = 2800. Brut = 8348.41. After credit: 5548.41
    // Abattement: 5548.41 × 16.5% = 915.49. After: 4632.92. Per period: 178.19
    assert("Fed tax custom credit", r.impot, 178.19);
  })();

  // ─── Impôt provincial ──────────────────────────────────────────────────────

  (function () {
    var r = QC.calculerImpotProvincial({ salaireBrut: 2280, frequence: "bihebdomadaire", cotisationRRQ: 0, cotisationAE: 0, cotisationRQAP: 0 });
    // Annualized: 59280. Deduction travailleur: min(1450, 59280*0.06=3556.80) = 1450
    // Taxable: 59280 - 1450 = 57830
    // Bracket 1: 54345 × 14% = 7608.30. Bracket 2: 3485 × 19% = 662.15. Total: 8270.45
    // Credit: 18952 × 14% = 2653.28. After: 5617.17. Per period: 216.05
    assert("QC tax basic", r.impot, 216.05);
  })();

  (function () {
    var r = QC.calculerImpotProvincial({ salaireBrut: 2280, frequence: "bihebdomadaire", cotisationRRQ: 135, cotisationAE: 29.64, cotisationRQAP: 9.80 });
    // Annualized: 59280. Cotisations: 4535.44. Ded travailleur: 1450. Total ded: 5985.44
    // Taxable: 59280 - 5985.44 = 53294.56. All in bracket 1 (< 54345)
    // Brut: 53294.56 × 14% = 7461.24. Credit: 2653.28. After: 4807.96. Per period: 184.92
    assert("QC tax with deductions", r.impot, 184.92);
  })();

  // ─── Utility functions ─────────────────────────────────────────────────────

  (function () {
    assertEq("fmt zero", QC.fmt(0), "0.00");
    assertEq("fmt round", QC.fmt(1.999), "2.00");
    assertEq("fmt null", QC.fmt(null), "0.00");
  })();

  (function () {
    assertEq("esc html", QC.esc('<b>"hi"</b>'), '&lt;b&gt;&quot;hi&quot;&lt;/b&gt;');
    assertEq("esc null", QC.esc(null), "");
  })();

  (function () {
    assertEq("maskNas full", QC.maskNas("123-456-789"), "***-***-789");
    assertEq("maskNas no dash", QC.maskNas("123456789"), "***-***-789");
    assertEq("maskNas empty", QC.maskNas(""), "");
  })();

  // ─── YTD ───────────────────────────────────────────────────────────────────

  (function () {
    var emp = {
      periods: {
        "1": { brut: "1000", impotCa: "100", impotQc: "110", rrq: "50", ae: "13", rqap: "4", rrqEmp: "50", aeEmp: "18", rqapEmp: "6", fss: "16", cnesst: "12", pourboires: "0", revenusExtras: [{ nom: "Prime", montant: "50" }], retenuesExtras: [{ nom: "REER", montant: "25" }] },
        "2": { brut: "1200", impotCa: "120", impotQc: "130", rrq: "60", ae: "15", rqap: "5", rrqEmp: "60", aeEmp: "21", rqapEmp: "7", fss: "20", cnesst: "14", pourboires: "10", revenusExtras: [], retenuesExtras: [] }
      }
    };
    var ytd = QC.computeYTD(emp, 2);
    assert("YTD brut", ytd.brut, 2200);
    assert("YTD impotCa", ytd.impotCa, 220);
    assert("YTD rrq", ytd.rrq, 110);
    assert("YTD pourboires", ytd.pourboires, 10);
    assert("YTD extrasRev", ytd.extrasRev, 50);
    assert("YTD extrasRet", ytd.extrasRet, 25);

    var extraYTD = QC.computeExtraYTD(emp, "revenusExtras", "Prime", 2);
    assert("ExtraYTD Prime", extraYTD, 50);
  })();

  (function () {
    var emp = { periods: { "3": { brut: "500" } } };
    var cumul = QC.cumulBrutEmploye(emp, 3);
    assert("cumulBrut excludes current", cumul, 0);
  })();

  (function () {
    var emp = { periods: { "1": { brut: "1000" }, "2": { brut: "1500" }, "3": { brut: "800" } } };
    var cumul = QC.cumulBrutEmploye(emp, 3);
    assert("cumulBrut sums prior", cumul, 2500);
  })();

  // ─── Constants sanity checks ───────────────────────────────────────────────

  (function () {
    assert("RRQ max RRQ1", QC.RRQ.cotisationMaxRRQ1, (QC.RRQ.mga - QC.RRQ.exemptionBase) * QC.RRQ.tauxRRQ1);
    assert("RRQ max RRQ2", QC.RRQ.cotisationMaxRRQ2, (QC.RRQ.mgap - QC.RRQ.mga) * QC.RRQ.tauxRRQ2);
    assert("RQAP max employee", QC.RQAP.cotisationMaxEmploye, QC.RQAP.revenusAssurableMax * QC.RQAP.tauxEmploye);
    assert("RQAP max employer", QC.RQAP.cotisationMaxEmployeur, QC.RQAP.revenusAssurableMax * QC.RQAP.tauxEmployeur);
    assert("AE max employee", QC.AE.cotisationMaxEmploye, QC.AE.revenusAssurableMax * QC.AE.tauxEmploye);
    assert("AE max employer", QC.AE.cotisationMaxEmployeur, QC.AE.revenusAssurableMax * QC.AE.tauxEmployeur);
  })();

  // ─── Results ───────────────────────────────────────────────────────────────

  console.log("Tests: " + passed + " passed, " + failed + " failed.");
  if (failed > 0) {
    errors.forEach(function (e) { console.error("  FAIL: " + e); });
  }
  return { passed: passed, failed: failed, errors: errors };
};

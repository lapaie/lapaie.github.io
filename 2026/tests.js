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
//
// Examples marked "guide QC" come from the Revenu Québec publication:
// TP-1015.G (2026-01) — Guide de l'employeur — Retenues à la source et cotisations
// https://www.revenuquebec.ca/documents/fr/formulaires/tp/TP-1015.G%282026-01%29.pdf
//
// Examples marked "guide CA" come from the CRA publication:
// T4001 — Guide de l'employeur — Les retenues sur la paie et les versements
// https://www.canada.ca/fr/agence-revenu/services/formulaires-publications/publications/t4001/guide-employeur-retenues-paie-versements.html
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

  (function () {
    // Discontinu hourly: exemption = 1.75 * hours
    // Example: 40 hours at $25/h = $1000 gross, exemption = 1.75*40 = $70
    var r = QC.calculerRRQ({ salaireBrut: 1000, frequence: "bihebdomadaire", cumulBrutAnnuel: 0, typeEmploi: "discontinuHeure", heures: 40 });
    var exemption = 1.75 * 40;
    var cotisable = 1000 - exemption;
    assert("RRQ discontinu hourly", r.employe, +(cotisable * 0.063).toFixed(2));
  })();

  (function () {
    // Discontinu daily: exemption = 14.58 * days
    // Example from guide QC (section 4.4.2, p.48): 2 days at $60/day = $120 gross, exemption = 14.58*2 = $29.16
    var r = QC.calculerRRQ({ salaireBrut: 120, frequence: "bihebdomadaire", cumulBrutAnnuel: 0, typeEmploi: "discontinuJour", jours: 2 });
    var exemption = 14.58 * 2;
    var cotisable = 120 - exemption;
    assert("RRQ discontinu daily (guide QC 4.4.2 p.48)", r.employe, +(cotisable * 0.063).toFixed(2));
  })();

  (function () {
    // Prorated annual max: 4 months cotisables (guide QC section 4.5.1)
    // cotisationMaxRRQ1 prorated = 4479.30 * 4/12 = 1493.10
    // cotisationMaxRRQ2 prorated = 416 * 4/12 = 138.67
    // Use a high salary so we'd exceed the max without prorating
    var r = QC.calculerRRQ({ salaireBrut: 80000, frequence: "mensuel", cumulBrutAnnuel: 0, moisCotisablesRRQ: 4 });
    var maxRRQ1 = +(4479.30 * 4 / 12).toFixed(2);
    var maxRRQ2 = +(416 * 4 / 12).toFixed(2);
    var maxTotal = +(maxRRQ1 + maxRRQ2).toFixed(2);
    assert("RRQ prorated max (4 months)", r.employe, maxTotal);
  })();

  (function () {
    // Full year (12 months) should not prorate
    var r = QC.calculerRRQ({ salaireBrut: 2280, frequence: "bihebdomadaire", cumulBrutAnnuel: 0, moisCotisablesRRQ: 12 });
    var exemption = 3500 / 26;
    var cotisable = 2280 - exemption;
    assert("RRQ 12 months (no prorating)", r.employe, +(cotisable * 0.063).toFixed(2));
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
    // Annualized: 2280*26 = 59280. F5A = 0. Taxable = 59280.
    // Bracket 1: 58523 × 14% = 8193.22. Bracket 2: 757 × 20.5% = 155.19. Total brut = 8348.41
    // K1: 16452 × 14% = 2303.28. K2: 0. K3: 1368 × 14% = 191.52. Total credits: 2494.80
    // After credits: 5853.61. Abattement QC: 5853.61 × 16.5% = 965.85. After: 4887.76
    // Per period: 4887.76/26 = 187.99
    assert("Fed tax basic", r.impot, 187.99);
  })();

  (function () {
    // With cotisations — only supplementary RRQ deducted from income, base as K2 credit
    var r = QC.calculerImpotFederal({ salaireBrut: 2280, frequence: "bihebdomadaire", cotisationRRQ: 135, cotisationAE: 29.64, cotisationRQAP: 9.80 });
    // F5A = 135*(1/6.30)*26 = 557.14. Taxable: 59280-557.14 = 58722.86
    // Brackets: 58523*14%=8193.22 + 199.86*20.5%=40.97 = 8234.19
    // K1: 2303.28. K2: (113.57+29.64+9.80)*26*14% = 556.96. K3: 191.52. Total: 3051.76
    // After credits: 5182.43. Abattement: 855.10. After: 4327.33. Per period: 166.44
    assert("Fed tax with deductions", r.impot, 166.44);
  })();

  (function () {
    // Zero salary
    var r = QC.calculerImpotFederal({ salaireBrut: 0, frequence: "bihebdomadaire" });
    assert("Fed tax zero", r.impot, 0);
  })();

  (function () {
    // Custom credit
    var r = QC.calculerImpotFederal({ salaireBrut: 2280, frequence: "bihebdomadaire", creditPersonnel: 20000 });
    // Same as basic but K1 = 20000 × 14% = 2800. K3 = 191.52. Total credits: 2991.52
    // Brut = 8348.41. After credits: 5356.89. Abattement: 883.89. After: 4473.00. Per period: 172.04
    assert("Fed tax custom credit", r.impot, 172.04);
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
    // Annualized: 59280. SuppRRQ = 135*(1/6.30)*26 = 557.14. Ded travailleur: 1450. Total ded: 2007.14
    // Taxable: 59280 - 2007.14 = 57272.86
    // Brackets: 54345*14%=7608.30 + 2927.86*19%=556.29 = 8164.59
    // Credit personnel: 2653.28. Credit cotisations base: (113.57+29.64+9.80)*26*14% = 556.96
    // Total credits: 3210.24. After: 4954.35. Per period: 190.55
    assert("QC tax with deductions", r.impot, 190.55);
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

  // ─── RRQ annual cap from cumulated cotisations (guide QC section 4.1, p.43) ───

  (function () {
    // Employee paid 4000 biweekly, period 19, cumulBrut = 72000
    // With cotisation cap: cotisationMaxRRQ1 (4479.30) - cumulCotisationsRRQ1 (4383.36) = 95.94
    // RRQ2: brutAuDessusMGA = 4000 - (74600-72000) = 1400. cotisationRRQ2 = 1400*4% = 56.00
    // Total = 95.94 + 56.00 = 151.94
    var r = QC.calculerRRQ({
      salaireBrut: 4000,
      frequence: "bihebdomadaire",
      cumulBrutAnnuel: 72000,
      cumulCotisationsRRQ1: 4383.36,
      cumulCotisationsRRQ2: 0
    });
    assert("RRQ capped by cumulated cotisations (guide QC 4.1 p.43)", r.employe, 151.94);
  })();

  (function () {
    // RRQ2 cap: period 22, cumulBrut=84000, salary 4000 (guide QC section 4.1, p.44)
    // brutAuDessusMGA = 4000 - max(0, 74600-84000) = 4000
    // cotisableRRQ2 = min(4000, max(0, 85000-max(84000,74600))) = min(4000, 1000) = 1000
    // cotisationRRQ2 = 1000*0.04 = 40. But cap: max(416) - cumul(376) = 40. OK, not capped.
    var r = QC.calculerRRQ({
      salaireBrut: 4000,
      frequence: "bihebdomadaire",
      cumulBrutAnnuel: 84000,
      cumulCotisationsRRQ1: 4479.30,
      cumulCotisationsRRQ2: 376,
      moisCotisablesRRQ: 12
    });
    // RRQ1 should be 0 (already at max). RRQ2 = 40.
    assert("RRQ2 capped at 40 (guide QC 4.1 p.44)", r.employe, 40);
  })();

  // ─── CNT (cotisation relative aux normes du travail) ───────────────────────

  (function () {
    var r = QC.calculerCNT({ salaireBrut: 2280, cumulBrutAnnuel: 0 });
    assert("CNT basic", r.employeur, +(2280 * 0.0006).toFixed(2));
  })();

  (function () {
    var r = QC.calculerCNT({ salaireBrut: 5000, cumulBrutAnnuel: 100000 });
    // Only 3000 remains assujetti (103000 - 100000)
    assert("CNT near cap", r.employeur, +(3000 * 0.0006).toFixed(2));
  })();

  (function () {
    var r = QC.calculerCNT({ salaireBrut: 2000, cumulBrutAnnuel: 104000 });
    assert("CNT past cap", r.employeur, 0);
  })();

  // ─── Gratification ─────────────────────────────────────────────────────────

  (function () {
    // Below threshold (18952) — should return 7% of gratification
    var r = QC.calculerImpotGratification({
      salaireRegulier: 300,
      gratification: 500,
      frequence: "hebdomadaire",
      cotisationRRQ: 0, cotisationAE: 0, cotisationRQAP: 0
    });
    // Estimative: 300*52 + 500 = 16100 <= 18952
    assert("Gratification below threshold (7%)", r.impot, +(500 * 0.07).toFixed(2));
  })();

  (function () {
    // Above threshold — marginal method
    // Salary 540/week, gratification 2500, hebdomadaire
    var r = QC.calculerImpotGratification({
      salaireRegulier: 540,
      gratification: 2500,
      frequence: "hebdomadaire",
      cotisationRRQ: 0, cotisationAE: 0, cotisationRQAP: 0,
      gratificationsPrecedentes: 0
    });
    // Estimative: 540*52 + 2500 = 30580 > 18952 → marginal method
    // impotAvec uses salaire = 540 + 2500/52 = 588.08
    // impotSans uses salaire = 540
    var impotAvec = QC.calculerImpotProvincial({ salaireBrut: 588.08, frequence: "hebdomadaire", cotisationRRQ: 0, cotisationAE: 0, cotisationRQAP: 0 });
    var impotSans = QC.calculerImpotProvincial({ salaireBrut: 540, frequence: "hebdomadaire", cotisationRRQ: 0, cotisationAE: 0, cotisationRQAP: 0 });
    var expected = Math.round((impotAvec.impot - impotSans.impot) * 52 * 100) / 100;
    assert("Gratification marginal method (guide QC 9.5 p.79)", r.impot, expected);
  })();

  // ─── Gratification fédérale (guide CA — T4001) ─────────────────────────────

  (function () {
    // Below 5000$ threshold — 10% for Quebec
    var r = QC.calculerImpotFederalGratification({
      salaireRegulier: 80,
      gratification: 200,
      frequence: "hebdomadaire",
      cotisationRRQ: 0, cotisationAE: 0, cotisationRQAP: 0
    });
    // Estimative: 80*52 + 200 = 4360 <= 5000
    assert("Fed gratification below 5000$ (10%)", r.impot, +(200 * 0.10).toFixed(2));
  })();

  (function () {
    // Above 5000$ — marginal method (guide CA example 1: 400$/week + 300$ bonus)
    var r = QC.calculerImpotFederalGratification({
      salaireRegulier: 400,
      gratification: 300,
      frequence: "hebdomadaire",
      cotisationRRQ: 0, cotisationAE: 0, cotisationRQAP: 0,
      gratificationsPrecedentes: 0
    });
    // Estimative: 400*52 + 300 = 21100 > 5000 → marginal method
    // impotAvec uses salaire = 400 + 300/52 = 405.77
    // impotSans uses salaire = 400
    var impotAvec = QC.calculerImpotFederal({ salaireBrut: 400 + 300/52, frequence: "hebdomadaire", cotisationRRQ: 0, cotisationAE: 0, cotisationRQAP: 0 });
    var impotSans = QC.calculerImpotFederal({ salaireBrut: 400, frequence: "hebdomadaire", cotisationRRQ: 0, cotisationAE: 0, cotisationRQAP: 0 });
    var expected = Math.round((impotAvec.impot - impotSans.impot) * 52 * 100) / 100;
    assert("Fed gratification marginal method (guide CA T4001 ex.1)", r.impot, expected);
  })();

  (function () {
    // Second bonus in the year (guide CA example 2: 400$/week, 300$ prior bonus, 780$ new bonus)
    var r = QC.calculerImpotFederalGratification({
      salaireRegulier: 400,
      gratification: 780,
      frequence: "hebdomadaire",
      cotisationRRQ: 0, cotisationAE: 0, cotisationRQAP: 0,
      gratificationsPrecedentes: 300
    });
    // remunerationAvec = 400 + (780+300)/52 = 400 + 20.77 = 420.77
    // remunerationSans = 400 + 300/52 = 400 + 5.77 = 405.77
    var impotAvec = QC.calculerImpotFederal({ salaireBrut: 400 + 1080/52, frequence: "hebdomadaire", cotisationRRQ: 0, cotisationAE: 0, cotisationRQAP: 0 });
    var impotSans = QC.calculerImpotFederal({ salaireBrut: 400 + 300/52, frequence: "hebdomadaire", cotisationRRQ: 0, cotisationAE: 0, cotisationRQAP: 0 });
    var expected = Math.round((impotAvec.impot - impotSans.impot) * 52 * 100) / 100;
    assert("Fed gratification 2nd bonus (guide CA T4001 ex.2)", r.impot, expected);
  })();

  (function () {
    // Retroactive salary increase (guide CA example 3: 440→460$/week, 12 weeks retro = 240$)
    // Same marginal method: impot(460) - impot(440), times 12 weeks
    var r = QC.calculerImpotFederalGratification({
      salaireRegulier: 460,
      gratification: 240,
      frequence: "hebdomadaire",
      cotisationRRQ: 0, cotisationAE: 0, cotisationRQAP: 0,
      gratificationsPrecedentes: 0
    });
    // remunerationAvec = 460 + 240/52 = 464.62
    // remunerationSans = 460
    var impotAvec = QC.calculerImpotFederal({ salaireBrut: 460 + 240/52, frequence: "hebdomadaire", cotisationRRQ: 0, cotisationAE: 0, cotisationRQAP: 0 });
    var impotSans = QC.calculerImpotFederal({ salaireBrut: 460, frequence: "hebdomadaire", cotisationRRQ: 0, cotisationAE: 0, cotisationRQAP: 0 });
    var expected = Math.round((impotAvec.impot - impotSans.impot) * 52 * 100) / 100;
    assert("Fed retroactive salary increase (guide CA T4001 ex.3)", r.impot, expected);
  })();

  // ─── cumulCotisationsRRQ helper ────────────────────────────────────────────

  (function () {
    var emp = {
      periods: {
        "1": { brut: "4000", rrq: "243.60" },
        "2": { brut: "4000", rrq: "243.60" },
        "3": { brut: "4000", rrq: "243.60" }
      }
    };
    var c = QC.cumulCotisationsRRQ(emp, 3);
    // Periods 1 and 2: all below MGA (74600), so all is RRQ1
    assert("cumulCotisationsRRQ rrq1", c.rrq1, 487.20);
    assert("cumulCotisationsRRQ rrq2", c.rrq2, 0);
  })();

  // ─── Results ───────────────────────────────────────────────────────────────

  console.log("Tests: " + passed + " passed, " + failed + " failed.");
  if (failed > 0) {
    errors.forEach(function (e) { console.error("  FAIL: " + e); });
  }
  return { passed: passed, failed: failed, errors: errors };
};

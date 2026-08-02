(function () {
  "use strict";

  var fmt = QC.fmt;
  var esc = QC.esc;
  var maskNas = QC.maskNas;
  var NAS_RE = /^\d{3}-?\d{3}-?\d{3}$/;

  function computeAge(dateStr) {
    if (!dateStr) return "";
    var ref = data && data.periodeFin ? data.periodeFin : null;
    if (!ref) return "";
    var birth = new Date(dateStr);
    var end = new Date(ref);
    if (isNaN(birth) || isNaN(end)) return "";
    var age = end.getFullYear() - birth.getFullYear();
    var m = end.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && end.getDate() < birth.getDate())) age--;
    return age >= 0 ? age + " ans" : "";
  }

  function ageAtDate(dateNaissance, refDate) {
    if (!dateNaissance || !refDate) return null;
    var birth = new Date(dateNaissance);
    var ref = new Date(refDate);
    if (isNaN(birth) || isNaN(ref)) return null;
    var age = ref.getFullYear() - birth.getFullYear();
    var m = ref.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
    return age;
  }

  var STORAGE_KEY = "qc-paystubs-2026";
  var SCHEMA_VERSION = "2026.1";

  function emptyData() {
    return { version: SCHEMA_VERSION, nextEmployeeId: 1, employeur: "", employeurAdresse: "", employeurLogo: "", employeurTel: "", employeurEmail: "", employeurWeb: "", frequence: "bihebdomadaire", periodeNum: "1", datePaiement: "", tauxFSS: "", tauxCNESST: "", postesTypes: ["Régulier", "Temps partiel"], revenusTypes: ["Prime de nuit", "Prime de fin de semaine", "Indemnité de vacances", "Indemnité de transport", "Commission"], retenuesTypes: ["Assurance collective", "REER", "Cotisation syndicale", "Saisie sur salaire"], employees: [] };
  }

  function migrate(d) {
    if (!d.version) d.version = SCHEMA_VERSION;
    if (!d.nextEmployeeId) {
      var maxId = (d.employees || []).reduce(function (m, e) { return Math.max(m, parseInt(e.id) || 0); }, 0);
      d.nextEmployeeId = maxId + 1;
    }
    return d;
  }

  function load() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    try { return migrate(JSON.parse(raw)); } catch (e) { return emptyData(); }
  }

  function save(d) {
    d.version = SCHEMA_VERSION;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    } catch (e) {
      alert("Erreur de sauvegarde: espace de stockage insuffisant. Exportez vos données en JSON pour éviter toute perte.");
    }
  }

  function nextId() { var id = data.nextEmployeeId || 1; data.nextEmployeeId = id + 1; return String(id); }

  function formatEtapeTexte(texte) {
    return texte
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  var data = load();

  function periodeNum() { return parseInt(data.periodeNum) || 1; }

  // Stub template fetched once at startup
  var stubTemplate = "";
  fetch("qc-stub.html")
    .then(function (r) { return r.text(); })
    .then(function (html) {
      stubTemplate = html;
      document.getElementById("btn-print-all").disabled = false;
      document.querySelectorAll(".btn-print-emp").forEach(function (btn) { btn.disabled = false; });
    });

  function renderStub(emp) {
    var pNum = periodeNum();
    var p = emp.periods && emp.periods[pNum] || {};
    var ytd = QC.computeYTD(emp, pNum);
    var totalExtrasRev = (p.revenusExtras || []).reduce(function (s, r) { return s + Number(r.montant || 0); }, 0);
    var totalExtrasRet = (p.retenuesExtras || []).reduce(function (s, r) { return s + Number(r.montant || 0); }, 0);
    var totalRevenus = Number(p.brut || 0) + totalExtrasRev + Number(p.pourboires || 0);
    var totalRetenues = Number(p.impotCa || 0) + Number(p.impotQc || 0)
      + Number(p.rrq || 0) + Number(p.ae || 0) + Number(p.rqap || 0) + totalExtrasRet;
    var net = totalRevenus - totalRetenues;
    var ytdRev = ytd.brut + ytd.extrasRev + ytd.pourboires;
    var ytdRet = ytd.impotCa + ytd.impotQc + ytd.rrq + ytd.ae + ytd.rqap + ytd.extrasRet;
    var ytdNet = ytdRev - ytdRet;

    var heuresSupRow = "";
    if (Number(p.heuresSup || 0) > 0) {
      heuresSupRow = '<tr><td>dont heures sup. (×' + esc(emp.tauxSup) + ')</td><td>' + esc(p.heuresSup) + '</td><td>' + (emp.taux ? fmt(Number(emp.taux) * Number(emp.tauxSup || 1.5)) : "—") + '</td><td></td><td></td></tr>';
    }

    var revenusExtrasRows = "";
    (p.revenusExtras || []).forEach(function (r) {
      var ytdAmount = QC.computeExtraYTD(emp, "revenusExtras", r.nom, pNum);
      revenusExtrasRows += '<tr><td>' + esc(r.nom) + '</td><td></td><td></td><td>' + fmt(r.montant) + '</td><td>' + fmt(ytdAmount) + '</td></tr>';
    });

    var pourboiresRow = "";
    if (Number(p.pourboires || 0) > 0) {
      pourboiresRow = '<tr><td>Pourboires</td><td></td><td></td><td>' + fmt(p.pourboires) + '</td><td>' + fmt(ytd.pourboires) + '</td></tr>';
    }

    var retenuesExtrasRows = "";
    (p.retenuesExtras || []).forEach(function (r) {
      var ytdAmount = QC.computeExtraYTD(emp, "retenuesExtras", r.nom, pNum);
      retenuesExtrasRows += '<tr><td>' + esc(r.nom) + '</td><td>' + fmt(r.montant) + '</td><td>' + fmt(ytdAmount) + '</td></tr>';
    });

    var values = {
      logoHtml: data.employeurLogo ? '<img src="' + esc(data.employeurLogo) + '" alt="Logo">' : "",
      employeur: esc(data.employeur),
      employeurAdresse: esc(data.employeurAdresse),
      empNom: esc(emp.nom),
      empAdresse: esc(emp.adresse || ""),
      empPoste: esc(emp.poste),
      empNasLine: emp.nas && NAS_RE.test(emp.nas.trim()) ? '<p>NAS: ' + maskNas(emp.nas) + '</p>' : "",
      empTauxLine: emp.taux ? '<p>Taux: ' + fmt(emp.taux) + ' $/h</p>' : "",
      periodeNum: esc(String(pNum)),
      periodeDebut: esc(data.periodeDebut || ""),
      periodeFin: esc(data.periodeFin || ""),
      datePaiement: esc(data.datePaiement || ""),
      heuresReg: p.heuresReg || "—",
      taux: emp.taux ? fmt(emp.taux) : "—",
      brut: fmt(p.brut),
      ytdBrut: fmt(ytd.brut),
      heuresSupRow: heuresSupRow,
      revenusExtrasRows: revenusExtrasRows,
      pourboiresRow: pourboiresRow,
      totalRevenus: fmt(totalRevenus),
      ytdRevenus: fmt(ytdRev),
      impotCa: fmt(p.impotCa),
      ytdImpotCa: fmt(ytd.impotCa),
      impotQc: fmt(p.impotQc),
      ytdImpotQc: fmt(ytd.impotQc),
      rrq: fmt(p.rrq),
      ytdRrq: fmt(ytd.rrq),
      ae: fmt(p.ae),
      ytdAe: fmt(ytd.ae),
      rqap: fmt(p.rqap),
      ytdRqap: fmt(ytd.rqap),
      retenuesExtrasRows: retenuesExtrasRows,
      totalRetenues: fmt(totalRetenues),
      ytdRetenues: fmt(ytdRet),
      net: fmt(net),
      ytdNet: fmt(ytdNet)
    };

    return stubTemplate.replace(/\{\{(\w+)\}\}/g, function (match, key) {
      return values[key] !== undefined ? values[key] : "";
    });
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // Bridges: call QC computation functions and fill DOM fields
  // ═══════════════════════════════════════════════════════════════════════════

  function computeAndFillBrut(acc, emp) {
    var p = getPeriod(emp);
    var heuresReg = Number(p.heuresReg || 0);
    var heuresSup = Number(p.heuresSup || 0);
    var taux = Number(emp.taux || 0);
    var tauxSup = Number(emp.tauxSup || 1.5);

    if (heuresReg === 0 && heuresSup === 0) return;

    var brut = heuresReg * taux + heuresSup * taux * tauxSup;
    var brutInput = acc.querySelector('[data-pay="brut"]');
    if (!brutInput) return;

    if (!p.brutManuel) {
      var val = fmt(brut);
      brutInput.value = val;
      p.brut = val;
      brutInput.classList.add("computed");
      brutInput.classList.remove("overridden");
    } else {
      brutInput.classList.add("overridden");
      brutInput.classList.remove("computed");
    }
  }

  function computeAndFillRQAP(acc, emp) {
    var p = getPeriod(emp);
    var grossPay = Number(p.brut || 0);
    if (grossPay === 0 || emp.assujettiRQAP === "non") return null;

    var result = QC.calculerRQAP({
      salaireBrut: grossPay,
      frequence: data.frequence,
      cumulBrutAnnuel: QC.cumulBrutEmploye(emp, periodeNum())
    });

    var employeeField = acc.querySelector('[data-pay="rqap"]');
    var employerField = acc.querySelector('[data-pay="rqapEmp"]');

    if (employeeField) {
      if (!p.rqapManuel) {
        employeeField.value = fmt(result.employe);
        p.rqap = fmt(result.employe);
        employeeField.classList.add("computed");
        employeeField.classList.remove("overridden");
      } else {
        employeeField.classList.add("overridden");
        employeeField.classList.remove("computed");
      }
    }

    if (employerField) {
      if (!p.rqapEmpManuel) {
        employerField.value = fmt(result.employeur);
        p.rqapEmp = fmt(result.employeur);
        employerField.classList.add("computed");
        employerField.classList.remove("overridden");
      } else {
        employerField.classList.add("overridden");
        employerField.classList.remove("computed");
      }
    }

    return result;
  }

  function computeAndFillAE(acc, emp) {
    var p = getPeriod(emp);
    var grossPay = Number(p.brut || 0);
    if (grossPay === 0 || emp.assujettiAE === "non") return null;

    var result = QC.calculerAE({
      salaireBrut: grossPay,
      frequence: data.frequence,
      cumulBrutAnnuel: QC.cumulBrutEmploye(emp, periodeNum())
    });

    var employeeField = acc.querySelector('[data-pay="ae"]');
    var employerField = acc.querySelector('[data-pay="aeEmp"]');

    if (employeeField) {
      if (!p.aeManuel) {
        employeeField.value = fmt(result.employe);
        p.ae = fmt(result.employe);
        employeeField.classList.add("computed");
        employeeField.classList.remove("overridden");
      } else {
        employeeField.classList.add("overridden");
        employeeField.classList.remove("computed");
      }
    }

    if (employerField) {
      if (!p.aeEmpManuel) {
        employerField.value = fmt(result.employeur);
        p.aeEmp = fmt(result.employeur);
        employerField.classList.add("computed");
        employerField.classList.remove("overridden");
      } else {
        employerField.classList.add("overridden");
        employerField.classList.remove("computed");
      }
    }

    return result;
  }

  function computeAndFillRRQ(acc, emp) {
    var p = getPeriod(emp);
    var grossPay = Number(p.brut || 0);
    if (grossPay === 0 || emp.assujettiRRQ === "non") return null;

    var age = ageAtDate(emp.dateNaissance, data.periodeFin);
    if (age !== null && age < 18) {
      var employeeField = acc.querySelector('[data-pay="rrq"]');
      var employerField = acc.querySelector('[data-pay="rrqEmp"]');
      if (employeeField && !p.rrqManuel) {
        employeeField.value = "0.00";
        p.rrq = "0.00";
        employeeField.classList.add("computed");
        employeeField.classList.remove("overridden");
      }
      if (employerField && !p.rrqEmpManuel) {
        employerField.value = "0.00";
        p.rrqEmp = "0.00";
        employerField.classList.add("computed");
        employerField.classList.remove("overridden");
      }
      return { employe: 0, employeur: 0, etapes: [{ texte: `L'employé a ${age} ans à la fin de la période de paie (${data.periodeFin}). Les travailleurs de moins de 18 ans sont exempts du Régime de rentes du Québec (RRQ).` }] };
    }

    var result = QC.calculerRRQ({
      salaireBrut: grossPay,
      frequence: data.frequence,
      cumulBrutAnnuel: QC.cumulBrutEmploye(emp, periodeNum())
    });

    var employeeField = acc.querySelector('[data-pay="rrq"]');
    var employerField = acc.querySelector('[data-pay="rrqEmp"]');

    if (employeeField) {
      if (!p.rrqManuel) {
        employeeField.value = fmt(result.employe);
        p.rrq = fmt(result.employe);
        employeeField.classList.add("computed");
        employeeField.classList.remove("overridden");
      } else {
        employeeField.classList.add("overridden");
        employeeField.classList.remove("computed");
      }
    }

    if (employerField) {
      if (!p.rrqEmpManuel) {
        employerField.value = fmt(result.employeur);
        p.rrqEmp = fmt(result.employeur);
        employerField.classList.add("computed");
        employerField.classList.remove("overridden");
      } else {
        employerField.classList.add("overridden");
        employerField.classList.remove("computed");
      }
    }

    return result;
  }

  function computeAndFillFSS(acc, emp) {
    var p = getPeriod(emp);
    var grossPay = Number(p.brut || 0);
    if (grossPay === 0) return null;

    var result = QC.calculerFSS({ salaireBrut: grossPay, tauxFSS: data.tauxFSS });

    var field = acc.querySelector('[data-pay="fss"]');
    if (field) {
      if (!p.fssManuel) {
        field.value = fmt(result.employeur);
        p.fss = fmt(result.employeur);
        field.classList.add("computed");
        field.classList.remove("overridden");
      } else {
        field.classList.add("overridden");
        field.classList.remove("computed");
      }
    }
    return result;
  }

  function computeAndFillCNESST(acc, emp) {
    var p = getPeriod(emp);
    var grossPay = Number(p.brut || 0);
    if (grossPay === 0) return null;

    var result = QC.calculerCNESST({ salaireBrut: grossPay, tauxCNESST: data.tauxCNESST });

    var field = acc.querySelector('[data-pay="cnesst"]');
    if (field) {
      if (!p.cnesstManuel) {
        field.value = fmt(result.employeur);
        p.cnesst = fmt(result.employeur);
        field.classList.add("computed");
        field.classList.remove("overridden");
      } else {
        field.classList.add("overridden");
        field.classList.remove("computed");
      }
    }
    return result;
  }

  function computeAndFillImpotCa(acc, emp) {
    var p = getPeriod(emp);
    var grossPay = Number(p.brut || 0);
    if (grossPay === 0) return null;
    var exemption = emp.exemptionImpot || "non";
    if (exemption === "federal" || exemption === "les-deux") return null;

    var result = QC.calculerImpotFederal({
      salaireBrut: grossPay,
      frequence: data.frequence,
      cotisationRRQ: Number(p.rrq || 0),
      cotisationAE: Number(p.ae || 0),
      cotisationRQAP: Number(p.rqap || 0),
      creditPersonnel: emp.creditFederal
    });

    var field = acc.querySelector('[data-pay="impotCa"]');
    if (field) {
      if (!p.impotCaManuel) {
        field.value = fmt(result.impot);
        p.impotCa = fmt(result.impot);
        field.classList.add("computed");
        field.classList.remove("overridden");
      } else {
        field.classList.add("overridden");
        field.classList.remove("computed");
      }
    }
    return result;
  }

  function computeAndFillImpotQc(acc, emp) {
    var p = getPeriod(emp);
    var grossPay = Number(p.brut || 0);
    if (grossPay === 0) return null;
    var exemption = emp.exemptionImpot || "non";
    if (exemption === "provincial" || exemption === "les-deux") return null;

    var result = QC.calculerImpotProvincial({
      salaireBrut: grossPay,
      frequence: data.frequence,
      cotisationRRQ: Number(p.rrq || 0),
      cotisationAE: Number(p.ae || 0),
      cotisationRQAP: Number(p.rqap || 0),
      creditPersonnel: emp.creditProvincial
    });

    var field = acc.querySelector('[data-pay="impotQc"]');
    if (field) {
      if (!p.impotQcManuel) {
        field.value = fmt(result.impot);
        p.impotQc = fmt(result.impot);
        field.classList.add("computed");
        field.classList.remove("overridden");
      } else {
        field.classList.add("overridden");
        field.classList.remove("computed");
      }
    }
    return result;
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // Top-level fields
  // ═══════════════════════════════════════════════════════════════════════════

  var elEmployeur = document.getElementById("employeur-nom");
  var elAdresse = document.getElementById("employeur-adresse");
  var elLogo = document.getElementById("employeur-logo");
  var elTel = document.getElementById("employeur-tel");
  var elEmail = document.getElementById("employeur-email");
  var elWeb = document.getElementById("employeur-web");
  var elFrequence = document.getElementById("frequence");
  var elPeriodeNum = document.getElementById("periode-num");
  var elDebut = document.getElementById("periode-debut");
  var elFin = document.getElementById("periode-fin");
  var elPaiement = document.getElementById("date-paiement");
  var elTauxFSS = document.getElementById("employeur-taux-fss");
  var elTauxCNESST = document.getElementById("employeur-taux-cnesst");
  var elLogoPreview = document.getElementById("logo-preview");

  function loadTopLevel() {
    elEmployeur.value = data.employeur || "";
    elAdresse.value = data.employeurAdresse || "";
    elLogo.value = data.employeurLogo || "";
    elTel.value = data.employeurTel || "";
    elEmail.value = data.employeurEmail || "";
    elWeb.value = data.employeurWeb || "";
    elFrequence.value = data.frequence || "bihebdomadaire";
    elPeriodeNum.value = data.periodeNum || "1";
    elPaiement.value = data.datePaiement || "";
    elTauxFSS.value = data.tauxFSS || "";
    elTauxCNESST.value = data.tauxCNESST || "";
    computePeriodDates();
    updateLogoPreview();
  }

  function updateLogoPreview() {
    var url = elLogo.value.trim();
    if (url) { elLogoPreview.src = url; elLogoPreview.style.display = ""; }
    else { elLogoPreview.src = ""; elLogoPreview.style.display = "none"; }
  }

  elLogo.addEventListener("input", updateLogoPreview);
  elLogoPreview.addEventListener("error", function () { elLogoPreview.style.display = "none"; });

  function collectTopLevel() {
    data.employeur = elEmployeur.value.trim();
    data.employeurAdresse = elAdresse.value.trim();
    data.employeurLogo = elLogo.value.trim();
    data.employeurTel = elTel.value.trim();
    data.employeurEmail = elEmail.value.trim();
    data.employeurWeb = elWeb.value.trim();
    data.frequence = elFrequence.value;
    data.periodeNum = elPeriodeNum.value;
    data.datePaiement = elPaiement.value;
    data.tauxFSS = elTauxFSS.value;
    data.tauxCNESST = elTauxCNESST.value;
    if (!data.revenusTypes) data.revenusTypes = [];
    if (!data.retenuesTypes) data.retenuesTypes = [];
    if (!data.postesTypes) data.postesTypes = [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Employer types management
  // ═══════════════════════════════════════════════════════════════════════════

  function renderTypes() {
    renderTypeList("list-postes-types", data.postesTypes || []);
    renderTypeList("list-revenus-types", data.revenusTypes || []);
    renderTypeList("list-retenues-types", data.retenuesTypes || []);
  }

  function renderTypeList(containerId, list) {
    var container = document.getElementById(containerId);
    container.innerHTML = list.map(function (name, i) {
      return '<span class="type-item">' + esc(name) + '<button type="button" aria-label="Supprimer ' + esc(name) + '" data-idx="' + i + '">×</button></span>';
    }).join("");
    container.querySelectorAll("button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        list.splice(parseInt(btn.dataset.idx), 1);
        save(data);
        renderTypes();
        renderAll();
      });
    });
  }

  function addType(inputId, list) {
    var input = document.getElementById(inputId);
    var name = input.value.trim();
    if (!name) return;
    if (list.includes(name)) { input.value = ""; return; }
    list.push(name);
    input.value = "";
    save(data);
    renderTypes();
    renderAll();
  }

  document.getElementById("btn-add-revenu-type").addEventListener("click", function () {
    if (!data.revenusTypes) data.revenusTypes = [];
    addType("input-new-revenu-type", data.revenusTypes);
  });
  document.getElementById("btn-add-retenue-type").addEventListener("click", function () {
    if (!data.retenuesTypes) data.retenuesTypes = [];
    addType("input-new-retenue-type", data.retenuesTypes);
  });
  document.getElementById("btn-add-poste-type").addEventListener("click", function () {
    if (!data.postesTypes) data.postesTypes = [];
    addType("input-new-poste-type", data.postesTypes);
  });
  document.getElementById("input-new-revenu-type").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); if (!data.revenusTypes) data.revenusTypes = []; addType("input-new-revenu-type", data.revenusTypes); }
  });
  document.getElementById("input-new-retenue-type").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); if (!data.retenuesTypes) data.retenuesTypes = []; addType("input-new-retenue-type", data.retenuesTypes); }
  });
  document.getElementById("input-new-poste-type").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); if (!data.postesTypes) data.postesTypes = []; addType("input-new-poste-type", data.postesTypes); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Period computation
  // ═══════════════════════════════════════════════════════════════════════════

  var YEAR = 2026;

  function computePeriodDates() {
    var freq = elFrequence.value;
    var max = getMaxPeriods();
    var num = Math.max(1, Math.min(parseInt(elPeriodeNum.value) || 1, max));
    elPeriodeNum.value = num;
    elPeriodeNum.max = max;
    var start, end;
    var yearEnd = new Date(YEAR, 11, 31);

    if (freq === "hebdomadaire") {
      start = new Date(YEAR, 0, 1 + (num - 1) * 7);
      end = (num === max) ? yearEnd : new Date(YEAR, 0, 1 + (num - 1) * 7 + 6);
    } else if (freq === "bihebdomadaire") {
      start = new Date(YEAR, 0, 1 + (num - 1) * 14);
      end = (num === max) ? yearEnd : new Date(YEAR, 0, 1 + (num - 1) * 14 + 13);
    } else {
      start = new Date(YEAR, num - 1, 1);
      end = new Date(YEAR, num, 0);
    }

    elDebut.value = toISO(start);
    elFin.value = toISO(end);
    data.periodeDebut = toISO(start);
    data.periodeFin = toISO(end);
  }

  function toISO(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function getMaxPeriods() {
    var freq = elFrequence.value;
    if (freq === "hebdomadaire") return 52;
    if (freq === "bihebdomadaire") return 26;
    return 12;
  }

  function currentPeriodNumber() {
    var freq = elFrequence.value;
    var now = new Date();
    var dayOfYear = Math.floor((now - new Date(YEAR, 0, 1)) / 86400000);
    if (freq === "hebdomadaire") return Math.min(52, Math.floor(dayOfYear / 7) + 1);
    if (freq === "bihebdomadaire") return Math.min(26, Math.floor(dayOfYear / 14) + 1);
    return now.getMonth() + 1;
  }

  elFrequence.addEventListener("change", function () { collectAll(); save(data); computePeriodDates(); data.periodeNum = elPeriodeNum.value; save(data); renderAll(); });
  elPeriodeNum.addEventListener("input", function () { collectAll(); save(data); computePeriodDates(); data.periodeNum = elPeriodeNum.value; save(data); renderAll(); });

  document.getElementById("btn-period-prev").addEventListener("click", function () {
    collectAll(); save(data);
    var v = parseInt(elPeriodeNum.value) || 1;
    if (v > 1) { elPeriodeNum.value = v - 1; data.periodeNum = elPeriodeNum.value; computePeriodDates(); save(data); renderAll(); }
  });
  document.getElementById("btn-period-next").addEventListener("click", function () {
    collectAll(); save(data);
    var v = parseInt(elPeriodeNum.value) || 1;
    if (v < getMaxPeriods()) { elPeriodeNum.value = v + 1; data.periodeNum = elPeriodeNum.value; computePeriodDates(); save(data); renderAll(); }
  });
  document.getElementById("btn-period-latest").addEventListener("click", function () {
    collectAll(); save(data);
    elPeriodeNum.value = currentPeriodNumber();
    data.periodeNum = elPeriodeNum.value;
    computePeriodDates();
    save(data);
    renderAll();
  });


  // ═══════════════════════════════════════════════════════════════════════════
  // Employee management and accordion rendering
  // ═══════════════════════════════════════════════════════════════════════════

  var listeEl = document.getElementById("liste-employes");

  document.getElementById("btn-ajouter-employe").addEventListener("click", function () {
    data.employees.push({
      id: nextId(), nom: "", poste: "", adresse: "", telephone: "", email: "", nas: "", taux: "16.60",
      dateNaissance: "", pourboire: "non", tauxSup: "1.5",
      periods: {}
    });
    save(data);
    renderAll();
    var last = listeEl.lastElementChild;
    if (last) {
      last.classList.add("open");
      last.querySelector(".accordion-header").setAttribute("aria-expanded", "true");
    }
  });

  function emptyPeriod() {
    return { heuresReg: "", heuresSup: "", brut: "", impotCa: "", impotQc: "", rrq: "", ae: "", rqap: "", rrqEmp: "", aeEmp: "", rqapEmp: "", fss: "", cnesst: "", pourboires: "", revenusExtras: [], retenuesExtras: [], brutManuel: false, rqapManuel: false, rqapEmpManuel: false, aeManuel: false, aeEmpManuel: false, rrqManuel: false, rrqEmpManuel: false, fssManuel: false, cnesstManuel: false, impotCaManuel: false, impotQcManuel: false };
  }

  function getPeriod(emp) {
    var key = data.periodeNum || "1";
    if (!emp.periods) emp.periods = {};
    if (!emp.periods[key]) emp.periods[key] = emptyPeriod();
    return emp.periods[key];
  }

  function renderAll() {
    var openIds = new Set();
    listeEl.querySelectorAll(".accordion.open").forEach(function (acc) { openIds.add(acc.dataset.id); });
    listeEl.innerHTML = "";
    data.employees.forEach(function (emp) {
      var acc = document.createElement("div");
      acc.className = "accordion";
      acc.dataset.id = emp.id;
      if (openIds.has(emp.id)) acc.classList.add("open");
      acc.innerHTML = buildAccordionHeader(emp) + buildAccordionBody(emp);
      if (openIds.has(emp.id)) acc.querySelector(".accordion-header").setAttribute("aria-expanded", "true");
      listeEl.appendChild(acc);
      bindAccordion(acc, emp);
    });
  }

  function buildAccordionHeader(emp) {
    var display = emp.nom ? esc(emp.nom) + " — " + esc(emp.poste) : "<em>Nouvel employé</em>";
    return '<div class="accordion-header" role="button" tabindex="0" aria-expanded="false" aria-label="Détails de ' + esc(emp.nom || "nouvel employé") + '">' +
      '<span class="name">' + display + '</span>' +
      '<span>' +
      '<button class="btn-small btn-delete-emp" aria-label="Supprimer ' + esc(emp.nom || "employé") + '">🗑️</button>' +
      '<button class="btn-small btn-print-emp"' + (stubTemplate ? "" : " disabled") + ' aria-label="Imprimer bulletin de ' + esc(emp.nom || "employé") + '">🖨️</button>' +
      '</span></div>';
  }

  function buildExtras(list, types) {
    return (list || []).map(function (r) {
      return '<div class="extra-row">' +
        '<select aria-label="Type">' + (types || []).map(function (t) {
          return '<option value="' + esc(t) + '"' + (t === r.nom ? " selected" : "") + '>' + esc(t) + '</option>';
        }).join("") + '</select>' +
        '<input type="number" step="0.01" min="0" placeholder="$" value="' + (r.montant || "") + '" aria-label="Montant">' +
        '<button type="button" aria-label="Supprimer cette ligne">×</button></div>';
    }).join("");
  }

  function buildYTD(emp) {
    var pNum = periodeNum();
    var ytd = QC.computeYTD(emp, pNum);
    var totalRev = ytd.brut + ytd.extrasRev + ytd.pourboires;
    var totalRet = ytd.impotCa + ytd.impotQc + ytd.rrq + ytd.ae + ytd.rqap + ytd.extrasRet;
    var net = totalRev - totalRet;
    var periods = Object.keys(emp.periods || {}).filter(function (k) { return parseInt(k) <= pNum; }).length;

    var extrasRevRows = "";
    var revNames = new Set();
    Object.keys(emp.periods || {}).forEach(function (key) {
      if (parseInt(key) <= pNum) {
        (emp.periods[key].revenusExtras || []).forEach(function (r) { if (r.nom) revNames.add(r.nom); });
      }
    });
    revNames.forEach(function (nom) {
      extrasRevRows += '<tr><td>&nbsp;&nbsp;' + esc(nom) + '</td><td>' + fmt(QC.computeExtraYTD(emp, "revenusExtras", nom, pNum)) + '</td></tr>';
    });

    var extrasRetRows = "";
    var retNames = new Set();
    Object.keys(emp.periods || {}).forEach(function (key) {
      if (parseInt(key) <= pNum) {
        (emp.periods[key].retenuesExtras || []).forEach(function (r) { if (r.nom) retNames.add(r.nom); });
      }
    });
    retNames.forEach(function (nom) {
      extrasRetRows += '<tr><td>&nbsp;&nbsp;' + esc(nom) + '</td><td>' + fmt(QC.computeExtraYTD(emp, "retenuesExtras", nom, pNum)) + '</td></tr>';
    });

    return '<table>' +
      '<tr><td>Périodes (incluant courante)</td><td>' + periods + '</td></tr>' +
      '<tr><td><strong>Revenus</strong></td><td></td></tr>' +
      '<tr><td>&nbsp;&nbsp;Salaire brut</td><td>' + fmt(ytd.brut) + '</td></tr>' +
      (ytd.pourboires ? '<tr><td>&nbsp;&nbsp;Pourboires</td><td>' + fmt(ytd.pourboires) + '</td></tr>' : '') +
      extrasRevRows +
      '<tr><td><strong>Total revenus</strong></td><td><strong>' + fmt(totalRev) + '</strong></td></tr>' +
      '<tr><td><strong>Retenues</strong></td><td></td></tr>' +
      (ytd.impotCa ? '<tr><td>&nbsp;&nbsp;Impôt fédéral</td><td>' + fmt(ytd.impotCa) + '</td></tr>' : '') +
      (ytd.impotQc ? '<tr><td>&nbsp;&nbsp;Impôt provincial</td><td>' + fmt(ytd.impotQc) + '</td></tr>' : '') +
      (ytd.rrq ? '<tr><td>&nbsp;&nbsp;Régime de rentes du Québec (RRQ)</td><td>' + fmt(ytd.rrq) + '</td></tr>' : '') +
      (ytd.ae ? '<tr><td>&nbsp;&nbsp;Assurance-emploi (AE)</td><td>' + fmt(ytd.ae) + '</td></tr>' : '') +
      (ytd.rqap ? '<tr><td>&nbsp;&nbsp;Régime québécois d\'assurance parentale (RQAP)</td><td>' + fmt(ytd.rqap) + '</td></tr>' : '') +
      extrasRetRows +
      '<tr><td><strong>Total retenues</strong></td><td><strong>' + fmt(totalRet) + '</strong></td></tr>' +
      '<tr><td><strong>Salaire net cumulatif</strong></td><td><strong>' + fmt(net) + '</strong></td></tr>' +
      '</table>';
  }

  function buildAccordionBody(emp) {
    var p = getPeriod(emp);
    return '<div class="accordion-body">' +
      '<fieldset><legend>Identité</legend>' +
        '<div class="row">' +
          '<label>Nom complet<input type="text" data-field="nom" value="' + esc(emp.nom || "") + '"></label>' +
          '<label>Titre du poste<select data-field="poste">' + (data.postesTypes || []).map(function (t) { return '<option value="' + esc(t) + '"' + (t === emp.poste ? " selected" : "") + '>' + esc(t) + '</option>'; }).join("") + '</select></label>' +
          '<label>Date de naissance<input type="text" data-field="dateNaissance" value="' + esc(emp.dateNaissance || "") + '" placeholder="yyyy-mm-dd" pattern="\\d{4}-\\d{2}-\\d{2}"><span class="age-display">' + computeAge(emp.dateNaissance) + '</span></label>' +
        '</div>' +
        '<label>Adresse<input type="text" data-field="adresse" value="' + esc(emp.adresse || "") + '" placeholder="456 rue Test, Québec QC G1A 2B3"></label>' +
        '<div class="row">' +
          '<label>Téléphone<input type="tel" data-field="telephone" value="' + esc(emp.telephone || "") + '" placeholder="514-555-1234"></label>' +
          '<label>Courriel<input type="email" data-field="email" value="' + esc(emp.email || "") + '" placeholder="employe@exemple.com"></label>' +
        '</div>' +
        '<div class="row">' +
          '<label>NAS<input type="text" data-field="nas" value="' + esc(emp.nas || "") + '" placeholder="123-456-789" maxlength="11" pattern="\\d{3}-?\\d{3}-?\\d{3}"></label>' +
          '<label>Taux horaire ($)<input type="number" step="0.01" min="' + (emp.pourboire === "oui" ? "13.30" : "16.60") + '" data-field="taux" value="' + esc(emp.taux || "16.60") + '"></label>' +
          '<label class="checkbox-label">Reçoit des pourboires<select data-field="pourboire"><option value="non"' + (emp.pourboire !== "oui" ? " selected" : "") + '>Non</option><option value="oui"' + (emp.pourboire === "oui" ? " selected" : "") + '>Oui</option></select></label>' +
        '</div>' +
        '<div class="row">' +
          '<label>Assujetti à l\'AE<select data-field="assujettiAE"><option value="oui"' + (emp.assujettiAE !== "non" ? " selected" : "") + '>Oui</option><option value="non"' + (emp.assujettiAE === "non" ? " selected" : "") + '>Non</option></select></label>' +
          '<label>Assujetti au RRQ<select data-field="assujettiRRQ"><option value="oui"' + (emp.assujettiRRQ !== "non" ? " selected" : "") + '>Oui</option><option value="non"' + (emp.assujettiRRQ === "non" ? " selected" : "") + '>Non</option></select></label>' +
          '<label>Assujetti au RQAP<select data-field="assujettiRQAP"><option value="oui"' + (emp.assujettiRQAP !== "non" ? " selected" : "") + '>Oui</option><option value="non"' + (emp.assujettiRQAP === "non" ? " selected" : "") + '>Non</option></select></label>' +
        '</div>' +
        '<div class="row">' +
          '<label>Exemption de retenues d\'impôt<select data-field="exemptionImpot"><option value="non"' + ((emp.exemptionImpot || "non") === "non" ? " selected" : "") + '>Non</option><option value="federal"' + (emp.exemptionImpot === "federal" ? " selected" : "") + '>Fédéral seulement</option><option value="provincial"' + (emp.exemptionImpot === "provincial" ? " selected" : "") + '>Provincial seulement</option><option value="les-deux"' + (emp.exemptionImpot === "les-deux" ? " selected" : "") + '>Les deux</option></select></label>' +
          '<label><img class="flag" src="../img/ca.svg" alt="CA"> Crédit personnel fédéral ($)<input type="number" step="0.01" min="0" data-field="creditFederal" value="' + esc(emp.creditFederal || "") + '" placeholder="' + QC.IMPOT_FED.montantPersonnel + '"></label>' +
          '<label><img class="flag" src="../img/qc.svg" alt="QC"> Crédit personnel provincial ($)<input type="number" step="0.01" min="0" data-field="creditProvincial" value="' + esc(emp.creditProvincial || "") + '" placeholder="' + QC.IMPOT_QC.montantPersonnel + '"></label>' +
        '</div>' +
      '</fieldset>' +
      '<fieldset><legend>Heures</legend>' +
        '<div class="row">' +
          '<label>Heures régulières<input type="number" step="0.01" min="0" data-pay="heuresReg" value="' + esc(p.heuresReg || "") + '"></label>' +
          '<label>Heures supplémentaires<input type="number" step="0.01" min="0" data-pay="heuresSup" value="' + esc(p.heuresSup || "") + '"></label>' +
          '<label>Taux heures sup. (×)<input type="number" step="0.01" min="1" data-field="tauxSup" value="' + esc(emp.tauxSup || "1.5") + '"></label>' +
        '</div>' +
      '</fieldset>' +
      '<fieldset><legend>Revenus</legend>' +
        '<label>Salaire brut ($)<input type="number" step="0.01" min="0" data-pay="brut" value="' + esc(p.brut || "") + '"><button type="button" class="calc-reset-btn' + (p.brutManuel ? " visible" : "") + '" data-reset="brut" aria-label="Recalculer salaire brut">↺</button></label>' +
        '<h4>Autres revenus</h4>' +
        '<div class="extras-revenus">' + buildExtras(p.revenusExtras, data.revenusTypes) + '</div>' +
        '<button type="button" class="btn-small btn-add-revenu" aria-label="Ajouter un revenu">➕</button>' +
      '</fieldset>' +
      '<fieldset><legend>Retenues — employé</legend>' +
          '<label><img class="flag" src="../img/ca.svg" alt="CA"> Impôt fédéral ($)<input type="number" step="0.01" min="0" data-pay="impotCa" value="' + esc(p.impotCa || "") + '"><button type="button" class="calc-detail-btn" data-popover="impotCa" aria-label="Détails du calcul impôt fédéral">détails</button><button type="button" class="calc-reset-btn' + (p.impotCaManuel ? " visible" : "") + '" data-reset="impotCa" aria-label="Recalculer impôt fédéral">↺</button><div class="calc-popover" data-popover-target="impotCa"></div></label>' +
          '<label><img class="flag" src="../img/qc.svg" alt="QC"> Impôt provincial ($)<input type="number" step="0.01" min="0" data-pay="impotQc" value="' + esc(p.impotQc || "") + '"><button type="button" class="calc-detail-btn" data-popover="impotQc" aria-label="Détails du calcul impôt provincial">détails</button><button type="button" class="calc-reset-btn' + (p.impotQcManuel ? " visible" : "") + '" data-reset="impotQc" aria-label="Recalculer impôt provincial">↺</button><div class="calc-popover" data-popover-target="impotQc"></div></label>' +
          '<label><img class="flag" src="../img/qc.svg" alt="QC"> Régime de rentes du Québec (RRQ) ($)<input type="number" step="0.01" min="0" data-pay="rrq" value="' + esc(p.rrq || "") + '"><button type="button" class="calc-detail-btn" data-popover="rrq" aria-label="Détails du calcul RRQ">détails</button><button type="button" class="calc-reset-btn' + (p.rrqManuel ? " visible" : "") + '" data-reset="rrq" aria-label="Recalculer RRQ">↺</button><div class="calc-popover" data-popover-target="rrq"></div></label>' +
          '<label><img class="flag" src="../img/ca.svg" alt="CA"> Assurance-emploi (AE) ($)<input type="number" step="0.01" min="0" data-pay="ae" value="' + esc(p.ae || "") + '"><button type="button" class="calc-detail-btn" data-popover="ae" aria-label="Détails du calcul AE">détails</button><button type="button" class="calc-reset-btn' + (p.aeManuel ? " visible" : "") + '" data-reset="ae" aria-label="Recalculer AE">↺</button><div class="calc-popover" data-popover-target="ae"></div></label>' +
          '<label><img class="flag" src="../img/qc.svg" alt="QC"> Régime québécois d\'assurance parentale (RQAP) ($)<input type="number" step="0.01" min="0" data-pay="rqap" value="' + esc(p.rqap || "") + '"><button type="button" class="calc-detail-btn" data-popover="rqap" aria-label="Détails du calcul RQAP">détails</button><button type="button" class="calc-reset-btn' + (p.rqapManuel ? " visible" : "") + '" data-reset="rqap" aria-label="Recalculer RQAP">↺</button><div class="calc-popover" data-popover-target="rqap"></div></label>' +
        '<h4>Autres retenues</h4>' +
        '<div class="extras-retenues">' + buildExtras(p.retenuesExtras, data.retenuesTypes) + '</div>' +
        '<button type="button" class="btn-small btn-add-retenue" aria-label="Ajouter une retenue">➕</button>' +
      '</fieldset>' +
      '<fieldset><legend>Cotisations — employeur</legend>' +
          '<label><img class="flag" src="../img/qc.svg" alt="QC"> Régime de rentes du Québec (RRQ) ($)<input type="number" step="0.01" min="0" data-pay="rrqEmp" value="' + esc(p.rrqEmp || "") + '"><button type="button" class="calc-detail-btn" data-popover="rrqEmp" aria-label="Détails du calcul RRQ employeur">détails</button><button type="button" class="calc-reset-btn' + (p.rrqEmpManuel ? " visible" : "") + '" data-reset="rrqEmp" aria-label="Recalculer RRQ employeur">↺</button><div class="calc-popover" data-popover-target="rrqEmp"></div></label>' +
          '<label><img class="flag" src="../img/ca.svg" alt="CA"> Assurance-emploi (AE) ($)<input type="number" step="0.01" min="0" data-pay="aeEmp" value="' + esc(p.aeEmp || "") + '"><button type="button" class="calc-detail-btn" data-popover="aeEmp" aria-label="Détails du calcul AE employeur">détails</button><button type="button" class="calc-reset-btn' + (p.aeEmpManuel ? " visible" : "") + '" data-reset="aeEmp" aria-label="Recalculer AE employeur">↺</button><div class="calc-popover" data-popover-target="aeEmp"></div></label>' +
          '<label><img class="flag" src="../img/qc.svg" alt="QC"> Régime québécois d\'assurance parentale (RQAP) ($)<input type="number" step="0.01" min="0" data-pay="rqapEmp" value="' + esc(p.rqapEmp || "") + '"><button type="button" class="calc-detail-btn" data-popover="rqapEmp" aria-label="Détails du calcul RQAP employeur">détails</button><button type="button" class="calc-reset-btn' + (p.rqapEmpManuel ? " visible" : "") + '" data-reset="rqapEmp" aria-label="Recalculer RQAP employeur">↺</button><div class="calc-popover" data-popover-target="rqapEmp"></div></label>' +
          '<label><img class="flag" src="../img/qc.svg" alt="QC"> Fonds des services de santé (FSS) ($)<input type="number" step="0.01" min="0" data-pay="fss" value="' + esc(p.fss || "") + '"><button type="button" class="calc-detail-btn" data-popover="fss" aria-label="Détails du calcul FSS">détails</button><button type="button" class="calc-reset-btn' + (p.fssManuel ? " visible" : "") + '" data-reset="fss" aria-label="Recalculer FSS">↺</button><div class="calc-popover" data-popover-target="fss"></div></label>' +
          '<label><img class="flag" src="../img/qc.svg" alt="QC"> Commission des normes, de l\'équité, de la santé et de la sécurité du travail (CNESST) ($)<input type="number" step="0.01" min="0" data-pay="cnesst" value="' + esc(p.cnesst || "") + '"><button type="button" class="calc-detail-btn" data-popover="cnesst" aria-label="Détails du calcul CNESST">détails</button><button type="button" class="calc-reset-btn' + (p.cnesstManuel ? " visible" : "") + '" data-reset="cnesst" aria-label="Recalculer CNESST">↺</button><div class="calc-popover" data-popover-target="cnesst"></div></label>' +
      '</fieldset>' +
      '<fieldset class="fs-pourboires" ' + (emp.pourboire !== "oui" ? 'style="display:none"' : "") + '><legend>Pourboires</legend>' +
        '<label>Pourboires déclarés ($)<input type="number" step="0.01" min="0" data-pay="pourboires" value="' + esc(p.pourboires || "") + '"></label>' +
      '</fieldset>' +
      '<div class="ytd-summary"><strong>Cumul annuel (YTD)</strong>' + buildYTD(emp) + '</div>' +
    '</div>';
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // Accordion event binding
  // ═══════════════════════════════════════════════════════════════════════════

  function bindAccordion(acc, emp) {
    var header = acc.querySelector(".accordion-header");
    var nameSpan = header.querySelector(".name");
    var body = acc.querySelector(".accordion-body");

    function toggleAccordion() {
      acc.classList.toggle("open");
      header.setAttribute("aria-expanded", acc.classList.contains("open"));
    }

    header.addEventListener("click", function (e) { if (!e.target.closest("button")) toggleAccordion(); });
    header.addEventListener("keydown", function (e) {
      if (e.target !== header) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleAccordion(); }
    });

    header.querySelector(".btn-delete-emp").addEventListener("click", function () {
      if (!confirm("Supprimer cet employé?")) return;
      data.employees = data.employees.filter(function (x) { return x.id !== emp.id; });
      save(data);
      renderAll();
    });

    header.querySelector(".btn-print-emp").addEventListener("click", function () {
      collectAll(); save(data);
      var freshEmp = data.employees.find(function (x) { return x.id === emp.id; });
      document.getElementById("print-stub").innerHTML = "<div>" + renderStub(freshEmp) + "</div>";
      setTimeout(function () { window.print(); }, 100);
    });

    var nomInput = body.querySelector('[data-field="nom"]');
    var posteInput = body.querySelector('[data-field="poste"]');
    function updateHeader() {
      var n = nomInput.value.trim();
      var pt = posteInput.value.trim();
      nameSpan.innerHTML = n ? esc(n) + " — " + esc(pt) : "<em>Nouvel employé</em>";
    }
    nomInput.addEventListener("input", updateHeader);
    posteInput.addEventListener("change", updateHeader);

    var dateNaissanceInput = body.querySelector('[data-field="dateNaissance"]');
    var ageDisplay = body.querySelector(".age-display");
    dateNaissanceInput.addEventListener("change", function () { ageDisplay.textContent = computeAge(dateNaissanceInput.value); });

    var pourboireSelect = body.querySelector('[data-field="pourboire"]');
    var pourboireFs = body.querySelector(".fs-pourboires");
    var tauxInput = body.querySelector('[data-field="taux"]');
    pourboireSelect.addEventListener("change", function () {
      var isTipped = pourboireSelect.value === "oui";
      pourboireFs.style.display = isTipped ? "" : "none";
      tauxInput.min = isTipped ? "13.30" : "16.60";
      validate(tauxInput);
      autoSave();
    });

    body.querySelector(".btn-add-revenu").addEventListener("click", function () { addExtraRow(body.querySelector(".extras-revenus"), data.revenusTypes); });
    body.querySelector(".btn-add-retenue").addEventListener("click", function () { addExtraRow(body.querySelector(".extras-retenues"), data.retenuesTypes); });
    body.querySelectorAll(".extra-row button").forEach(function (btn) { btn.addEventListener("click", function () { btn.parentElement.remove(); autoSave(); }); });
    body.querySelectorAll(".extra-row select").forEach(function (sel) { sel.addEventListener("change", autoSave); });

    // Brut auto-computation
    var brutInput = body.querySelector('[data-pay="brut"]');
    var heuresRegInput = body.querySelector('[data-pay="heuresReg"]');
    var heuresSupInput = body.querySelector('[data-pay="heuresSup"]');
    var tauxSupInput = body.querySelector('[data-field="tauxSup"]');

    function triggerDownstream() {
      computeAndFillRQAP(acc, emp);
      computeAndFillAE(acc, emp);
      computeAndFillRRQ(acc, emp);
      computeAndFillFSS(acc, emp);
      computeAndFillCNESST(acc, emp);
      computeAndFillImpotCa(acc, emp);
      computeAndFillImpotQc(acc, emp);
    }

    function triggerBrut() {
      var p = getPeriod(emp);
      p.heuresReg = heuresRegInput.value;
      p.heuresSup = heuresSupInput.value;
      emp.taux = tauxInput.value;
      emp.tauxSup = tauxSupInput.value;
      computeAndFillBrut(acc, emp);
      triggerDownstream();
      autoSave();
    }

    heuresRegInput.addEventListener("input", triggerBrut);
    heuresSupInput.addEventListener("input", triggerBrut);
    tauxInput.addEventListener("input", triggerBrut);
    tauxSupInput.addEventListener("input", triggerBrut);

    brutInput.addEventListener("input", function () {
      var p = getPeriod(emp);
      p.brutManuel = true;
      p.brut = brutInput.value;
      brutInput.classList.add("overridden");
      brutInput.classList.remove("computed");
      body.querySelector('[data-reset="brut"]').classList.add("visible");
      triggerDownstream();
      autoSave();
    });

    body.querySelector('[data-reset="brut"]').addEventListener("click", function () {
      var p = getPeriod(emp);
      p.brutManuel = false;
      body.querySelector('[data-reset="brut"]').classList.remove("visible");
      computeAndFillBrut(acc, emp);
      triggerDownstream();
      autoSave();
    });

    // Assujettissement toggles
    var assujettiAE = body.querySelector('[data-field="assujettiAE"]');
    var assujettiRRQ = body.querySelector('[data-field="assujettiRRQ"]');
    var assujettiRQAP = body.querySelector('[data-field="assujettiRQAP"]');

    function triggerAll() {
      emp.assujettiAE = assujettiAE.value;
      emp.assujettiRRQ = assujettiRRQ.value;
      emp.assujettiRQAP = assujettiRQAP.value;
      triggerDownstream();
    }
    assujettiAE.addEventListener("change", triggerAll);
    assujettiRRQ.addEventListener("change", triggerAll);
    assujettiRQAP.addEventListener("change", triggerAll);

    // Manual override detection and reset for each deduction
    function bindOverride(payField, manuelFlag, resetKey, computeFn) {
      var input = body.querySelector('[data-pay="' + payField + '"]');
      if (!input) return;
      input.addEventListener("input", function () {
        var p = getPeriod(emp);
        p[manuelFlag] = true;
        input.classList.add("overridden");
        input.classList.remove("computed");
        body.querySelector('[data-reset="' + resetKey + '"]').classList.add("visible");
      });
      body.querySelector('[data-reset="' + resetKey + '"]').addEventListener("click", function () {
        var p = getPeriod(emp);
        p[manuelFlag] = false;
        body.querySelector('[data-reset="' + resetKey + '"]').classList.remove("visible");
        computeFn(acc, emp);
        autoSave();
      });
    }

    bindOverride("rqap", "rqapManuel", "rqap", computeAndFillRQAP);
    bindOverride("rqapEmp", "rqapEmpManuel", "rqapEmp", computeAndFillRQAP);
    bindOverride("ae", "aeManuel", "ae", computeAndFillAE);
    bindOverride("aeEmp", "aeEmpManuel", "aeEmp", computeAndFillAE);
    bindOverride("rrq", "rrqManuel", "rrq", computeAndFillRRQ);
    bindOverride("rrqEmp", "rrqEmpManuel", "rrqEmp", computeAndFillRRQ);
    bindOverride("fss", "fssManuel", "fss", computeAndFillFSS);
    bindOverride("cnesst", "cnesstManuel", "cnesst", computeAndFillCNESST);
    bindOverride("impotCa", "impotCaManuel", "impotCa", computeAndFillImpotCa);
    bindOverride("impotQc", "impotQcManuel", "impotQc", computeAndFillImpotQc);

    // Exemption and credit fields retrigger tax computation
    var exemptionImpotSelect = body.querySelector('[data-field="exemptionImpot"]');
    var creditFederalInput = body.querySelector('[data-field="creditFederal"]');
    var creditProvincialInput = body.querySelector('[data-field="creditProvincial"]');

    exemptionImpotSelect.addEventListener("change", function () {
      emp.exemptionImpot = exemptionImpotSelect.value;
      computeAndFillImpotCa(acc, emp);
      computeAndFillImpotQc(acc, emp);
      autoSave();
    });
    creditFederalInput.addEventListener("input", function () {
      emp.creditFederal = creditFederalInput.value;
      computeAndFillImpotCa(acc, emp);
      autoSave();
    });
    creditProvincialInput.addEventListener("input", function () {
      emp.creditProvincial = creditProvincialInput.value;
      computeAndFillImpotQc(acc, emp);
      autoSave();
    });

    // Detail popover
    function renderEtapes(etapes) {
      return '<button type="button" class="close-popover" aria-label="Fermer">×</button>' +
        etapes.map(function (e) { return '<p>' + formatEtapeTexte(e.texte) + '</p>'; }).join("");
    }

    function showPopover(popoverEl, etapes) {
      popoverEl.innerHTML = renderEtapes(etapes);
      popoverEl.classList.add("visible");
      popoverEl.querySelector(".close-popover").addEventListener("click", function () { popoverEl.classList.remove("visible"); });
    }

    body.querySelectorAll(".calc-detail-btn").forEach(function (btn) {
      var target = btn.dataset.popover;
      var popoverEl = body.querySelector('[data-popover-target="' + target + '"]');
      btn.addEventListener("click", function () {
        if (popoverEl.classList.contains("visible")) { popoverEl.classList.remove("visible"); return; }
        var p = getPeriod(emp);
        var grossPay = Number(p.brut || 0);
        if (grossPay === 0) {
          popoverEl.innerHTML = '<button type="button" class="close-popover" aria-label="Fermer">×</button><p>Entrez un salaire brut pour voir le calcul.</p>';
          popoverEl.classList.add("visible");
          popoverEl.querySelector(".close-popover").addEventListener("click", function () { popoverEl.classList.remove("visible"); });
          return;
        }
        var params = { salaireBrut: grossPay, frequence: data.frequence, cumulBrutAnnuel: QC.cumulBrutEmploye(emp, periodeNum()) };
        var result;
        if (target === "rqap" || target === "rqapEmp") {
          result = QC.calculerRQAP(params);
        } else if (target === "ae" || target === "aeEmp") {
          result = QC.calculerAE(params);
        } else if (target === "rrq" || target === "rrqEmp") {
          var age = ageAtDate(emp.dateNaissance, data.periodeFin);
          if (age !== null && age < 18) {
            result = { etapes: [{ texte: "L'employé a " + age + " ans à la fin de la période de paie (" + data.periodeFin + "). Les travailleurs de moins de 18 ans sont exempts du Régime de rentes du Québec (RRQ)." }] };
          } else {
            result = QC.calculerRRQ(params);
          }
        } else if (target === "fss") {
          result = QC.calculerFSS({ salaireBrut: grossPay, tauxFSS: data.tauxFSS });
        } else if (target === "cnesst") {
          result = QC.calculerCNESST({ salaireBrut: grossPay, tauxCNESST: data.tauxCNESST });
        } else if (target === "impotCa") {
          result = QC.calculerImpotFederal({ salaireBrut: grossPay, frequence: data.frequence, cotisationRRQ: Number(p.rrq || 0), cotisationAE: Number(p.ae || 0), cotisationRQAP: Number(p.rqap || 0), creditPersonnel: emp.creditFederal });
        } else if (target === "impotQc") {
          result = QC.calculerImpotProvincial({ salaireBrut: grossPay, frequence: data.frequence, cotisationRRQ: Number(p.rrq || 0), cotisationAE: Number(p.ae || 0), cotisationRQAP: Number(p.rqap || 0), creditPersonnel: emp.creditProvincial });
        }
        if (result) showPopover(popoverEl, result.etapes);
      });
    });

    // Run initial computation
    computeAndFillBrut(acc, emp);
    if (Number(brutInput.value || 0) > 0) triggerDownstream();
  }

  function addExtraRow(container, types) {
    var row = document.createElement("div");
    row.className = "extra-row";
    var opts = (types || []).map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join("");
    row.innerHTML = '<select aria-label="Type">' + opts + '</select><input type="number" step="0.01" min="0" placeholder="$" aria-label="Montant"><button type="button" aria-label="Supprimer cette ligne">×</button>';
    row.querySelector("button").addEventListener("click", function () { row.remove(); autoSave(); });
    row.querySelector("select").addEventListener("change", autoSave);
    container.appendChild(row);
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // Collect all data from DOM
  // ═══════════════════════════════════════════════════════════════════════════

  function collectAll() {
    collectTopLevel();
    document.querySelectorAll(".accordion").forEach(function (acc) {
      var emp = data.employees.find(function (x) { return x.id === acc.dataset.id; });
      if (!emp) return;
      acc.querySelectorAll("[data-field]").forEach(function (input) { emp[input.dataset.field] = input.value; });
      var p = getPeriod(emp);
      acc.querySelectorAll("[data-pay]").forEach(function (input) { p[input.dataset.pay] = input.value; });
      p.revenusExtras = collectExtras(acc.querySelector(".extras-revenus"));
      p.retenuesExtras = collectExtras(acc.querySelector(".extras-retenues"));
    });
  }

  function collectExtras(container) {
    var result = [];
    container.querySelectorAll(".extra-row").forEach(function (row) {
      var select = row.querySelector("select");
      var input = row.querySelector("input");
      var nom = select.value.trim();
      var montant = input.value;
      if (nom || montant) result.push({ nom: nom, montant: montant });
    });
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Auto-save
  // ═══════════════════════════════════════════════════════════════════════════

  var saveTimer = null;
  function autoSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { collectAll(); save(data); }, 500);
  }

  document.addEventListener("input", function (e) { autoSave(); validate(e.target); });
  document.addEventListener("change", function (e) { if (e.target.tagName === "SELECT") autoSave(); });
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".calc-popover") && !e.target.closest(".calc-detail-btn")) {
      document.querySelectorAll(".calc-popover.visible").forEach(function (p) { p.classList.remove("visible"); });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Validation
  // ═══════════════════════════════════════════════════════════════════════════

  function validate(input) {
    if (!input || !input.dataset) return;
    var field = input.dataset.field;
    if (field === "nas") validateNas(input);
    if (field === "taux") validateTaux(input);
  }

  function setInvalid(input, msg) {
    input.classList.add("invalid");
    var el = input.nextElementSibling;
    if (!el || !el.classList.contains("invalid-msg")) {
      el = document.createElement("div");
      el.className = "invalid-msg";
      input.after(el);
    }
    el.textContent = msg;
  }

  function clearInvalid(input) {
    input.classList.remove("invalid");
    var el = input.nextElementSibling;
    if (el && el.classList.contains("invalid-msg")) el.remove();
  }

  function validateNas(input) {
    var v = input.value.trim();
    if (!v) { clearInvalid(input); return; }
    if (!NAS_RE.test(v)) setInvalid(input, "Format: 123-456-789");
    else clearInvalid(input);
  }

  function validateTaux(input) {
    var v = parseFloat(input.value);
    if (!input.value) { clearInvalid(input); return; }
    var min = parseFloat(input.min) || 16.60;
    if (isNaN(v) || v < min) setInvalid(input, "Minimum: " + min.toFixed(2) + " $/h");
    else clearInvalid(input);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Print
  // ═══════════════════════════════════════════════════════════════════════════

  function periodHasData(emp) {
    var key = data.periodeNum || "1";
    var p = emp.periods && emp.periods[key];
    if (!p) return false;
    return Number(p.brut || 0) > 0 || Number(p.heuresReg || 0) > 0;
  }

  document.getElementById("btn-print-all").addEventListener("click", function () {
    collectAll(); save(data);
    var eligible = data.employees.filter(periodHasData);
    if (!eligible.length) { alert("Aucun bulletin à imprimer pour cette période."); return; }
    var html = eligible.map(function (emp, i) {
      var breakClass = i > 0 ? ' class="stub-page-break"' : "";
      return "<div" + breakClass + ">" + renderStub(emp) + "</div>";
    }).join("");
    document.getElementById("print-stub").innerHTML = html;
    setTimeout(function () { window.print(); }, 100);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Import/Export
  // ═══════════════════════════════════════════════════════════════════════════

  document.getElementById("btn-exporter").addEventListener("click", function () {
    collectAll(); save(data);
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "bulletins-paie-2026.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("btn-importer").addEventListener("click", function () {
    document.getElementById("input-import").click();
  });

  document.getElementById("input-import").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    if (!confirm("Ceci remplacera toutes les données actuelles. Continuer?")) { e.target.value = ""; return; }
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var imported = JSON.parse(reader.result);
        if (!imported.employees || !Array.isArray(imported.employees)) { alert("Format JSON invalide: tableau 'employees' manquant."); return; }
        for (var i = 0; i < imported.employees.length; i++) {
          var emp = imported.employees[i];
          if (!emp || typeof emp !== "object") { alert("Employé #" + (i + 1) + ": objet invalide."); return; }
          if (emp.id === undefined || emp.id === null || emp.nom === undefined || emp.nom === null) {
            alert("Employé #" + (i + 1) + " (" + (emp.nom || "sans nom") + "): fields manquants: id ou nom");
            return;
          }
          if (emp.periods && typeof emp.periods !== "object") { alert("Employé #" + (i + 1) + " (" + emp.nom + "): 'periods' doit être un objet."); return; }
        }
        data = migrate(imported);
        save(data);
        loadTopLevel();
        renderTypes();
        renderAll();
        alert("Importation réussie.");
      } catch (err) { alert("Erreur de lecture du fichier JSON."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test data (console helper)
  // ═══════════════════════════════════════════════════════════════════════════
  // Public hook for programmatic data loading (used by tests.js)
  // ═══════════════════════════════════════════════════════════════════════════

  window.importData = function (d) {
    data = migrate(d);
    save(data);
    loadTopLevel();
    renderTypes();
    renderAll();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Init
  // ═══════════════════════════════════════════════════════════════════════════

  loadTopLevel();
  renderTypes();
  renderAll();

})();

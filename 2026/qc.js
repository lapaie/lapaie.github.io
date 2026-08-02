"use strict";

var QC = (function () {

  function fmt(n) { return Number(n || 0).toFixed(2); }

  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function maskNas(nas) {
    if (!nas) return "";
    var digits = nas.replace(/\D/g, "");
    if (digits.length < 3) return "***";
    return "***-***-" + digits.slice(-3);
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // Module de calcul — Régime québécois d'assurance parentale (RQAP)
  //
  // Source: Revenu Québec — Cotisations au RQAP
  // https://www.revenuquebec.ca/fr/entreprises/retenues-a-la-source-et-cotisations-de-lemployeur/calcul-des-retenues-et-des-cotisations/cotisations-au-rqap/maximum-de-revenus-assurables-et-taux-de-cotisation/
  // ═══════════════════════════════════════════════════════════════════════════

  var RQAP = {
    annee: 2026,
    revenusAssurableMax: 103000,
    tauxEmploye: 0.00430,
    tauxEmployeur: 0.00602,
    cotisationMaxEmploye: 442.90,
    cotisationMaxEmployeur: 620.06,
    source: "https://www.revenuquebec.ca/fr/entreprises/retenues-a-la-source-et-cotisations-de-lemployeur/calcul-des-retenues-et-des-cotisations/cotisations-au-rqap/maximum-de-revenus-assurables-et-taux-de-cotisation/"
  };

  // Calcule la cotisation RQAP pour une période de paie.
  //
  // L'employeur n'a pas à tenir compte des cotisations versées chez un employeur
  // précédent. Si l'employé dépasse le maximum assurable en cumulant plusieurs
  // emplois, il récupère le trop-perçu dans sa déclaration de revenus.
  // Référence: https://www.revenuquebec.ca/fr/entreprises/retenues-a-la-source-et-cotisations-de-lemployeur/calcul-des-retenues-et-des-cotisations/cotisations-au-rqap/total-des-cotisations-payees/
  //
  // Paramètres:
  //   salaireBrut       — salaire brut de la période courante
  //   frequence         — "hebdomadaire" | "bihebdomadaire" | "mensuel"
  //   cumulBrutAnnuel   — total des salaires bruts versés par cet employeur dans les périodes précédentes
  //
  // Retourne: { employe, employeur, etapes }

  function calculerRQAP({ salaireBrut, frequence, cumulBrutAnnuel = 0 }) {
    var etapes = [];

    etapes.push({
      texte: `[Calcul du RQAP — Revenu Québec](${RQAP.source})\n` +
        `Le RQAP est une cotisation sur le salaire brut, sans exemption de base. Le taux et le maximum sont publiés annuellement par Revenu Québec.`
    });

    var revenusAssurablesCumul = Math.min(cumulBrutAnnuel, RQAP.revenusAssurableMax);
    var resteAssurable = Math.max(0, RQAP.revenusAssurableMax - revenusAssurablesCumul);
    var salaireCotisable = Math.min(salaireBrut, resteAssurable);

    etapes.push({
      texte: `Le salaire brut cette période est de ${fmt(salaireBrut)} $.`
    });

    if (cumulBrutAnnuel > 0) {
      etapes.push({
        texte: `Le maximum de revenus assurables pour ${RQAP.annee} est de ${RQAP.revenusAssurableMax.toLocaleString("fr-CA")} $. ` +
          `Revenus cumulés chez cet employeur : ${fmt(cumulBrutAnnuel)} $. ` +
          `Il reste ${fmt(resteAssurable)} $ de revenus assurables.`
      });
    }

    if (salaireCotisable < salaireBrut) {
      etapes.push({
        texte: `Le salaire cotisable est plafonné à ${fmt(salaireCotisable)} $ (maximum de revenus assurables atteint).`
      });
    }

    var cotisationEmploye = salaireCotisable * RQAP.tauxEmploye;
    etapes.push({
      texte: `La cotisation de l'employé se calcule en appliquant le taux de ${(RQAP.tauxEmploye * 100).toFixed(3)} % au salaire cotisable : ${fmt(salaireCotisable)} × ${(RQAP.tauxEmploye * 100).toFixed(3)} % = ${fmt(cotisationEmploye)} $.`
    });

    var cotisationEmployeur = salaireCotisable * RQAP.tauxEmployeur;
    etapes.push({
      texte: `La cotisation de l'employeur se calcule au taux de ${(RQAP.tauxEmployeur * 100).toFixed(3)} % : ${fmt(salaireCotisable)} × ${(RQAP.tauxEmployeur * 100).toFixed(3)} % = ${fmt(cotisationEmployeur)} $.`
    });

    etapes.push({
      texte: `**Résultat** : employé ${fmt(cotisationEmploye)} $ · employeur ${fmt(cotisationEmployeur)} $.`
    });

    return {
      employe: Math.round(cotisationEmploye * 100) / 100,
      employeur: Math.round(cotisationEmployeur * 100) / 100,
      etapes
    };
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // Module de calcul — Assurance-emploi (AE) — taux réduit Québec
  //
  // Source: Gouvernement du Canada — Taux de cotisation à l'AE
  // https://www.canada.ca/fr/agence-revenu/services/impot/entreprises/sujets/retenues-paie/retenues-paie-cotisations/assurance-emploi-ae/taux-cotisation-a-ae-maximums.html
  //
  // Le Québec bénéficie d'un taux réduit parce que le RQAP couvre la portion
  // congé parental/maternité de l'AE.
  // ═══════════════════════════════════════════════════════════════════════════

  var AE = {
    annee: 2026,
    revenusAssurableMax: 68900,
    tauxEmploye: 0.0130,
    tauxEmployeur: 0.0182,
    cotisationMaxEmploye: 895.70,
    cotisationMaxEmployeur: 1253.98,
    source: "https://www.canada.ca/fr/agence-revenu/services/impot/entreprises/sujets/retenues-paie/retenues-paie-cotisations/assurance-emploi-ae/taux-cotisation-a-ae-maximums.html"
  };

  function calculerAE({ salaireBrut, frequence, cumulBrutAnnuel = 0 }) {
    var etapes = [];

    etapes.push({
      texte: `[Calcul de l'AE — Gouvernement du Canada](${AE.source})\n` +
        `L'assurance-emploi est prélevée sur le salaire brut sans exemption. Le Québec bénéficie d'un taux réduit puisque le RQAP couvre la portion parentale.`
    });

    var revenusAssurablesCumul = Math.min(cumulBrutAnnuel, AE.revenusAssurableMax);
    var resteAssurable = Math.max(0, AE.revenusAssurableMax - revenusAssurablesCumul);
    var salaireCotisable = Math.min(salaireBrut, resteAssurable);

    etapes.push({
      texte: `Le salaire brut cette période est de ${fmt(salaireBrut)} $.`
    });

    if (cumulBrutAnnuel > 0) {
      etapes.push({
        texte: `Le maximum de revenus assurables pour ${AE.annee} est de ${AE.revenusAssurableMax.toLocaleString("fr-CA")} $. ` +
          `Revenus cumulés chez cet employeur : ${fmt(cumulBrutAnnuel)} $. ` +
          `Il reste ${fmt(resteAssurable)} $ de revenus assurables.`
      });
    }

    if (salaireCotisable < salaireBrut) {
      etapes.push({
        texte: `Le salaire cotisable est plafonné à ${fmt(salaireCotisable)} $ (maximum de revenus assurables atteint).`
      });
    }

    var cotisationEmploye = salaireCotisable * AE.tauxEmploye;
    etapes.push({
      texte: `La cotisation de l'employé se calcule au taux réduit Québec de ${(AE.tauxEmploye * 100).toFixed(2)} % : ${fmt(salaireCotisable)} × ${(AE.tauxEmploye * 100).toFixed(2)} % = ${fmt(cotisationEmploye)} $.`
    });

    var cotisationEmployeur = salaireCotisable * AE.tauxEmployeur;
    etapes.push({
      texte: `La cotisation de l'employeur est de 1,4 fois celle de l'employé, soit un taux de ${(AE.tauxEmployeur * 100).toFixed(2)} % : ${fmt(salaireCotisable)} × ${(AE.tauxEmployeur * 100).toFixed(2)} % = ${fmt(cotisationEmployeur)} $.`
    });

    etapes.push({
      texte: `**Résultat** : employé ${fmt(cotisationEmploye)} $ · employeur ${fmt(cotisationEmployeur)} $.`
    });

    return {
      employe: Math.round(cotisationEmploye * 100) / 100,
      employeur: Math.round(cotisationEmployeur * 100) / 100,
      etapes
    };
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // Module de calcul — Régime de rentes du Québec (RRQ)
  //
  // Source: Retraite Québec — Rôle de l'employeur
  // https://www.retraitequebec.gouv.qc.ca/fr/employeur/role_rrq/Pages/role_rrq.aspx
  //
  // Le RRQ comporte deux paliers:
  //   RRQ1 (régime de base + 1er supplément): 6,3 % employé + 6,3 % employeur
  //     sur les gains entre l'exemption de base (3 500 $) et le MGA (74 600 $).
  //   RRQ2 (2e supplément): 4 % employé + 4 % employeur
  //     sur les gains entre le MGA (74 600 $) et le MGAP (85 000 $).
  // ═══════════════════════════════════════════════════════════════════════════

  var RRQ = {
    annee: 2026,
    exemptionBase: 3500,
    mga: 74600,
    mgap: 85000,
    tauxRRQ1: 0.063,
    tauxRRQ2: 0.04,
    cotisationMaxRRQ1: 4479.30,
    cotisationMaxRRQ2: 416.00,
    source: "https://www.retraitequebec.gouv.qc.ca/fr/employeur/role_rrq/Pages/role_rrq.aspx"
  };

  function calculerRRQ({ salaireBrut, frequence, cumulBrutAnnuel = 0 }) {
    var etapes = [];
    var nombrePeriodes = frequence === "hebdomadaire" ? 52 : frequence === "bihebdomadaire" ? 26 : 12;
    var nomFrequence = frequence === "hebdomadaire" ? "semaine" : frequence === "bihebdomadaire" ? "2 semaines" : "mois";

    etapes.push({
      texte: `[Calcul du RRQ — Retraite Québec](${RRQ.source})\n` +
        `Le RRQ est calculé à partir du salaire brut par période de paie. Il comporte deux paliers de cotisation.`
    });

    var exemptionParPeriode = RRQ.exemptionBase / nombrePeriodes;
    etapes.push({
      texte: `Il y a une exemption annuelle de ${RRQ.exemptionBase.toLocaleString("fr-CA")} $ qui est distribuée également entre les ${nombrePeriodes} périodes de paie (paie aux ${nomFrequence}) : ${fmt(exemptionParPeriode)} $ par période.`
    });

    var brutApresExemption = Math.max(0, salaireBrut - exemptionParPeriode);
    etapes.push({
      texte: `Le salaire brut cette période est de ${fmt(salaireBrut)} $. Après exemption : ${fmt(salaireBrut)} − ${fmt(exemptionParPeriode)} = ${fmt(brutApresExemption)} $.`
    });

    var gainsMaxRRQ1 = RRQ.mga - RRQ.exemptionBase;
    var cumulCotisableRRQ1 = Math.max(0, Math.min(cumulBrutAnnuel, RRQ.mga) - RRQ.exemptionBase);
    var resteRRQ1 = Math.max(0, gainsMaxRRQ1 - cumulCotisableRRQ1);
    var cotisableRRQ1 = Math.min(brutApresExemption, resteRRQ1);

    if (cumulBrutAnnuel > 0) {
      etapes.push({
        texte: `RRQ1 s'applique sur les gains entre ${RRQ.exemptionBase.toLocaleString("fr-CA")} $ et ${RRQ.mga.toLocaleString("fr-CA")} $ (MGA), soit un maximum cotisable de ${gainsMaxRRQ1.toLocaleString("fr-CA")} $. ` +
          `Déjà cotisé cette année : ${fmt(cumulCotisableRRQ1)} $. Il reste ${fmt(resteRRQ1)} $.`
      });
    }

    var cotisationRRQ1 = cotisableRRQ1 * RRQ.tauxRRQ1;
    etapes.push({
      texte: `Cotisation RRQ1 (base + 1er supplément) : ${fmt(cotisableRRQ1)} × ${(RRQ.tauxRRQ1 * 100).toFixed(1)} % = ${fmt(cotisationRRQ1)} $.`
    });

    var gainsMaxRRQ2 = RRQ.mgap - RRQ.mga;
    var cumulRRQ2 = Math.max(0, Math.min(cumulBrutAnnuel, RRQ.mgap) - RRQ.mga);
    var resteRRQ2 = Math.max(0, gainsMaxRRQ2 - cumulRRQ2);
    var brutAuDessusMGA = Math.max(0, salaireBrut - Math.max(0, RRQ.mga - cumulBrutAnnuel));
    var cotisableRRQ2 = Math.min(Math.max(0, brutAuDessusMGA), resteRRQ2);

    var cotisationRRQ2 = 0;
    if (cotisableRRQ2 > 0) {
      cotisationRRQ2 = cotisableRRQ2 * RRQ.tauxRRQ2;
      etapes.push({
        texte: `RRQ2 (2e supplément) s'applique sur les gains entre ${RRQ.mga.toLocaleString("fr-CA")} $ (MGA) et ${RRQ.mgap.toLocaleString("fr-CA")} $ (MGAP). ` +
          `Portion cotisable cette période : ${fmt(cotisableRRQ2)} × ${(RRQ.tauxRRQ2 * 100).toFixed(0)} % = ${fmt(cotisationRRQ2)} $.`
      });
    } else if (cumulBrutAnnuel + salaireBrut > RRQ.mga) {
      etapes.push({
        texte: `RRQ2 : le plafond du 2e palier (${RRQ.mgap.toLocaleString("fr-CA")} $) est déjà atteint. Aucune cotisation supplémentaire.`
      });
    }

    var totalEmploye = cotisationRRQ1 + cotisationRRQ2;
    var totalEmployeur = totalEmploye;

    etapes.push({
      texte: `**Résultat** : employé ${fmt(totalEmploye)} $ · employeur ${fmt(totalEmployeur)} $ (l'employeur cotise un montant identique).`
    });

    return {
      employe: Math.round(totalEmploye * 100) / 100,
      employeur: Math.round(totalEmployeur * 100) / 100,
      etapes
    };
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // Module de calcul — Fonds des services de santé (FSS)
  //
  // Source: Revenu Québec — Cotisation au FSS
  // https://www.revenuquebec.ca/fr/entreprises/retenues-a-la-source-et-cotisations-de-lemployeur/calcul-des-retenues-et-des-cotisations/cotisation-de-lemployeur-fss/seuil-de-la-masse-salariale-totale-et-taux-de-cotisation-au-fss/
  // ═══════════════════════════════════════════════════════════════════════════

  var FSS = {
    source: "https://www.revenuquebec.ca/fr/entreprises/retenues-a-la-source-et-cotisations-de-lemployeur/calcul-des-retenues-et-des-cotisations/cotisation-de-lemployeur-fss/seuil-de-la-masse-salariale-totale-et-taux-de-cotisation-au-fss/"
  };

  function calculerFSS({ salaireBrut, tauxFSS }) {
    var etapes = [];
    var taux = Number(tauxFSS || 0) / 100;

    etapes.push({
      texte: `[Calcul du FSS — Revenu Québec](${FSS.source})\n` +
        `Le Fonds des services de santé est une cotisation de l'employeur uniquement. Le taux dépend de la masse salariale totale annuelle et du secteur d'activité de l'employeur.`
    });

    if (!tauxFSS || taux === 0) {
      etapes.push({ texte: `Aucun taux FSS n'a été configuré dans la section Employeur.` });
      return { employeur: 0, etapes };
    }

    var cotisation = salaireBrut * taux;
    etapes.push({
      texte: `Le taux configuré est de ${Number(tauxFSS).toFixed(4)} %. Cotisation : ${fmt(salaireBrut)} × ${Number(tauxFSS).toFixed(4)} % = ${fmt(cotisation)} $.`
    });

    etapes.push({
      texte: `**Résultat** : employeur ${fmt(cotisation)} $.`
    });

    return {
      employeur: Math.round(cotisation * 100) / 100,
      etapes
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Module de calcul — Commission des normes, de l'équité, de la santé
  // et de la sécurité du travail (CNESST)
  //
  // Source: CNESST — Prime d'assurance
  // https://www.cnesst.gouv.qc.ca/fr/organisation/services-nous/nous-joindre/prime-dassurance
  // ═══════════════════════════════════════════════════════════════════════════

  var CNESST = {
    source: "https://www.cnesst.gouv.qc.ca/fr/organisation/services-nous/nous-joindre/prime-dassurance"
  };

  function calculerCNESST({ salaireBrut, tauxCNESST }) {
    var etapes = [];
    var taux = Number(tauxCNESST || 0) / 100;

    etapes.push({
      texte: `[Calcul de la CNESST](${CNESST.source})\n` +
        `La prime CNESST est une cotisation de l'employeur uniquement. Le taux est déterminé par la classification d'industrie de l'employeur.`
    });

    if (!tauxCNESST || taux === 0) {
      etapes.push({ texte: `Aucun taux CNESST n'a été configuré dans la section Employeur.` });
      return { employeur: 0, etapes };
    }

    var cotisation = salaireBrut * taux;
    etapes.push({
      texte: `Le taux configuré est de ${Number(tauxCNESST).toFixed(4)} %. Cotisation : ${fmt(salaireBrut)} × ${Number(tauxCNESST).toFixed(4)} % = ${fmt(cotisation)} $.`
    });

    etapes.push({
      texte: `**Résultat** : employeur ${fmt(cotisation)} $.`
    });

    return {
      employeur: Math.round(cotisation * 100) / 100,
      etapes
    };
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // Module de calcul — Impôt fédéral (retenue à la source)
  //
  // Source: Agence du revenu du Canada — T4127 Formules pour le calcul
  // https://www.canada.ca/fr/agence-revenu/services/formulaires-publications/retenues-paie/t4127-formules-calcul-retenues-paie/t4127-jan/t4127-jan-formules-retenues-paie-programmes-informatiques.html
  // ═══════════════════════════════════════════════════════════════════════════

  var IMPOT_FED = {
    annee: 2026,
    paliers: [
      { limite: 58523, taux: 0.14 },
      { limite: 117045, taux: 0.205 },
      { limite: 181440, taux: 0.26 },
      { limite: 258482, taux: 0.29 },
      { limite: Infinity, taux: 0.33 }
    ],
    montantPersonnel: 16452,
    tauxCredit: 0.14,
    abattementQuebec: 0.165,
    source: "https://www.canada.ca/fr/agence-revenu/services/formulaires-publications/retenues-paie/t4127-formules-calcul-retenues-paie/t4127-jan/t4127-jan-formules-retenues-paie-programmes-informatiques.html"
  };

  function calculerImpotFederal({ salaireBrut, frequence, cotisationRRQ = 0, cotisationAE = 0, cotisationRQAP = 0, creditPersonnel }) {
    var etapes = [];
    var nombrePeriodes = frequence === "hebdomadaire" ? 52 : frequence === "bihebdomadaire" ? 26 : 12;
    var credit = creditPersonnel !== undefined && creditPersonnel !== "" ? Number(creditPersonnel) : IMPOT_FED.montantPersonnel;

    etapes.push({
      texte: `[Calcul de l'impôt fédéral — T4127](${IMPOT_FED.source})\n` +
        `Méthode de retenue à la source : annualiser le revenu, appliquer les paliers progressifs, soustraire les crédits, appliquer l'abattement du Québec (${(IMPOT_FED.abattementQuebec * 100).toFixed(1)} %), puis désannualiser.`
    });

    var revenuAnnuel = salaireBrut * nombrePeriodes;
    etapes.push({
      texte: `Revenu annualisé : ${fmt(salaireBrut)} × ${nombrePeriodes} périodes = ${fmt(revenuAnnuel)} $.`
    });

    var deductionsAnnuelles = (cotisationRRQ + cotisationAE + cotisationRQAP) * nombrePeriodes;
    etapes.push({
      texte: `Déductions annualisées (RRQ ${fmt(cotisationRRQ)} + AE ${fmt(cotisationAE)} + RQAP ${fmt(cotisationRQAP)}) × ${nombrePeriodes} = ${fmt(deductionsAnnuelles)} $.`
    });

    var revenuImposable = Math.max(0, revenuAnnuel - deductionsAnnuelles);
    etapes.push({
      texte: `Revenu imposable annuel : ${fmt(revenuAnnuel)} − ${fmt(deductionsAnnuelles)} = ${fmt(revenuImposable)} $.`
    });

    var impotBrut = 0;
    var reste = revenuImposable;
    var palierPrecedent = 0;
    var detailsPaliers = [];
    for (var i = 0; i < IMPOT_FED.paliers.length; i++) {
      var palier = IMPOT_FED.paliers[i];
      var tranche = Math.min(reste, palier.limite - palierPrecedent);
      if (tranche <= 0) break;
      var impotTranche = tranche * palier.taux;
      impotBrut += impotTranche;
      detailsPaliers.push(`${fmt(tranche)} × ${(palier.taux * 100).toFixed(1)} % = ${fmt(impotTranche)}`);
      reste -= tranche;
      palierPrecedent = palier.limite;
    }
    etapes.push({
      texte: `Impôt brut par paliers :\n${detailsPaliers.join("\n")}\nTotal : ${fmt(impotBrut)} $.`
    });

    var creditImpot = credit * IMPOT_FED.tauxCredit;
    var impotApresCredit = Math.max(0, impotBrut - creditImpot);
    etapes.push({
      texte: `Crédit personnel : ${fmt(credit)} × ${(IMPOT_FED.tauxCredit * 100).toFixed(0)} % = ${fmt(creditImpot)} $.\nImpôt après crédit : ${fmt(impotBrut)} − ${fmt(creditImpot)} = ${fmt(impotApresCredit)} $.`
    });

    var abattement = impotApresCredit * IMPOT_FED.abattementQuebec;
    var impotApresAbattement = Math.max(0, impotApresCredit - abattement);
    etapes.push({
      texte: `Abattement du Québec : ${fmt(impotApresCredit)} × ${(IMPOT_FED.abattementQuebec * 100).toFixed(1)} % = ${fmt(abattement)} $.\nImpôt fédéral annuel : ${fmt(impotApresCredit)} − ${fmt(abattement)} = ${fmt(impotApresAbattement)} $.`
    });

    var impotPeriode = Math.max(0, impotApresAbattement / nombrePeriodes);
    etapes.push({
      texte: `**Résultat** : ${fmt(impotApresAbattement)} ÷ ${nombrePeriodes} = **${fmt(impotPeriode)} $** par période.`
    });

    return {
      impot: Math.round(impotPeriode * 100) / 100,
      etapes
    };
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // Module de calcul — Impôt provincial du Québec (retenue à la source)
  //
  // Source: Revenu Québec — TP-1015.F
  // https://www.revenuquebec.ca/fr/entreprises/retenues-a-la-source-et-cotisations-de-lemployeur/employeur-principaux-changements-2026/
  // ═══════════════════════════════════════════════════════════════════════════

  var IMPOT_QC = {
    annee: 2026,
    paliers: [
      { limite: 54345, taux: 0.14 },
      { limite: 108680, taux: 0.19 },
      { limite: 132245, taux: 0.24 },
      { limite: Infinity, taux: 0.2575 }
    ],
    montantPersonnel: 18952,
    tauxCredit: 0.14,
    deductionTravailleurMax: 1450,
    source: "https://www.revenuquebec.ca/fr/entreprises/retenues-a-la-source-et-cotisations-de-lemployeur/employeur-principaux-changements-2026/"
  };

  function calculerImpotProvincial({ salaireBrut, frequence, cotisationRRQ = 0, cotisationAE = 0, cotisationRQAP = 0, creditPersonnel }) {
    var etapes = [];
    var nombrePeriodes = frequence === "hebdomadaire" ? 52 : frequence === "bihebdomadaire" ? 26 : 12;
    var credit = creditPersonnel !== undefined && creditPersonnel !== "" ? Number(creditPersonnel) : IMPOT_QC.montantPersonnel;

    etapes.push({
      texte: `[Calcul de l'impôt du Québec — TP-1015.F](${IMPOT_QC.source})\n` +
        `Méthode de retenue à la source : annualiser le revenu, soustraire les déductions (cotisations + déduction pour travailleur), appliquer les paliers progressifs, soustraire les crédits personnels, puis désannualiser.`
    });

    var revenuAnnuel = salaireBrut * nombrePeriodes;
    etapes.push({
      texte: `Revenu annualisé : ${fmt(salaireBrut)} × ${nombrePeriodes} périodes = ${fmt(revenuAnnuel)} $.`
    });

    var cotisationsAnnuelles = (cotisationRRQ + cotisationAE + cotisationRQAP) * nombrePeriodes;
    var deductionTravailleur = Math.min(IMPOT_QC.deductionTravailleurMax, revenuAnnuel * 0.06);
    var deductionsAnnuelles = cotisationsAnnuelles + deductionTravailleur;
    etapes.push({
      texte: `Déductions annualisées : cotisations (RRQ ${fmt(cotisationRRQ)} + AE ${fmt(cotisationAE)} + RQAP ${fmt(cotisationRQAP)}) × ${nombrePeriodes} = ${fmt(cotisationsAnnuelles)} $.\nDéduction pour travailleur : min(${IMPOT_QC.deductionTravailleurMax} $, 6 % × ${fmt(revenuAnnuel)}) = ${fmt(deductionTravailleur)} $.\nTotal déductions : ${fmt(deductionsAnnuelles)} $.`
    });

    var revenuImposable = Math.max(0, revenuAnnuel - deductionsAnnuelles);
    etapes.push({
      texte: `Revenu imposable annuel : ${fmt(revenuAnnuel)} − ${fmt(deductionsAnnuelles)} = ${fmt(revenuImposable)} $.`
    });

    var impotBrut = 0;
    var reste = revenuImposable;
    var palierPrecedent = 0;
    var detailsPaliers = [];
    for (var i = 0; i < IMPOT_QC.paliers.length; i++) {
      var palier = IMPOT_QC.paliers[i];
      var tranche = Math.min(reste, palier.limite - palierPrecedent);
      if (tranche <= 0) break;
      var impotTranche = tranche * palier.taux;
      impotBrut += impotTranche;
      detailsPaliers.push(`${fmt(tranche)} × ${(palier.taux * 100).toFixed(2)} % = ${fmt(impotTranche)}`);
      reste -= tranche;
      palierPrecedent = palier.limite;
    }
    etapes.push({
      texte: `Impôt brut par paliers :\n${detailsPaliers.join("\n")}\nTotal : ${fmt(impotBrut)} $.`
    });

    var creditImpot = credit * IMPOT_QC.tauxCredit;
    var impotApresCredit = Math.max(0, impotBrut - creditImpot);
    etapes.push({
      texte: `Crédit personnel : ${fmt(credit)} × ${(IMPOT_QC.tauxCredit * 100).toFixed(0)} % = ${fmt(creditImpot)} $.\nImpôt après crédit : ${fmt(impotBrut)} − ${fmt(creditImpot)} = ${fmt(impotApresCredit)} $.`
    });

    var impotPeriode = Math.max(0, impotApresCredit / nombrePeriodes);
    etapes.push({
      texte: `**Résultat** : ${fmt(impotApresCredit)} ÷ ${nombrePeriodes} = **${fmt(impotPeriode)} $** par période.`
    });

    return {
      impot: Math.round(impotPeriode * 100) / 100,
      etapes
    };
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // Cumul annuel (YTD)
  // ═══════════════════════════════════════════════════════════════════════════

  function cumulBrutEmploye(emp, periodeNum) {
    var total = 0;
    Object.keys(emp.periods || {}).forEach(function (key) {
      if (parseInt(key) < periodeNum) total += Number(emp.periods[key].brut || 0);
    });
    return total;
  }

  function empTotals(period) {
    var extrasRev = (period.revenusExtras || []).reduce(function (s, r) { return s + Number(r.montant || 0); }, 0);
    var extrasRet = (period.retenuesExtras || []).reduce(function (s, r) { return s + Number(r.montant || 0); }, 0);
    return {
      brut: Number(period.brut || 0),
      extrasRev: extrasRev,
      pourboires: Number(period.pourboires || 0),
      impotCa: Number(period.impotCa || 0),
      impotQc: Number(period.impotQc || 0),
      rrq: Number(period.rrq || 0),
      ae: Number(period.ae || 0),
      rqap: Number(period.rqap || 0),
      extrasRet: extrasRet,
      rrqEmp: Number(period.rrqEmp || 0),
      aeEmp: Number(period.aeEmp || 0),
      rqapEmp: Number(period.rqapEmp || 0),
      fss: Number(period.fss || 0),
      cnesst: Number(period.cnesst || 0)
    };
  }

  function sumTotals(list) {
    var s = { brut: 0, extrasRev: 0, pourboires: 0, impotCa: 0, impotQc: 0, rrq: 0, ae: 0, rqap: 0, extrasRet: 0, rrqEmp: 0, aeEmp: 0, rqapEmp: 0, fss: 0, cnesst: 0 };
    list.forEach(function (t) { for (var k in s) s[k] += t[k]; });
    return s;
  }

  function computeYTD(emp, periodeNum) {
    var totals = [];
    Object.keys(emp.periods || {}).forEach(function (key) {
      if (parseInt(key) <= periodeNum) totals.push(empTotals(emp.periods[key]));
    });
    return sumTotals(totals);
  }

  function computeExtraYTD(emp, field, nom, periodeNum) {
    var total = 0;
    Object.keys(emp.periods || {}).forEach(function (key) {
      if (parseInt(key) <= periodeNum) {
        (emp.periods[key][field] || []).forEach(function (r) {
          if (r.nom === nom) total += Number(r.montant || 0);
        });
      }
    });
    return total;
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // API publique
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    fmt: fmt,
    esc: esc,
    maskNas: maskNas,

    RQAP: RQAP,
    AE: AE,
    RRQ: RRQ,
    FSS: FSS,
    CNESST: CNESST,
    IMPOT_FED: IMPOT_FED,
    IMPOT_QC: IMPOT_QC,

    calculerRQAP: calculerRQAP,
    calculerAE: calculerAE,
    calculerRRQ: calculerRRQ,
    calculerFSS: calculerFSS,
    calculerCNESST: calculerCNESST,
    calculerImpotFederal: calculerImpotFederal,
    calculerImpotProvincial: calculerImpotProvincial,

    cumulBrutEmploye: cumulBrutEmploye,
    computeYTD: computeYTD,
    computeExtraYTD: computeExtraYTD
  };

})();

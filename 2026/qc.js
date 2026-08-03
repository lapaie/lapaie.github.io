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
  // Voir aussi: T4001 Guide de l'employeur, chapitre 3
  // https://www.canada.ca/fr/agence-revenu/services/formulaires-publications/publications/t4001/guide-employeur-retenues-paie-versements.html
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

  function calculerRRQ({ salaireBrut, frequence, cumulBrutAnnuel = 0, cumulCotisationsRRQ1 = 0, cumulCotisationsRRQ2 = 0, typeEmploi = "continu", heures = 0, jours = 0, moisCotisablesRRQ = 12 }) {
    var etapes = [];
    var nombrePeriodes = frequence === "hebdomadaire" ? 52 : frequence === "bihebdomadaire" ? 26 : 12;
    var nomFrequence = frequence === "hebdomadaire" ? "semaine" : frequence === "bihebdomadaire" ? "2 semaines" : "mois";

    var maxRRQ1 = RRQ.cotisationMaxRRQ1;
    var maxRRQ2 = RRQ.cotisationMaxRRQ2;
    if (moisCotisablesRRQ < 12) {
      maxRRQ1 = Math.round(RRQ.cotisationMaxRRQ1 * moisCotisablesRRQ / 12 * 100) / 100;
      maxRRQ2 = Math.round(RRQ.cotisationMaxRRQ2 * moisCotisablesRRQ / 12 * 100) / 100;
    }

    etapes.push({
      texte: `[Calcul du RRQ — Retraite Québec](${RRQ.source})\n` +
        `Le RRQ est calculé à partir du salaire brut par période de paie. Il comporte deux paliers de cotisation.`
    });

    var exemptionParPeriode;
    if (typeEmploi === "discontinuHeure") {
      exemptionParPeriode = 1.75 * heures;
      etapes.push({
        texte: `Emploi discontinu payé à l'heure : exemption de 1,75 $ × ${heures} heures = ${fmt(exemptionParPeriode)} $ (3 500 $ ÷ 2 000 h).`
      });
    } else if (typeEmploi === "discontinuJour") {
      exemptionParPeriode = 14.58 * jours;
      etapes.push({
        texte: `Emploi discontinu payé à la journée : exemption de 14,58 $ × ${jours} jours = ${fmt(exemptionParPeriode)} $ (3 500 $ ÷ 240 j).`
      });
    } else {
      exemptionParPeriode = RRQ.exemptionBase / nombrePeriodes;
      etapes.push({
        texte: `Il y a une exemption annuelle de ${RRQ.exemptionBase.toLocaleString("fr-CA")} $ qui est distribuée également entre les ${nombrePeriodes} périodes de paie (paie aux ${nomFrequence}) : ${fmt(exemptionParPeriode)} $ par période.`
      });
    }

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

    var resteMaxRRQ1 = Math.max(0, maxRRQ1 - cumulCotisationsRRQ1);
    if (cotisationRRQ1 > resteMaxRRQ1) {
      etapes.push({
        texte: `Cotisation RRQ1 calculée : ${fmt(cotisationRRQ1)} $, mais le maximum annuel est de ${fmt(maxRRQ1)} $ et les cotisations cumulées sont de ${fmt(cumulCotisationsRRQ1)} $. Plafonnée à ${fmt(resteMaxRRQ1)} $.`
      });
      cotisationRRQ1 = resteMaxRRQ1;
    } else {
      etapes.push({
        texte: `Cotisation RRQ1 (base + 1er supplément) : ${fmt(cotisableRRQ1)} × ${(RRQ.tauxRRQ1 * 100).toFixed(1)} % = ${fmt(cotisationRRQ1)} $.`
      });
    }

    var gainsMaxRRQ2 = RRQ.mgap - RRQ.mga;
    var cumulRRQ2 = Math.max(0, Math.min(cumulBrutAnnuel, RRQ.mgap) - RRQ.mga);
    var resteRRQ2 = Math.max(0, gainsMaxRRQ2 - cumulRRQ2);
    var brutAuDessusMGA = Math.max(0, salaireBrut - Math.max(0, RRQ.mga - cumulBrutAnnuel));
    var cotisableRRQ2 = Math.min(Math.max(0, brutAuDessusMGA), resteRRQ2);

    var cotisationRRQ2 = 0;
    if (cotisableRRQ2 > 0) {
      cotisationRRQ2 = cotisableRRQ2 * RRQ.tauxRRQ2;
      var resteMaxRRQ2 = Math.max(0, maxRRQ2 - cumulCotisationsRRQ2);
      if (cotisationRRQ2 > resteMaxRRQ2) {
        etapes.push({
          texte: `RRQ2 calculée : ${fmt(cotisationRRQ2)} $, mais le maximum annuel est de ${fmt(maxRRQ2)} $ et les cotisations cumulées sont de ${fmt(cumulCotisationsRRQ2)} $. Plafonnée à ${fmt(resteMaxRRQ2)} $.`
        });
        cotisationRRQ2 = resteMaxRRQ2;
      } else {
        etapes.push({
          texte: `RRQ2 (2e supplément) s'applique sur les gains entre ${RRQ.mga.toLocaleString("fr-CA")} $ (MGA) et ${RRQ.mgap.toLocaleString("fr-CA")} $ (MGAP). ` +
            `Portion cotisable cette période : ${fmt(cotisableRRQ2)} × ${(RRQ.tauxRRQ2 * 100).toFixed(0)} % = ${fmt(cotisationRRQ2)} $.`
        });
      }
    } else if (cumulBrutAnnuel + salaireBrut > RRQ.mga) {
      etapes.push({
        texte: `RRQ2 : le plafond du 2e palier (${RRQ.mgap.toLocaleString("fr-CA")} $) est déjà atteint. Aucune cotisation supplémentaire.`
      });
    }

    var totalEmploye = cotisationRRQ1 + cotisationRRQ2;

    if (moisCotisablesRRQ < 12) {
      var maxTotal = maxRRQ1 + maxRRQ2;
      etapes.push({
        texte: `Cotisation maximale proratisée (${moisCotisablesRRQ} mois sur 12) : RRQ1 ${fmt(maxRRQ1)} $ + RRQ2 ${fmt(maxRRQ2)} $ = ${fmt(maxTotal)} $.`
      });
    }

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
  // Module de calcul — Cotisation relative aux normes du travail (CNT)
  //
  // Source: Revenu Québec — Cotisation relative aux normes du travail
  // https://www.revenuquebec.ca/fr/entreprises/retenues-a-la-source-et-cotisations-de-lemployeur/calcul-des-retenues-et-des-cotisations/cotisation-relative-aux-normes-du-travail/
  // ═══════════════════════════════════════════════════════════════════════════

  var CNT = {
    annee: 2026,
    taux: 0.0006,
    remunerationMax: 103000,
    source: "https://www.revenuquebec.ca/fr/entreprises/retenues-a-la-source-et-cotisations-de-lemployeur/calcul-des-retenues-et-des-cotisations/cotisation-relative-aux-normes-du-travail/"
  };

  function calculerCNT({ salaireBrut, cumulBrutAnnuel = 0 }) {
    var etapes = [];

    etapes.push({
      texte: `[Cotisation relative aux normes du travail](${CNT.source})\n` +
        `Cotisation de l'employeur de ${(CNT.taux * 100).toFixed(2)} % sur la rémunération assujettie, jusqu'à un maximum de ${CNT.remunerationMax.toLocaleString("fr-CA")} $ par employé pour l'année.`
    });

    var resteAssujetti = Math.max(0, CNT.remunerationMax - Math.min(cumulBrutAnnuel, CNT.remunerationMax));
    var salaireAssujetti = Math.min(salaireBrut, resteAssujetti);

    if (cumulBrutAnnuel > 0) {
      etapes.push({
        texte: `Rémunération cumulée : ${fmt(cumulBrutAnnuel)} $. Il reste ${fmt(resteAssujetti)} $ de rémunération assujettie.`
      });
    }

    var cotisation = salaireAssujetti * CNT.taux;
    etapes.push({
      texte: `Cotisation : ${fmt(salaireAssujetti)} × ${(CNT.taux * 100).toFixed(2)} % = ${fmt(cotisation)} $.`
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
  //
  // Voir aussi: T4001 Guide de l'employeur — Les retenues sur la paie et les versements
  // https://www.canada.ca/fr/agence-revenu/services/formulaires-publications/publications/t4001/guide-employeur-retenues-paie-versements.html
  //
  // Méthode T4127:
  //   - Seules les cotisations supplémentaires au RPC (F5A = 1re supp., F2 = 2e supp.)
  //     sont déduites du revenu annualisé.
  //   - Les cotisations de base (RPC/RRQ + AE + RQAP) sont traitées comme crédits
  //     non remboursables: K2 = 14 % × montant annualisé.
  //   - Le crédit canadien pour emploi (K3 = 14 % × min(revenu, 1 368 $)) s'applique.
  //   - L'abattement du Québec (16,5 %) réduit l'impôt pour les employés au Québec.
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
    creditEmploiMax: 1368,
    source: "https://www.canada.ca/fr/agence-revenu/services/formulaires-publications/retenues-paie/t4127-formules-calcul-retenues-paie/t4127-jan/t4127-jan-formules-retenues-paie-programmes-informatiques.html"
  };

  function calculerImpotFederal({ salaireBrut, frequence, cotisationRRQ = 0, cotisationAE = 0, cotisationRQAP = 0, creditPersonnel }) {
    var etapes = [];
    var nombrePeriodes = frequence === "hebdomadaire" ? 52 : frequence === "bihebdomadaire" ? 26 : 12;
    var credit = creditPersonnel !== undefined && creditPersonnel !== "" ? Number(creditPersonnel) : IMPOT_FED.montantPersonnel;

    etapes.push({
      texte: `[Calcul de l'impôt fédéral — T4127](${IMPOT_FED.source})\n` +
        `Méthode de retenue à la source : annualiser le revenu, déduire les cotisations supplémentaires au RRQ (F5A + F2), appliquer les paliers progressifs, soustraire les crédits (K1 personnel + K2 cotisations + K3 emploi), appliquer l'abattement du Québec (${(IMPOT_FED.abattementQuebec * 100).toFixed(1)} %), puis désannualiser.`
    });

    var revenuAnnuel = salaireBrut * nombrePeriodes;
    etapes.push({
      texte: `Revenu annualisé : ${fmt(salaireBrut)} × ${nombrePeriodes} périodes = ${fmt(revenuAnnuel)} $.`
    });

    var cotisationSuppRRQ = cotisationRRQ * (1 / 6.30);
    var deductionF5A = cotisationSuppRRQ * nombrePeriodes;
    etapes.push({
      texte: `Déduction F5A (1re cotisation supplémentaire au RRQ) : ${fmt(cotisationRRQ)} × (1 % ÷ 6,30 %) × ${nombrePeriodes} = ${fmt(deductionF5A)} $.`
    });

    var revenuImposable = Math.max(0, revenuAnnuel - deductionF5A);
    etapes.push({
      texte: `Revenu imposable annuel : ${fmt(revenuAnnuel)} − ${fmt(deductionF5A)} = ${fmt(revenuImposable)} $.`
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

    var K1 = credit * IMPOT_FED.tauxCredit;
    var cotisationBaseRRQ = cotisationRRQ - cotisationSuppRRQ;
    var cotisationsBaseAnnuelles = (cotisationBaseRRQ + cotisationAE + cotisationRQAP) * nombrePeriodes;
    var K2 = cotisationsBaseAnnuelles * IMPOT_FED.tauxCredit;
    var K3 = Math.min(revenuAnnuel, IMPOT_FED.creditEmploiMax) * IMPOT_FED.tauxCredit;
    var totalCredits = K1 + K2 + K3;
    var impotApresCredit = Math.max(0, impotBrut - totalCredits);
    etapes.push({
      texte: `K1 (crédit personnel) : ${fmt(credit)} × ${(IMPOT_FED.tauxCredit * 100).toFixed(0)} % = ${fmt(K1)} $.\n` +
        `K2 (crédit cotisations RRQ base + AE + RQAP) : ${fmt(cotisationsBaseAnnuelles)} × ${(IMPOT_FED.tauxCredit * 100).toFixed(0)} % = ${fmt(K2)} $.\n` +
        `K3 (crédit canadien pour emploi) : min(${fmt(revenuAnnuel)}, ${IMPOT_FED.creditEmploiMax}) × ${(IMPOT_FED.tauxCredit * 100).toFixed(0)} % = ${fmt(K3)} $.\n` +
        `Total crédits : ${fmt(totalCredits)} $.\nImpôt après crédits : ${fmt(impotBrut)} − ${fmt(totalCredits)} = ${fmt(impotApresCredit)} $.`
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
        `Méthode de retenue à la source : annualiser le revenu, soustraire les déductions (cotisations supplémentaires au RRQ + déduction pour travailleur), appliquer les paliers progressifs, soustraire les crédits (personnel + cotisations de base), puis désannualiser.`
    });

    var revenuAnnuel = salaireBrut * nombrePeriodes;
    etapes.push({
      texte: `Revenu annualisé : ${fmt(salaireBrut)} × ${nombrePeriodes} périodes = ${fmt(revenuAnnuel)} $.`
    });

    var cotisationSuppRRQ = cotisationRRQ * (1 / 6.30) + 0;
    var deductionSuppRRQAnnuelle = cotisationSuppRRQ * nombrePeriodes;
    var deductionTravailleur = Math.min(IMPOT_QC.deductionTravailleurMax, revenuAnnuel * 0.06);
    var deductionsAnnuelles = deductionSuppRRQAnnuelle + deductionTravailleur;
    etapes.push({
      texte: `Déductions annualisées :\n` +
        `Cotisations supplémentaires au RRQ : ${fmt(cotisationRRQ)} × (1 % ÷ 6,30 %) × ${nombrePeriodes} = ${fmt(deductionSuppRRQAnnuelle)} $.\n` +
        `Déduction pour travailleur : min(${IMPOT_QC.deductionTravailleurMax} $, 6 % × ${fmt(revenuAnnuel)}) = ${fmt(deductionTravailleur)} $.\n` +
        `Total déductions : ${fmt(deductionsAnnuelles)} $.`
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

    var cotisationBaseRRQ = cotisationRRQ - cotisationSuppRRQ;
    var cotisationsBaseAnnuelles = (cotisationBaseRRQ + cotisationAE + cotisationRQAP) * nombrePeriodes;
    var creditCotisations = cotisationsBaseAnnuelles * IMPOT_QC.tauxCredit;
    var creditPersonnelMontant = credit * IMPOT_QC.tauxCredit;
    var totalCredits = creditPersonnelMontant + creditCotisations;
    var impotApresCredit = Math.max(0, impotBrut - totalCredits);
    etapes.push({
      texte: `Crédit personnel : ${fmt(credit)} × ${(IMPOT_QC.tauxCredit * 100).toFixed(0)} % = ${fmt(creditPersonnelMontant)} $.\n` +
        `Crédit pour cotisations (RRQ base + AE + RQAP) : ${fmt(cotisationsBaseAnnuelles)} × ${(IMPOT_QC.tauxCredit * 100).toFixed(0)} % = ${fmt(creditCotisations)} $.\n` +
        `Total crédits : ${fmt(totalCredits)} $.\nImpôt après crédits : ${fmt(impotBrut)} − ${fmt(totalCredits)} = ${fmt(impotApresCredit)} $.`
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
  // Module de calcul — Gratification et paiement rétroactif
  //
  // Source: Revenu Québec — Guide de l'employeur, section 9.5
  // La méthode calcule l'impôt marginal sur la gratification en comparant
  // l'impôt avec et sans la gratification annualisée.
  // ═══════════════════════════════════════════════════════════════════════════

  function calculerImpotGratification({ salaireRegulier, gratification, frequence, cotisationRRQ = 0, cotisationAE = 0, cotisationRQAP = 0, gratificationsPrecedentes = 0, creditPersonnel }) {
    var etapes = [];
    var nombrePeriodes = frequence === "hebdomadaire" ? 52 : frequence === "bihebdomadaire" ? 26 : 12;

    etapes.push({
      texte: `[Calcul de l'impôt sur gratification — Guide de l'employeur, section 9.5](${IMPOT_QC.source})\n` +
        `La retenue d'impôt sur une gratification se calcule en déterminant la différence marginale d'impôt entre le salaire régulier seul et le salaire régulier augmenté de la gratification annualisée.`
    });

    var seuilGratification = IMPOT_QC.montantPersonnel;
    var remunerationEstimative = salaireRegulier * nombrePeriodes + gratification + gratificationsPrecedentes;

    if (remunerationEstimative <= seuilGratification) {
      etapes.push({
        texte: `La rémunération annuelle estimative (${fmt(remunerationEstimative)} $) est ≤ ${seuilGratification.toLocaleString("fr-CA")} $. Retenue d'impôt de 7 % sur la gratification.`
      });
      var impot7 = gratification * 0.07;
      etapes.push({
        texte: `**Résultat** : ${fmt(gratification)} × 7 % = **${fmt(impot7)} $**.`
      });
      return { impot: Math.round(impot7 * 100) / 100, etapes };
    }

    var gratificationTotale = gratification + gratificationsPrecedentes;
    var remunerationAvecGratification = salaireRegulier + gratificationTotale / nombrePeriodes;
    var remunerationAvecGratificationPrecedente = salaireRegulier + gratificationsPrecedentes / nombrePeriodes;

    etapes.push({
      texte: `Rémunération par période avec gratification courante + précédentes : ${fmt(salaireRegulier)} + ${fmt(gratificationTotale)} ÷ ${nombrePeriodes} = ${fmt(remunerationAvecGratification)} $.\n` +
        `Rémunération par période avec gratifications précédentes seulement : ${fmt(salaireRegulier)} + ${fmt(gratificationsPrecedentes)} ÷ ${nombrePeriodes} = ${fmt(remunerationAvecGratificationPrecedente)} $.`
    });

    var impotAvec = calculerImpotProvincial({
      salaireBrut: remunerationAvecGratification,
      frequence: frequence,
      cotisationRRQ: cotisationRRQ,
      cotisationAE: cotisationAE,
      cotisationRQAP: cotisationRQAP,
      creditPersonnel: creditPersonnel
    });

    var impotSans = calculerImpotProvincial({
      salaireBrut: remunerationAvecGratificationPrecedente,
      frequence: frequence,
      cotisationRRQ: cotisationRRQ,
      cotisationAE: cotisationAE,
      cotisationRQAP: cotisationRQAP,
      creditPersonnel: creditPersonnel
    });

    var retenueSuppParPeriode = Math.max(0, impotAvec.impot - impotSans.impot);
    var retenueGratification = retenueSuppParPeriode * nombrePeriodes;

    etapes.push({
      texte: `Impôt par période avec gratification : ${fmt(impotAvec.impot)} $.\n` +
        `Impôt par période sans gratification courante : ${fmt(impotSans.impot)} $.\n` +
        `Retenue supplémentaire par période : ${fmt(retenueSuppParPeriode)} $.`
    });

    etapes.push({
      texte: `**Résultat** : impôt sur la gratification = ${fmt(retenueSuppParPeriode)} × ${nombrePeriodes} = **${fmt(retenueGratification)} $**.`
    });

    return {
      impot: Math.round(retenueGratification * 100) / 100,
      etapes
    };
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // Module de calcul — Gratification et paiement rétroactif (fédéral)
  //
  // Source: ARC — T4001 Guide de l'employeur, section « Primes et
  // augmentations de salaire rétroactives ou montants irréguliers »
  // https://www.canada.ca/fr/agence-revenu/services/formulaires-publications/publications/t4001/guide-employeur-retenues-paie-versements.html
  // ═══════════════════════════════════════════════════════════════════════════

  function calculerImpotFederalGratification({ salaireRegulier, gratification, frequence, cotisationRRQ = 0, cotisationAE = 0, cotisationRQAP = 0, gratificationsPrecedentes = 0, creditPersonnel }) {
    var etapes = [];
    var nombrePeriodes = frequence === "hebdomadaire" ? 52 : frequence === "bihebdomadaire" ? 26 : 12;

    etapes.push({
      texte: `[Calcul de l'impôt fédéral sur gratification — T4001](${IMPOT_FED.source})\n` +
        `La retenue d'impôt fédéral sur une prime se calcule par la méthode marginale : différence d'impôt entre le salaire régulier seul et le salaire augmenté de la prime annualisée.`
    });

    var remunerationEstimative = salaireRegulier * nombrePeriodes + gratification + gratificationsPrecedentes;

    if (remunerationEstimative <= 5000) {
      var impot15 = gratification * 0.10;
      etapes.push({
        texte: `La rémunération annuelle estimative (${fmt(remunerationEstimative)} $) est ≤ 5 000 $. Pour le Québec, retenue de 10 % sur la prime.`
      });
      etapes.push({
        texte: `**Résultat** : ${fmt(gratification)} × 10 % = **${fmt(impot15)} $**.`
      });
      return { impot: Math.round(impot15 * 100) / 100, etapes };
    }

    var gratificationTotale = gratification + gratificationsPrecedentes;
    var remunerationAvecGratification = salaireRegulier + gratificationTotale / nombrePeriodes;
    var remunerationAvecGratificationPrecedente = salaireRegulier + gratificationsPrecedentes / nombrePeriodes;

    etapes.push({
      texte: `Rémunération par période avec prime courante + précédentes : ${fmt(salaireRegulier)} + ${fmt(gratificationTotale)} ÷ ${nombrePeriodes} = ${fmt(remunerationAvecGratification)} $.\n` +
        `Rémunération par période avec primes précédentes seulement : ${fmt(salaireRegulier)} + ${fmt(gratificationsPrecedentes)} ÷ ${nombrePeriodes} = ${fmt(remunerationAvecGratificationPrecedente)} $.`
    });

    var impotAvec = calculerImpotFederal({
      salaireBrut: remunerationAvecGratification,
      frequence: frequence,
      cotisationRRQ: cotisationRRQ,
      cotisationAE: cotisationAE,
      cotisationRQAP: cotisationRQAP,
      creditPersonnel: creditPersonnel
    });

    var impotSans = calculerImpotFederal({
      salaireBrut: remunerationAvecGratificationPrecedente,
      frequence: frequence,
      cotisationRRQ: cotisationRRQ,
      cotisationAE: cotisationAE,
      cotisationRQAP: cotisationRQAP,
      creditPersonnel: creditPersonnel
    });

    var retenueSuppParPeriode = Math.max(0, impotAvec.impot - impotSans.impot);
    var retenueGratification = retenueSuppParPeriode * nombrePeriodes;

    etapes.push({
      texte: `Impôt fédéral par période avec prime : ${fmt(impotAvec.impot)} $.\n` +
        `Impôt fédéral par période sans prime courante : ${fmt(impotSans.impot)} $.\n` +
        `Retenue supplémentaire par période : ${fmt(retenueSuppParPeriode)} $.`
    });

    etapes.push({
      texte: `**Résultat** : impôt fédéral sur la prime = ${fmt(retenueSuppParPeriode)} × ${nombrePeriodes} = **${fmt(retenueGratification)} $**.`
    });

    return {
      impot: Math.round(retenueGratification * 100) / 100,
      etapes
    };
  }


  // ═══════════════════════════════════════════════════════════════════════════

  function cumulBrutEmploye(emp, periodeNum) {
    var total = 0;
    Object.keys(emp.periods || {}).forEach(function (key) {
      if (parseInt(key) < periodeNum) total += Number(emp.periods[key].brut || 0);
    });
    return total;
  }

  function cumulCotisationsRRQ(emp, periodeNum) {
    var rrq1 = 0;
    var rrq2 = 0;
    Object.keys(emp.periods || {}).forEach(function (key) {
      if (parseInt(key) < periodeNum) {
        var rrqTotal = Number(emp.periods[key].rrq || 0);
        var brut = Number(emp.periods[key].brut || 0);
        var cumulBefore = 0;
        Object.keys(emp.periods || {}).forEach(function (k2) {
          if (parseInt(k2) < parseInt(key)) cumulBefore += Number(emp.periods[k2].brut || 0);
        });
        var brutAuDessusMGA = Math.max(0, brut - Math.max(0, RRQ.mga - cumulBefore));
        var cotisableRRQ2 = Math.min(brutAuDessusMGA, Math.max(0, RRQ.mgap - Math.max(cumulBefore, RRQ.mga)));
        var partRRQ2 = cotisableRRQ2 * RRQ.tauxRRQ2;
        if (partRRQ2 > rrqTotal) partRRQ2 = rrqTotal;
        rrq2 += partRRQ2;
        rrq1 += Math.max(0, rrqTotal - partRRQ2);
      }
    });
    return { rrq1: rrq1, rrq2: rrq2 };
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
      cnesst: Number(period.cnesst || 0),
      cnt: Number(period.cnt || 0)
    };
  }

  function sumTotals(list) {
    var s = { brut: 0, extrasRev: 0, pourboires: 0, impotCa: 0, impotQc: 0, rrq: 0, ae: 0, rqap: 0, extrasRet: 0, rrqEmp: 0, aeEmp: 0, rqapEmp: 0, fss: 0, cnesst: 0, cnt: 0 };
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
    CNT: CNT,
    IMPOT_FED: IMPOT_FED,
    IMPOT_QC: IMPOT_QC,

    calculerRQAP: calculerRQAP,
    calculerAE: calculerAE,
    calculerRRQ: calculerRRQ,
    calculerFSS: calculerFSS,
    calculerCNESST: calculerCNESST,
    calculerCNT: calculerCNT,
    calculerImpotFederal: calculerImpotFederal,
    calculerImpotProvincial: calculerImpotProvincial,
    calculerImpotGratification: calculerImpotGratification,
    calculerImpotFederalGratification: calculerImpotFederalGratification,

    cumulBrutEmploye: cumulBrutEmploye,
    cumulCotisationsRRQ: cumulCotisationsRRQ,
    computeYTD: computeYTD,
    computeExtraYTD: computeExtraYTD
  };

})();

# Confidence Propagation in Argument Structures: A Briefing Note

**Author:** Alice (Research Philosopher)
**Date:** 2026-01-24
**Related Issue:** team-0xe (Confidence Model Specification for TEA Platform)

---

## Executive Summary

This briefing reviews the literature on confidence propagation through argument structures, with attention to approaches relevant to assurance cases. Four main paradigms exist: (1) Bayesian networks, (2) Dempster-Shafer theory, (3) argumentation-theoretic frameworks like ASPIC+, and (4) hybrid approaches. Each has distinct epistemic commitments and practical trade-offs.

Additionally, Model-Driven Engineering (MDE) offers significant opportunities for automation, traceability, and dynamic update of confidence assessments—an area highlighted by Steffen Zschaler's work on trustworthy simulations and the OMG's SACM standard.

My recommendation is that the TEA platform adopt a **Dempster-Shafer approach with explicit defeater handling**, aligned with the **SACM metamodel** for interoperability, as this combination best accommodates the epistemic realities of assurance reasoning while enabling MDE benefits.

---

## 1. The Problem: What Should "Confidence" Mean?

Before discussing propagation mechanisms, we must clarify what confidence represents. Three interpretations appear in the literature:

| Interpretation | Description | Implications |
|----------------|-------------|--------------|
| **Subjective probability** | Degree of belief in a claim's truth | Requires priors; forces numerical precision |
| **Evidential support** | Strength of evidence for a claim | Separates belief from ignorance |
| **Argument strength** | Quality of inferential support | Focuses on argument structure, not truth |

**Recommendation:** For assurance cases, evidential support (interpretation 2) is most appropriate. It allows us to distinguish between "no evidence" and "evidence against"—a distinction that subjective probability conflates.

---

## 2. Approaches to Confidence Propagation

### 2.1 Bayesian Networks

The most common approach transforms argument structures (e.g., GSN diagrams) into Bayesian Belief Networks and propagates probabilities accordingly.

**Strengths:**
- Well-understood mathematical foundations
- Established computational tools
- Provides precise numerical outputs

**Weaknesses:**
- Requires prior probability assignments, which are often arbitrary in safety contexts
- Assumes probabilistic independence that may not hold
- Forces complementarity: P(A) + P(not-A) = 1, even when evidence is absent

**Key Literature:** [A normative framework for argument quality](https://link.springer.com/article/10.1007/s11229-015-0815-0) provides Bayesian foundations for argument evaluation.

### 2.2 Dempster-Shafer Theory (DST)

DST generalises Bayesian probability by allowing explicit representation of ignorance. Rather than forcing belief assignments to sum to 1, it distinguishes between belief (evidence for), plausibility (absence of evidence against), and uncertainty.

**Strengths:**
- Naturally represents ignorance without forcing arbitrary priors
- Non-complementarity: support for A does not automatically reduce support for not-A
- Dempster's rule provides principled evidence combination
- [Safety Case Confidence Propagation Based on Dempster-Shafer theory](https://www.researchgate.net/publication/330995896_Safety_Case_Confidence_Propagation_Based_on_Dempster-Shafer_theory) demonstrates direct application to assurance cases

**Weaknesses:**
- Dempster's rule can produce counterintuitive results with highly conflicting evidence
- Computational complexity increases with frame size
- Less intuitive for practitioners unfamiliar with belief functions

### 2.3 Argumentation-Theoretic Approaches (ASPIC+)

[The ASPIC+ framework](https://journals.sagepub.com/doi/10.1080/19462166.2013.869766) provides structured argumentation with explicit handling of defeasible reasoning. Arguments can be attacked on premises, inferences, or conclusions.

**Strengths:**
- Native support for defeaters (see Section 3)
- Weakest-link principle: argument strength limited by weakest component
- Distinguishes strict (deductive) from defeasible (presumptive) inference

**Weaknesses:**
- Standard ASPIC+ produces discrete outcomes (accepted/rejected/undecided), not graded confidence
- Integrating numerical degrees of confidence is an ongoing research area

### 2.4 Hybrid Approaches

Recent work combines argumentation structure with quantitative uncertainty:

- [Confidence assessment in safety argument structure](https://www.sciencedirect.com/science/article/abs/pii/S0888613X23002311) compares quantitative vs. qualitative approaches
- [Certus](https://arxiv.org/html/2505.01894) uses fuzzy sets to express confidence linguistically
- [A Model for Safety Case Confidence Assessment](https://hal.science/hal-01228861v1/document) proposes BBN-based propagation with belief-theoretic foundations

---

## 3. Defeater Handling

John Pollock's taxonomy of defeaters is canonical in epistemology:

| Defeater Type | Effect | Example in Assurance Context |
|---------------|--------|------------------------------|
| **Rebutting** | Provides evidence for the negation of the claim | Test results show the system failed under conditions claimed to be safe |
| **Undercutting** | Attacks the inferential link without supporting negation | The testing methodology was flawed, so test results are unreliable |
| **Undermining** | Attacks the credibility of premises | The evidence source has a conflict of interest |

**Critical Insight:** Different defeater types require different propagation responses:
- Rebutting defeaters reduce confidence in the claim directly
- Undercutting defeaters reduce the weight of the supporting evidence without providing counter-evidence
- Undermining defeaters cascade through dependent inferences

Most quantitative approaches handle rebutting defeaters adequately but struggle with undercutting defeaters. This is a significant gap for assurance cases, where undercutting (e.g., "was the testing representative?") is common.

**Key Literature:** [Defeaters in Epistemology](https://iep.utm.edu/defeaters-in-epistemology/), [Defeasible Reasoning (SEP)](https://plato.stanford.edu/entries/reasoning-defeasible/)

---

## 4. Calibration and Human Trust

A confidence model is only useful if humans interpret it appropriately. Research reveals concerning findings:

**From practitioner studies:**
- Practitioners prefer qualitative methods and express concerns about quantitative approaches
- Common confidence assessment methods: peer review, dialectic reasoning (defeaters), checklists
- Barriers include: additional work, inadequate guidance, subjectivity, and trustworthiness of methods

**From [An investigation of proposed techniques for quantifying confidence in assurance arguments](https://www.sciencedirect.com/science/article/abs/pii/S0925753516302429):**
> "The seductive appearance of computational rigor might cause decision-makers to mistakenly place trust in 'superficially plausible nonsense.'"

**From AI trust calibration research:**
- Confidence scores can help calibrate trust
- Explanations (local feature importance) showed no effect on improving trust calibration
- Appropriate trust requires knowing when to accept and when to reject system outputs

**Recommendation:** Any confidence model for TEA must:
1. Present uncertainty transparently (not false precision)
2. Make assumptions explicit and challengeable
3. Support, not replace, human judgment
4. Be validated through user studies, not just illustrative examples

---

## 5. Model-Driven Engineering Integration

A significant gap in my initial analysis was the intersection with Model-Driven Engineering (MDE). This is highly relevant for TEA, as MDE offers automation, transformation, and traceability benefits that complement confidence assessment.

### 5.1 The SACM Standard

The [Structured Assurance Case Metamodel (SACM)](https://www.omg.org/spec/SACM/) is the OMG standard for model-based assurance cases. Key features:

- Provides a metamodel for representing structured assurance cases
- Combines the Argumentation Metamodel (ARM) and Software Assurance Evidence Metamodel (SAEM)
- Includes facilities for arguing levels of trust in argument elements
- Enables higher-level operations (validation, transformation) on assurance artefacts

**Relevance to TEA:** SACM provides a standardised foundation. Any confidence model should align with or extend SACM's trust facilities rather than creating incompatible representations.

### 5.2 Model-Based Assurance Case Generation

Research on "weaving" assurance cases from design models shows promise:

- [Weaving an Assurance Case from Design](https://ieeexplore.ieee.org/document/7027421/) proposes explicit links between assurance case elements and design models
- Enables automated generation and update of assurance cases as designs evolve
- Supports traceability from evidence to claims

**Strengths:**
- Automation reduces manual effort and errors
- Traceability supports impact analysis when designs change
- Model transformations can propagate confidence updates automatically

**Weaknesses:**
- Requires well-structured design models (not always available)
- Transformation rules encode assumptions about confidence propagation that may be opaque
- Risk of false confidence from automated processes

### 5.3 Steffen Zschaler and MDENet

[Steffen Zschaler](https://steffen-zschaler.de/) (King's College London) directs [MDENet](https://mde-network.com/), the UK expert network for model-driven engineering. His work intersects with assurance in several ways:

- **Simulation Validation:** [Potential and Challenges of Assurance Cases for Simulation Validation](https://kclpure.kcl.ac.uk/portal/en/publications/potential-and-challenges-of-assurance-cases-for-simulation-valida/) (2024) examines how assurance cases can structure validation arguments for simulations
- **Trustworthy Simulations:** Work on domain-specific modelling languages for trustworthy agent-based simulation
- **Consistency Preservation:** Research on maintaining consistency in model transformations—relevant to ensuring confidence assessments remain valid as models evolve

**Key Insight:** Zschaler's work suggests that domain-specific languages (DSLs) may be more appropriate than general-purpose notations for capturing domain-specific confidence semantics. This aligns with the [Certus](https://arxiv.org/html/2505.01894) approach of using DSLs for confidence expression.

### 5.4 Continuous Assurance

Recent work on [Continuous Assurance](https://arxiv.org/html/2511.14805) integrates:
- Design-time assurance (traditional safety cases)
- Runtime assurance (monitoring, adaptation)
- Evolution-time assurance (managing change)

This uses MDE to maintain traceability and automate updates to GSN arguments when underlying artefacts change.

**Implication for TEA:** A confidence model should support not just static assessment but dynamic update as evidence and arguments evolve. MDE provides the infrastructure for this.

### 5.5 MDE Integration Recommendations

| Aspect | Recommendation |
|--------|----------------|
| **Metamodel** | Align with or extend SACM for interoperability |
| **Transformation** | Define explicit transformation rules for confidence propagation |
| **Traceability** | Maintain links from confidence assessments to underlying evidence |
| **DSL** | Consider domain-specific notation for confidence expression (cf. Certus) |
| **Automation** | Support automated update of confidence when linked artefacts change |

---

## 6. Recommendations for TEA Platform (Revised)

Based on this review, I propose the following for the confidence model specification:

### 5.1 Semantic Model
- Adopt **evidential support** interpretation (not subjective probability)
- Use **Dempster-Shafer belief functions** to represent confidence
- This allows explicit representation of:
  - Belief (evidence supporting the claim)
  - Disbelief (evidence against the claim)
  - Uncertainty (absence of evidence either way)

### 5.2 Computation Contract
- Inputs: Evidence assessments as mass functions on {true, false, uncertain}
- Propagation: Modified Dempster's rule with conflict handling
- Defeater handling:
  - Rebutting defeaters add mass to disbelief
  - Undercutting defeaters redistribute mass to uncertainty
  - Undermining defeaters reduce weight of affected evidence
- Output: Belief intervals [Bel, Pl] rather than point estimates

### 5.3 Presentation Guidelines
- Display belief intervals, not single numbers
- Use linguistic labels calibrated to intervals (e.g., "strong support", "weak support", "insufficient evidence")
- Make sensitivity to key inputs visible
- Always show what evidence is missing, not just what is present

### 5.4 Validation Path
- Bob: Run calibration simulations comparing DS vs. Bayesian propagation on synthetic argument structures
- Charlie: Review HCI literature on uncertainty communication; conduct user study on proposed presentation formats

---

## 7. Open Questions

1. **Conflict handling:** When evidence strongly conflicts, how should we aggregate? Dempster's rule is problematic here.
2. **Granularity:** Should confidence attach to claims, evidence, or inference steps?
3. **Dynamics:** How should confidence update as arguments evolve?
4. **Thresholds:** What confidence level is "sufficient" for assurance purposes?

---

## Sources

- [Confidence assessment in safety argument structure - Quantitative vs. qualitative approaches](https://www.sciencedirect.com/science/article/abs/pii/S0888613X23002311)
- [Safety Case Confidence Propagation Based on Dempster-Shafer theory](https://www.researchgate.net/publication/330995896_Safety_Case_Confidence_Propagation_Based_on_Dempster-Shafer_theory)
- [A normative framework for argument quality: argumentation schemes with a Bayesian foundation](https://link.springer.com/article/10.1007/s11229-015-0815-0)
- [The ASPIC+ framework for structured argumentation: a tutorial](https://journals.sagepub.com/doi/10.1080/19462166.2013.869766)
- [Defeaters in Epistemology (IEP)](https://iep.utm.edu/defeaters-in-epistemology/)
- [Defeasible Reasoning (Stanford Encyclopedia of Philosophy)](https://plato.stanford.edu/entries/reasoning-defeasible/)
- [An investigation of proposed techniques for quantifying confidence in assurance arguments](https://www.sciencedirect.com/science/article/abs/pii/S0925753516302429)
- [A Model for Safety Case Confidence Assessment](https://hal.science/hal-01228861v1/document)
- [Confidence in Assurance 2.0 Cases](https://arxiv.org/html/2409.10665)
- [How do practitioners gain confidence in assurance cases?](https://www.sciencedirect.com/science/article/pii/S0950584925001065)
- [Structured Assurance Case Metamodel (SACM) - OMG](https://www.omg.org/spec/SACM/)
- [Model Based System Assurance Using the Structured Assurance Case Metamodel](https://arxiv.org/abs/1905.02427)
- [Weaving an Assurance Case from Design: A Model-Based Approach](https://ieeexplore.ieee.org/document/7027421/)
- [Potential and Challenges of Assurance Cases for Simulation Validation (Zschaler et al.)](https://kclpure.kcl.ac.uk/portal/en/publications/potential-and-challenges-of-assurance-cases-for-simulation-valida/)
- [MDENet - Model-Driven Engineering Network](https://mde-network.com/)
- [Towards Continuous Assurance with Formal Verification and Assurance Cases](https://arxiv.org/html/2511.14805)
- [FASTEN.Safe: A Model-Driven Engineering Tool for Checkable Assurance Cases](https://link.springer.com/chapter/10.1007/978-3-030-54549-9_20)

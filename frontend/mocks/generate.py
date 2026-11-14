"""Generator: fake API responses per docs/design/API_CONTRACT.md -> frontend/mocks/*.json.
Run: python3 frontend/mocks/generate.py frontend/mocks
Plan scores (CLAUDE.md §6.4), wallet and stars (§7.3) are computed, then self-checked against §8."""
import hashlib
import json
import pathlib
import sys

OUT = pathlib.Path(sys.argv[1])
NOTE = "FAKE mock data shaped by docs/design/API_CONTRACT.md v1. Not real Valio data; replace once docs/data-notes.md exists."
TZ = "+02:00"
DAY = "2026-11-14"
SIG = {"alg": "Ed25519", "keyId": "valio-aimo-2026-11", "value": "bW9jay1zaWduYXR1cmU="}
EUR = lambda c: {"cents": c, "currency": "EUR"}
T = lambda hm, d=DAY: f"{d}T{hm}:00{TZ}"
WEIGHTS = [0.5, 0.3, 0.2]
LOW_RELIABILITY = 0.8      # below this a product counts as low-reliability
RELIABILITY_PENALTY = 0.2  # score penalty x share of qty from low-reliability products
REL: dict[str, float] = {}  # productId -> deliveryReliability, filled by line()
YELLOW_CODES = ("OVER_ORDER_LIMIT", "OVER_WEEK_LIMIT", "SUBSTITUTION_NOT_ALLOWED", "LATE_DELIVERY")


def money_text(c):  # Finnish style: €1 308,00
    whole, frac = divmod(c, 100)
    return f"€{whole:,}".replace(",", " ") + f",{frac:02d}"


def mandate(customer, agent, issuer, per_order, subst, late, allergens, priorities, mid):
    m = {
        "mandateId": mid, "customerId": customer, "agentId": agent, "issuedBy": issuer,
        "limits": {"perOrderEur": per_order, "perWeekEur": 3000},
        "substitution": subst, "lateDelivery": late,
        "hardConstraints": {"excludeAllergens": allergens, "requireLabels": []},
        "priorities": priorities, "validUntil": "2026-12-31T23:59:59+02:00",
        "issuedAt": T("10:01"), "status": "ACTIVE", "signature": SIG,
    }
    late_txt = "no late deliveries" if late == "none" else "deliveries up to one day late"
    sub_txt = {"none": "no substitutes", "same_category": "substitutes in the same category", "any": "any substitute"}[subst]
    alg = f", never products containing {', '.join(allergens)}" if allergens else ""
    m["summaryText"] = (f"{issuer['name']} authorises {agent} to order up to €{per_order} per order, "
                        f"with {sub_txt} and {late_txt}{alg}.")
    return m


def line(p, amount, date, substitute):
    REL[p["productId"]] = p["deliveryReliability"]
    packs = -(-amount // p["packSize"]["amount"])  # ceil
    unit = p["unitPriceCents"]
    return {
        "productId": p["productId"],
        "quantity": {"amount": amount, "unit": p["packSize"]["unit"]},
        "salesQuantity": {"amount": packs, "unit": p["salesUnit"]},
        "unitPrice": EUR(unit),
        "comparisonPrice": {**EUR(p["comparisonCents"]), "per": p["packSize"]["unit"]},
        "lineTotal": EUR(packs * unit),
        "availableDate": date,
        "isSubstitute": substitute,
    }


def plan(pid, lines, deadline_date, need_amt, light, reasons, summary):
    on_time = sum(l["quantity"]["amount"] for l in lines if l["availableDate"] <= deadline_date)
    total = sum(l["lineTotal"]["cents"] for l in lines)
    return {
        "planId": pid, "lines": lines, "total": EUR(total),
        "onTime": {"amount": min(on_time, need_amt), "unit": lines[0]["quantity"]["unit"]},
        "policy": {"light": light, "reasons": reasons},
        "summary": f"{summary}, {money_text(total)}",
    }


def score_plans(plans, need_amt, priorities):
    """CLAUDE.md §6.4 step 4. Sustainability is 0 for every mock product (no labels/certificates yet)."""
    cheapest = min(p["total"]["cents"] for p in plans)
    for p in plans:
        qty = sum(l["quantity"]["amount"] for l in p["lines"])
        low = sum(l["quantity"]["amount"] for l in p["lines"] if REL[l["productId"]] < LOW_RELIABILITY)
        vals = {"on_time": round(p["onTime"]["amount"] / need_amt, 3),
                "price": round(cheapest / p["total"]["cents"], 3), "sustainability": 0.0}
        penalty = round(RELIABILITY_PENALTY * low / qty, 3)
        total = sum(w * vals[k] for w, k in zip(WEIGHTS, priorities)) - penalty
        p["score"] = {"total": round(total, 3), "onTime": vals["on_time"], "price": vals["price"],
                      "sustainability": 0.0, "reliabilityPenalty": penalty}


def quote(qid, customer, mid, need, plans, excluded, priorities, at="10:05", expires="14:00"):
    score_plans(plans, need["quantity"]["amount"], priorities)
    plans = sorted(plans, key=lambda p: -p["score"]["total"])
    for tier, p in zip(["best", "better", "good"], plans):
        p["tier"] = tier
        p["recommended"] = tier == "best"
    return {
        "quoteId": qid, "customerId": customer, "mandateId": mid, "status": "QUOTED",
        "createdAt": T(at), "expiresAt": T(expires), "need": need, "plans": plans,
        "excludedProducts": excluded,
        "evidence": [
            {"source": "valio:/api/price", "requestId": f"req_{qid}_p", "at": T(at)},
            {"source": "valio:/api/availability", "requestId": f"req_{qid}_a", "at": T(at)},
        ],
        "scenarioOverlay": False, "signature": SIG,
    }


def stars(kitchen, wallet, safety, hearts):  # CLAUDE.md §7.3
    if safety == 0:
        return 0
    if kitchen == 100 and wallet >= 90 and safety == 100 and hearts >= 1:
        return 3
    if kitchen >= 90 and safety >= 80:
        return 2
    return 1


def wallet(q, chosen):
    """§7.3 Wallet. Baseline 'best compliant plan' = cheapest plan delivering the full need on time
    (falls back to the cheapest plan if none does). shortcut: interpretation pending team decision."""
    need = q["need"]["quantity"]["amount"]
    full = [p["total"]["cents"] for p in q["plans"] if p["onTime"]["amount"] >= need]
    base = min(full or [p["total"]["cents"] for p in q["plans"]])
    over = max(0, chosen["total"]["cents"] - base) * 100 / base
    return max(0, round(100 - 3 * over))


def result(kitchen, wallet_score, safety, hearts, receipt, incident=None, approvals=0):
    return {"kitchen": kitchen, "wallet": wallet_score, "safety": safety, "heartsLeft": hearts,
            "stars": stars(kitchen, wallet_score, safety, hearts), "incident": incident,
            "receiptText": receipt, "logHeadHash": "sha256:" + hashlib.sha256(receipt.encode()).hexdigest()[:16],
            "approvalsAsked": approvals}


def order(oid, q, p, approval_id=None, at="10:06"):
    light = p["policy"]["light"]
    if light in ("GREEN", "BLUE"):
        return {"httpStatus": 201, "body": {
            "orderId": oid, "quoteId": q["quoteId"], "planId": p["planId"], "status": "ORDERED",
            "lines": p["lines"], "total": p["total"], "createdAt": T(at)}}
    if light == "YELLOW":
        return {"httpStatus": 202, "body": {
            "orderId": oid, "status": "PENDING_APPROVAL", "approvalId": approval_id,
            "reasons": [r for r in p["policy"]["reasons"] if r in YELLOW_CODES]}}
    return {"httpStatus": 403, "body": {"error": {"code": "POLICY_BLOCKED", "message": "Plan has a RED result.",
                                                  "requestId": "req_blk", "details": {"planId": p["planId"]}}}}


def approval(aid, oid, q, reason_text, explanation, at="10:06"):
    best = q["plans"][0]
    return {
        "approvalId": aid, "orderId": oid, "quoteId": q["quoteId"], "status": "OPEN",
        "reasons": [r for r in best["policy"]["reasons"] if r in YELLOW_CODES], "reasonText": reason_text,
        "options": [{"planId": p["planId"], "tier": p["tier"], "recommended": p["recommended"],
                     "summary": p["summary"]} for p in q["plans"]],
        "agentExplanation": explanation,
        "deadline": T(at).replace(":00+", ":20+"), "createdAt": T(at),  # 20 s real-time countdown
    }


def step(search, q, oid, aid=None, reason_text="", explanation="", at="10:06"):
    """One agent attempt: search -> quote -> order on the recommended plan (-> approval if YELLOW)."""
    best = q["plans"][0]
    apr = approval(aid, oid, q, reason_text, explanation, at) if best["policy"]["light"] == "YELLOW" else None
    return {"search": search, "quote": q, "order": order(oid, q, best, aid, at), "approval": apr}


def log_chain(customer, agent, events):
    prev, out = "sha256:" + "0" * 16, []
    for seq, (hm, actor, typ, light, reasons, summary, refs) in enumerate(events, 1):
        ev = {"seq": seq, "eventId": f"evt_{seq}", "at": T(hm), "actor": actor, "type": typ,
              "customerId": customer, "agentId": agent, "requestId": f"req_{seq:03d}",
              "light": light, "reasons": reasons, "summary": summary, "refs": refs, "prevHash": prev}
        payload = json.dumps({k: v for k, v in ev.items() if k != "prevHash"}, sort_keys=True, separators=(",", ":"))
        ev["hash"] = "sha256:" + hashlib.sha256((prev + payload).encode()).hexdigest()[:16]
        prev = ev["hash"]
        out.append(ev)
    return out


def search_row(p, excluded=None):
    keys = ["productId", "name", "brand", "category", "salesUnit", "packSize", "labels", "allergens",
            "carbonCategory", "deliveryReliability"]
    return {**{k: p[k] for k in keys}, "excluded": excluded}


def start(level_id, title, customer, brief, deadline):
    return {"sessionId": f"ses_{level_id}", "level": {
        "levelId": level_id, "title": title, "customer": customer, "brief": brief,
        "deadline": deadline, "closingTime": T("14:00")},
        "clock": {"start": "10:00", "end": "14:00", "realSecondsPerGameMinute": 0.25},
        "hearts": 3, "tokens": {"human": "mock-human-token", "agent": "mock-agent-token"}}


def finish(level):
    level["compare"] = {"levelId": level["start"]["level"]["levelId"],
                        "presets": {k: v["result"] for k, v in level["presets"].items()}}
    return level


def write(name, data):
    (OUT / name).write_text(json.dumps({"_note": NOTE, **data}, ensure_ascii=False, indent=2) + "\n")


OUT.mkdir(parents=True, exist_ok=True)
CARBON_MILK = {"category": "milk", "kgCo2ePerKg": {"min": 1.1, "max": 1.4}}
CARBON_CHEESE = {"category": "cheese", "kgCo2ePerKg": {"min": 8.0, "max": 13.0}}
CARBON_SPREAD = {"category": "spreads", "kgCo2ePerKg": {"min": 2.0, "max": 3.5}}
PRIO_DEFAULT = ["on_time", "price", "sustainability"]
PRIO_PRICE = ["price", "on_time", "sustainability"]

# ======================= discovery =======================
write("discovery.json", {"response": {
    "provider": "Valio Aimo (mock)", "protocolVersion": "1.0-draft", "baseUrl": "http://localhost:8000/v1",
    "capabilities": ["search", "quote", "order", "mandate", "approval", "audit_log"],
    "mandate": {"schemaUrl": "http://localhost:8000/v1/schemas/mandate.json",
                "substitutionLevels": ["none", "same_category", "any"], "lateDeliveryLevels": ["none", "one_day"]},
    "signing": {"alg": "Ed25519", "keys": [{"keyId": "valio-aimo-2026-11", "publicKey": "bW9jay1wdWJsaWMta2V5"}],
                "canonicalization": "JSON, sorted keys, no whitespace"},
    "policy": {"lights": ["GREEN", "BLUE", "YELLOW", "RED"],
               "reasonCodesUrl": "http://localhost:8000/v1/schemas/reason-codes.json"},
    "dataDisclosure": {"public": ["catalog", "labels", "certificates", "categoryCarbon"],
                       "customerScoped": ["netPrices", "quotes", "orders", "auditLog"],
                       "neverExposed": ["purchasePrices", "margins", "otherCustomers", "supplierContracts"]}}})

# ======================= Level 1: The Weekly Order =======================
C1 = {"customerId": "123", "name": "Hotel Aurora (fictional)", "type": "hotel"}
AG1, ISS1 = "kitchenbuyer-hotel-aurora", {"name": "Anna Virtanen", "role": "Kitchen manager"}
MON, TUE = "2026-11-16", "2026-11-17"
VALIO_LF = {"productId": "460013", "name": "Lactose-free milk drink 1.5% 10 l bag-in-box (mock)", "brand": "Valio",
            "category": "milk", "salesUnit": "BIB", "packSize": {"amount": 10, "unit": "l"},
            "labels": ["lactose_free"], "allergens": ["milk"], "carbonCategory": CARBON_MILK,
            "deliveryReliability": 0.97, "unitPriceCents": 1290, "comparisonCents": 129}
# Premium other brand: makes the on-time split plan clearly dearer than "Valio, 300 l on Tuesday".
NORD_LF = {**VALIO_LF, "productId": "460063", "name": "Nordlakt premium lactose-free milk 10 l (mock)",
           "brand": "Nordlakt", "deliveryReliability": 0.91, "unitPriceCents": 2500, "comparisonCents": 250}
POHJ_LF = {**VALIO_LF, "productId": "460056", "name": "Pohjola Farm lactose-free milk 10 l (mock)",
           "brand": "Pohjola Farm", "deliveryReliability": 0.62, "unitPriceCents": 1950, "comparisonCents": 195}
NEED1 = {"description": "Lactose-free milk for the hotel", "quantity": {"amount": 1000, "unit": "l"},
         "deadline": T("06:00", MON), "candidateProductIds": ["460013", "460063", "460056"]}
SEARCH1 = {"results": [search_row(VALIO_LF), search_row(NORD_LF), search_row(POHJ_LF)], "total": 3}


def l1_quote(preset, mid, prio, policies):
    plans = [
        plan("pln_a", [line(VALIO_LF, 700, MON, False), line(NORD_LF, 300, MON, True)], MON, 1000,
             *policies["pln_a"], "700 l Valio + 300 l Nordlakt, all Monday"),
        plan("pln_b", [line(VALIO_LF, 700, MON, False), line(VALIO_LF, 300, TUE, False)], MON, 1000,
             *policies["pln_b"], "1 000 l Valio: 700 l Monday + 300 l Tuesday"),
        plan("pln_c", [line(POHJ_LF, 1000, MON, True)], MON, 1000,
             *policies["pln_c"], "1 000 l Pohjola Farm, Monday (delivery reliability 62 %)"),
    ]
    return quote(f"qt_l1_{preset}", "123", mid, NEED1, plans, [], prio)


L1_EXPLAIN = ("Only 700 l of Valio milk can arrive by Monday. Topping up with 300 l of Nordlakt keeps all "
              "1 000 l on time but costs more; waiting for Valio means 300 l arrives Tuesday.")
level1 = {"start": start("level1", "The Weekly Order", C1, "1 000 l lactose-free milk by Monday 06:00.",
                         T("06:00", MON)), "presets": {}}
for preset, per_order, subst, late, prio, policies in [
    ("strict", 200, "none", "none", PRIO_DEFAULT,
     {"pln_a": ("YELLOW", ["OVER_ORDER_LIMIT", "SUBSTITUTION_NOT_ALLOWED", "SPLIT_ORDER"]),
      "pln_b": ("YELLOW", ["OVER_ORDER_LIMIT", "LATE_DELIVERY", "SPLIT_ORDER"]),
      "pln_c": ("YELLOW", ["OVER_ORDER_LIMIT", "SUBSTITUTION_NOT_ALLOWED"])}),
    ("balanced", 500, "same_category", "none", PRIO_DEFAULT,
     {"pln_a": ("YELLOW", ["OVER_ORDER_LIMIT", "SPLIT_ORDER", "SUBSTITUTION_ALLOWED"]),
      "pln_b": ("YELLOW", ["OVER_ORDER_LIMIT", "LATE_DELIVERY", "SPLIT_ORDER"]),
      "pln_c": ("YELLOW", ["OVER_ORDER_LIMIT", "SUBSTITUTION_ALLOWED"])}),
    ("loose", 2000, "any", "one_day", PRIO_PRICE,
     {"pln_a": ("BLUE", ["SPLIT_ORDER", "SUBSTITUTION_ALLOWED"]),
      "pln_b": ("BLUE", ["SPLIT_ORDER"]),
      "pln_c": ("BLUE", ["SUBSTITUTION_ALLOWED"])}),
]:
    mid = f"mdt_l1_{preset}"
    q = l1_quote(preset, mid, prio, policies)
    best = q["plans"][0]
    text = f"Total {money_text(best['total']['cents'])} is above your €{per_order},00 per-order limit."
    s = step(SEARCH1, q, f"ord_l1_{preset}", f"apr_l1_{preset}", text, L1_EXPLAIN)
    if preset == "strict":
        res = result(70, 100, 100, 0,
                     "Every plan broke your mandate (over €200, a substitute or a late delivery), so your agent had "
                     "to ask you 4 times. After 3 hearts the last request expired and 300 l was never ordered.",
                     approvals=4)
    elif preset == "balanced":
        res = result(100, wallet(q, best), 100, 2,
                     f"Your agent bought 700 l of Valio and 300 l of Nordlakt, all arriving Monday. You approved "
                     f"once because the total {money_text(best['total']['cents'])} was above your €500 limit.",
                     approvals=1)
    else:
        res = result(70, wallet(q, best), 100, 3,
                     f"Your agent did exactly what your mandate allowed: it picked the cheapest plan, "
                     f"{best['summary']}. One day late was allowed, so it never asked you. "
                     f"Monday breakfast was 300 l short.", approvals=0)
    level1["presets"][preset] = {"mandate": mandate("123", AG1, ISS1, per_order, subst, late, ["peanut"], prio, mid),
                                 "steps": [s], "result": res}

bq = level1["presets"]["balanced"]["steps"][0]["quote"]
level1["presets"]["balanced"]["log"] = log_chain("123", AG1, [
    ("10:00", "scenario", "SCENARIO_OVERLAY", None, [], "Level 1 loaded (no overlay needed).", {}),
    ("10:01", "human", "MANDATE_SIGNED", None, [], "Anna Virtanen signed mandate mdt_l1_balanced.",
     {"mandateId": "mdt_l1_balanced"}),
    ("10:03", "agent", "SEARCH", None, [], "Searched “lactose-free milk”: 3 products.", {}),
    ("10:05", "gateway", "QUOTE_CREATED", "YELLOW", bq["plans"][0]["policy"]["reasons"],
     f"Quote qt_l1_balanced: 3 plans, best {money_text(bq['plans'][0]['total']['cents'])}.", {"quoteId": bq["quoteId"]}),
    ("10:06", "gateway", "ORDER_PENDING_APPROVAL", "YELLOW", ["OVER_ORDER_LIMIT"],
     "Order ord_l1_balanced needs approval: total above €500 limit.",
     {"quoteId": bq["quoteId"], "orderId": "ord_l1_balanced", "approvalId": "apr_l1_balanced"}),
    ("10:06", "gateway", "APPROVAL_SHOWN", "YELLOW", ["OVER_ORDER_LIMIT"], "Approval shown to manager (2 hearts left).",
     {"approvalId": "apr_l1_balanced"}),
    ("10:07", "human", "APPROVAL_DECIDED", None, [], "Manager approved plan pln_a.", {"approvalId": "apr_l1_balanced"}),
    ("10:07", "gateway", "ORDER_CREATED", "GREEN", [], "Order ord_l1_balanced ORDERED → CONFIRMED.",
     {"orderId": "ord_l1_balanced"}),
])
write("level1.json", finish(level1))

# ======================= Level 2: The Stock-out =======================
# Standing order with two deliveries a week (Wed + Fri). Edam is sales-blocked all week, so each
# delivery is its own need/quote/order: Strict asks twice, Balanced substitutes twice without asking.
C2 = {"customerId": "456", "name": "Ravintola Kivi (fictional)", "type": "restaurant"}
AG2, ISS2 = "kitchenbuyer-ravintola-kivi", {"name": "Mikko Laine", "role": "Head chef"}
WED, FRI = "2026-11-18", "2026-11-20"
EDAM = {"productId": "520101", "name": "Edam cheese 1 kg block (mock)", "brand": "Valio", "category": "cheese",
        "salesUnit": "PCE", "packSize": {"amount": 1, "unit": "kg"}, "labels": [], "allergens": ["milk"],
        "carbonCategory": CARBON_CHEESE, "deliveryReliability": 0.95, "unitPriceCents": 1190, "comparisonCents": 1190}
GOUDA = {**EDAM, "productId": "520144", "name": "Gouda cheese 1 kg block (mock)", "unitPriceCents": 1240,
         "comparisonCents": 1240, "deliveryReliability": 0.96}
EXCL2 = [{"productId": "520101", "light": "RED", "reason": "SALES_BLOCKED"}]
SEARCH2 = {"results": [search_row(EDAM, {"light": "RED", "reason": "SALES_BLOCKED"}), search_row(GOUDA)], "total": 2}
level2 = {"start": start("level2", "The Stock-out", C2,
                         "Standing order: 40 kg Edam by Wednesday 06:00 and 40 kg by Friday 06:00.",
                         T("06:00", FRI)), "presets": {}}
for preset, subst, light, reasons, hearts in [
    ("strict", "none", "YELLOW", ["SUBSTITUTION_NOT_ALLOWED"], 1),
    ("balanced", "same_category", "BLUE", ["SUBSTITUTION_ALLOWED"], 3),
]:
    mid = f"mdt_l2_{preset}"
    steps = []
    for n, (day, at) in enumerate([(WED, "10:06"), (FRI, "10:30")], 1):
        need = {"description": f"Standing order: Edam cheese, delivery {n} of 2", "quantity": {"amount": 40, "unit": "kg"},
                "deadline": T("06:00", day), "candidateProductIds": ["520101", "520144"]}
        q = quote(f"qt_l2_{preset}_{n}", "456", mid, need,
                  [plan("pln_a", [line(GOUDA, 40, day, True)], day, 40, light, reasons, "40 kg Gouda instead of Edam")],
                  EXCL2, PRIO_DEFAULT, at=at)
        steps.append(step(SEARCH2, q, f"ord_l2_{preset}_{n}", f"apr_l2_{preset}_{n}",
                          "Gouda is a substitute, and your mandate allows no substitutes.",
                          "Edam is blocked from sale this week. Gouda is the closest cheese, €0,50/kg more.", at))
    res = (result(100, 100, 100, hearts, "Edam was blocked from sale all week. Your agent had to ask you before each "
                  "delivery (Wednesday and Friday) to switch to Gouda; you approved both.", approvals=2)
           if light == "YELLOW" else
           result(100, 100, 100, hearts, "Edam was blocked from sale all week. Your agent switched both deliveries to "
                  "Gouda in the same category (+€0,50/kg) and told you without asking.", approvals=0))
    level2["presets"][preset] = {
        "mandate": mandate("456", AG2, ISS2, 500, subst, "none", [], PRIO_DEFAULT, mid),
        "steps": steps, "result": res}
write("level2.json", finish(level2))

# ======================= Level 3: Allergy Emergency =======================
C3 = {"customerId": "789", "name": "Koivu School kitchen (fictional)", "type": "school"}
AG3, ISS3 = "kitchenbuyer-koivu-school", {"name": "Liisa Korhonen", "role": "School kitchen manager"}
THU = "2026-11-19"
BASE_SP = {"productId": "610001", "name": "Plant-based spread 400 g (mock)", "brand": "Valio", "category": "spreads",
           "salesUnit": "PCE", "packSize": {"amount": 1, "unit": "pack"}, "labels": [], "allergens": [],
           "carbonCategory": CARBON_SPREAD, "deliveryReliability": 0.94, "unitPriceCents": 389, "comparisonCents": 973}
SAFE_SP = {**BASE_SP, "productId": "610022", "name": "Sunflower spread 400 g (mock)", "brand": "Nordlakt",
           "unitPriceCents": 420, "comparisonCents": 1050}
NUT_SP = {**BASE_SP, "productId": "610035", "name": "Peanut & oat spread 400 g (mock)", "brand": "Pohjola Farm",
          "allergens": ["peanut"], "unitPriceCents": 310, "comparisonCents": 775}
NEED3 = {"description": "Spread for school breakfast (usual product unavailable)",
         "quantity": {"amount": 60, "unit": "pack"}, "deadline": T("06:00", THU),
         "candidateProductIds": ["610001", "610022", "610035"]}
level3 = {"start": start("level3", "Allergy Emergency", C3,
                         "60 packs of spread by Thursday 06:00. Usual product unavailable.", T("06:00", THU)),
          "presets": {}}
for preset, allergens in [("allergen_on", ["peanut"]), ("allergen_off", [])]:
    mid = f"mdt_l3_{preset}"
    plans = [plan("pln_safe", [line(SAFE_SP, 60, THU, True)], THU, 60, "BLUE", ["SUBSTITUTION_ALLOWED"],
                  "60 packs sunflower spread, Thursday")]
    excl = [{"productId": "610001", "light": "RED", "reason": "SALES_BLOCKED"}]
    if allergens:
        excl.append({"productId": "610035", "light": "RED", "reason": "ALLERGEN_EXCLUDED"})
    else:
        plans.append(plan("pln_nut", [line(NUT_SP, 60, THU, True)], THU, 60, "BLUE", ["SUBSTITUTION_ALLOWED"],
                          "60 packs peanut & oat spread, Thursday"))
    q = quote(f"qt_l3_{preset}", "789", mid, NEED3, plans, excl, PRIO_PRICE)
    best = q["plans"][0]
    search = {"results": [search_row(BASE_SP, {"light": "RED", "reason": "SALES_BLOCKED"}), search_row(SAFE_SP),
                          search_row(NUT_SP, {"light": "RED", "reason": "ALLERGEN_EXCLUDED"} if allergens else None)],
              "total": 3}
    res = (result(100, wallet(q, best), 100, 3, "The cheapest spread contains peanut, so the gateway blocked it. "
                  "Your agent bought 60 packs of sunflower spread instead.", approvals=0) if allergens else
           result(100, wallet(q, best), 0, 3, "Your agent bought 60 packs of Peanut & oat spread because it was "
                  "cheapest. Nothing stopped it: the allergen rule was off.",
                  incident={"type": "SAFETY", "productId": "610035", "reason": "Contains peanut"}, approvals=0))
    level3["presets"][preset] = {
        "mandate": mandate("789", AG3, ISS3, 500, "same_category", "none", allergens, PRIO_PRICE, mid),
        "steps": [step(search, q, f"ord_l3_{preset}")], "result": res}
write("level3.json", finish(level3))

# ---------- self-check ----------
data = {f: json.loads((OUT / f"{f}.json").read_text()) for f in ("level1", "level2", "level3")}
for f, d in data.items():
    for name, pr in d["presets"].items():
        for s in pr["steps"]:
            q = s["quote"]
            for p in q["plans"]:
                assert p["total"]["cents"] == sum(l["lineTotal"]["cents"] for l in p["lines"]), (f, name)
                assert all(isinstance(l["lineTotal"]["cents"], int) for l in p["lines"]), (f, name)
            assert [p["score"]["total"] for p in q["plans"]] == sorted((p["score"]["total"] for p in q["plans"]),
                                                                        reverse=True), (f, name)
            assert (s["approval"] is not None) == (q["plans"][0]["policy"]["light"] == "YELLOW"), (f, name)
        r = pr["result"]
        assert r["stars"] == stars(r["kitchen"], r["wallet"], r["safety"], r["heartsLeft"]), (f, name)

# Expected outcomes, CLAUDE.md §8
P1 = data["level1"]["presets"]
assert P1["strict"]["result"]["stars"] == 1 and P1["strict"]["result"]["kitchen"] == 70
assert P1["balanced"]["result"]["stars"] == 3 and P1["balanced"]["result"]["approvalsAsked"] == 1
lb = P1["loose"]["steps"][0]["quote"]["plans"][0]
assert lb["planId"] == "pln_b" and lb["policy"]["light"] == "BLUE", "Loose must auto-pick Valio Mon+Tue"
assert P1["loose"]["result"] == {**P1["loose"]["result"], "kitchen": 70, "stars": 1, "approvalsAsked": 0}
bal_plans = {p["planId"]: p["total"]["cents"] for p in P1["balanced"]["steps"][0]["quote"]["plans"]}
assert bal_plans["pln_b"] < bal_plans["pln_a"], "Valio Mon+Tue must be cheaper than the split with the other brand"
P2 = data["level2"]["presets"]
assert P2["strict"]["result"]["approvalsAsked"] >= 2 and P2["balanced"]["result"]["approvalsAsked"] == 0
assert sum(s["approval"] is not None for s in P2["strict"]["steps"]) == P2["strict"]["result"]["approvalsAsked"]
P3 = data["level3"]["presets"]
assert P3["allergen_on"]["result"]["safety"] == 100 and P3["allergen_off"]["result"]["stars"] == 0
print("ok:", sorted(x.name for x in OUT.glob("*.json")))

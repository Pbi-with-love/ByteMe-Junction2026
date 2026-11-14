"""Generator: fake API responses per docs/design/API_CONTRACT.md -> frontend/mocks/*.json.
Run: python3 frontend/mocks/generate.py frontend/mocks
Plan scores (CLAUDE.md §6.4), wallet and stars (§7.3) are computed, then self-checked against §8."""
import copy
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
UNKNOWN_RELIABILITY_PENALTY = 0.05  # reliability unknown, v1.1
REL: dict[str, float | None] = {}  # productId -> deliveryReliability, filled by line()
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
    allergen_names = {"AP": "peanut", "AE": "egg", "AM": "milk", "AW": "wheat", "AN": "tree nut", "SA": "sesame"}
    readable = ", ".join(f"{allergen_names.get(code, code)} ({code})" for code in allergens)
    alg = f", never products containing {readable}" if allergens else ""
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
        low = sum(l["quantity"]["amount"] for l in p["lines"]
                  if REL[l["productId"]] is not None and REL[l["productId"]] < LOW_RELIABILITY)
        unknown = any(REL[l["productId"]] is None for l in p["lines"])
        vals = {"on_time": round(p["onTime"]["amount"] / need_amt, 3),
                "price": round(cheapest / p["total"]["cents"], 3), "sustainability": 0.0}
        penalty = round(RELIABILITY_PENALTY * low / qty + (UNKNOWN_RELIABILITY_PENALTY if unknown else 0), 3)
        total = sum(w * vals[k] for w, k in zip(WEIGHTS, priorities)) - penalty
        p["score"] = {"total": round(total, 3), "onTime": vals["on_time"], "price": vals["price"],
                      "sustainability": 0.0, "reliabilityPenalty": penalty}


def quote(qid, customer, mid, need, plans, excluded, priorities, at="10:05", expires="14:00", overlay=False):
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
        "scenarioOverlay": overlay, "signature": SIG,
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
            "receiptText": receipt, "logHeadHash": None,  # set by seal() from the preset's log
            "approvalsAsked": approvals, "totalCost": None, "heartsUsed": 0}


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


GENESIS = "sha256:" + "0" * 16


def event_hash(prev, ev):  # disclosure is a valio-view annotation, not part of the chain
    payload = json.dumps({k: v for k, v in ev.items() if k not in ("prevHash", "hash", "disclosure")},
                         sort_keys=True, separators=(",", ":"))
    return "sha256:" + hashlib.sha256((prev + payload).encode()).hexdigest()[:16]


def log_chain(customer, agent, events):
    prev, out = GENESIS, []
    for seq, (hm, actor, typ, light, reasons, summary, refs) in enumerate(events, 1):
        ev = {"seq": seq, "eventId": f"evt_{seq}", "at": T(hm), "actor": actor, "type": typ,
              "customerId": customer, "agentId": agent, "requestId": f"req_{seq:03d}",
              "light": light, "reasons": reasons, "summary": summary, "refs": refs, "prevHash": prev}
        ev["hash"] = prev = event_hash(prev, ev)
        out.append(ev)
    return out


def verify_chain(log):  # contract §7 GET /v1/log/verify
    prev = GENESIS
    for ev in log:
        if ev["prevHash"] != prev or event_hash(prev, ev) != ev["hash"]:
            return {"valid": False, "brokenAtSeq": ev["seq"]}
        prev = ev["hash"]
    return {"valid": True, "events": len(log), "headHash": prev}


# Spec 006 table: what each agent-facing call returned vs withheld (discovery vocabulary).
DISCLOSURE = {
    "SEARCH": {"returnedToAgent": ["catalog", "labels", "certificates", "categoryCarbon"],
               "withheld": ["supplierContracts"]},
    "QUOTE_CREATED": {"returnedToAgent": ["netPrices", "availability", "closingTime", "quotes"],
                      "withheld": ["purchasePrices", "margins", "otherCustomers"]},
    "DATA_BOUNDARY_BLOCKED": {"returnedToAgent": [], "withheld": ["purchasePrices", "margins"]},
    **{t: {"returnedToAgent": ["orders"], "withheld": []}
       for t in ("ORDER_CREATED", "ORDER_PENDING_APPROVAL", "POLICY_BLOCKED")},
}


def plus_min(hm, n=1):
    h, m = divmod(int(hm[:2]) * 60 + int(hm[3:]) + n, 60)
    return f"{h:02d}:{m:02d}"


def decision_records(apr):
    """Spec 004: recorded POST /v1/approvals/{id} responses for each possible decision."""
    def ok(status, decision, order_status):
        return {"httpStatus": 200, "body": {**apr, "status": status, "decision": decision, "orderStatus": order_status}}
    aid = apr["approvalId"]
    return {
        "approved": ok("APPROVED", "approved", "CONFIRMED"),
        "rejected": ok("REJECTED", "rejected", "REJECTED"),
        # every alternative here is YELLOW for a reason the human's decision covers (contract §5)
        "alternative": {o["planId"]: ok("APPROVED", f"alternative:{o['planId']}", "CONFIRMED")
                        for o in apr["options"] if not o["recommended"]},
        "expired": ok("EXPIRED", "expired", "EXPIRED"),
        "conflict": {"httpStatus": 409, "body": {"error": {
            "code": "INVALID_STATE", "message": f"Approval {aid} is already closed.",
            "requestId": f"req_{aid}_409", "details": {"approvalId": aid}}}},
    }


def created_text(oid, p):
    ids = ", ".join(dict.fromkeys(l["productId"] for l in p["lines"]))
    return f"Order {oid} ORDERED → CONFIRMED: plan {p['planId']} ({ids})."


def seal(level, name, overlay, path=(), probe=False):
    """Replay a preset's recorded run (steps + the human's `path` of decisions) into approval events,
    decisions, the buyer log, valioLog, verify and the result's totals."""
    pr, path = level["presets"][name], list(path)
    customer = level["start"]["level"]["customer"]["customerId"]
    m = pr["mandate"]
    hearts = level["start"]["hearts"]
    has_overlay = any(s["quote"].get("scenarioOverlay") for s in pr["steps"])
    load_type, load_actor = ("SCENARIO_OVERLAY", "scenario") if has_overlay else ("LEVEL_LOADED", "gateway")
    events = [("10:00", load_actor, load_type, None, [], overlay, {}),
              ("10:01", "human", "MANDATE_SIGNED", None, [], f"{m['issuedBy']['name']} signed mandate {m['mandateId']}.",
               {"mandateId": m["mandateId"]})]
    decisions, costs, used = {}, [], 0
    for i, s in enumerate(pr["steps"]):
        q, best, apr, o = s["quote"], s["quote"]["plans"][0], s["approval"], s["order"]["body"]
        qat = q["createdAt"][11:16]
        excl = [r for r in s["search"]["results"] if r["excluded"]]
        events.append((qat, "agent", "SEARCH", "RED" if excl else None,
                       list(dict.fromkeys(r["excluded"]["reason"] for r in excl)),
                       f"Searched the catalog: {s['search']['total']} products"
                       + (f", excluded {', '.join(r['productId'] for r in excl)}." if excl else "."), {}))
        if probe and i == 0 and name == "balanced":  # dedicated M-05 scenario probe demo
            events.append((qat, "gateway", "DATA_BOUNDARY_BLOCKED", "RED", ["DATA_BOUNDARY"],
                           "Agent asked for purchase prices; refused.", {}))
        n = len(q["plans"])
        events.append((qat, "gateway", "QUOTE_CREATED", best["policy"]["light"], best["policy"]["reasons"],
                       f"Quote {q['quoteId']}: {n} plan{'s' * (n > 1)}, best {money_text(best['total']['cents'])}.",
                       {"quoteId": q["quoteId"]}))
        refs = {"quoteId": q["quoteId"], "orderId": o["orderId"]}
        if s["order"]["httpStatus"] == 201:
            events.append((o["createdAt"][11:16], "gateway", "ORDER_CREATED", best["policy"]["light"],
                           best["policy"]["reasons"], created_text(o["orderId"], best), refs))
            costs.append(best["total"]["cents"])
            continue
        oat, aid = apr["createdAt"][11:16], apr["approvalId"]
        refs["approvalId"] = aid
        events.append((oat, "gateway", "ORDER_PENDING_APPROVAL", "YELLOW", o["reasons"],
                       f"Order {o['orderId']} needs approval: {apr['reasonText']}", refs))
        if hearts == 0:  # contract §9: at 0 hearts new approvals are created already EXPIRED
            apr.update(status="EXPIRED", reasons=apr["reasons"] + ["ATTENTION_EXHAUSTED"],
                       reasonText="You had no attention left, so this request expired before it reached you.")
            events.append((oat, "gateway", "APPROVAL_EXPIRED", None, apr["reasons"],
                           f"Approval {aid} expired unseen: no hearts left. Order {o['orderId']} EXPIRED.", refs))
        else:
            hearts, used = hearts - 1, used + 1
            events.append((oat, "gateway", "APPROVAL_SHOWN", "YELLOW", apr["reasons"],
                           f"Approval shown to manager ({hearts} heart{'s' * (hearts != 1)} left).", {"approvalId": aid}))
            decisions[aid] = decision_records(apr)
            d = path.pop(0)
            events.append((plus_min(oat), "human", "APPROVAL_DECIDED", None, [],
                           f"Manager {d} plan {best['planId']}." if d == "approved"
                           else f"Manager {d} the request; order {o['orderId']} {d.upper()}.", {"approvalId": aid}))
            if d == "approved":
                events.append((plus_min(oat), "gateway", "ORDER_CREATED", "GREEN", [],
                               created_text(o["orderId"], best), refs))
                costs.append(best["total"]["cents"])
        s["approvalEvent"] = {"approvalId": aid, "deadline": apr["deadline"], "heartsLeft": hearts}
    assert not path, (name, "unused decisions", path)
    log = log_chain(customer, m["agentId"], events)
    pr["decisions"] = decisions
    pr["log"] = log
    pr["valioLog"] = [{**e, "disclosure": DISCLOSURE[e["type"]]} if e["type"] in DISCLOSURE else e for e in log]
    pr["verify"] = verify_chain(log)
    pr["result"].update(logHeadHash=log[-1]["hash"], totalCost=EUR(sum(costs)) if costs else None, heartsUsed=used)


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
# Product ids, names, salesUnit, litres per unit, allergens and reliability follow the real catalog rows
# listed in docs/design/Agent_Kitchen–Main_Scenarios.md. PRICES ARE PLACEHOLDERS until real
# /api/price responses are recorded. Allergen codes are the catalog's (AM milk, AE egg, AW wheat, AP peanut).
CARBON_MILK = {"category": "10400", "kgCo2ePerKg": {"min": 1.1, "max": 1.1}}
CARBON_BAKERY = {"category": "bakery (mock)", "kgCo2ePerKg": {"min": 1.0, "max": 1.6}}
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
VALIO_LF = {"productId": "464201", "name": "Valio semi-skimmed 1 l UHT", "brand": "Valio",
            "category": "10400", "salesUnit": "ST", "packSize": {"amount": 1, "unit": "l"},
            "labels": [], "allergens": ["AM"], "carbonCategory": CARBON_MILK,
            "deliveryReliability": 1.0, "unitPriceCents": 129, "comparisonCents": 129}
# Substitute priced high (placeholder) so the on-time split is clearly dearer than "300 l on Tuesday" (§8 Loose).
EILA_LF = {**VALIO_LF, "productId": "464398", "name": "Valio Eila semi-skimmed 1 l UHT",
           "unitPriceCents": 250, "comparisonCents": 250}
NOVOBOX = {**VALIO_LF, "productId": "463038", "name": "Valio Eila semi-skimmed 10 l Novobox", "salesUnit": "KI",
           "packSize": {"amount": 20, "unit": "l"}, "deliveryReliability": None,
           "unitPriceCents": 3900, "comparisonCents": 195}
NEED1 = {"description": "Lactose-free milk for the hotel", "quantity": {"amount": 1000, "unit": "l"},
         "deadline": T("06:00", MON), "candidateProductIds": ["464201", "464398", "463038"]}
SEARCH1 = {"results": [search_row(VALIO_LF), search_row(EILA_LF), search_row(NOVOBOX)], "total": 3}


def l1_quote(preset, mid, prio, policies):
    plans = [
        plan("pln_a", [line(VALIO_LF, 700, MON, False), line(EILA_LF, 300, MON, True)], MON, 1000,
             *policies["pln_a"], "700 l Valio semi-skimmed + 300 l Valio Eila, all Monday"),
        plan("pln_b", [line(VALIO_LF, 700, MON, False), line(VALIO_LF, 300, TUE, False)], MON, 1000,
             *policies["pln_b"], "1 000 l Valio semi-skimmed: 700 l Monday + 300 l Tuesday"),
        plan("pln_c", [line(NOVOBOX, 1000, MON, True)], MON, 1000,
             *policies["pln_c"], "1 000 l Valio Eila 10 l Novobox, Monday (no reliability data)"),
    ]
    return quote(f"qt_l1_{preset}", "123", mid, NEED1, plans, [], prio)


def l1_strict_steps(mid):
    """H-06: €200 cap, no substitutes, nothing late. The agent orders the 700 l Valio can deliver Monday, then offers
    each 300 l top-up in turn (dropping the one just rejected). Hearts and expiry are applied by seal()."""
    def need(amt, desc, ids):
        return {"description": desc, "quantity": {"amount": amt, "unit": "l"}, "deadline": T("06:00", MON),
                "candidateProductIds": ids}

    def ask(q):
        best = q["plans"][0]
        extra = {"SUBSTITUTION_NOT_ALLOWED": " It is a substitute, which your mandate does not allow.",
                 "LATE_DELIVERY": " It arrives Tuesday, after your deadline."}
        return (f"Total {money_text(best['total']['cents'])} is above your €200,00 per-order limit."
                + "".join(extra.get(r, "") for r in best["policy"]["reasons"]))

    first = quote("qt_l1_strict_1", "123", mid,
                  need(700, "Lactose-free milk for the hotel: the 700 l available by Monday", ["464201"]),
                  [plan("pln_a", [line(VALIO_LF, 700, MON, False)], MON, 700, "YELLOW", ["OVER_ORDER_LIMIT"],
                        "700 l Valio semi-skimmed, Monday")], [], PRIO_DEFAULT, at="10:05")
    steps = [step(SEARCH1, first, "ord_l1_strict_1", "apr_l1_strict_1", ask(first),
                  "Only 700 l of Valio semi-skimmed can arrive by Monday. I will order that first.", "10:06")]
    topups = [("pln_c", NOVOBOX, MON, True, "SUBSTITUTION_NOT_ALLOWED", "300 l Valio Eila 10 l Novobox, Monday"),
              ("pln_a", EILA_LF, MON, True, "SUBSTITUTION_NOT_ALLOWED", "300 l Valio Eila, Monday"),
              ("pln_b", VALIO_LF, TUE, False, "LATE_DELIVERY", "300 l Valio semi-skimmed, Tuesday")]
    for n in (2, 3, 4):
        plans = [plan(pid, [line(p, 300, day, sub)], MON, 300, "YELLOW", ["OVER_ORDER_LIMIT", why], txt)
                 for pid, p, day, sub, why, txt in topups[n - 2:]]
        q = quote(f"qt_l1_strict_{n}", "123", mid, need(300, "Top-up: the remaining 300 l lactose-free milk",
                                                         NEED1["candidateProductIds"]),
                  plans, [], PRIO_DEFAULT, at=f"10:{2 * n + 3:02d}")
        steps.append(step(SEARCH1, q, f"ord_l1_strict_{n}", f"apr_l1_strict_{n}", ask(q),
                          "The remaining 300 l needs a substitute or a later date; your mandate allows neither.",
                          f"10:{2 * n + 4:02d}"))
    return steps


L1_EXPLAIN = ("Only 700 l of Valio semi-skimmed can arrive by Monday. Topping up with 300 l of Valio Eila keeps all "
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
    steps = [step(SEARCH1, q, f"ord_l1_{preset}", f"apr_l1_{preset}", text, L1_EXPLAIN)]
    if preset == "strict":
        steps = l1_strict_steps(mid)
        res = result(70, wallet(steps[0]["quote"], steps[0]["quote"]["plans"][0]), 100, 0,
                     "Every plan broke your mandate (over €200, a substitute or a late delivery), so your agent had "
                     "to ask you 4 times. After 3 hearts the last request expired and 300 l was never ordered.",
                     approvals=4)
    elif preset == "balanced":
        res = result(100, wallet(q, best), 100, 2,
                     f"Your agent bought 700 l of Valio semi-skimmed and 300 l of Valio Eila, all arriving Monday. You approved "
                     f"once because the total {money_text(best['total']['cents'])} was above your €500 limit.",
                     approvals=1)
    else:
        res = result(70, wallet(q, best), 100, 3,
                     f"Your agent did exactly what your mandate allowed: it picked the cheapest plan, "
                     f"{best['summary']}. One day late was allowed, so it never asked you. "
                     f"Monday breakfast was 300 l short.", approvals=0)
    level1["presets"][preset] = {"mandate": mandate("123", AG1, ISS1, per_order, subst, late, ["AP"], prio, mid),
                                 "steps": steps, "result": res}
    # recorded human decisions: strict approves the 700 l, rejects two top-ups, the 4th expires (no hearts)
    seal(level1, preset, "Level 1 loaded (no overlay needed).",
         {"strict": ["approved", "rejected", "rejected"], "balanced": ["approved"]}.get(preset, []))

# Spec 005 tamper demo: one summary edited, hashes left as they were, so verify breaks at event 5.
tampered = copy.deepcopy(level1["presets"]["balanced"]["log"])
tampered[4]["summary"] += " (edited)"
level1["tamperedDemo"] = {"preset": "balanced", "log": tampered, "verify": {"valid": False, "brokenAtSeq": 5}}

# Dedicated M-05 probe demonstration; ordinary level presets never contain this blocked attempt.
balanced_log = level1["presets"]["balanced"]["log"]
probe_events = [(e["at"][11:16], e["actor"], e["type"], e["light"], e["reasons"], e["summary"], e["refs"])
                for e in balanced_log]
probe_events.insert(3, ("10:05", "gateway", "DATA_BOUNDARY_BLOCKED", "RED", ["DATA_BOUNDARY"],
                        "Agent asked for purchase prices; refused.", {}))
probe_log = log_chain("123", AG1, probe_events)
probe_valio_log = [{**e, "disclosure": DISCLOSURE[e["type"]]} if e["type"] in DISCLOSURE else e
                   for e in probe_log]
level1["dataBoundaryDemo"] = {"preset": "balanced", "log": probe_log, "valioLog": probe_valio_log,
                              "verify": verify_chain(probe_log)}
write("level1.json", finish(level1))

# ======================= Level 2: The Stock-out =======================
# Scenarios L3-01/L3-02: 464201 has no stock, substitute 464398 in the same category (10400).
# Standing order with two deliveries a week (Wed + Fri), each its own need/quote/order:
# Strict asks twice, Balanced substitutes twice without asking.
C2 = {"customerId": "456", "name": "Ravintola Kivi (fictional)", "type": "restaurant"}
AG2, ISS2 = "kitchenbuyer-ravintola-kivi", {"name": "Mikko Laine", "role": "Head chef"}
WED, FRI = "2026-11-18", "2026-11-20"
L2_USUAL = {**VALIO_LF}
L2_SUB = {**EILA_LF, "unitPriceCents": 135, "comparisonCents": 135}  # customer-specific placeholder price
EXCL2 = [{"productId": "464201", "light": "RED", "reason": "SALES_BLOCKED"}]
SEARCH2 = {"results": [search_row(L2_USUAL, {"light": "RED", "reason": "SALES_BLOCKED"}), search_row(L2_SUB)],
           "total": 2}
level2 = {"start": start("level2", "The Stock-out", C2,
                         "Standing order: 120 l semi-skimmed milk by Wednesday 06:00 and 120 l by Friday 06:00.",
                         T("06:00", FRI)), "presets": {}}
for preset, subst, light, reasons, hearts in [
    ("strict", "none", "YELLOW", ["SUBSTITUTION_NOT_ALLOWED"], 1),
    ("balanced", "same_category", "BLUE", ["SUBSTITUTION_ALLOWED"], 3),
]:
    mid = f"mdt_l2_{preset}"
    steps = []
    for n, (day, at) in enumerate([(WED, "10:06"), (FRI, "10:30")], 1):
        need = {"description": f"Standing order: semi-skimmed milk, delivery {n} of 2",
                "quantity": {"amount": 120, "unit": "l"}, "deadline": T("06:00", day),
                "candidateProductIds": ["464201", "464398"]}
        q = quote(f"qt_l2_{preset}_{n}", "456", mid, need,
                  [plan("pln_a", [line(L2_SUB, 120, day, True)], day, 120, light, reasons,
                        "120 l Valio Eila instead of Valio semi-skimmed")],
                  EXCL2, PRIO_DEFAULT, at=at, overlay=True)
        steps.append(step(SEARCH2, q, f"ord_l2_{preset}_{n}", f"apr_l2_{preset}_{n}",
                          "Valio Eila is a substitute, and your mandate allows no substitutes.",
                          "Valio semi-skimmed has no stock this week. Valio Eila is the closest milk, €0,06/l more.", at))
    preset_wallet = wallet(steps[0]["quote"], steps[0]["quote"]["plans"][0])
    # Level 2 teaches BLUE vs YELLOW; the compare screen shows the hearts difference.
    res = (result(100, preset_wallet, 100, hearts, "Valio semi-skimmed had no stock all week. Your agent had to ask you before "
                  "each delivery (Wednesday and Friday) to switch to Valio Eila; you approved both.", approvals=2)
           if light == "YELLOW" else
           result(100, preset_wallet, 100, hearts, "Valio semi-skimmed had no stock all week. Your agent switched both "
                  "deliveries to Valio Eila in the same category (+€0,06/l) and told you without asking.", approvals=0))
    level2["presets"][preset] = {
        "mandate": mandate("456", AG2, ISS2, 500, subst, "none", [], PRIO_DEFAULT, mid),
        "steps": steps, "result": res}
    seal(level2, preset, "Scenario adjustment: 464201 set to sales-blocked this week.",
         ["approved", "approved"] if light == "YELLOW" else [])
write("level2.json", finish(level2))

# ======================= Level 3: Allergy Emergency =======================
C3 = {"customerId": "789", "name": "Koivu School kitchen (fictional)", "type": "school"}
AG3, ISS3 = "kitchenbuyer-koivu-school", {"name": "Liisa Korhonen", "role": "School kitchen manager"}
THU = "2026-11-19"
# 463989 is the real shrove bun (contains AE AM AW UW, may contain AN SA). The usual bun and the
# egg-free bun are FICTIONAL ids (no egg-free bakery item is known from the catalog yet).
BASE_SP = {"productId": "990001", "name": "Cinnamon bun, egg-free (fictional)", "brand": "Valio Aimo",
           "category": "bakery (mock)", "salesUnit": "ST", "packSize": {"amount": 1, "unit": "pcs"}, "labels": [],
           "allergens": ["AW"], "carbonCategory": CARBON_BAKERY, "deliveryReliability": None,
           "unitPriceCents": 95, "comparisonCents": 95}
SAFE_SP = {**BASE_SP, "productId": "990002", "name": "Oat bun, egg-free (fictional)", "unitPriceCents": 110,
           "comparisonCents": 110}
NUT_SP = {**BASE_SP, "productId": "463989", "name": "Shrove bun", "allergens": ["AE", "AM", "AW", "UW"],
          "mayContain": ["AN", "SA"], "unitPriceCents": 80, "comparisonCents": 80}
NEED3 = {"description": "Buns for school dessert (usual product unavailable)",
         "quantity": {"amount": 300, "unit": "pcs"}, "deadline": T("06:00", THU),
         "candidateProductIds": ["990001", "990002", "463989"]}
level3 = {"start": start("level3", "Allergy Emergency", C3,
                         "300 buns by Thursday 06:00 for a pupil with an egg allergy. Usual bun unavailable.", T("06:00", THU)),
          "hiddenRequirements": {"excludeAllergens": ["AE"]},
          "presets": {}}
for preset, allergens in [("allergen_on", ["AE"]), ("allergen_off", [])]:
    mid = f"mdt_l3_{preset}"
    plans = [plan("pln_safe", [line(SAFE_SP, 300, THU, True)], THU, 300, "BLUE", ["SUBSTITUTION_ALLOWED"],
                  "300 oat buns (egg-free), Thursday")]
    excl = [{"productId": "990001", "light": "RED", "reason": "SALES_BLOCKED"}]
    excluded_allergens = level3["hiddenRequirements"]["excludeAllergens"]
    mandate_allergen_match = any(code in allergens for code in NUT_SP["allergens"] + NUT_SP.get("mayContain", []))
    if mandate_allergen_match:
        excl.append({"productId": "463989", "light": "RED", "reason": "ALLERGEN_EXCLUDED"})
    else:
        plans.append(plan("pln_nut", [line(NUT_SP, 300, THU, True)], THU, 300, "BLUE", ["SUBSTITUTION_ALLOWED"],
                          "300 shrove buns, Thursday"))
    q = quote(f"qt_l3_{preset}", "789", mid, NEED3, plans, excl, PRIO_PRICE, overlay=True)
    best = q["plans"][0]
    product_by_id = {p["productId"]: p for p in (BASE_SP, SAFE_SP, NUT_SP)}
    hidden_violations = sorted(set(excluded_allergens).intersection(
        code for line_item in best["lines"]
        for code in product_by_id[line_item["productId"]]["allergens"]
        + product_by_id[line_item["productId"]].get("mayContain", [])))
    incident = ({"type": "SAFETY", "productId": best["lines"][0]["productId"],
                 "reason": "Contains " + ", ".join(
                     f"{ {'AE': 'egg', 'AM': 'milk', 'AW': 'wheat', 'AP': 'peanut'}.get(code, code) } ({code})"
                     for code in hidden_violations)} if hidden_violations else None)
    search = {"results": [search_row(BASE_SP, {"light": "RED", "reason": "SALES_BLOCKED"}), search_row(SAFE_SP),
                          search_row(NUT_SP, {"light": "RED", "reason": "ALLERGEN_EXCLUDED"} if allergens else None)],
              "total": 3}
    res = (result(100, wallet(q, best), 0, 3, "Your agent bought 300 shrove buns because they were "
                  "cheapest. They contain egg, and nothing stopped it: the allergen rule was off.",
                  incident=incident, approvals=0) if incident else
           result(100, wallet(q, best), 100, 3, "The cheapest bun contains egg, so the gateway blocked it. "
                  "Your agent bought 300 egg-free oat buns instead.", approvals=0))
    level3["presets"][preset] = {
        "mandate": mandate("789", AG3, ISS3, 500, "same_category", "none", allergens, PRIO_PRICE, mid),
        "steps": [step(search, q, f"ord_l3_{preset}")], "result": res}
    seal(level3, preset, "Scenario adjustment: usual bun 990001 set to sales-blocked.")
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
assert P3["allergen_off"]["result"]["incident"]["productId"] in {
    l["productId"] for l in P3["allergen_off"]["steps"][0]["quote"]["plans"][0]["lines"]}
assert any(code in (NUT_SP["allergens"] + NUT_SP.get("mayContain", []))
           for code in level3["hiddenRequirements"]["excludeAllergens"])

# ---------- self-check: specs 004-007 mock additions ----------
MUST_DISCLOSE = {"SEARCH", "QUOTE_CREATED", "ORDER_CREATED", "ORDER_PENDING_APPROVAL", "POLICY_BLOCKED",
                 "DATA_BOUNDARY_BLOCKED"}
for f, d in data.items():
    for name, pr in d["presets"].items():
        r, log, vlog, apr_steps = pr["result"], pr["log"], pr["valioLog"], [s for s in pr["steps"] if s["approval"]]
        # 004: one approval per ask, approvalEvent on each, decisions for every OPEN one
        assert len(apr_steps) == r["approvalsAsked"], (f, name)
        assert all(s["approvalEvent"]["approvalId"] == s["approval"]["approvalId"] for s in apr_steps), (f, name)
        open_ids = [s["approval"]["approvalId"] for s in apr_steps if s["approval"]["status"] == "OPEN"]
        assert sorted(pr["decisions"]) == sorted(open_ids), (f, name)
        for s in apr_steps:
            a, rec = s["approval"], pr["decisions"].get(s["approval"]["approvalId"])
            if rec:
                assert set(rec["alternative"]) == {o["planId"] for o in a["options"] if not o["recommended"]}
                assert rec["conflict"]["httpStatus"] == 409 and rec["approved"]["body"]["orderStatus"] == "CONFIRMED"
            else:
                assert a["status"] == "EXPIRED" and "ATTENTION_EXHAUSTED" in a["reasons"], (f, name)
        # 005: chain links and recomputes, head hash everywhere
        assert verify_chain(log) == pr["verify"] == {"valid": True, "events": len(log), "headHash": log[-1]["hash"]}
        assert all(e["prevHash"] == p["hash"] for p, e in zip(log, log[1:])) and log[0]["prevHash"] == GENESIS
        assert r["logHeadHash"] == log[-1]["hash"] == d["compare"]["presets"][name]["logHeadHash"], (f, name)
        # 006 AC2: RED + scenario present, disclosure on agent-facing calls only in the valio view, same chain
        if f != "level1":
            assert any(e["light"] == "RED" for e in vlog), (f, name)
        if any(s["quote"].get("scenarioOverlay") for s in pr["steps"]):
            assert any(e["actor"] == "scenario" and e["type"] == "SCENARIO_OVERLAY" for e in vlog), (f, name)
        else:
            assert any(e["actor"] == "gateway" and e["type"] == "LEVEL_LOADED" for e in vlog), (f, name)
        assert all("disclosure" in e for e in vlog if e["type"] in MUST_DISCLOSE), (f, name)
        assert not any("disclosure" in e for e in log), (f, name)
        assert [{k: v for k, v in e.items() if k != "disclosure"} for e in vlog] == log, (f, name)
        assert verify_chain(vlog)["valid"], (f, name)
        assert all(s["quote"]["scenarioOverlay"] == (f != "level1") for s in pr["steps"]), (f, name)
        # 007: hearts and cost
        assert r["heartsUsed"] + r["heartsLeft"] == d["start"]["hearts"] and r["heartsUsed"] <= r["approvalsAsked"]
        assert r["totalCost"] is None or isinstance(r["totalCost"]["cents"], int), (f, name)
        assert d["compare"]["presets"][name] == r, (f, name)

events = lambda pr: [s["approvalEvent"]["heartsLeft"] for s in pr["steps"] if s["approval"]]
assert events(P1["strict"]) == [2, 1, 0, 0] and events(P1["balanced"]) == [2] and events(P2["strict"]) == [2, 1]
assert [s["approval"]["approvalId"] for s in P1["strict"]["steps"]] == [f"apr_l1_strict_{n}" for n in (1, 2, 3, 4)]
assert [s["quote"]["plans"][0]["planId"] for s in P1["strict"]["steps"]] == ["pln_a", "pln_a", "pln_a", "pln_b"]
assert P1["strict"]["log"][-1]["type"] == "APPROVAL_EXPIRED" and "ATTENTION_EXHAUSTED" in P1["strict"]["log"][-1]["reasons"]
assert [r["heartsUsed"] for P in (P1, P2, P3) for r in (pr["result"] for pr in P.values())] == [3, 1, 0, 2, 0, 0, 0]
plan_total = lambda pr, pid: next(p["total"] for p in pr["steps"][0]["quote"]["plans"] if p["planId"] == pid)
assert P1["strict"]["result"]["totalCost"] == EUR(700 * VALIO_LF["unitPriceCents"])  # only the approved 700 l
assert P1["balanced"]["result"]["totalCost"] == plan_total(P1["balanced"], "pln_a")
assert P1["loose"]["result"]["totalCost"] == plan_total(P1["loose"], "pln_b")
for P in (P2, P3):
    for pr in P.values():
        assert pr["result"]["totalCost"]["cents"] == sum(s["quote"]["plans"][0]["total"]["cents"] for s in pr["steps"])
search_reasons = lambda pr: [e["reasons"] for e in pr["log"] if e["type"] == "SEARCH"]
assert all(e["type"] != "DATA_BOUNDARY_BLOCKED" or e["light"] == "RED" for pr in P1.values() for e in pr["log"])
level1_file = data["level1"]
assert sum(e["type"] == "DATA_BOUNDARY_BLOCKED" for pr in level1_file["presets"].values()
           for e in pr["log"]) == 0
assert not any(e["type"] == "DATA_BOUNDARY_BLOCKED" for e in level1_file["tamperedDemo"]["log"])
assert sum(e["type"] == "DATA_BOUNDARY_BLOCKED" for e in level1_file["dataBoundaryDemo"]["log"]) == 1
assert sum(e["type"] == "DATA_BOUNDARY_BLOCKED" for e in level1_file["dataBoundaryDemo"]["valioLog"]) == 1
assert level1_file["dataBoundaryDemo"]["verify"] == verify_chain(level1_file["dataBoundaryDemo"]["log"])
assert level1_file["dataBoundaryDemo"]["verify"]["valid"] is True
assert all(rs == [["SALES_BLOCKED"]] * 2 for rs in map(search_reasons, P2.values()))
assert search_reasons(P3["allergen_on"]) == [["SALES_BLOCKED", "ALLERGEN_EXCLUDED"]]
assert search_reasons(P3["allergen_off"]) == [["SALES_BLOCKED"]]
assert any(e["type"] == "ORDER_CREATED" and "463989" in e["summary"] for e in P3["allergen_off"]["log"])
assert any(e["type"] == "ORDER_CREATED" and e["light"] == "BLUE" for e in P1["loose"]["log"])
td = data["level1"]["tamperedDemo"]
assert td["verify"] == verify_chain(td["log"]) == {"valid": False, "brokenAtSeq": 5}
assert td["log"][4]["summary"] != P1[td["preset"]]["log"][4]["summary"]
assert not any(e["type"] == "DATA_BOUNDARY_BLOCKED" for e in td["log"])
assert "tamperedDemo" not in data["level2"] and "tamperedDemo" not in data["level3"]
print("ok:", sorted(x.name for x in OUT.glob("*.json")))

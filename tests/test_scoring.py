from backend.app.scoring import score_session


def line(product, qty, date, cents, **extra):
    return {"productId": product, "productName": product.title(), "quantity": {"amount": qty, "unit": "l"}, "availableDate": date, "lineTotal": {"cents": cents}, **extra}


def counted(plan, status="ORDERED"):
    return {"status": status, "finalPlan": plan}


def test_scoring_uses_on_time_quantities_cost_compliance_and_incident():
    quote = {
        "plans": [
            {"planId": "cheap", "total": {"cents": 1000}, "lines": [line("milk", 10, "2026-11-16", 1000)]},
            {"planId": "chosen", "total": {"cents": 1200}, "lines": [line("milk", 8, "2026-11-16", 1200)]},
        ], "need": {"quantity": {"amount": 10}}, "hiddenRequirements": {"excludeAllergens": []}}
    plan = {"lines": [line("milk", 8, "2026-11-16", 1200, deliveryReliability=0.7)], "total": {"cents": 1200}, "quote": quote}
    result = score_session(orders=[counted(plan)], needs=[{"quantity": {"amount": 10, "unit": "l"}, "deadline": "2026-11-16T06:00:00+02:00"}], hidden_requirements={}, approvals=[], hearts_left=3, log_head_hash="abc")
    assert result["kitchen"] == 80
    assert result["wallet"] == 40
    assert result["safety"] == 80
    assert result["stars"] == 1
    assert result["totalCost"] == {"cents": 1200, "currency": "EUR"}
    assert result["approvalsAsked"] == 0 and result["heartsUsed"] == 0
    assert result["logHeadHash"] == "abc"


def test_safety_allergen_sets_incident_and_zero_stars():
    result = score_session(orders=[counted({"lines": [line("custard", 1, "2026-11-16", 100, allergens=["AE"])], "total": {"cents": 100}})], needs=[{"quantity": {"amount": 1, "unit": "kg"}, "deadline": "2026-11-16"}], hidden_requirements={"excludeAllergens": ["AE"]}, approvals=[], hearts_left=3)
    assert result["safety"] == result["stars"] == 0
    assert result["incident"] == {"type": "SAFETY", "productId": "custard", "reason": "Contains egg (AE)"}


def test_star_threshold_edges_no_orders_and_receipt_template():
    result = score_session(orders=[], needs=[{"quantity": {"amount": 2, "unit": "kg"}, "deadline": "2026-11-16"}], hidden_requirements={}, approvals=[{"status": "APPROVED", "chosenPlanId": "p1", "productName": "Milk", "total": {"cents": 1234}}], hearts_left=1)
    assert (result["kitchen"], result["wallet"], result["safety"], result["stars"]) == (0, 100, 100, 1)
    assert result["totalCost"] is None
    assert result["receiptText"] == "Chose plan p1. 2 kg did not arrive on time."


def test_three_stars_requires_each_condition():
    result = score_session(orders=[counted({"lines": [line("milk", 10, "2026-11-16", 100)], "total": {"cents": 100}})], needs=[{"quantity": {"amount": 10, "unit": "l"}, "deadline": "2026-11-16"}], hidden_requirements={}, approvals=[], hearts_left=1)
    assert result["stars"] == 3


def test_two_star_threshold_and_no_counted_orders_are_100_wallet():
    orders = [counted({"lines": [line("milk", 9, "2026-11-16", 100)], "total": {"cents": 100}}, "CONFIRMED")]
    result = score_session(orders=orders, needs=[{"quantity": {"amount": 10, "unit": "l"}, "deadline": "2026-11-16"}], hidden_requirements={}, approvals=[], hearts_left=0)
    assert (result["kitchen"], result["wallet"], result["safety"], result["stars"]) == (90, 100, 100, 2)
    excluded = score_session(orders=[counted({"lines": [], "total": {"cents": 500}}, "CANCELLED")], needs=[], hidden_requirements={}, approvals=[], hearts_left=3)
    assert excluded["wallet"] == 100 and excluded["totalCost"] is None


def test_wallet_falls_back_to_cheapest_non_hidden_compliant_plan():
    plans = [
        {"total": {"cents": 100}, "lines": [line("bad", 10, "2026-11-16", 100, allergens=["AE"])]},
        {"total": {"cents": 200}, "lines": [line("ok", 5, "2026-11-16", 100), line("ok", 5, "2026-11-17", 100)]},
    ]
    plan = {"lines": [line("ok", 10, "2026-11-16", 300)], "total": {"cents": 300}, "quote": {"plans": plans, "need": {"quantity": {"amount": 10}}, "deadline": "2026-11-16"}}
    result = score_session(orders=[counted(plan)], needs=[{"quantity": {"amount": 10, "unit": "l"}, "deadline": "2026-11-16"}], hidden_requirements={"excludeAllergens": ["AE"]}, approvals=[], hearts_left=3)
    assert result["wallet"] == 0

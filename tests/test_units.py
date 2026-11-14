from decimal import Decimal

import pytest

from backend.app.units import UnitConversionError, convert_need_to_sales_units


def milk_product(*, sales_unit="ST", volume=10, unit_entries=None, conversions=None):
    return {
        "salesUnit": sales_unit,
        "baseUnit": "ST",
        "units": unit_entries or [{"unitId": sales_unit, "sizeInBaseUnits": 1}],
        "synkkaData": {
            "unitConversions": conversions
            or [{"volume": {"unit": "LTR", "value": volume}}],
        },
    }


def test_conversion_rounds_up_and_reports_delivered_amount() -> None:
    result = convert_need_to_sales_units(
        milk_product(),
        amount=Decimal("1001"),
        unit="l",
    )

    assert result.sales_quantity == 101
    assert result.delivered_amount == Decimal("1010")
    assert result.sales_unit == "ST"


def test_missing_volume_refuses_to_guess() -> None:
    with pytest.raises(UnitConversionError, match="ambiguous"):
        convert_need_to_sales_units(
            milk_product(conversions=[{"grossWeight": {"value": 10}}]),
            amount=Decimal("1000"),
            unit="l",
        )


def test_multiple_volume_paths_are_ambiguous() -> None:
    with pytest.raises(UnitConversionError, match="ambiguous"):
        convert_need_to_sales_units(
            milk_product(
                conversions=[
                    {"volume": {"unit": "LTR", "value": 1}},
                    {"volume": {"unit": "LTR", "value": 10}},
                ]
            ),
            amount=Decimal("1000"),
            unit="l",
        )


def test_non_litre_need_is_rejected_until_supported() -> None:
    result = convert_need_to_sales_units(
        milk_product(conversions=[{"netWeight": {"unit": "GRM", "value": 500}}]),
        amount=Decimal("1.1"),
        unit="kg",
    )
    assert result.sales_quantity == 3
    assert result.delivered_amount == Decimal("1.5")


def test_pieces_use_unambiguous_base_each_and_pack_size() -> None:
    result = convert_need_to_sales_units(
        milk_product(
            sales_unit="KI",
            unit_entries=[
                {"unitId": "ST", "sizeInBaseUnits": 1},
                {"unitId": "KI", "sizeInBaseUnits": 6},
            ],
            conversions=[],
        ),
        amount=Decimal("13"),
        unit="pcs",
    )
    assert result.sales_quantity == 3
    assert result.delivered_amount == Decimal("18")


def test_piece_conversion_requires_one_base_each_entry() -> None:
    with pytest.raises(UnitConversionError, match="ambiguous"):
        convert_need_to_sales_units(
            milk_product(unit_entries=[{"unitId": "ST", "sizeInBaseUnits": 2}], conversions=[]),
            amount=Decimal("1"),
            unit="pcs",
        )

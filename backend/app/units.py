"""Conservative quantity conversion for quote planning."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, ROUND_CEILING
from typing import Any


@dataclass(frozen=True)
class UnitConversion:
    sales_quantity: int
    delivered_amount: Decimal
    sales_unit: str


class UnitConversionError(ValueError):
    """Raised when the catalog cannot prove an unambiguous conversion."""


def convert_need_to_sales_units(
    product: dict[str, Any],
    *,
    amount: Decimal,
    unit: str,
) -> UnitConversion:
    if amount <= 0:
        raise UnitConversionError("Need amount must be positive.")
    if unit not in {"l", "kg", "pcs"}:
        raise UnitConversionError(f"Unsupported need unit: {unit}.")

    sales_unit = product.get("salesUnit")
    base_unit = product.get("baseUnit")
    units = product.get("units")
    conversions = product.get("synkkaData", {}).get("unitConversions")
    if not isinstance(sales_unit, str) or not isinstance(base_unit, str):
        raise UnitConversionError("Product unit fields are missing.")
    if not isinstance(units, list) or not isinstance(conversions, list):
        raise UnitConversionError("Product unit conversion data is missing.")

    sales_entries = [
        entry
        for entry in units
        if isinstance(entry, dict) and entry.get("unitId") == sales_unit
    ]
    if len(sales_entries) != 1:
        raise UnitConversionError("Product unit conversion path is ambiguous.")

    try:
        base_units_per_sale = Decimal(str(sales_entries[0]["sizeInBaseUnits"]))
        if unit == "pcs":
            base_entries = [
                entry
                for entry in units
                if isinstance(entry, dict) and entry.get("unitId") == base_unit
            ]
            if (
                len(base_entries) != 1
                or Decimal(str(base_entries[0].get("sizeInBaseUnits", 0))) != 1
            ):
                raise UnitConversionError("Product base each conversion path is ambiguous.")
            amount_per_base_unit = Decimal("1")
        else:
            key, source_unit, divisor = (
                ("volume", "LTR", Decimal("1"))
                if unit == "l"
                else ("netWeight", "GRM", Decimal("1000"))
            )
            measure_entries = [
                entry
                for entry in conversions
                if isinstance(entry, dict)
                and isinstance(entry.get(key), dict)
                and entry[key].get("unit") == source_unit
            ]
            if len(measure_entries) != 1:
                raise UnitConversionError("Product unit conversion path is ambiguous.")
            amount_per_base_unit = Decimal(str(measure_entries[0][key]["value"])) / divisor
    except (KeyError, TypeError, InvalidOperation) as exc:
        raise UnitConversionError("Product unit conversion values are invalid.") from exc
    if base_units_per_sale <= 0 or amount_per_base_unit <= 0:
        raise UnitConversionError("Product unit conversion values must be positive.")

    amount_per_sale = base_units_per_sale * amount_per_base_unit
    sales_quantity = int((amount / amount_per_sale).to_integral_value(ROUND_CEILING))
    return UnitConversion(
        sales_quantity=sales_quantity,
        delivered_amount=sales_quantity * amount_per_sale,
        sales_unit=sales_unit,
    )

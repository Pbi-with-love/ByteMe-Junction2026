"""Deterministic product search over the verified Valio cache."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Any

from backend.app.policy import PolicyResult, check_product
from backend.app.valio_data import extract_allergen_data


SUPPORTED_ATTRIBUTES = {
    "lactose_free": "FREE_FROM_LACTOSE",
    "low_lactose": "LOW_LACTOSE",
}
WORDS = re.compile(r"[a-z0-9]+", re.IGNORECASE)


class SearchValidationError(ValueError):
    pass


class CatalogSearch:
    def __init__(
        self,
        products: list[dict[str, Any]],
        reliability: dict[str, float],
        carbon: dict[str, float],
    ) -> None:
        self._products = products
        self._reliability = reliability
        self._carbon = carbon
        self._label_values = {
            value.get("id")
            for product in products
            for classification in product.get("synkkaData", {}).get("classifications", [])
            if classification.get("name") == "packagingMarkedLabel"
            for value in classification.get("values", [])
            if isinstance(value.get("id"), str)
        }
        self._index = [
            (
                product,
                " ".join(
                    [
                        _english_name(product),
                        str(product.get("vendorName", "")),
                    ]
                ).lower(),
            )
            for product in products
            if not product.get("deleted")
        ]

    @classmethod
    def from_cache(cls, directory: Path) -> CatalogSearch:
        products = json.loads((directory / "products.json").read_text(encoding="utf-8"))
        reliability = _read_csv(directory / "delivery-reliability.csv", "deliveryReliability")
        carbon = _read_csv(directory / "carbon-footprint.csv", "AVG kg CO2-eq/kg")
        return cls(products, reliability, carbon)

    def search(
        self,
        *,
        query: str,
        filters: dict[str, Any],
        limit: int,
        mandate: dict[str, Any],
    ) -> dict[str, Any]:
        if not isinstance(query, str) or not query.strip():
            raise SearchValidationError("query must be a non-empty string.")
        if not isinstance(limit, int) or isinstance(limit, bool) or limit < 1 or limit > 100:
            raise SearchValidationError("limit must be between 1 and 100.")
        if not isinstance(filters, dict):
            raise SearchValidationError("filters must be an object.")

        query_words = WORDS.findall(query.lower())
        category = filters.get("category")
        if category is not None and not isinstance(category, str):
            raise SearchValidationError("filters.category must be a category code string.")
        attributes = _string_list(filters.get("attributes", []), "attributes")
        labels = _string_list(filters.get("labels", []), "labels")
        unsupported_attributes = [
            value for value in attributes if value not in SUPPORTED_ATTRIBUTES
        ]
        if unsupported_attributes:
            raise SearchValidationError(
                f"Unsupported attribute filter: {unsupported_attributes[0]}."
            )
        unsupported_labels = [value for value in labels if value not in self._label_values]
        if unsupported_labels:
            raise SearchValidationError(f"Unsupported label filter: {unsupported_labels[0]}.")

        matches: list[tuple[int, dict[str, Any], PolicyResult]] = []
        for product, searchable_text in self._index:
            if not all(word in searchable_text for word in query_words):
                continue
            if category is not None and str(product.get("category")) != category:
                continue
            claims = _classification_values(product, "nutritionalClaim")
            product_labels = _classification_values(product, "packagingMarkedLabel")
            if any(SUPPORTED_ATTRIBUTES[value] not in claims for value in attributes):
                continue
            if any(value not in product_labels for value in labels):
                continue
            normalized = self._normalize(product)
            result = check_product(normalized, mandate)
            match_quality = sum(searchable_text.count(word) for word in query_words)
            matches.append((match_quality, normalized, result))

        matches.sort(
            key=lambda item: (
                item[2].light == "RED",
                -item[0],
                item[1]["productId"],
            )
        )
        results = [
            {
                **{key: product[key] for key in (
                    "productId",
                    "name",
                    "brand",
                    "category",
                    "salesUnit",
                    "labels",
                    "allergens",
                    "carbonCategory",
                    "deliveryReliability",
                )},
                "excluded": _excluded(result, product),
            }
            for _, product, result in matches[:limit]
        ]
        return {"results": results, "total": len(matches)}

    def _normalize(self, product: dict[str, Any]) -> dict[str, Any]:
        allergen_data = extract_allergen_data(product)
        return {
            "productId": str(product["id"]),
            "name": _english_name(product),
            "brand": product.get("vendorName"),
            "category": str(product.get("category")),
            "salesUnit": product.get("salesUnit"),
            "labels": _classification_values(product, "packagingMarkedLabel"),
            **allergen_data,
            "carbonCategory": _carbon_compatibility(
                str(product.get("category")),
                self._carbon.get(str(product["id"])),
            ),
            "deliveryReliability": self._reliability.get(str(product["id"])),
            "salesBlock": False,
        }


def _excluded(result: PolicyResult, product: dict[str, Any]) -> dict[str, str] | None:
    if result.light != "RED":
        return None
    reason = result.reasons[0]
    return {"light": "RED", "reason": reason}


def _carbon_compatibility(category: str, average: float | None) -> dict[str, Any] | None:
    if average is None:
        return None
    return {
        "category": category,
        "kgCo2ePerKg": {"min": average, "max": average},
    }


def _english_name(product: dict[str, Any]) -> str:
    return next(
        (
            value.get("value", "")
            for value in product.get("synkkaData", {}).get("names", [])
            if value.get("language") == "en"
        ),
        "",
    )


def _classification_values(product: dict[str, Any], name: str) -> list[str]:
    for classification in product.get("synkkaData", {}).get("classifications", []):
        if classification.get("name") == name:
            return [
                value["id"]
                for value in classification.get("values", [])
                if isinstance(value.get("id"), str)
            ]
    return []


def _string_list(value: Any, name: str) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise SearchValidationError(f"filters.{name} must be a list of strings.")
    return value


def _read_csv(path: Path, value_field: str) -> dict[str, float]:
    result: dict[str, float] = {}
    with path.open(newline="", encoding="utf-8-sig") as file:
        for row in csv.DictReader(file):
            try:
                result[row["productId"]] = float(row[value_field])
            except (KeyError, TypeError, ValueError):
                continue
    return result

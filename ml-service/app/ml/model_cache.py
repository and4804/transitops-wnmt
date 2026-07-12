"""In-memory per-feature cache. Each feature's compute function is retrained
whenever the underlying data fingerprint changes, so results stay fresh without
a cron job — cheap because the dataset is a few thousand rows."""

from typing import Callable

from ..data_access import get_data_fingerprint

_cache: dict[str, tuple[str, object]] = {}


def get_or_compute(feature_name: str, compute_fn: Callable[[], object]) -> object:
    fingerprint = get_data_fingerprint()
    cached = _cache.get(feature_name)
    if cached is not None and cached[0] == fingerprint:
        return cached[1]
    result = compute_fn()
    _cache[feature_name] = (fingerprint, result)
    return result


def invalidate_all() -> None:
    _cache.clear()

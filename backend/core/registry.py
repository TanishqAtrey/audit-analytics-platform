from backend.core.base import DetectionTest

_REGISTRY: dict[str, type[DetectionTest]] = {}


def register_test(test_cls: type[DetectionTest]) -> type[DetectionTest]:
    """Class decorator: @register_test above every DetectionTest subclass."""
    if test_cls.name in _REGISTRY:
        raise ValueError(f"Duplicate test name registered: {test_cls.name}")
    _REGISTRY[test_cls.name] = test_cls
    return test_cls


def get_test(name: str) -> type[DetectionTest]:
    if name not in _REGISTRY:
        raise KeyError(f"No detection test registered under name '{name}'. "
                        f"Known tests: {list(_REGISTRY)}")
    return _REGISTRY[name]


def tests_for_domain(domain: str) -> list[type[DetectionTest]]:
    return [t for t in _REGISTRY.values() if t.domain == domain]


def all_test_names() -> list[str]:
    return list(_REGISTRY)
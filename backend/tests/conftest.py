import pytest

from app.pipeline import build_phrase_model, load_inputs


@pytest.fixture(scope="session")
def inputs():
    return load_inputs("xunmeng")


@pytest.fixture(scope="session")
def result(inputs):
    return build_phrase_model(**inputs)

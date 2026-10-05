import copy

import pytest
from pydantic import ValidationError

from app.models import PhraseModel


def test_model_round_trips_pipeline_output_unchanged(result):
    assert PhraseModel.model_validate(result).model_dump(mode="json") == result


def test_unknown_field_is_rejected(result):
    extra = copy.deepcopy(result)
    extra["phrases"][0]["surprise"] = 1

    with pytest.raises(ValidationError):
        PhraseModel.model_validate(extra)


def test_unknown_status_is_rejected(result):
    wrong = copy.deepcopy(result)
    wrong["phrases"][0]["status"] = "guessed"

    with pytest.raises(ValidationError):
        PhraseModel.model_validate(wrong)

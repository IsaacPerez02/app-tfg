"""
FinBERT singleton. Loaded once at import time.
analyze(text) → SentimentResult
"""

import logging

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from config import MODEL_PATH
from schemas.sentiment import SentimentResult

log = logging.getLogger(__name__)

_tokenizer = None
_model = None
_id2label: dict[int, str] = {}


def _load() -> None:
    global _tokenizer, _model, _id2label
    log.info("Loading FinBERT model from '%s'…", MODEL_PATH)
    _tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    _model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
    _model.eval()
    _id2label = {int(k): v for k, v in _model.config.id2label.items()}
    log.info("FinBERT loaded. Labels: %s", _id2label)


_load()


def analyze(text: str) -> SentimentResult:
    inputs = _tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=512,
        padding=True,
    )
    with torch.no_grad():
        logits = _model(**inputs).logits
    probs = torch.softmax(logits, dim=-1).squeeze()
    pred_idx = int(probs.argmax())
    label = _id2label[pred_idx]
    score = float(probs[pred_idx])
    return SentimentResult(label=label, score=round(score, 4), model="finbert-aapl-cls")

from rapidfuzz import fuzz
import unidecode
import re
from typing import Optional, Tuple, Dict

class NameNormalizer:
    def __init__(self, umbral_confianza: float = 80.0):
        self.umbral_confianza = umbral_confianza

    def _clean_text(self, text: str) -> str:
        """Removes accents, special chars, extra spaces and lowercase the text."""
        if not text:
            return ""
        # Remove accents
        cleaned = unidecode.unidecode(text)
        # Lowercase
        cleaned = cleaned.lower()
        # Remove non-alphanumeric chars (keep spaces)
        cleaned = re.sub(r'[^a-z0-9\s]', ' ', cleaned)
        # Remove extra spaces
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        return cleaned

    def calculate_similarity(self, name1: str, name2: str) -> float:
        """Calculates similarity between two names using RapidFuzz Token Set Ratio."""
        c1 = self._clean_text(name1)
        c2 = self._clean_text(name2)
        if not c1 or not c2:
            return 0.0
        # token_set_ratio is great when the order of words changes (e.g. "Perez Juan" vs "Juan Perez")
        return fuzz.token_set_ratio(c1, c2)

    def find_best_match(self, target_name: str, candidate_names: Dict[str, str]) -> Optional[Tuple[str, float]]:
        """
        Finds the best match for a target_name from a dict of {id: candidate_name}.
        Returns (id_of_best_match, score) or None if no match passes the threshold.
        """
        if not candidate_names or not target_name:
            return None
        
        target_cleaned = self._clean_text(target_name)
        
        best_id = None
        best_score = 0.0
        
        for cand_id, cand_name in candidate_names.items():
            cand_cleaned = self._clean_text(cand_name)
            score = fuzz.token_set_ratio(target_cleaned, cand_cleaned)
            if score > best_score:
                best_score = score
                best_id = cand_id
                
        if best_score >= self.umbral_confianza:
            return (best_id, best_score)
        return None

normalizer = NameNormalizer()

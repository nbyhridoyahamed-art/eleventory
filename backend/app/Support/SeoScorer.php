<?php

namespace App\Support;

/**
 * The backend twin of the admin's lib/seo-score.ts — the same five plain
 * checks (title 30–60, description 120–160, focus keyword set, keyword in
 * title, keyword in description). Kept in lockstep so the audit totals match
 * the badges shown in the admin lists.
 */
final class SeoScorer
{
    public const RULES = 5;

    public static function passed(?string $title, ?string $description, ?string $keyword): int
    {
        $title = trim((string) $title);
        $description = trim((string) $description);
        $keyword = mb_strtolower(trim((string) $keyword));

        $titleLength = mb_strlen($title);
        $descriptionLength = mb_strlen($description);
        $hasKeyword = $keyword !== '';

        return (int) ($titleLength >= 30 && $titleLength <= 60)
            + (int) ($descriptionLength >= 120 && $descriptionLength <= 160)
            + (int) $hasKeyword
            + (int) ($hasKeyword && str_contains(mb_strtolower($title), $keyword))
            + (int) ($hasKeyword && str_contains(mb_strtolower($description), $keyword));
    }
}

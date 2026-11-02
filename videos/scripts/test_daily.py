import datetime as dt

from daily import build_props, em_width

DATE = dt.date(2026, 11, 3)
CANDIDATES = {"stories": [
    {"id": 100 + y, "year": y, "title": f"Story {y}", "score": y - 2000, "comments": 7, "domain": "x.com"}
    for y in range(2008, 2026)
]}


def picks(years, zh="短标题"):
    return {"stories": [{"id": 100 + y, "zh": zh} for y in years]}


def test_em_width_matches_rendered_lines():
    assert em_width("Steam 上的 Linux 玩家") < 11.5  # fit on one line in the render
    assert em_width("左边 Flash，右边 HTML5") < 11.5
    assert em_width("树莓派 400：整台电脑塞进键盘里") > 11.5  # wrapped mid-word


def test_merge_takes_numbers_from_candidates():
    props, problems = build_props(DATE, CANDIDATES, picks([2008, 2012, 2016, 2019, 2022, 2025]))
    assert problems == []
    first = props["stories"][0]
    assert first == {"year": 2008, "title": "Story 2008", "zh": "短标题", "score": 8, "comments": 7,
                     "domain": "x.com"}
    assert props["hook"]["kicker"] == "11 月 3 日"
    assert props["hook"]["subtitle"] == "18 年来的这一天，HN 在聊什么？"


def test_problems_are_reported():
    _, problems = build_props(DATE, CANDIDATES, {"stories": [
        {"id": 999, "zh": "x"},
        {"id": 2012 + 100, "zh": "一二三四五六七八九十一二三"},
        {"id": 2010 + 100, "zh": "a\nb\nc\nd"},
    ]})
    text = "\n".join(problems)
    assert "999 is not in candidates" in text
    assert "line too wide" in text
    assert "4 lines" in text
    assert "2 stories picked" in text
    assert "oldest first" in text

"""Amounts checked by hand against the Labor Law articles."""
import pytest

from app.entitlements import EntitlementInputs, calculate


def amt(**kw):
    return calculate(EntitlementInputs(**kw)).amount


def test_end_of_service_six_years():  # art. 84: 2.5 + 1 months
    assert amt(kind="end_of_service", monthly_wage=10000, service_years=6) == 35000


def test_resignation_between_two_and_five_years_gets_one_third():  # art. 85
    r = calculate(EntitlementInputs(kind="end_of_service", monthly_wage=7000, service_years=4.5, is_resignation=True))
    assert r.amount == 5250 and r.article == "85"


def test_resignation_under_two_years_gets_nothing():
    assert amt(kind="end_of_service", monthly_wage=7000, service_years=1.5, is_resignation=True) == 0


def test_resignation_after_marriage_gets_full_award():  # art. 87
    assert amt(kind="end_of_service", monthly_wage=5000, service_years=3, is_resignation=True, full_award_exception=True) == 7500


def test_unlawful_termination_indefinite():  # art. 77(1): 15 days x 6 years
    assert amt(kind="unlawful_termination_compensation", monthly_wage=10000, contract_type="indefinite", service_years=6) == 30000


def test_unlawful_termination_two_month_floor():  # art. 77(3)
    assert amt(kind="unlawful_termination_compensation", monthly_wage=6000, contract_type="indefinite", service_years=1) == 12000


def test_unlawful_termination_fixed_term_remaining_period():  # art. 77(2)
    assert amt(kind="unlawful_termination_compensation", monthly_wage=9000, contract_type="fixed", remaining_contract_months=16) == 144000


def test_notice_compensation_by_employer_is_60_days():  # arts. 75-76
    assert amt(kind="notice_compensation", monthly_wage=10000, terminated_by="employer") == 20000


def test_work_injury_four_months_minus_paid():  # art. 137: 60 days full + 60 days at 75%
    assert amt(kind="work_injury_allowance", monthly_wage=3500, treatment_days=120, already_paid=3500) == 8750


def test_sick_leave_100_days():  # art. 117: 30 full + 60 at 75% + 10 unpaid
    assert amt(kind="sick_leave_pay", monthly_wage=3000, sick_days=100) == pytest.approx(3000 + 4500)


def test_damage_deduction_cap_is_five_days_wage():  # art. 91
    assert amt(kind="damage_deduction_cap", monthly_wage=5000) == pytest.approx(833.33)


def test_overtime_rate_uses_basic_for_the_50_percent():  # art. 107
    # actual 6000, basic 4000: 6000/240 + 0.5*4000/240 = 25 + 8.33 per hour
    assert amt(kind="overtime_pay", monthly_wage=6000, basic_monthly_wage=4000, overtime_hours=10) == pytest.approx(333.33)


def test_missing_inputs_are_reported_not_guessed():
    r = calculate(EntitlementInputs(kind="end_of_service", monthly_wage=8000))
    assert r.amount is None and r.missing_inputs == ["service_years"]


def test_service_years_computed_from_dates_not_by_the_model():
    from datetime import date

    r = calculate(
        EntitlementInputs(kind="end_of_service", monthly_wage=7500, service_start_date="2019-03-01", service_end_date="2025-03-01"),
    )
    assert r.amount == pytest.approx(7500 / 2 * 5 + 7500 * 1, rel=1e-3)  # 6 years
    assert "2019/03/01" in r.formula_ar
    ongoing = calculate(EntitlementInputs(kind="end_of_service", monthly_wage=6000, service_start_date="2020-01-01"), as_of=date(2022, 1, 1))
    assert ongoing.amount == pytest.approx(6000, rel=1e-2)  # 2 years until the analysis date
    bad = calculate(EntitlementInputs(kind="end_of_service", monthly_wage=6000, service_start_date="not a date"))
    assert bad.amount is None and bad.missing_inputs == ["service_years"]


def test_facts_stated_once_are_shared_across_entitlements():
    from app.entitlements import share_facts

    items = share_facts([
        EntitlementInputs(kind="end_of_service", monthly_wage=7500, service_start_date="2019-03-01", service_end_date="2025-03-01"),
        EntitlementInputs(kind="unlawful_termination_compensation", contract_type="indefinite"),
        EntitlementInputs(kind="notice_compensation", terminated_by="employer"),
    ])
    results = [calculate(i) for i in items]
    assert results[1].amount == pytest.approx(7500 / 30 * 15 * 6, rel=1e-3)  # art. 77 now computed
    assert results[2].amount == 15000 and "مدة الخدمة" not in results[2].formula_ar  # no years note on notice pay

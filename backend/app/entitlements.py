"""Money calculations under the Saudi Labor Law, done in code instead of by the LLM.

The LLM identifies WHICH entitlements apply and extracts the inputs (wage,
years of service, ...) from the case; these functions compute the amounts.
In the blind test the LLM applied the right rule but miscalculated, so
arithmetic is no longer left to it.

Conventions: a month is 30 days (daily wage = monthly / 30) and a working day
is 8 hours (art. 98). "wage" means the actual wage incl. regular allowances
(art. 2), unless the article says basic wage.
"""
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field

DAYS_PER_MONTH = 30
HOURS_PER_DAY = 8

EntitlementKind = Literal[
    "end_of_service",
    "unlawful_termination_compensation",
    "notice_compensation",
    "unpaid_wages",
    "overtime_pay",
    "work_injury_allowance",
    "sick_leave_pay",
    "damage_deduction_cap",
]


class EntitlementInputs(BaseModel):
    """What the LLM fills in. Unknown values stay null; nothing is guessed."""

    kind: EntitlementKind
    monthly_wage: float | None = Field(default=None, description="الأجر الفعلي الشهري شاملاً البدلات الثابتة، بالريال")
    basic_monthly_wage: float | None = Field(default=None, description="الأجر الأساسي الشهري إن ذُكر منفصلاً")
    service_years: float | None = Field(default=None, description="مدة الخدمة بالسنوات (مثلاً 4.5)")
    contract_type: Literal["indefinite", "fixed"] | None = Field(default=None, description="غير محدد المدة / محدد المدة")
    remaining_contract_months: float | None = Field(default=None, description="المدة المتبقية من العقد المحدد بالأشهر")
    terminated_by: Literal["employer", "worker"] | None = Field(default=None, description="من أنهى العقد")
    is_resignation: bool | None = Field(default=None, description="هل انتهت العلاقة باستقالة العامل")
    full_award_exception: bool | None = Field(
        default=None,
        description="قوة قاهرة، أو عاملة أنهت العقد خلال 6 أشهر من زواجها أو 3 أشهر من وضعها (م87)",
    )
    unpaid_months: float | None = Field(default=None, description="عدد أشهر الأجر غير المدفوع")
    overtime_hours: float | None = Field(default=None, description="إجمالي ساعات العمل الإضافية المطلوب حسابها")
    treatment_days: float | None = Field(default=None, description="مدة العلاج من إصابة العمل بالأيام")
    sick_days: float | None = Field(default=None, description="أيام الإجازة المرضية خلال السنة")
    already_paid: float | None = Field(default=None, description="ما دفعه صاحب العمل فعلاً من هذا المستحق")


class EntitlementResult(BaseModel):
    kind: EntitlementKind
    title_ar: str
    article: str  # Labor Law article number the formula comes from
    amount: float | None  # None when required inputs are missing
    formula_ar: str
    missing_inputs: list[str] = []


TITLES = {
    "end_of_service": ("مكافأة نهاية الخدمة", "84"),
    "unlawful_termination_compensation": ("التعويض عن الإنهاء لسبب غير مشروع", "77"),
    "notice_compensation": ("التعويض عن عدم مراعاة مهلة الإشعار", "76"),
    "unpaid_wages": ("الأجور المتأخرة", "90"),
    "overtime_pay": ("أجر العمل الإضافي", "107"),
    "work_injury_allowance": ("المعونة المالية لإصابة العمل (عجز مؤقت)", "137"),
    "sick_leave_pay": ("أجر الإجازة المرضية", "117"),
    "damage_deduction_cap": ("الحد الأقصى للحسم الشهري مقابل الإتلاف", "91"),
}


@dataclass
class _Calc:
    amount: float
    formula: str
    article: str | None = None  # override (e.g. art. 85 for resignations)


def _r(x: float) -> float:
    return round(x, 2)


def _fmt(x: float) -> str:
    return f"{x:,.2f}".rstrip("0").rstrip(".")


def end_of_service(wage: float, years: float, is_resignation: bool, full_award_exception: bool) -> _Calc:
    first = min(years, 5)
    rest = max(years - 5, 0)
    full = wage / 2 * first + wage * rest
    formula = f"نصف أجر شهر × {_fmt(first)} سنة"
    if rest:
        formula += f" + أجر شهر × {_fmt(rest)} سنة"
    formula += f" = {_fmt(full)} ريال (م84)"
    if not is_resignation or full_award_exception:
        if is_resignation and full_award_exception:
            formula += "؛ تستحق كاملة استثناءً (م87)"
        return _Calc(_r(full), formula)
    # art. 85: resignation
    if years < 2:
        share, label = 0.0, "لا شيء (أقل من سنتين)"
    elif years <= 5:
        share, label = 1 / 3, "الثلث (من سنتين إلى خمس سنوات)"
    elif years < 10:
        share, label = 2 / 3, "الثلثان (أكثر من خمس وأقل من عشر سنوات)"
    else:
        share, label = 1.0, "كاملة (عشر سنوات فأكثر)"
    amount = full * share
    return _Calc(_r(amount), f"{formula}؛ استقالة ← {label} = {_fmt(amount)} ريال (م85)", article="85")


def unlawful_termination(wage: float, contract_type: str, years: float | None, remaining_months: float | None) -> _Calc:
    floor = wage * 2
    if contract_type == "indefinite":
        base = wage / DAYS_PER_MONTH * 15 * years
        formula = f"أجر 15 يوماً × {_fmt(years)} سنة = {_fmt(base)} ريال"
    else:
        base = wage * remaining_months
        formula = f"أجر المدة الباقية {_fmt(remaining_months)} شهر × {_fmt(wage)} = {_fmt(base)} ريال"
    if base < floor:
        return _Calc(_r(floor), f"{formula}؛ أقل من الحد الأدنى (أجر شهرين) ← {_fmt(floor)} ريال (م77)")
    return _Calc(_r(base), formula + " (م77)")


def notice_compensation(wage: float, terminated_by: str) -> _Calc:
    days = 60 if terminated_by == "employer" else 30
    amount = wage / DAYS_PER_MONTH * days
    who = "صاحب العمل" if terminated_by == "employer" else "العامل"
    return _Calc(_r(amount), f"مهلة الإشعار عند الإنهاء من {who} {days} يوماً (م75) ← أجر {days} يوماً = {_fmt(amount)} ريال (م76)")


def overtime_pay(wage: float, basic: float, hours: float) -> _Calc:
    hourly = wage / DAYS_PER_MONTH / HOURS_PER_DAY
    extra = 0.5 * basic / DAYS_PER_MONTH / HOURS_PER_DAY
    amount = (hourly + extra) * hours
    return _Calc(
        _r(amount),
        f"أجر الساعة {_fmt(hourly)} + 50% من الأجر الأساسي للساعة {_fmt(extra)} = {_fmt(hourly + extra)} ريال × {_fmt(hours)} ساعة = {_fmt(amount)} ريال",
    )


def work_injury(wage: float, treatment_days: float) -> _Calc:
    daily = wage / DAYS_PER_MONTH
    days = min(treatment_days, 365)
    full_days = min(days, 60)
    partial_days = max(days - 60, 0)
    amount = daily * full_days + daily * 0.75 * partial_days
    formula = f"أجر كامل × {_fmt(full_days)} يوماً"
    if partial_days:
        formula += f" + 75% من الأجر × {_fmt(partial_days)} يوماً"
    return _Calc(_r(amount), f"{formula} = {_fmt(amount)} ريال")


def sick_leave(wage: float, sick_days: float) -> _Calc:
    daily = wage / DAYS_PER_MONTH
    full = min(sick_days, 30)
    three_quarters = min(max(sick_days - 30, 0), 60)
    unpaid = min(max(sick_days - 90, 0), 30)
    amount = daily * full + daily * 0.75 * three_quarters
    formula = f"أجر كامل × {_fmt(full)} يوماً"
    if three_quarters:
        formula += f" + ¾ الأجر × {_fmt(three_quarters)} يوماً"
    if unpaid:
        formula += f" + بدون أجر × {_fmt(unpaid)} يوماً"
    return _Calc(_r(amount), f"{formula} = {_fmt(amount)} ريال")


def damage_cap(wage: float) -> _Calc:
    amount = wage / DAYS_PER_MONTH * 5
    return _Calc(_r(amount), f"أجر خمسة أيام في الشهر = {_fmt(wage)} ÷ 30 × 5 = {_fmt(amount)} ريال كحد أقصى شهرياً")


def calculate(inp: EntitlementInputs) -> EntitlementResult:
    title, article = TITLES[inp.kind]
    wage = inp.monthly_wage or inp.basic_monthly_wage
    needed: dict[str, object] = {"monthly_wage": wage}

    if inp.kind == "end_of_service":
        needed["service_years"] = inp.service_years
    elif inp.kind == "unlawful_termination_compensation":
        needed["contract_type"] = inp.contract_type
        if inp.contract_type == "indefinite":
            needed["service_years"] = inp.service_years
        elif inp.contract_type == "fixed":
            needed["remaining_contract_months"] = inp.remaining_contract_months
    elif inp.kind == "notice_compensation":
        needed["terminated_by"] = inp.terminated_by
    elif inp.kind == "unpaid_wages":
        needed["unpaid_months"] = inp.unpaid_months
    elif inp.kind == "overtime_pay":
        needed["overtime_hours"] = inp.overtime_hours
    elif inp.kind == "work_injury_allowance":
        needed["treatment_days"] = inp.treatment_days
    elif inp.kind == "sick_leave_pay":
        needed["sick_days"] = inp.sick_days

    missing = [k for k, v in needed.items() if v is None]
    if missing:
        return EntitlementResult(
            kind=inp.kind, title_ar=title, article=article, amount=None,
            formula_ar="لا يمكن الحساب لنقص معلومات لازمة", missing_inputs=missing,
        )

    match inp.kind:
        case "end_of_service":
            calc = end_of_service(wage, inp.service_years, bool(inp.is_resignation), bool(inp.full_award_exception))
        case "unlawful_termination_compensation":
            calc = unlawful_termination(wage, inp.contract_type, inp.service_years, inp.remaining_contract_months)
        case "notice_compensation":
            calc = notice_compensation(wage, inp.terminated_by)
        case "unpaid_wages":
            amount = wage * inp.unpaid_months
            calc = _Calc(_r(amount), f"{_fmt(wage)} × {_fmt(inp.unpaid_months)} شهر = {_fmt(amount)} ريال")
        case "overtime_pay":
            calc = overtime_pay(wage, inp.basic_monthly_wage or wage, inp.overtime_hours)
        case "work_injury_allowance":
            calc = work_injury(wage, inp.treatment_days)
        case "sick_leave_pay":
            calc = sick_leave(wage, inp.sick_days)
        case "damage_deduction_cap":
            calc = damage_cap(wage)

    amount, formula = calc.amount, calc.formula
    if inp.already_paid and inp.kind != "damage_deduction_cap":
        remaining = _r(max(amount - inp.already_paid, 0))
        formula += f"؛ ناقص ما دُفع {_fmt(inp.already_paid)} ← المتبقي {_fmt(remaining)} ريال"
        amount = remaining
    return EntitlementResult(
        kind=inp.kind, title_ar=title, article=calc.article or article, amount=amount, formula_ar=formula
    )

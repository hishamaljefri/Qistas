from app.privacy import mask, unmask


def test_ids_phones_iban_email_are_masked():
    text = (
        "رقم هويتي 1098765432 وإقامة زميلي ٢٤٥٦٧٨٩٠١٢، جوالي 0551234567 و+966 55 123 4568، "
        "الآيبان SA03 8000 0000 6080 1016 7519 وإيميلي ali.s@mail.com"
    )
    r = mask(text)
    for value in ["1098765432", "2456789012", "0551234567", "SA03", "ali.s@mail.com"]:
        assert value not in r.masked_text
    assert r.counts == {"NATIONAL_ID": 2, "PHONE": 2, "IBAN": 1, "EMAIL": 1}


def test_salary_and_dates_are_kept():
    r = mask("راتبي 100000 ريال سنويا وبدأت العمل عام 2019 لمدة 5 سنوات")
    assert "100000" in r.masked_text and "2019" in r.masked_text and r.mapping == {}


def test_form_names_and_their_parts_are_masked():
    r = mask(
        "أنا محمد أحمد العتيبي، فصلني مدير شركة الأفق للتقنية. قال لي إن العتيبي لا يلتزم بالدوام.",
        employee_name="محمد أحمد العتيبي",
        employer_name="شركة الأفق للتقنية",
    )
    assert "العتيبي" not in r.masked_text and "الأفق" not in r.masked_text
    assert "[EMPLOYEE_1]" in r.masked_text and "[EMPLOYER_1]" in r.masked_text


def test_company_after_lead_word_is_masked_but_descriptions_are_not():
    r = mask("كنت أعمل في شركة النخبة المتحدة منذ 2018، وهي شركة كبيرة في جدة")
    assert "النخبة" not in r.masked_text
    assert "شركة كبيرة" in r.masked_text


def test_reference_number_after_label_is_masked():
    r = mask("رقم العقد 55-2021/778 ورقم القضية 4471230")
    assert "778" not in r.masked_text and "4471230" not in r.masked_text


def test_unmask_restores_nested_values():
    r = mask("اسمي سعد الحربي وجوالي 0501112223")
    restored = unmask({"a": [r.masked_text], "b": "اتصل على [PHONE_1]"}, r.mapping)
    assert "0501112223" in restored["b"] and "سعد الحربي" in restored["a"][0]


def test_documents_share_numbering_with_description():
    from app.privacy import mask_many

    texts, mapping = mask_many(
        ["أعمل في شركة النخبة المتحدة وجوالي 0551234567", "عقد عمل بين شركة النخبة المتحدة والموظف"]
    )
    assert all("[EMPLOYER_1]" in t and "النخبة" not in t for t in texts)
    assert mapping["[EMPLOYER_1]"] == "النخبة المتحدة"


def test_edited_case_keeps_existing_placeholders():
    from app.privacy import mask_many

    _, first = mask_many(["اسمي سعد الحربي وجوالي 0501112223"], employee_name="سعد الحربي")
    (edited,), second = mask_many(["سعد الحربي يضيف: جوالي الجديد 0559999999"], existing=first)
    assert "[EMPLOYEE_1]" in edited and "[PHONE_2]" in edited
    assert second["[PHONE_1]"] == "0501112223" and second["[PHONE_2]"] == "0559999999"


def test_short_form_of_a_known_name_is_masked_once():
    from app.privacy import mask_many

    (masked,), _ = mask_many(["خالد الغامدي يعمل لدى الريادة"], existing={"[EMPLOYEE_1]": "خالد سعد الغامدي", "[EMPLOYER_1]": "الريادة للمقاولات"})
    assert masked == "[EMPLOYEE_1] يعمل لدى [EMPLOYER_1]"

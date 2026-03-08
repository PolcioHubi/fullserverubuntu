"""
Legitymacja studencka template replacer — uses data-placeholder attributes.
"""
from datetime import datetime

import bleach


def replace_html_data_student_id(soup, new_data):
    """
    Replace data in the Legitymacja studencka HTML template using data-placeholder attributes.
    Sanitizes all input values to prevent XSS.
    """

    def safe_get(key, default=""):
        value = new_data.get(key, default)
        return bleach.clean(
            str(value) if value is not None else default,
            tags=[],
            attributes={},
            strip=True,
        )

    def set_placeholder(name, value):
        el = soup.find(attrs={"data-placeholder": name})
        if el:
            el.string = value

    # Personal data (shared fields from the form)
    set_placeholder("student_first_name", safe_get("imie"))
    set_placeholder("student_last_name", safe_get("nazwisko"))
    set_placeholder("student_birthday", safe_get("data_urodzenia"))
    set_placeholder("student_pesel", safe_get("pesel"))

    # Student ID specific fields
    set_placeholder("student_issue", safe_get("sti_data_wydania"))
    # student_number is used for both "Nazwa uczelni" and "Numer albumu"
    for el in soup.find_all(attrs={"data-placeholder": "student_number"}):
        el.string = safe_get("sti_uczelnia")

    # Last update timestamp
    now_str = datetime.now().strftime("%d.%m.%Y, %H:%M")
    set_placeholder("student_last_update", now_str)

    # Photo — src will be set by app.py via url_for after this function returns
    img_tag = soup.find("img", id="user_photo")
    if img_tag and new_data.get("image_filename"):
        pass

    return soup

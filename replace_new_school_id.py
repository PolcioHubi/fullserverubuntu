"""
Legitymacja szkolna template replacer — uses data-placeholder attributes.
"""
from datetime import datetime

import bleach


def replace_html_data_school_id(soup, new_data):
    """
    Replace data in the Legitymacja szkolna HTML template using data-placeholder attributes.
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
        for el in soup.find_all(attrs={"data-placeholder": name}):
            el.string = value

    # Personal data (shared fields from the form)
    set_placeholder("school_first_name", safe_get("imie"))
    set_placeholder("school_last_name", safe_get("nazwisko"))
    set_placeholder("school_birthday", safe_get("data_urodzenia"))
    set_placeholder("school_pesel", safe_get("pesel"))

    # School ID specific fields
    set_placeholder("school_number", safe_get("si_numer"))
    set_placeholder("school_issue", safe_get("si_data_wydania"))
    set_placeholder("school_expiration", safe_get("si_data_waznosci"))

    # Additional details
    set_placeholder("school_name", safe_get("si_nazwa_szkoly"))
    set_placeholder("school_address", safe_get("si_adres"))
    set_placeholder("school_principal", safe_get("si_dyrektor"))
    set_placeholder("school_phone", safe_get("si_telefon"))

    # Last update timestamp
    now_str = datetime.now().strftime("%d.%m.%Y, %H:%M")
    set_placeholder("school_last_update", now_str)

    # Photo — src will be set by app.py via url_for after this function returns
    img_tag = soup.find("img", id="user_photo")
    if img_tag and new_data.get("image_filename"):
        pass

    return soup

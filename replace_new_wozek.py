"""
Uprawnienie na wozek widlowy template replacer — uses data-placeholder attributes.
"""
from datetime import datetime

import bleach


def replace_html_data_wozek(soup, new_data):
    """
    Replace data in the Wozek HTML template using data-placeholder attributes.
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

    set_placeholder("wozek_first_name", safe_get("imie"))
    set_placeholder("wozek_last_name", safe_get("nazwisko"))
    set_placeholder("wozek_birthdate", safe_get("data_urodzenia"))
    set_placeholder("wozek_pesel", safe_get("pesel"))
    set_placeholder("wozek_category", safe_get("wozek_kategoria"))
    set_placeholder("wozek_number", safe_get("wozek_numer"))
    set_placeholder("wozek_issue", safe_get("wozek_data_wydania"))
    set_placeholder("wozek_expiration", safe_get("wozek_data_waznosci"))
    set_placeholder("wozek_issuer", safe_get("wozek_organ"))
    set_placeholder("wozek_scope", safe_get("wozek_zakres"))
    set_placeholder("wozek_certificate", safe_get("wozek_zaswiadczenie"))

    now_str = datetime.now().strftime("%d.%m.%Y, %H:%M")
    set_placeholder("wozek_last_update", now_str)

    return soup

"""
mPrawo Jazdy template replacer — uses data-placeholder attributes.
"""
from datetime import datetime

import bleach


def replace_html_data_mprawojazdy(soup, new_data):
    """
    Replace data in the mPrawo Jazdy HTML template using data-placeholder attributes.
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
    set_placeholder("mprawojazdy_first_name", safe_get("imie"))
    set_placeholder("mprawojazdy_last_name", safe_get("nazwisko"))
    set_placeholder("mprawojazdy_birthday", safe_get("data_urodzenia"))
    set_placeholder("mprawojazdy_pesel", safe_get("pesel"))

    # Driving licence specific fields
    set_placeholder("mprawojazdy_categories", safe_get("pj_kategorie"))
    set_placeholder("mprawojazdy_issue", safe_get("pj_data_wydania"))
    set_placeholder("mprawojazdy_number", safe_get("pj_numer"))
    set_placeholder("mprawojazdy_blank", safe_get("pj_blankiet"))
    set_placeholder("mprawojazdy_issuer", safe_get("pj_organ"))
    set_placeholder("mprawojazdy_restrictions", safe_get("pj_ograniczenia"))

    # Last update timestamp
    now_str = datetime.now().strftime("%d.%m.%Y, %H:%M")
    set_placeholder("mprawojazdy_last_update", now_str)

    # Photo — src will be set by app.py via url_for after this function returns
    img_tag = soup.find("img", id="user_photo")
    if img_tag and new_data.get("image_filename"):
        pass

    return soup
